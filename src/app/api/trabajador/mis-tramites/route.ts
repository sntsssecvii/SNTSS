import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { calcularPosiciones } from '@/lib/bolsa-de-trabajo/calculos'
import { getComparisonRecordsForWorker } from '@/lib/bolsa-de-trabajo/comparison-groups'
import { getBolsaPosicionesMaterializadasPorMatricula } from '@/lib/firebase/bolsa-posiciones-materializadas'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'
import type { BolsaDeTrabajoRegistro, Sincronizacion, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

export const dynamic = 'force-dynamic'

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length).trim()
}

function hasUsableMaterializedRecord(record: { recordId?: string | null }) {
  return Boolean(record.recordId?.trim())
}

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, { bucket: 'api:trabajador:mis-tramites', limit: 60, windowMs: 60_000 })
    const idToken = getBearerToken(request)

    if (!idToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken)
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get()

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado.' }, { status: 404 })
    }

    const userData = userDoc.data() as { matricula?: string; status?: string } | undefined
    const matricula = userData?.matricula?.trim().toUpperCase()

    if (!matricula) {
      return NextResponse.json({ error: 'El usuario autenticado no tiene matrícula vinculada.' }, { status: 400 })
    }

    if (userData?.status && userData.status !== 'active') {
      return NextResponse.json({ error: 'La cuenta no está activa para consultar información.' }, { status: 403 })
    }

    const syncSnap = await adminDb
      .collection('sincronizaciones')
      .where('esFuenteVerdad', '==', true)
      .limit(1)
      .get()

    if (syncSnap.empty) {
      return NextResponse.json({ error: 'No hay información oficial activa en este momento.' }, { status: 404 })
    }

    const syncActiva = {
      id: syncSnap.docs[0].id,
      ...syncSnap.docs[0].data()
    } as Sincronizacion

    const tramitesMaterializados = (await getBolsaPosicionesMaterializadasPorMatricula(syncActiva.id, matricula))
      .filter(hasUsableMaterializedRecord)

    if (tramitesMaterializados.length === 0) {
      const docsSnap = await adminDb
        .collection('bolsa_de_trabajo_documentos')
        .where('syncId', '==', syncActiva.id)
        .get()

      if (docsSnap.empty) {
        return NextResponse.json({ error: 'No se encontraron listados para esta quincena.' }, { status: 404 })
      }

      const resultadosFallback = await Promise.all(docsSnap.docs.map(async (docSnap) => {
        const tipoDocumento = docSnap.get('tipo') as TipoBolsaDeTrabajo
        const registrosSnap = await docSnap.ref
          .collection('registros')
          .where('matricula', '==', matricula)
          .get()

        if (registrosSnap.empty) return []

        const allRegistrosSnap = await docSnap.ref.collection('registros').get()
        const registros = allRegistrosSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as BolsaDeTrabajoRegistro[]

        return registrosSnap.docs
          .map((registroDoc) => ({
            id: registroDoc.id,
            ...registroDoc.data(),
          }) as BolsaDeTrabajoRegistro)
          .map((workerRecord) => {
            const comparisonRecords = getComparisonRecordsForWorker(registros, workerRecord, tipoDocumento)
            const resultado = calcularPosiciones(comparisonRecords, matricula, tipoDocumento, {
              targetRecordId: workerRecord.id,
            })

            return resultado ? {
              ...resultado,
              recordId: workerRecord.id,
              tipoDocumento,
              documentoId: docSnap.id,
            } : null
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      }))

      const tramitesFallback = resultadosFallback
        .flat()
        .sort((a, b) => a.tipoDocumento.localeCompare(b.tipoDocumento))

      if (tramitesFallback.length === 0) {
        return NextResponse.json({
          error: 'No se encontraron trámites vigentes para la matrícula autenticada.',
          matricula,
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        matricula,
        data: tramitesFallback,
        periodo: {
          anio: syncActiva.anio,
          mes: syncActiva.mes,
          quincena: syncActiva.quincena,
        },
      })
    }

    const tramites = tramitesMaterializados
      .map((item) => ({
        ...item,
        registro: item.grupoComparable?.registro,
      }))
      .sort((a, b) => a.tipoDocumento.localeCompare(b.tipoDocumento))

    if (tramites.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron trámites vigentes para la matrícula autenticada.',
        matricula,
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      matricula,
      data: tramites,
      periodo: {
        anio: syncActiva.anio,
        mes: syncActiva.mes,
        quincena: syncActiva.quincena,
      },
    })
  } catch (error: any) {
    console.error('Error en mis tramites:', error)

    if (error instanceof RateLimitError || error?.message === 'RATE_LIMITED') {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds || 60) } }
      )
    }

    if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error') {
      return NextResponse.json({ error: 'La sesión expiró. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    if (error?.code === 'auth/invalid-id-token') {
      return NextResponse.json({ error: 'La sesión no es válida. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}

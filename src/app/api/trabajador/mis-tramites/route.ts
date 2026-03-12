import { NextRequest, NextResponse } from 'next/server'
import { getFuenteVerdad } from '@/lib/firebase/sincronizaciones'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { calcularPosiciones } from '@/lib/bolsa-de-trabajo/calculos'
import { getComparisonRecordsForWorker } from '@/lib/bolsa-de-trabajo/comparison-groups'
import type { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

interface DocumentoEncontrado {
  docId: string
  tipoDocumento: TipoBolsaDeTrabajo
  registro: BolsaDeTrabajoRegistro
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length).trim()
}

export async function GET(request: NextRequest) {
  try {
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

    const syncActiva = await getFuenteVerdad()
    if (!syncActiva) {
      return NextResponse.json({ error: 'No hay información oficial activa en este momento.' }, { status: 404 })
    }

    const docsSnap = await adminDb
      .collection('bolsa_de_trabajo_documentos')
      .where('syncId', '==', syncActiva.id)
      .get()

    if (docsSnap.empty) {
      return NextResponse.json({ error: 'No se encontraron listados para esta quincena.' }, { status: 404 })
    }

    const documentosEncontrados: DocumentoEncontrado[] = []

    for (const docSnap of docsSnap.docs) {
      const tipoDocumento = docSnap.get('tipo') as TipoBolsaDeTrabajo
      const registrosSnap = await docSnap.ref
        .collection('registros')
        .where('matricula', '==', matricula)
        .limit(1)
        .get()

      if (registrosSnap.empty) continue

      documentosEncontrados.push({
        docId: docSnap.id,
        tipoDocumento,
        registro: {
          id: registrosSnap.docs[0].id,
          ...registrosSnap.docs[0].data(),
        } as BolsaDeTrabajoRegistro,
      })
    }

    if (documentosEncontrados.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron trámites vigentes para la matrícula autenticada.',
        matricula,
      }, { status: 404 })
    }

    const resultados = await Promise.all(documentosEncontrados.map(async ({ docId, tipoDocumento, registro }) => {
      const registrosSnap = await adminDb
        .collection('bolsa_de_trabajo_documentos')
        .doc(docId)
        .collection('registros')
        .get()

      const registros = registrosSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as BolsaDeTrabajoRegistro[]

      const comparisonRecords = getComparisonRecordsForWorker(registros, registro, tipoDocumento)
      const resultado = calcularPosiciones(comparisonRecords, matricula, tipoDocumento)

      return resultado ? {
        ...resultado,
        tipoDocumento,
        documentoId: docId,
      } : null
    }))

    const tramites = resultados
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.tipoDocumento.localeCompare(b.tipoDocumento))

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

import { NextRequest, NextResponse } from 'next/server'
import { getFuenteVerdad } from '@/lib/firebase/sincronizaciones'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { calcularPosiciones } from '@/lib/bolsa-de-trabajo/calculos'
import { getComparisonRecordsForWorker } from '@/lib/bolsa-de-trabajo/comparison-groups'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'
import type { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length).trim()
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentoId: string }> }
) {
  try {
    enforceRateLimit(request, { bucket: 'api:trabajador:mi-tramite-detalle', limit: 90, windowMs: 60_000 })
    const idToken = getBearerToken(request)
    if (!idToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { documentoId } = await params
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

    const documentoRef = adminDb.collection('bolsa_de_trabajo_documentos').doc(documentoId)
    const documentoSnap = await documentoRef.get()

    if (!documentoSnap.exists) {
      return NextResponse.json({ error: 'Trámite no encontrado.' }, { status: 404 })
    }

    if (documentoSnap.get('syncId') !== syncActiva.id) {
      return NextResponse.json({ error: 'El trámite no pertenece al corte oficial vigente.' }, { status: 404 })
    }

    const tipoDocumento = documentoSnap.get('tipo') as TipoBolsaDeTrabajo

    const registroSnap = await documentoRef
      .collection('registros')
      .where('matricula', '==', matricula)
      .limit(1)
      .get()

    if (registroSnap.empty) {
      return NextResponse.json({ error: 'El trámite solicitado no pertenece al usuario autenticado.' }, { status: 403 })
    }

    const registrosSnap = await documentoRef.collection('registros').get()
    const registros = registrosSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BolsaDeTrabajoRegistro[]
    const workerRecord = {
      id: registroSnap.docs[0].id,
      ...registroSnap.docs[0].data(),
    } as BolsaDeTrabajoRegistro

    const comparisonRecords = getComparisonRecordsForWorker(registros, workerRecord, tipoDocumento)
    const resultado = calcularPosiciones(comparisonRecords, matricula, tipoDocumento)
    if (!resultado) {
      return NextResponse.json({ error: 'No se pudo calcular el detalle del trámite.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...resultado,
        tipoDocumento,
        documentoId,
      },
      periodo: {
        anio: syncActiva.anio,
        mes: syncActiva.mes,
        quincena: syncActiva.quincena,
      },
    })
  } catch (error: any) {
    console.error('Error en detalle de tramite:', error)

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

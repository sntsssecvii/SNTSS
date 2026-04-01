import { NextRequest, NextResponse } from 'next/server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAdminRequest } from '@/lib/firebase/server-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'
import type { EstadoProcesamiento, Sincronizacion, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

const TIPOS_REQUERIDOS = 8

type BolsaDocumentoLite = {
  id: string
  syncId?: string
  tipo: TipoBolsaDeTrabajo
  estado: EstadoProcesamiento
  totalRegistros: number
  nombreArchivo?: string
}

type QuincenaResumenResponse = {
  sync: Sincronizacion
  documentos: BolsaDocumentoLite[]
  tiposCargados: number
  completados: number
  errores: number
  procesando: number
  totalRegistros: number
  estadoUI: 'PUBLICADA' | 'LISTA' | 'INCOMPLETA' | 'CON_ERROR' | 'BORRADOR'
}

function convertirTimestamp(timestamp: any): Date {
  if (timestamp?.toDate) return timestamp.toDate()
  if (timestamp instanceof Date) return timestamp
  return new Date()
}

function convertirSincronizacion(doc: any): Sincronizacion {
  const data = doc.data()
  return {
    id: doc.id,
    anio: data.anio,
    mes: data.mes,
    quincena: data.quincena,
    estado: data.estado,
    fechaInicio: convertirTimestamp(data.fechaInicio),
    fechaFinalizacion: data.fechaFinalizacion ? convertirTimestamp(data.fechaFinalizacion) : undefined,
    archivosSubidos: data.archivosSubidos || [],
    esFuenteVerdad: data.esFuenteVerdad || false,
    subidoPor: data.subidoPor,
    subidoPorEmail: data.subidoPorEmail,
  }
}

function getEstadoUI(sync: Sincronizacion, documentos: BolsaDocumentoLite[]): QuincenaResumenResponse['estadoUI'] {
  if (sync.esFuenteVerdad) return 'PUBLICADA'
  if (documentos.some((doc) => doc.estado === 'ERROR')) return 'CON_ERROR'
  if (documentos.length === 0) return 'BORRADOR'
  if (documentos.length < TIPOS_REQUERIDOS) return 'INCOMPLETA'
  return 'LISTA'
}

function getPeriodoKey(sync: Sincronizacion) {
  return `${sync.anio}-${sync.mes}-${sync.quincena}`
}

function getResumenScore(item: QuincenaResumenResponse) {
  const baseDate = item.sync.fechaFinalizacion || item.sync.fechaInicio
  const timestamp = baseDate instanceof Date ? baseDate.getTime() : 0
  const estadoScore = item.estadoUI === 'PUBLICADA'
    ? 4
    : item.estadoUI === 'LISTA'
      ? 3
      : item.estadoUI === 'INCOMPLETA'
        ? 2
        : item.estadoUI === 'CON_ERROR'
          ? 1
          : 0

  return (estadoScore * 1_000_000_000_000) + (item.tiposCargados * 1_000_000_000) + timestamp
}

function consolidarResumenesPorPeriodo(items: QuincenaResumenResponse[]) {
  const grouped = new Map<string, QuincenaResumenResponse[]>()

  items.forEach((item) => {
    const key = getPeriodoKey(item.sync)
    const bucket = grouped.get(key) || []
    bucket.push(item)
    grouped.set(key, bucket)
  })

  return Array.from(grouped.values())
    .map((bucket) => bucket.sort((a, b) => getResumenScore(b) - getResumenScore(a))[0])
    .sort((a, b) => getResumenScore(b) - getResumenScore(a))
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, { bucket: 'api:admin:bolsa:quincenas', limit: 40, windowMs: 60_000 })
    await requireAdminRequest(request)

    const limite = Math.min(Number(request.nextUrl.searchParams.get('limit') || '30'), 60)
    const syncSnapshot = await adminDb
      .collection('sincronizaciones')
      .orderBy('fechaInicio', 'desc')
      .limit(limite)
      .get()

    const sincronizaciones = syncSnapshot.docs.map(convertirSincronizacion)
    const syncIds = sincronizaciones.map((sync) => sync.id).filter(Boolean)

    let documentos: BolsaDocumentoLite[] = []
    if (syncIds.length > 0) {
      const chunks: string[][] = []
      for (let i = 0; i < syncIds.length; i += 10) {
        chunks.push(syncIds.slice(i, i + 10))
      }

      const snapGroups = await Promise.all(
        chunks.map((chunk) =>
          adminDb.collection('bolsa_de_trabajo_documentos').where('syncId', 'in', chunk).get()
        )
      )

      documentos = snapGroups.flatMap((snapshot) =>
        snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            syncId: data.syncId,
            tipo: data.tipo,
            estado: data.estado,
            totalRegistros: Number(data.totalRegistros || 0),
            nombreArchivo: data.nombreArchivo || '',
          } as BolsaDocumentoLite
        })
      )
    }

    const docsMap = documentos.reduce((acc, doc) => {
      if (!doc.syncId) return acc
      const list = acc.get(doc.syncId) || []
      list.push(doc)
      acc.set(doc.syncId, list)
      return acc
    }, new Map<string, BolsaDocumentoLite[]>())

    const items = sincronizaciones.map((sync) => {
      const docs = docsMap.get(sync.id) || []
      return {
        sync,
        documentos: docs,
        totalRegistros: docs.reduce((sum, doc) => sum + (doc.totalRegistros || 0), 0),
        tiposCargados: new Set(docs.map((doc) => doc.tipo)).size,
        completados: docs.filter((doc) => doc.estado === 'COMPLETADO').length,
        errores: docs.filter((doc) => doc.estado === 'ERROR').length,
        procesando: docs.filter((doc) => doc.estado === 'PROCESANDO' || doc.estado === 'VALIDANDO').length,
        estadoUI: getEstadoUI(sync, docs),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        resumenes: consolidarResumenesPorPeriodo(items),
      },
    })
  } catch (error: any) {
    console.error('Error obteniendo resumen de quincenas de bolsa:', error)

    if (error instanceof RateLimitError || error?.message === 'RATE_LIMITED') {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds || 60) } }
      )
    }

    if (error?.message === 'AUTH_REQUIRED') {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    if (error?.message === 'PROFILE_NOT_FOUND') {
      return NextResponse.json({ error: 'Perfil de administrador no encontrado.' }, { status: 404 })
    }

    if (error?.message === 'ACCOUNT_INACTIVE') {
      return NextResponse.json({ error: 'La cuenta no está activa.' }, { status: 403 })
    }

    if (error?.message === 'ADMIN_REQUIRED') {
      return NextResponse.json({ error: 'Se requiere perfil de administrador.' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'No se pudieron obtener las quincenas.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

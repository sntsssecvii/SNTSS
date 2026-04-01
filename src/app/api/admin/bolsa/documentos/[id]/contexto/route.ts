import { NextRequest, NextResponse } from 'next/server'

import { getTrabajadoresAntes } from '@/lib/bolsa-de-trabajo/calculos'
import { adminDb } from '@/lib/firebase/admin'
import { requireAdminRequest } from '@/lib/firebase/server-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'
import type { BolsaDeTrabajoDocumento, BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'

function convertirTimestamp(timestamp: any): Date {
  if (timestamp?.toDate) return timestamp.toDate()
  if (timestamp instanceof Date) return timestamp
  return new Date()
}

function convertirDocumento(doc: any): BolsaDeTrabajoDocumento {
  const data = doc.data()
  return {
    id: doc.id,
    syncId: data.syncId,
    tipo: data.tipo,
    fechaActualizacion: convertirTimestamp(data.fechaActualizacion),
    fechaCarga: convertirTimestamp(data.fechaCarga),
    subidoPor: data.subidoPor,
    subidoPorEmail: data.subidoPorEmail,
    estado: data.estado,
    urlArchivo: data.urlArchivo,
    nombreArchivo: data.nombreArchivo,
    metadata: data.metadata || {},
    registros: [],
    errores: data.errores || [],
    version: data.version || 1,
    totalRegistros: data.totalRegistros || 0,
    registrosValidados: data.registrosValidados || 0,
    registrosConErrores: data.registrosConErrores || 0,
  }
}

function convertirRegistro(doc: any): BolsaDeTrabajoRegistro {
  return {
    id: doc.id,
    ...doc.data(),
  } as BolsaDeTrabajoRegistro
}

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdminRequest(request)
    enforceRateLimit(request, {
      bucket: 'api:admin:bolsa:documento-contexto',
      limit: 120,
      windowMs: 60_000,
      identifier: adminUser.uid,
    })

    const { id } = await params
    const recordId = request.nextUrl.searchParams.get('recordId') || ''

    if (!recordId) {
      return NextResponse.json({ error: 'recordId es requerido.' }, { status: 400 })
    }

    const docRef = adminDb.collection('bolsa_de_trabajo_documentos').doc(id)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 })
    }

    const documento = convertirDocumento(docSnap)
    const registrosSnap = await docRef.collection('registros').orderBy('filaOriginal', 'asc').get()
    const registros = registrosSnap.docs.map(convertirRegistro)
    const registro = registros.find((item) => item.id === recordId)

    if (!registro?.matricula) {
      return NextResponse.json({ success: true, data: { trabajadoresAntes: [] } })
    }

    return NextResponse.json({
      success: true,
      data: {
        trabajadoresAntes: getTrabajadoresAntes(registros, registro.matricula, documento.tipo, {
          targetRecordId: recordId,
        }),
      },
    })
  } catch (error: any) {
    console.error('Error obteniendo contexto de documento de bolsa:', error)

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
      { error: 'No se pudo obtener el contexto del documento.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAdminRequest } from '@/lib/firebase/server-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

type UserStatus = 'pending' | 'active' | 'rejected'

function isValidStatus(status: string | null): status is UserStatus {
  return status === 'pending' || status === 'active' || status === 'rejected'
}

function toCreatedAtMs(value: any) {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.seconds === 'number') return value.seconds * 1000
  return null
}

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, { bucket: 'api:admin:validaciones:solicitudes', limit: 60, windowMs: 60_000 })
    await requireAdminRequest(request)

    const status = request.nextUrl.searchParams.get('status')

    if (!isValidStatus(status)) {
      return NextResponse.json({ error: 'Estatus de validación no válido.' }, { status: 400 })
    }

    const snapshot = await adminDb.collection('users').where('status', '==', status).get()

    const requests = snapshot.docs
      .map((doc) => {
        const data = doc.data()

        return {
          uid: doc.id,
          nombre: data.nombre || '',
          apellidoPaterno: data.apellidoPaterno || '',
          apellidoMaterno: data.apellidoMaterno || '',
          matricula: data.matricula || '',
          email: data.email || '',
          curp: data.curp || '',
          status: data.status || status,
          rejectionReason: data.rejectionReason || '',
          documents: {
            identificacion: data.documents?.identificacion || '',
            tarjeton: data.documents?.tarjeton || '',
          },
          createdAtMs: toCreatedAtMs(data.createdAt),
        }
      })
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))

    return NextResponse.json({
      success: true,
      data: {
        requests,
      },
    })
  } catch (error: any) {
    console.error('Error obteniendo solicitudes de validación:', error)

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
      { error: 'No se pudieron obtener las solicitudes.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

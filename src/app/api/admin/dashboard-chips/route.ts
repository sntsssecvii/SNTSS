import { NextRequest, NextResponse } from 'next/server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAdminRequest } from '@/lib/firebase/server-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, { bucket: 'api:admin:dashboard-chips', limit: 60, windowMs: 60_000 })
    await requireAdminRequest(request)

    const usersRef = adminDb.collection('users')
    const documentsRef = adminDb.collection('bolsa_de_trabajo_documentos')

    const [usuariosActivosSnap, validacionesPendientesSnap, documentosProcesadosSnap] = await Promise.all([
      usersRef.where('status', '==', 'active').count().get(),
      usersRef.where('status', '==', 'pending').count().get(),
      documentsRef.count().get(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        usuariosActivos: usuariosActivosSnap.data().count,
        validacionesPendientes: validacionesPendientesSnap.data().count,
        documentosProcesados: documentosProcesadosSnap.data().count,
      },
    })
  } catch (error: any) {
    console.error('Error obteniendo chips del dashboard admin:', error)

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
      { error: 'No se pudieron obtener las métricas del dashboard.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

import { materializeSyncPositions } from '@/lib/bolsa-de-trabajo/materialize-sync-service'
import { writeAdminAuditLog } from '@/lib/firebase/admin-audit'
import { adminDb } from '@/lib/firebase/admin'
import { requireAdminRequest } from '@/lib/firebase/server-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'
import type { PeriodoBolsa } from '@/types/bolsa-de-trabajo'

export const dynamic = 'force-dynamic'

const SYNC_COLLECTION = 'sincronizaciones'

export async function POST(request: NextRequest) {
  let adminUser: Awaited<ReturnType<typeof requireAdminRequest>> | null = null

  try {
    enforceRateLimit(request, { bucket: 'api:bolsa:materializar', limit: 6, windowMs: 60_000 })
    adminUser = await requireAdminRequest(request)

    const body = await request.json().catch(() => null)
    const syncId = typeof body?.syncId === 'string' ? body.syncId.trim() : ''

    if (!syncId) {
      return NextResponse.json({ error: 'syncId requerido.' }, { status: 400 })
    }

    const syncSnap = await adminDb.collection(SYNC_COLLECTION).doc(syncId).get()
    if (!syncSnap.exists) {
      return NextResponse.json({ error: 'La sincronización no existe.' }, { status: 404 })
    }

    const syncData = syncSnap.data() as { anio: number; mes: number; quincena: 1 | 2 }
    const periodo: PeriodoBolsa = {
      anio: syncData.anio,
      mes: syncData.mes,
      quincena: syncData.quincena,
    }

    const result = await materializeSyncPositions(syncId, periodo)

    await writeAdminAuditLog({
      action: 'BOLSA_MATERIALIZAR_SYNC',
      actorUid: adminUser.uid,
      actorEmail: adminUser.email || '',
      targetType: 'sincronizacion',
      targetId: syncId,
      status: 'SUCCESS',
      metadata: {
        ...result,
      },
    })

    return NextResponse.json({
      success: true,
      syncId,
      ...result,
    })
  } catch (error: any) {
    console.error('Error materializando sincronización de bolsa:', error)

    if (adminUser) {
      try {
        await writeAdminAuditLog({
          action: 'BOLSA_MATERIALIZAR_SYNC',
          actorUid: adminUser.uid,
          actorEmail: adminUser.email || '',
          targetType: 'sincronizacion',
          status: 'ERROR',
          metadata: {
            error: error?.message || 'UNKNOWN_ERROR',
          },
        })
      } catch (auditError) {
        console.error('Error registrando auditoría de materialización:', auditError)
      }
    }

    if (error instanceof RateLimitError || error?.message === 'RATE_LIMITED') {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds || 60) } }
      )
    }

    if (error?.message === 'AUTH_REQUIRED') {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    }

    if (error?.message === 'ADMIN_REQUIRED') {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
    }

    if (error?.message === 'SYNC_WITHOUT_DOCUMENTS') {
      return NextResponse.json({ error: 'La sincronización no tiene documentos para materializar.' }, { status: 400 })
    }

    if (typeof error?.message === 'string' && error.message.startsWith('SYNC_HAS_INCOMPLETE_DOCUMENTS:')) {
      const detalles = JSON.parse(error.message.replace('SYNC_HAS_INCOMPLETE_DOCUMENTS:', ''))
      return NextResponse.json(
        {
          error: 'Todos los documentos deben estar completados antes de materializar.',
          detalles,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'No se pudo materializar la sincronización.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

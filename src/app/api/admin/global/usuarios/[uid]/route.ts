import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

import { normalizeUserRole } from '@/lib/auth/roles'
import { writeAdminAuditLog } from '@/lib/firebase/admin-audit'
import { adminDb } from '@/lib/firebase/admin'
import { requireSuperAdminRequest } from '@/lib/firebase/server-auth'
import { ROLES } from '@/types/roles'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'

const ALLOWED_ROLES = new Set<string>(Object.values(ROLES))
const ALLOWED_STATUS = new Set(['pending', 'active', 'rejected'])

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  let actorUid = ''
  let actorEmail = ''
  let targetUid = ''

  try {
    enforceRateLimit(request, { bucket: 'api:admin:global:usuarios:update', limit: 30, windowMs: 60_000 })
    const adminContext = await requireSuperAdminRequest(request)
    actorUid = adminContext.uid
    actorEmail = adminContext.email || ''

    const { uid } = await params
    targetUid = uid
    const body = await request.json().catch(() => ({}))

    const nextRole = typeof body?.role === 'string' ? normalizeUserRole(body.role) : undefined
    const nextStatus = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : undefined

    if (!nextRole && !nextStatus) {
      return NextResponse.json({ error: 'No se enviaron cambios válidos.' }, { status: 400 })
    }

    if (nextRole && !ALLOWED_ROLES.has(nextRole)) {
      return NextResponse.json({ error: 'Rol no válido.' }, { status: 400 })
    }

    if (nextStatus && !ALLOWED_STATUS.has(nextStatus)) {
      return NextResponse.json({ error: 'Estatus no válido.' }, { status: 400 })
    }

    if (actorUid === uid) {
      if (nextRole && nextRole !== ROLES.SUPER_ADMIN) {
        return NextResponse.json(
          { error: 'No puedes quitarte el rol de admin global desde esta interfaz.' },
          { status: 400 }
        )
      }

      if (nextStatus && nextStatus !== 'active') {
        return NextResponse.json(
          { error: 'No puedes desactivar tu propia cuenta global desde esta interfaz.' },
          { status: 400 }
        )
      }
    }

    const userRef = adminDb.collection('users').doc(uid)
    const userSnap = await userRef.get()

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    const currentData = userSnap.data() || {}
    const currentRole = normalizeUserRole(currentData.role)
    const currentStatus = currentData.status || 'pending'

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (nextRole && nextRole !== currentRole) {
      updates.role = nextRole
    }

    if (nextStatus && nextStatus !== currentStatus) {
      updates.status = nextStatus
      updates.rejectionReason = nextStatus === 'rejected'
        ? currentData.rejectionReason || 'Actualizado por admin global.'
        : FieldValue.delete()
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({
        success: true,
        data: {
          uid,
          role: currentRole,
          status: currentStatus,
          unchanged: true,
        },
      })
    }

    await userRef.update(updates)

    await writeAdminAuditLog({
      action: 'GLOBAL_USER_UPDATED',
      actorUid,
      actorEmail,
      targetType: 'users',
      targetId: uid,
      status: 'SUCCESS',
      metadata: {
        previousRole: currentRole,
        nextRole: nextRole || currentRole,
        previousStatus: currentStatus,
        nextStatus: nextStatus || currentStatus,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        uid,
        role: nextRole || currentRole,
        status: nextStatus || currentStatus,
      },
    })
  } catch (error: any) {
    console.error('Error actualizando usuario global:', error)

    if (targetUid && actorUid) {
      await writeAdminAuditLog({
        action: 'GLOBAL_USER_UPDATED',
        actorUid,
        actorEmail,
        targetType: 'users',
        targetId: targetUid,
        status: 'ERROR',
        metadata: {
          error: error?.message || 'UNKNOWN_ERROR',
        },
      }).catch((auditError) => {
        console.error('Error escribiendo auditoría de fallo:', auditError)
      })
    }

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
      return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 })
    }

    if (error?.message === 'ACCOUNT_INACTIVE') {
      return NextResponse.json({ error: 'La cuenta no está activa.' }, { status: 403 })
    }

    if (error?.message === 'SUPER_ADMIN_REQUIRED') {
      return NextResponse.json({ error: 'Se requiere perfil de admin global.' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'No se pudo actualizar el usuario.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

import { sendApprovalEmail, sendRejectionEmail } from '@/lib/email'
import { writeAdminAuditLog } from '@/lib/firebase/admin-audit'
import { adminDb } from '@/lib/firebase/admin'
import { requireAdminRequest } from '@/lib/firebase/server-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit'

type UserStatus = 'active' | 'rejected'

function getFullName(data: Record<string, any>) {
  return [data.nombre, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' ').trim()
}

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  let actorUid = ''
  let actorEmail = ''
  let targetUid = ''

  try {
    enforceRateLimit(request, { bucket: 'api:admin:validaciones:accion', limit: 30, windowMs: 60_000 })
    const adminContext = await requireAdminRequest(request)
    actorUid = adminContext.uid
    actorEmail = adminContext.email || ''

    const { uid } = await params
    targetUid = uid
    const body = await request.json().catch(() => ({}))
    const nextStatus = body?.status as UserStatus | undefined
    const rejectionReason = typeof body?.rejectionReason === 'string' ? body.rejectionReason.trim() : ''

    if (nextStatus !== 'active' && nextStatus !== 'rejected') {
      return NextResponse.json({ error: 'Estatus de acción no válido.' }, { status: 400 })
    }

    if (nextStatus === 'rejected' && !rejectionReason) {
      return NextResponse.json({ error: 'La razón de rechazo es obligatoria.' }, { status: 400 })
    }

    const userRef = adminDb.collection('users').doc(uid)
    const userSnap = await userRef.get()

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    const userData = userSnap.data() || {}
    const fullName = getFullName(userData)
    let warning: string | null = null

    await userRef.update({
      status: nextStatus,
      rejectionReason: nextStatus === 'rejected' ? rejectionReason : FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await adminDb.collection('notifications').add({
      userId: uid,
      title: nextStatus === 'active' ? '¡Cuenta Activada!' : 'Solicitud Rechazada',
      message:
        nextStatus === 'active'
          ? 'Tu solicitud de registro ha sido aprobada. Ya puedes acceder a todas las funcionalidades.'
          : `Tu solicitud ha sido rechazada. Razón: ${rejectionReason}`,
      type: 'system',
      link: nextStatus === 'active' ? '/admin/perfil' : null,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })

    if (userData.email) {
      try {
        if (nextStatus === 'active') {
          await sendApprovalEmail(userData.email, fullName)
        } else {
          await sendRejectionEmail(userData.email, fullName, rejectionReason)
        }
      } catch (emailError) {
        console.error('Error enviando correo de validación:', emailError)
        warning = nextStatus === 'active'
          ? 'La cuenta se activó, pero no se pudo enviar el correo de aprobación.'
          : 'La solicitud se actualizó, pero no se pudo enviar el correo de rechazo.'
      }
    }

    await writeAdminAuditLog({
      action: 'USER_VALIDATION_UPDATED',
      actorUid,
      actorEmail,
      targetType: 'users',
      targetId: uid,
      status: 'SUCCESS',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        nextStatus,
        warning,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        uid,
        status: nextStatus,
      },
      warning,
    })
  } catch (error: any) {
    console.error('Error actualizando validación de usuario:', error)

    if (actorUid && targetUid) {
      await writeAdminAuditLog({
        action: 'USER_VALIDATION_UPDATED',
        actorUid,
        actorEmail,
        targetType: 'users',
        targetId: targetUid,
        status: 'ERROR',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          error: error?.message || 'UNKNOWN_ERROR',
        },
      }).catch((auditError) => {
        console.error('Error escribiendo auditoría de validación fallida:', auditError)
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
      return NextResponse.json({ error: 'Perfil de administrador no encontrado.' }, { status: 404 })
    }

    if (error?.message === 'ACCOUNT_INACTIVE') {
      return NextResponse.json({ error: 'La cuenta no está activa.' }, { status: 403 })
    }

    if (error?.message === 'ADMIN_REQUIRED') {
      return NextResponse.json({ error: 'Se requiere perfil de administrador.' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'No se pudo actualizar la solicitud.', details: error?.message || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

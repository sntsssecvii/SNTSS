import { NextRequest } from 'next/server'

import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { isAdminRole, isSuperAdminRole, normalizeUserRole } from '@/lib/auth/roles'

interface AdminRequestContext {
  uid: string
  email: string | null
  role: string
  status?: string
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length).trim()
}

export async function requireAdminRequest(request: NextRequest): Promise<AdminRequestContext> {
  const idToken = getBearerToken(request)

  if (!idToken) {
    throw new Error('AUTH_REQUIRED')
  }

  const decodedToken = await adminAuth.verifyIdToken(idToken)
  const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get()

  if (!userDoc.exists) {
    throw new Error('PROFILE_NOT_FOUND')
  }

  const userData = userDoc.data() as { role?: string; status?: string; email?: string } | undefined
  const role = normalizeUserRole(userData?.role)
  const status = userData?.status

  if (status && status !== 'active') {
    throw new Error('ACCOUNT_INACTIVE')
  }

  if (!isAdminRole(role)) {
    throw new Error('ADMIN_REQUIRED')
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || userData?.email || null,
    role,
    status,
  }
}

export async function requireSuperAdminRequest(request: NextRequest): Promise<AdminRequestContext> {
  const context = await requireAdminRequest(request)

  if (!isSuperAdminRole(context.role)) {
    throw new Error('SUPER_ADMIN_REQUIRED')
  }

  return context
}

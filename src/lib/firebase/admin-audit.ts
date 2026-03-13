import { adminDb } from '@/lib/firebase/admin'
import * as admin from 'firebase-admin'

type AdminAuditLogInput = {
  action: string
  actorUid: string
  actorEmail?: string
  targetType: string
  targetId?: string
  status: 'SUCCESS' | 'ERROR'
  ip?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export async function writeAdminAuditLog(input: AdminAuditLogInput) {
  await adminDb.collection('admin_audit_logs').add({
    ...input,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

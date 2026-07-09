import * as admin from "firebase-admin";

import { adminDb } from "@/lib/firebase/admin";

const COLLECTION = "chat_contrato_sessions";

export interface ChatSessionMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    pageNumber: number;
    clauseNumber?: number;
    clauseTitle?: string;
    excerpt: string;
  }>;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatSessionMessage[];
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export async function createChatSession(
  userId: string,
  title: string,
  messages: ChatSessionMessage[],
): Promise<string> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = await adminDb.collection(COLLECTION).add({
    userId,
    title,
    messages,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateChatSession(
  sessionId: string,
  userId: string,
  messages: ChatSessionMessage[],
  title?: string,
) {
  const ref = adminDb.collection(COLLECTION).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.userId !== userId) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const update: Record<string, unknown> = {
    messages,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (title) update.title = title;

  await ref.update(update);
}

export async function getChatSession(
  sessionId: string,
  userId: string,
): Promise<ChatSession | null> {
  const doc = await adminDb.collection(COLLECTION).doc(sessionId).get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  if (data.userId !== userId) return null;

  return {
    id: doc.id,
    userId: data.userId,
    title: data.title,
    messages: data.messages || [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listChatSessions(
  userId: string,
  limit = 20,
): Promise<
  Array<{ id: string; title: string; messageCount: number; updatedAt: string }>
> {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "Sin título",
      messageCount: data.messages?.length || 0,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || "",
    };
  });
}

export async function deleteChatSession(sessionId: string, userId: string) {
  const ref = adminDb.collection(COLLECTION).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.userId !== userId) {
    throw new Error("SESSION_NOT_FOUND");
  }
  await ref.delete();
}

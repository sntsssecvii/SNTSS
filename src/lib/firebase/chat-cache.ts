import * as admin from "firebase-admin";

import { adminDb } from "@/lib/firebase/admin";

const CACHE_COLLECTION = "chat_contrato_cache";
const FEEDBACK_COLLECTION = "chat_contrato_feedback";
const CACHE_TTL_DAYS = 7;

// ---------------------------------------------------------------------------
// Query normalization — "¿Cuántos días de vacaciones?" and
// "cuantos dias de vacaciones me tocan" should hit the same cache entry
// ---------------------------------------------------------------------------

export function normalizeQueryForCache(query: string): string {
  return (
    query
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      // Remove filler words that don't change the meaning
      .replace(
        /\b(me|te|se|nos|les|lo|la|los|las|un|una|unos|unas|el|del|al|por favor|necesito|saber|quiero|quisiera|podrias|puedes|decirme|explicar|dime)\b/g,
        "",
      )
      .replace(/\s+/g, " ")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export interface CachedAnswer {
  query: string;
  normalizedQuery: string;
  answer: string;
  sources: Array<{
    pageNumber: number;
    clauseNumber?: number;
    clauseTitle?: string;
    excerpt: string;
    score: number;
  }>;
  sourceCount: number;
  createdAt: admin.firestore.Timestamp;
  hitCount: number;
  feedbackScore: number; // sum of +1/-1 ratings
}

export async function getCachedAnswer(
  query: string,
): Promise<CachedAnswer | null> {
  const normalized = normalizeQueryForCache(query);
  if (normalized.length < 5) return null;

  const snapshot = await adminDb
    .collection(CACHE_COLLECTION)
    .where("normalizedQuery", "==", normalized)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data() as CachedAnswer;

  // Check TTL
  const createdAt = data.createdAt?.toDate?.();
  if (createdAt) {
    const ageMs = Date.now() - createdAt.getTime();
    if (ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
      await doc.ref.delete();
      return null;
    }
  }

  // Don't serve cached answers with bad feedback
  if (data.feedbackScore < -2) return null;

  // Increment hit count
  await doc.ref.update({
    hitCount: admin.firestore.FieldValue.increment(1),
  });

  return data;
}

export async function setCachedAnswer(
  query: string,
  answer: string,
  sources: CachedAnswer["sources"],
) {
  const normalized = normalizeQueryForCache(query);
  if (normalized.length < 5) return;

  // Check if already exists
  const existing = await adminDb
    .collection(CACHE_COLLECTION)
    .where("normalizedQuery", "==", normalized)
    .limit(1)
    .get();

  if (!existing.empty) {
    // Update existing
    await existing.docs[0].ref.update({
      answer,
      sources,
      sourceCount: sources.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  await adminDb.collection(CACHE_COLLECTION).add({
    query,
    normalizedQuery: normalized,
    answer,
    sources,
    sourceCount: sources.length,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    hitCount: 0,
    feedbackScore: 0,
  });
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export interface AnswerFeedback {
  userId: string;
  query: string;
  normalizedQuery: string;
  answer: string;
  rating: 1 | -1;
  createdAt: admin.firestore.Timestamp;
}

export async function submitFeedback(
  userId: string,
  query: string,
  answer: string,
  rating: 1 | -1,
) {
  const normalized = normalizeQueryForCache(query);

  // Save feedback
  await adminDb.collection(FEEDBACK_COLLECTION).add({
    userId,
    query,
    normalizedQuery: normalized,
    answer: answer.slice(0, 500),
    rating,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update cache feedbackScore if exists
  const cacheSnapshot = await adminDb
    .collection(CACHE_COLLECTION)
    .where("normalizedQuery", "==", normalized)
    .limit(1)
    .get();

  if (!cacheSnapshot.empty) {
    await cacheSnapshot.docs[0].ref.update({
      feedbackScore: admin.firestore.FieldValue.increment(rating),
    });
  }
}

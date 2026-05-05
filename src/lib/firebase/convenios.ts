import { adminDb, adminStorage } from "@/lib/firebase/admin";
import type { Convenio } from "@/types/convenios";
import type { WriteBatch } from "firebase-admin/firestore";

const COLLECTION = "convenios";

export async function getConveniosPublicos(): Promise<Convenio[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .where("publicado", "==", true)
    .orderBy("orden", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Convenio);
}

export async function getConveniosAdmin(): Promise<Convenio[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .orderBy("orden", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Convenio);
}

export async function createConvenio(
  data: Omit<Convenio, "id">,
): Promise<string> {
  const ref = await adminDb.collection(COLLECTION).add(data);
  return ref.id;
}

export async function updateConvenio(
  id: string,
  data: Partial<Omit<Convenio, "id">>,
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).update(data);
}

export async function deleteConvenio(
  id: string,
  imageUrl: string,
): Promise<void> {
  const url = new URL(imageUrl);
  const pathEncoded = url.pathname.split("/o/")[1];
  if (pathEncoded) {
    const storagePath = decodeURIComponent(pathEncoded.split("?")[0]);
    try {
      await adminStorage.bucket().file(storagePath).delete();
    } catch {
      // Si el archivo no existe en Storage, continuar igual
    }
  }
  await adminDb.collection(COLLECTION).doc(id).delete();
}

export async function publishConvenios(
  ids: string[],
  todosIds: string[],
): Promise<void> {
  const batch: WriteBatch = adminDb.batch();
  for (const id of todosIds) {
    const ref = adminDb.collection(COLLECTION).doc(id);
    batch.update(ref, { publicado: ids.includes(id) });
  }
  await batch.commit();
}

export async function reorderConvenios(
  ordenado: Array<{ id: string; orden: number }>,
): Promise<void> {
  const batch: WriteBatch = adminDb.batch();
  for (const { id, orden } of ordenado) {
    batch.update(adminDb.collection(COLLECTION).doc(id), { orden });
  }
  await batch.commit();
}

export async function getMaxOrden(): Promise<number> {
  const snap = await adminDb
    .collection(COLLECTION)
    .orderBy("orden", "desc")
    .limit(1)
    .get();
  if (snap.empty) return 0;
  return (snap.docs[0].data().orden as number) + 1;
}

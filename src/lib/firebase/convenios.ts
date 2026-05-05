import { adminDb, adminStorage } from "@/lib/firebase/admin";
import type { Convenio, ConvenioPublico } from "@/types/convenios";
import type { WriteBatch } from "firebase-admin/firestore";

const COLLECTION = "convenios";

export async function getConveniosPublicos(): Promise<ConvenioPublico[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .where("publicado", "==", true)
    .orderBy("orden", "asc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      imageUrl: data.imageUrl as string,
      link: data.link as string | undefined,
      orden: data.orden as number,
    };
  });
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
    } catch (err: any) {
      // 404 significa que el archivo ya no existe en Storage — continuar igual
      if (err?.code !== 404 && err?.message !== "No such object") {
        console.error("[convenios] Error al borrar archivo de Storage:", err);
      }
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

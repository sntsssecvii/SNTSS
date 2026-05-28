import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import type { EscalafonListado, EscalafonAspirante } from "@/types/escalafon";

const COL_LISTADOS = "escalafon_listados";
const COL_ASPIRANTES = "escalafon_aspirantes";

// Obtiene el listado vigente para esa categoría y área (sin importar periodo)
// Un listado nuevo del mismo tipo siempre reemplaza al anterior como fuente de verdad
export async function obtenerListadoVigente(
  categoriaCode: string,
  areaCode: string,
): Promise<EscalafonListado | null> {
  const snap = await adminDb
    .collection(COL_LISTADOS)
    .where("categoriaCode", "==", categoriaCode)
    .where("areaCode", "==", areaCode)
    .orderBy("creadoEn", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as EscalafonListado;
}

// Guarda un listado y sus aspirantes en batch
export async function guardarListado(
  listado: Omit<EscalafonListado, "id">,
  aspirantes: Omit<EscalafonAspirante, "id">[],
): Promise<string> {
  const listadoRef = adminDb.collection(COL_LISTADOS).doc();
  const listadoId = listadoRef.id;

  const batch = adminDb.batch();

  batch.set(listadoRef, {
    ...listado,
    creadoEn: Timestamp.now(),
  });

  for (const aspirante of aspirantes) {
    const aspiranteRef = adminDb.collection(COL_ASPIRANTES).doc();
    batch.set(aspiranteRef, { ...aspirante, listadoId });
  }

  await batch.commit();
  return listadoId;
}

// Lista todos los listados ordenados por fecha de creación
export async function listarListados(): Promise<EscalafonListado[]> {
  const snap = await adminDb
    .collection(COL_LISTADOS)
    .orderBy("creadoEn", "desc")
    .get();

  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as EscalafonListado,
  );
}

// Obtiene un listado por ID
export async function obtenerListado(
  listadoId: string,
): Promise<EscalafonListado | null> {
  const doc = await adminDb.collection(COL_LISTADOS).doc(listadoId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as EscalafonListado;
}

// Obtiene los aspirantes de un listado ordenados por lugar
export async function obtenerAspirantes(
  listadoId: string,
): Promise<EscalafonAspirante[]> {
  const snap = await adminDb
    .collection(COL_ASPIRANTES)
    .where("listadoId", "==", listadoId)
    .orderBy("lugar", "asc")
    .get();

  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as EscalafonAspirante,
  );
}

// Elimina un listado y sus aspirantes
export async function eliminarListado(listadoId: string): Promise<void> {
  const aspirantesSnap = await adminDb
    .collection(COL_ASPIRANTES)
    .where("listadoId", "==", listadoId)
    .get();

  const batch = adminDb.batch();
  aspirantesSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(adminDb.collection(COL_LISTADOS).doc(listadoId));
  await batch.commit();
}

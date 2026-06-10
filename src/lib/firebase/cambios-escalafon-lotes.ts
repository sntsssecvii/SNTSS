import { adminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { CambiosLote, CambiosListado } from "@/types/cambios-escalafon";

const COL_LOTES = "cambios_lotes";
const COL_LISTADOS = "cambios_listados";

const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function generarNombreLoteCambios(fecha: Date = new Date()): string {
  const dia = fecha.getDate();
  const mes = MESES_CORTOS[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `${dia} ${mes} ${anio}`;
}

export async function crearLoteCambios(
  nombre: string,
  subidoPor: string,
): Promise<string> {
  const ref = adminDb.collection(COL_LOTES).doc();
  const now = Timestamp.now();
  await ref.set({
    nombre,
    estado: "ABIERTO",
    totalListados: 0,
    subidoPor,
    creadoEn: now,
    actualizadoEn: now,
  });
  return ref.id;
}

export async function obtenerLoteAbiertoCambios(): Promise<CambiosLote | null> {
  const snap = await adminDb
    .collection(COL_LOTES)
    .where("estado", "==", "ABIERTO")
    .orderBy("creadoEn", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as CambiosLote;
}

export async function listarLotesCambios(): Promise<CambiosLote[]> {
  const snap = await adminDb
    .collection(COL_LOTES)
    .orderBy("creadoEn", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CambiosLote);
}

export async function obtenerLoteCambios(
  loteId: string,
): Promise<CambiosLote | null> {
  const doc = await adminDb.collection(COL_LOTES).doc(loteId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as CambiosLote;
}

export async function listarListadosDelLoteCambios(
  loteId: string,
): Promise<CambiosListado[]> {
  const snap = await adminDb
    .collection(COL_LISTADOS)
    .where("loteId", "==", loteId)
    .orderBy("creadoEn", "desc")
    .get();
  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as CambiosListado,
  );
}

export async function actualizarLoteCambios(
  loteId: string,
  data: { nombre?: string; estado?: "CERRADO" },
): Promise<void> {
  await adminDb
    .collection(COL_LOTES)
    .doc(loteId)
    .update({ ...data, actualizadoEn: Timestamp.now() });
}

export async function incrementarTotalListadosCambios(
  loteId: string,
): Promise<void> {
  await adminDb
    .collection(COL_LOTES)
    .doc(loteId)
    .update({
      totalListados: FieldValue.increment(1),
      actualizadoEn: Timestamp.now(),
    });
}

export async function decrementarTotalListadosCambios(
  loteId: string,
): Promise<void> {
  await adminDb
    .collection(COL_LOTES)
    .doc(loteId)
    .update({
      totalListados: FieldValue.increment(-1),
      actualizadoEn: Timestamp.now(),
    });
}

export async function consolidarListadosEnLoteCambios(
  loteId: string,
): Promise<number> {
  const snap = await adminDb.collection(COL_LISTADOS).get();
  const foraneos = snap.docs.filter((doc) => doc.data().loteId !== loteId);
  if (foraneos.length === 0) return 0;

  const loteIdsAfectados = new Set<string>();
  const batch = adminDb.batch();

  foraneos.forEach((doc) => {
    const oldLoteId = doc.data().loteId as string | undefined;
    if (oldLoteId) loteIdsAfectados.add(oldLoteId);
    batch.update(doc.ref, { loteId });
  });

  batch.update(adminDb.collection(COL_LOTES).doc(loteId), {
    totalListados: snap.size,
    actualizadoEn: Timestamp.now(),
  });

  loteIdsAfectados.forEach((oldId) => {
    batch.update(adminDb.collection(COL_LOTES).doc(oldId), {
      totalListados: 0,
      actualizadoEn: Timestamp.now(),
    });
  });

  await batch.commit();
  return foraneos.length;
}

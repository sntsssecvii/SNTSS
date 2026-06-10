import { adminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { EscalafonLote, EscalafonListado } from "@/types/escalafon";

const COL_LOTES = "escalafon_lotes";
const COL_LISTADOS = "escalafon_listados";

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

export function generarNombreLote(fecha: Date = new Date()): string {
  const dia = fecha.getDate();
  const mes = MESES_CORTOS[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `${dia} ${mes} ${anio}`;
}

export async function crearLote(
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

export async function obtenerLoteAbierto(): Promise<EscalafonLote | null> {
  const snap = await adminDb
    .collection(COL_LOTES)
    .where("estado", "==", "ABIERTO")
    .orderBy("creadoEn", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as EscalafonLote;
}

export async function listarLotes(): Promise<EscalafonLote[]> {
  const snap = await adminDb
    .collection(COL_LOTES)
    .orderBy("creadoEn", "desc")
    .get();
  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as EscalafonLote,
  );
}

export async function obtenerLote(
  loteId: string,
): Promise<EscalafonLote | null> {
  const doc = await adminDb.collection(COL_LOTES).doc(loteId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as EscalafonLote;
}

export async function listarListadosDelLote(
  loteId: string,
): Promise<EscalafonListado[]> {
  const snap = await adminDb
    .collection(COL_LISTADOS)
    .where("loteId", "==", loteId)
    .orderBy("creadoEn", "desc")
    .get();
  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as EscalafonListado,
  );
}

export async function actualizarLote(
  loteId: string,
  data: { nombre?: string; estado?: "CERRADO" },
): Promise<void> {
  await adminDb
    .collection(COL_LOTES)
    .doc(loteId)
    .update({
      ...data,
      actualizadoEn: Timestamp.now(),
    });
}

export async function incrementarTotalListados(loteId: string): Promise<void> {
  await adminDb
    .collection(COL_LOTES)
    .doc(loteId)
    .update({
      totalListados: FieldValue.increment(1),
      actualizadoEn: Timestamp.now(),
    });
}

export async function decrementarTotalListados(loteId: string): Promise<void> {
  await adminDb
    .collection(COL_LOTES)
    .doc(loteId)
    .update({
      totalListados: FieldValue.increment(-1),
      actualizadoEn: Timestamp.now(),
    });
}

// Mueve todos los listados de otros lotes al lote dado.
// Se llama al cerrar un lote para que quede como snapshot completo del escalafón.
export async function consolidarListadosEnLote(
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

  // El lote nuevo queda con todos los listados
  batch.update(adminDb.collection(COL_LOTES).doc(loteId), {
    totalListados: snap.size,
    actualizadoEn: Timestamp.now(),
  });

  // Los lotes anteriores quedan en cero
  loteIdsAfectados.forEach((oldId) => {
    batch.update(adminDb.collection(COL_LOTES).doc(oldId), {
      totalListados: 0,
      actualizadoEn: Timestamp.now(),
    });
  });

  await batch.commit();
  return foraneos.length;
}

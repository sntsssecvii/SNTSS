import { adminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { EscalafonLote, EscalafonListado } from "@/types/escalafon";

const COL_LOTES = "escalafon_lotes";
const COL_LISTADOS = "escalafon_listados";

const NOMBRES_MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function generarNombreLote(fecha: Date = new Date()): string {
  const mes = NOMBRES_MESES[fecha.getMonth()];
  const anio = fecha.getFullYear();
  const quincena = fecha.getDate() <= 15 ? "Q1" : "Q2";
  return `${mes} ${anio} · ${quincena}`;
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

// src/lib/firebase/requerimientos.ts
import { adminDb } from "./admin";
import { Timestamp } from "firebase-admin/firestore";
import type { Requerimiento, Partida } from "@/types/requerimientos";

const COL = "requerimientos";

export async function createRequerimiento(data: {
  numeroOficio: string;
  fechaCircular: Date;
  partidas: Omit<Partida, "cantidadDisponible">[];
  creadoPor: string;
}): Promise<string> {
  const ahora = Timestamp.now();
  const partidas: Partida[] = data.partidas.map((p) => ({
    ...p,
    cantidadDisponible: p.cantidadTotal,
  }));
  const doc = {
    numeroOficio: data.numeroOficio,
    fechaCircular: Timestamp.fromDate(data.fechaCircular),
    estado: "ACTIVO" as const,
    partidas,
    creadoPor: data.creadoPor,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
  const ref = await adminDb.collection(COL).add(doc);
  return ref.id;
}

export async function listRequerimientos(): Promise<
  (Requerimiento & { id: string })[]
> {
  const snap = await adminDb.collection(COL).orderBy("creadoEn", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Requerimiento) }));
}

export async function getRequerimientosActivos(): Promise<
  (Requerimiento & { id: string })[]
> {
  const snap = await adminDb
    .collection(COL)
    .where("estado", "==", "ACTIVO")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Requerimiento) }));
}

/**
 * Decrementa cantidadDisponible en la partida indicada (por zona+categoria) en transacción.
 * Lanza error si no hay disponibilidad.
 */
export async function decrementarPartida(
  requerimientoId: string,
  zona: string,
  categoria: string,
): Promise<void> {
  const ref = adminDb.collection(COL).doc(requerimientoId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("REQUERIMIENTO_NOT_FOUND");
    const data = snap.data() as Requerimiento;
    const idx = data.partidas.findIndex(
      (p) => p.zona === zona && p.categoria === categoria,
    );
    if (idx === -1) throw new Error("PARTIDA_NOT_FOUND");
    if (data.partidas[idx].cantidadDisponible <= 0)
      throw new Error("SIN_DISPONIBILIDAD");
    const partidas = [...data.partidas];
    partidas[idx] = {
      ...partidas[idx],
      cantidadDisponible: partidas[idx].cantidadDisponible - 1,
    };
    tx.update(ref, { partidas, actualizadoEn: Timestamp.now() });
  });
}

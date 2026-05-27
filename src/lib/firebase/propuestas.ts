// src/lib/firebase/propuestas.ts
// Solo para uso en servidor (API Routes) — usa firebase-admin
import { adminDb } from "./admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type {
  Propuesta,
  WarningsPropuesta,
  Aspirante,
  DatosSolicitante,
} from "@/types/propuestas";
import type {
  EstadoPropuesta,
  EstadoFase2,
  EventoHistorial,
} from "@/types/workflow";

const COL = "propuestas";

export async function createPropuesta(data: {
  numeroCaso: string;
  matricula: string;
  solicitante: DatosSolicitante | null;
  sinFamiliar: boolean;
  aspirante: Aspirante | null;
  ineUrl: string | null;
  warnings: WarningsPropuesta;
  usuarioId: string;
}): Promise<string> {
  const ahora = Timestamp.now();
  const evento: EventoHistorial = {
    fecha: ahora as any,
    tipo: "CREADA",
    usuarioId: data.usuarioId,
    nota: null,
  };
  const doc = {
    numeroCaso: data.numeroCaso,
    folio: null,
    estado: "PENDIENTE" as EstadoPropuesta,
    estadoFase2: null,
    motivoRechazo: null,
    matricula: data.matricula,
    solicitante: data.solicitante,
    sinFamiliar: data.sinFamiliar,
    aspirante: data.aspirante,
    documentos: { ineUrl: data.ineUrl },
    warnings: data.warnings,
    historial: [evento],
    creadoEn: ahora as any,
    actualizadoEn: ahora as any,
  };
  const ref = await adminDb.collection(COL).add(doc);
  return ref.id;
}

export async function getPropuestaById(
  id: string,
): Promise<(Propuesta & { id: string }) | null> {
  const snap = await adminDb.collection(COL).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Propuesta) };
}

export interface FiltroPropuestas {
  estado?: EstadoPropuesta;
  limit?: number;
}

export async function listPropuestas(
  filtros: FiltroPropuestas = {},
): Promise<(Propuesta & { id: string })[]> {
  let q = adminDb
    .collection(COL)
    .orderBy("creadoEn", "desc") as FirebaseFirestore.Query;
  if (filtros.estado) {
    q = q.where("estado", "==", filtros.estado);
  }
  if (filtros.limit) {
    q = q.limit(filtros.limit);
  }
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Propuesta) }));
}

export async function aprobarPropuesta(
  id: string,
  folio: string,
  usuarioId: string,
): Promise<void> {
  const ahora = Timestamp.now();
  const evento: EventoHistorial = {
    fecha: ahora as any,
    tipo: "APROBADA",
    usuarioId,
    nota: null,
  };
  await adminDb
    .collection(COL)
    .doc(id)
    .update({
      estado: "APROBADA",
      folio,
      estadoFase2: "SIN_ASIGNAR",
      actualizadoEn: ahora,
      historial: FieldValue.arrayUnion(evento),
    });
}

export async function rechazarPropuesta(
  id: string,
  motivo: string,
  usuarioId: string,
): Promise<void> {
  const ahora = Timestamp.now();
  const evento: EventoHistorial = {
    fecha: ahora as any,
    tipo: "RECHAZADA",
    usuarioId,
    nota: motivo,
  };
  await adminDb
    .collection(COL)
    .doc(id)
    .update({
      estado: "RECHAZADA",
      motivoRechazo: motivo,
      actualizadoEn: ahora,
      historial: FieldValue.arrayUnion(evento),
    });
}

export async function propuestaActivaPorMatricula(
  matricula: string,
): Promise<(Propuesta & { id: string }) | null> {
  const snap = await adminDb
    .collection(COL)
    .where("matricula", "==", matricula)
    .where("estado", "in", ["PENDIENTE", "APROBADA"])
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Propuesta) };
}

export async function curpExisteEnPropuestasActivas(
  curp: string,
): Promise<boolean> {
  const snap = await adminDb
    .collection(COL)
    .where("aspirante.curp", "==", curp.toUpperCase())
    .where("estado", "in", ["PENDIENTE", "APROBADA"])
    .limit(1)
    .get();
  return !snap.empty;
}

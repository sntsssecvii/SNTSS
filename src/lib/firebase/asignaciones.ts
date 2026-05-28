// src/lib/firebase/asignaciones.ts
import { adminDb } from "./admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { Asignacion } from "@/types/asignaciones";
import type { EventoHistorial } from "@/types/workflow";

const COL_ASIG = "asignaciones";
const COL_PROP = "propuestas";

export async function crearAsignacion(data: {
  propuestaId: string;
  requerimientoId: string;
  zona: string;
  categoria: string;
  asignadoPor: string;
}): Promise<string> {
  const ahora = Timestamp.now();
  const doc: Omit<Asignacion, "id"> = {
    propuestaId: data.propuestaId,
    requerimientoId: data.requerimientoId,
    zona: data.zona,
    categoria: data.categoria,
    estado: "ACTIVA",
    asignadoPor: data.asignadoPor,
    asignadoEn: ahora as any,
  };
  const ref = await adminDb.collection(COL_ASIG).add(doc);

  // Actualizar estadoFase2 en la propuesta
  const evento: EventoHistorial = {
    fecha: ahora as any,
    tipo: "ASIGNADA",
    usuarioId: data.asignadoPor,
    nota: `Requerimiento: ${data.requerimientoId}`,
  };
  await adminDb
    .collection(COL_PROP)
    .doc(data.propuestaId)
    .update({
      estadoFase2: "ASIGNADA",
      actualizadoEn: ahora,
      historial: FieldValue.arrayUnion(evento),
    });

  return ref.id;
}

export async function listAsignaciones(): Promise<
  (Asignacion & { id: string })[]
> {
  const snap = await adminDb
    .collection(COL_ASIG)
    .orderBy("asignadoEn", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Asignacion) }));
}

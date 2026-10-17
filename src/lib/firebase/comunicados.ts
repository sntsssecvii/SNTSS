import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { ordenarComunicados, type ComunicadoInput } from "@/lib/comunicados";
import type {
  Comunicado,
  ComunicadoAdmin,
  ComunicadoPublico,
} from "@/types/comunicados";

/**
 * Comunicados oficiales que el sindicato publica en la landing pública.
 * Solo Admin SDK: la colección queda cubierta por el catch-all de
 * `firestore.rules`, ningún cliente la lee directo.
 *
 * Volumen bajo (decenas de docs): se filtra por `publicado` y se ordena en
 * memoria para no requerir índices compuestos.
 */
const COLLECTION = "comunicados";

function serializar(snap: DocumentSnapshot): ComunicadoAdmin {
  const data = snap.data() as Omit<Comunicado, "id">;
  const fecha = data.fechaPublicacion ?? data.creadoEn;
  return {
    id: snap.id,
    titulo: data.titulo,
    cuerpo: data.cuerpo,
    categoria: data.categoria,
    ...(data.enlace ? { enlace: data.enlace } : {}),
    fijado: Boolean(data.fijado),
    publicado: Boolean(data.publicado),
    fecha: fecha.toDate().toISOString(),
  };
}

export async function getComunicadosPublicos(
  limite: number,
): Promise<ComunicadoPublico[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .where("publicado", "==", true)
    .get();
  return ordenarComunicados(snap.docs.map(serializar))
    .slice(0, limite)
    .map(({ publicado: _publicado, ...publico }) => publico);
}

export async function getComunicadosAdmin(): Promise<ComunicadoAdmin[]> {
  const snap = await adminDb.collection(COLLECTION).get();
  return ordenarComunicados(snap.docs.map(serializar));
}

export async function createComunicado(
  input: ComunicadoInput,
  creadoPor: string,
): Promise<string> {
  const ahora = Timestamp.now();
  const ref = await adminDb.collection(COLLECTION).add({
    titulo: input.titulo,
    cuerpo: input.cuerpo,
    categoria: input.categoria,
    enlace: input.enlace || null,
    fijado: input.fijado,
    publicado: input.publicado,
    fechaPublicacion: input.publicado ? ahora : null,
    creadoEn: ahora,
    creadoPor,
  });
  return ref.id;
}

export async function updateComunicado(
  id: string,
  cambios: Partial<ComunicadoInput>,
): Promise<boolean> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const datos: Record<string, unknown> = {
    ...cambios,
    actualizadoEn: Timestamp.now(),
  };
  if (cambios.enlace !== undefined) datos.enlace = cambios.enlace || null;
  // La fecha visible se fija la primera vez que se publica.
  if (cambios.publicado && !snap.data()?.fechaPublicacion) {
    datos.fechaPublicacion = Timestamp.now();
  }
  await ref.update(datos);
  return true;
}

export async function deleteComunicado(id: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).delete();
}

import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import type {
  CambiosListado,
  CambiosRegistro,
} from "@/types/cambios-escalafon";
import {
  calcularPosicionesCambios,
  claveRegistro,
} from "@/lib/cambios-escalafon/position-engine";

const COL_LISTADOS = "cambios_listados";
const COL_REGISTROS = "cambios_registros";

// Auto-reemplazo: misma categoría + mismo concepto + misma ÁREA = reemplaza.
// El área distingue especialidades que comparten categoriaCode (p.ej. ENF. ESP.
// QUIRÚRGICA 216 vs PEDIATRÍA 232); sin ella, subir varias especialidades
// borraba las anteriores y se perdían personas.
export async function obtenerListadoVigenteCambios(
  categoriaCode: string,
  concepto: string,
  area: number,
): Promise<CambiosListado | null> {
  const snap = await adminDb
    .collection(COL_LISTADOS)
    .where("categoriaCode", "==", categoriaCode)
    .where("concepto", "==", concepto)
    .orderBy("creadoEn", "desc")
    .get();
  if (snap.empty) return null;
  const lista = snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as CambiosListado,
  );
  // 1) Mismo área: es la identidad correcta del listado.
  const exacto = lista.find((l) => l.area != null && l.area === area);
  if (exacto) return exacto;
  // 2) Doc legacy sin área: se reemplaza al re-subir para migrar el colapsado.
  const legacy = lista.find((l) => l.area == null);
  return legacy ?? null;
}

export async function guardarListadoCambios(
  listado: Omit<CambiosListado, "id">,
  registros: Omit<CambiosRegistro, "id">[],
): Promise<string> {
  const listadoRef = adminDb.collection(COL_LISTADOS).doc();
  const listadoId = listadoRef.id;

  // Firestore batch limit: 500 ops. Para listados grandes usar múltiples batches.
  const BATCH_SIZE = 400;
  const primero = adminDb.batch();
  primero.set(listadoRef, { ...listado, creadoEn: Timestamp.now() });

  let batch = primero;
  let opsEnBatch = 1;

  for (const registro of registros) {
    if (opsEnBatch >= BATCH_SIZE) {
      await batch.commit();
      batch = adminDb.batch();
      opsEnBatch = 0;
    }
    const ref = adminDb.collection(COL_REGISTROS).doc();
    batch.set(ref, { ...registro, listadoId });
    opsEnBatch++;
  }

  await batch.commit();
  return listadoId;
}

export async function obtenerListadoCambios(
  listadoId: string,
): Promise<CambiosListado | null> {
  const doc = await adminDb.collection(COL_LISTADOS).doc(listadoId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as CambiosListado;
}

export async function obtenerRegistros(
  listadoId: string,
): Promise<CambiosRegistro[]> {
  const snap = await adminDb
    .collection(COL_REGISTROS)
    .where("listadoId", "==", listadoId)
    .orderBy("fechaRegistro", "asc")
    .get();
  return snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as CambiosRegistro,
  );
}

/**
 * Corre el motor de posiciones sobre los registros de un listado y guarda
 * lugar/totalEnGrupo/grupoUnidad/grupoTurno en cada doc de cambios_registros.
 * Para incondicionales (multiples posiciones), guarda la mejor (lugar mas bajo).
 */
export async function materializarPosicionesCambios(
  listadoId: string,
): Promise<void> {
  const registros = await obtenerRegistros(listadoId);
  if (registros.length === 0) return;

  const posiciones = calcularPosicionesCambios(registros);

  // Para cada registro, tomar la mejor posicion (menor lugar).
  // Un incondicional puede aparecer en multiples grupos.
  const mejorPorRegistro = new Map<
    string,
    { lugar: number; totalEnGrupo: number; unidad: string; turno: string }
  >();

  for (const p of posiciones) {
    const k = claveRegistro(p.registro);
    const prev = mejorPorRegistro.get(k);
    if (!prev || p.lugar < prev.lugar) {
      mejorPorRegistro.set(k, {
        lugar: p.lugar,
        totalEnGrupo: p.totalEnGrupo,
        unidad: p.unidad,
        turno: p.turno,
      });
    }
  }

  // Actualizar docs en batches
  const BATCH_SIZE = 400;
  const docs = registros.filter((r) => mejorPorRegistro.has(claveRegistro(r)));
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    for (const r of docs.slice(i, i + BATCH_SIZE)) {
      const best = mejorPorRegistro.get(claveRegistro(r))!;
      batch.update(adminDb.collection(COL_REGISTROS).doc(r.id!), {
        lugar: best.lugar,
        totalEnGrupo: best.totalEnGrupo,
        grupoUnidad: best.unidad,
        grupoTurno: best.turno,
      });
    }
    await batch.commit();
  }
}

export async function eliminarListadoCambios(listadoId: string): Promise<void> {
  const registrosSnap = await adminDb
    .collection(COL_REGISTROS)
    .where("listadoId", "==", listadoId)
    .get();

  const BATCH_SIZE = 400;
  for (let i = 0; i < registrosSnap.docs.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    registrosSnap.docs
      .slice(i, i + BATCH_SIZE)
      .forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  await adminDb.collection(COL_LISTADOS).doc(listadoId).delete();
}

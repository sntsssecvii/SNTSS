import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import {
  buildBolsaPositionLookupId,
  POSITION_LOOKUP_COLLECTION,
} from "@/lib/bolsa-de-trabajo/position-materialization";
import type {
  BolsaPosicionMaterializada,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

function removeUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => removeUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefinedDeep(entryValue)])
        .filter(([, entryValue]) => entryValue !== undefined),
    );
  }

  return value;
}

function serializeLookup(lookup: BolsaPosicionMaterializada) {
  return removeUndefinedDeep({
    ...lookup,
    fechaMaterializacion:
      lookup.fechaMaterializacion instanceof Date
        ? Timestamp.fromDate(lookup.fechaMaterializacion)
        : lookup.fechaMaterializacion,
  }) as Record<string, unknown>;
}

export async function upsertBolsaPosicionMaterializada(
  lookup: BolsaPosicionMaterializada,
): Promise<string> {
  const id =
    lookup.id ||
    buildBolsaPositionLookupId(
      lookup.syncId,
      lookup.matricula,
      lookup.tipoDocumento,
      lookup.recordId,
    );
  const payload = serializeLookup({ ...lookup, id });
  await adminDb
    .collection(POSITION_LOOKUP_COLLECTION)
    .doc(id)
    .set(payload, { merge: true });
  return id;
}

export async function upsertBolsaPosicionesMaterializadas(
  lookups: BolsaPosicionMaterializada[],
): Promise<number> {
  const BATCH_SIZE = 500;
  let total = 0;

  for (let i = 0; i < lookups.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    const lote = lookups.slice(i, i + BATCH_SIZE);

    lote.forEach((lookup) => {
      const id =
        lookup.id ||
        buildBolsaPositionLookupId(
          lookup.syncId,
          lookup.matricula,
          lookup.tipoDocumento,
          lookup.recordId,
        );
      const payload = serializeLookup({ ...lookup, id });
      batch.set(
        adminDb.collection(POSITION_LOOKUP_COLLECTION).doc(id),
        payload,
        { merge: true },
      );
    });

    await batch.commit();
    total += lote.length;
  }

  return total;
}

export async function getBolsaPosicionMaterializada(
  syncId: string,
  matricula: string,
  tipoDocumento: TipoBolsaDeTrabajo,
  recordId?: string,
): Promise<BolsaPosicionMaterializada | null> {
  const id = buildBolsaPositionLookupId(
    syncId,
    matricula,
    tipoDocumento,
    recordId,
  );
  const snap = await adminDb
    .collection(POSITION_LOOKUP_COLLECTION)
    .doc(id)
    .get();

  if (!snap.exists) {
    return null;
  }

  return snap.data() as BolsaPosicionMaterializada;
}

export async function getBolsaPosicionesMaterializadasPorMatricula(
  syncId: string,
  matricula: string,
): Promise<BolsaPosicionMaterializada[]> {
  const normalizedMatricula = matricula.trim().toUpperCase();
  const snapshot = await adminDb
    .collection(POSITION_LOOKUP_COLLECTION)
    .where("syncId", "==", syncId)
    .where("matricula", "==", normalizedMatricula)
    .get();

  return snapshot.docs.map((doc) => doc.data() as BolsaPosicionMaterializada);
}

export async function hasBolsaPosicionesMaterializadasForSync(
  syncId: string,
): Promise<boolean> {
  const snapshot = await adminDb
    .collection(POSITION_LOOKUP_COLLECTION)
    .where("syncId", "==", syncId)
    .limit(1)
    .get();

  return !snapshot.empty;
}

export async function deleteBolsaPosicionesMaterializadasPorSync(
  syncId: string,
): Promise<number> {
  const BATCH_SIZE = 500;
  let total = 0;

  let snapshot = await adminDb
    .collection(POSITION_LOOKUP_COLLECTION)
    .where("syncId", "==", syncId)
    .limit(BATCH_SIZE)
    .get();

  while (!snapshot.empty) {
    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snapshot.docs.length;

    if (snapshot.docs.length < BATCH_SIZE) break;

    snapshot = await adminDb
      .collection(POSITION_LOOKUP_COLLECTION)
      .where("syncId", "==", syncId)
      .limit(BATCH_SIZE)
      .get();
  }

  return total;
}

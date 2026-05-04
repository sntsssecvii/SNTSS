/**
 * Migración: backfill searchTokens en todos los usuarios existentes.
 *
 * Ejecutar: npx ts-node --project tsconfig.scripts.json scripts/migrations/backfill-search-tokens.ts
 *
 * El campo searchTokens es un array de palabras normalizadas del nombre completo
 * que permite búsqueda por cualquier parte del nombre (nombre, apellido paterno, materno).
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";

const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(
    process.env.HOME || "",
    ".config/firebase/sntss-service-account.json",
  );

if (!getApps().length) {
  initializeApp({ credential: cert(SERVICE_ACCOUNT_PATH) });
}

const db = getFirestore();

function normalizeSearchText(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildSearchTokens(data: {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
}): string[] {
  return [data.nombre, data.apellidoPaterno, data.apellidoMaterno]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .map((w) => normalizeSearchText(w))
    .filter((w) => w.length >= 2);
}

async function main() {
  const usersRef = db.collection("users");
  let processed = 0;
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  const BATCH_SIZE = 400;

  console.log("Iniciando backfill de searchTokens...");

  while (true) {
    let q: FirebaseFirestore.Query = usersRef.limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      const data = doc.data();

      // Saltar si ya tiene tokens actualizados (para re-runs seguros)
      const tokens = buildSearchTokens({
        nombre: data.nombre,
        apellidoPaterno: data.apellidoPaterno,
        apellidoMaterno: data.apellidoMaterno,
      });

      const existing: string[] = data.searchTokens || [];
      const same =
        existing.length === tokens.length &&
        tokens.every((t) => existing.includes(t));

      if (!same) {
        batch.update(doc.ref, { searchTokens: tokens });
        batchCount++;
        updated++;
      }

      processed++;
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`  Procesados: ${processed} | Actualizados: ${updated}`);

    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log(
    `\nListo. Total procesados: ${processed}, actualizados: ${updated}`,
  );
}

main().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});

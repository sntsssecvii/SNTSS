/**
 * Migración: asignar loteId a escalafon_listados existentes sin loteId.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
 *   npx ts-node --project tsconfig.scripts.json scripts/migrations/escalafon-lotes-migration.ts
 *
 * Correr UNA SOLA VEZ en producción.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const serviceAccount = require(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    `${process.env.HOME}/.config/firebase/sntss-service-account.json`,
);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function run() {
  console.log("Iniciando migración de lotes escalafonarios...");

  // 1. Crear lote "Importaciones previas" en estado CERRADO
  const loteRef = db.collection("escalafon_lotes").doc();
  const now = Timestamp.now();
  await loteRef.set({
    nombre: "Importaciones previas",
    estado: "CERRADO",
    totalListados: 0,
    subidoPor: "migration-script",
    creadoEn: now,
    actualizadoEn: now,
  });
  const loteId = loteRef.id;
  console.log(`Lote creado: ${loteId}`);

  // 2. Buscar listados sin loteId
  const snap = await db.collection("escalafon_listados").get();
  const sinLote = snap.docs.filter((doc) => !doc.data().loteId);
  console.log(`Listados sin loteId: ${sinLote.length}`);

  if (sinLote.length === 0) {
    console.log("Nada que migrar. Eliminando lote creado...");
    await loteRef.delete();
    return;
  }

  // 3. Actualizar en batches de 500
  const BATCH_SIZE = 500;
  let count = 0;
  for (let i = 0; i < sinLote.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = sinLote.slice(i, i + BATCH_SIZE);
    chunk.forEach((doc) => {
      batch.update(doc.ref, { loteId });
    });
    await batch.commit();
    count += chunk.length;
    console.log(`  Migrados: ${count}/${sinLote.length}`);
  }

  // 4. Actualizar totalListados en el lote
  await loteRef.update({
    totalListados: FieldValue.increment(sinLote.length),
    actualizadoEn: Timestamp.now(),
  });

  console.log(
    `Migración completa. ${sinLote.length} listados asignados al lote "${loteId}".`,
  );
}

run().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});

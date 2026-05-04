// scripts/migrations/rebuild-nombre-completo-lowercase.ts
//
// Reconstruye el campo `nombreCompletoLowercase` para todos los usuarios
// con el nuevo orden: apellidoPaterno apellidoMaterno nombre
// (antes era: nombre apellidoPaterno apellidoMaterno)
//
// Ejecutar con:
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//     npx ts-node -r tsconfig-paths/register scripts/migrations/rebuild-nombre-completo-lowercase.ts

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(
    process.env.HOME || "",
    ".config/firebase/sntss-service-account.json",
  );

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account no encontrado: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

function normalizeSearchText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function main() {
  console.log("=== rebuild-nombre-completo-lowercase ===\n");

  const snapshot = await db.collection("users").get();
  console.log(`Total usuarios: ${snapshot.size}\n`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const apellidoPaterno = data.apellidoPaterno || "";
    const apellidoMaterno = data.apellidoMaterno || "";
    const nombre = data.nombre || "";

    // Nuevo orden: apellidoPaterno apellidoMaterno nombre
    const nuevoCampo = normalizeSearchText(
      [apellidoPaterno, apellidoMaterno, nombre].filter(Boolean).join(" "),
    );

    if (data.nombreCompletoLowercase === nuevoCampo) {
      skipped++;
      continue;
    }

    batch.update(docSnap.ref, {
      nombreCompletoLowercase: nuevoCampo,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batchCount++;
    updated++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Batch de ${BATCH_SIZE} commits...`);
      batch = db.batch();
      batchCount = 0;
    }

    console.log(
      `  ✓ ${data.email || docSnap.id}: "${data.nombreCompletoLowercase}" → "${nuevoCampo}"`,
    );
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n✓ Actualizados: ${updated} | Sin cambios: ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

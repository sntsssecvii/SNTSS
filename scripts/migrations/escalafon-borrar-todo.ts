/**
 * Script de limpieza: borra TODOS los documentos de escalafon_listados,
 * escalafon_aspirantes y escalafon_lotes.
 *
 * Uso: npx tsx scripts/migrations/escalafon-borrar-todo.ts
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const serviceAccount = require(
  `${process.env.HOME}/.config/firebase/sntss-service-account.json`,
);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function borrarColeccion(nombre: string) {
  let total = 0;
  let snap = await db.collection(nombre).limit(500).get();

  while (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snap.docs.length;
    console.log(`  ${nombre}: borrados ${total}...`);
    snap = await db.collection(nombre).limit(500).get();
  }
  console.log(`  ${nombre}: ${total} documentos eliminados.`);
}

async function main() {
  console.log("Borrando colecciones de escalafón...\n");
  await borrarColeccion("escalafon_aspirantes");
  await borrarColeccion("escalafon_listados");
  await borrarColeccion("escalafon_lotes");
  console.log("\nListo. Puedes volver a subir los PDFs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

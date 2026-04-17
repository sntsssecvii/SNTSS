// scripts/normalize-nombres.ts
// Ejecutar con:
// GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//   npx ts-node -r tsconfig-paths/register scripts/normalize-nombres.ts

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// Cargar service account
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
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

// Partículas que NO se capitalizan (excepto al inicio de la cadena)
const PARTICULAS = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "e",
  "o",
  "u",
]);

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .trim()
    .split(/\s+/)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && PARTICULAS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

interface ChangeLog {
  uid: string;
  email: string;
  antes: {
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  };
  despues: {
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  };
}

async function main() {
  console.log("=== normalize-nombres ===\n");

  const snapshot = await db
    .collection("users")
    .where("role", "!=", "SUPER_ADMIN")
    .get();

  console.log(
    `Total usuarios a revisar (excl. SUPER_ADMIN): ${snapshot.size}\n`,
  );

  const changes: ChangeLog[] = [];
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const uid = docSnap.id;

    const nombreOriginal = data.nombre || "";
    const apellidoPaternoOriginal = data.apellidoPaterno || "";
    const apellidoMaternoOriginal = data.apellidoMaterno || "";

    const nombreNormalizado = toTitleCase(nombreOriginal);
    const apellidoPaternoNormalizado = toTitleCase(apellidoPaternoOriginal);
    const apellidoMaternoNormalizado = apellidoMaternoOriginal
      ? toTitleCase(apellidoMaternoOriginal)
      : apellidoMaternoOriginal;

    const changed =
      nombreNormalizado !== nombreOriginal ||
      apellidoPaternoNormalizado !== apellidoPaternoOriginal ||
      apellidoMaternoNormalizado !== apellidoMaternoOriginal;

    if (!changed) {
      skipped++;
      continue;
    }

    // Actualizar Firestore
    await docSnap.ref.update({
      nombre: nombreNormalizado,
      apellidoPaterno: apellidoPaternoNormalizado,
      apellidoMaterno: apellidoMaternoNormalizado,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Actualizar displayName en Firebase Auth
    const displayName = [
      nombreNormalizado,
      apellidoPaternoNormalizado,
      apellidoMaternoNormalizado,
    ]
      .filter(Boolean)
      .join(" ");

    try {
      await auth.updateUser(uid, { displayName });
    } catch (err) {
      console.warn(
        `  ⚠ No se pudo actualizar Auth displayName para ${uid}:`,
        err,
      );
    }

    changes.push({
      uid,
      email: data.email || "",
      antes: {
        nombre: nombreOriginal,
        apellidoPaterno: apellidoPaternoOriginal,
        apellidoMaterno: apellidoMaternoOriginal,
      },
      despues: {
        nombre: nombreNormalizado,
        apellidoPaterno: apellidoPaternoNormalizado,
        apellidoMaterno: apellidoMaternoNormalizado,
      },
    });

    updated++;
    console.log(
      `  ✓ ${data.email}: "${nombreOriginal}" → "${nombreNormalizado}"`,
    );
  }

  // Guardar log
  const logDir = path.join(process.cwd(), "artifacts");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(
    logDir,
    `normalize-nombres-${new Date().toISOString().slice(0, 10)}.json`,
  );
  fs.writeFileSync(logPath, JSON.stringify(changes, null, 2), "utf-8");

  console.log(`\n✓ Actualizados: ${updated} | Sin cambios: ${skipped}`);
  console.log(`✓ Log guardado en: ${logPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

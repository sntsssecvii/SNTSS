// scripts/send-reactivacion-rechazados.ts
// Envía correo de reactivación a todos los usuarios con status "rejected".
//
// Ejecutar con:
//   RESEND_API_KEY=re_xxx \
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//   npx ts-node -r tsconfig-paths/register scripts/send-reactivacion-rechazados.ts
//
// Flags opcionales:
//   --dry-run     Lista destinatarios sin enviar correos
//   --limit=N     Limita el envío a los primeros N usuarios

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import { Resend } from "resend";
import { reactivationTemplate } from "../src/lib/email-templates";

// ── Firebase init ──────────────────────────────────────────────────────────────

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

const db = admin.firestore();

// ── Resend init ────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("Falta RESEND_API_KEY como variable de entorno.");
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);
const FROM_EMAIL = "SNTSS Sección VII <notificaciones@sntssvii.com>";

// ── Args ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1] ?? "0", 10) : 0;

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RejectedUser {
  uid: string;
  nombre: string;
  apellidoPaterno: string;
  email: string;
  rejectionReason: string;
}

async function fetchAllRejected(): Promise<RejectedUser[]> {
  const users: RejectedUser[] = [];
  let query = db
    .collection("users")
    .where("status", "==", "rejected")
    .limit(100);

  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

  while (true) {
    const snapshot: admin.firestore.QuerySnapshot = lastDoc
      ? await query.startAfter(lastDoc).get()
      : await query.get();

    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      users.push({
        uid: doc.id,
        nombre: `${data.nombre ?? ""} ${data.apellidoPaterno ?? ""}`.trim(),
        apellidoPaterno: data.apellidoPaterno ?? "",
        email: data.email ?? "",
        rejectionReason: data.rejectionReason ?? "(sin motivo especificado)",
      });
    }

    if (snapshot.docs.length < 100) break;
    lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
  }

  return users;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Obteniendo usuarios rechazados...");
  let users = await fetchAllRejected();
  console.log(`Total rechazados: ${users.length}`);

  if (limit > 0) {
    users = users.slice(0, limit);
    console.log(`Limitado a los primeros ${limit} usuarios.`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Destinatarios:");
    users.forEach((u, i) => {
      console.log(
        `  ${i + 1}. ${u.nombre} <${u.email}> — ${u.rejectionReason}`,
      );
    });
    console.log("\nEjecuta sin --dry-run para enviar los correos.");
    return;
  }

  let sent = 0;
  let failed = 0;
  const errors: { email: string; error: string }[] = [];

  for (const user of users) {
    if (!user.email) {
      console.warn(`  [SKIP] UID ${user.uid} — sin email`);
      failed++;
      continue;
    }

    try {
      const html = reactivationTemplate(user.nombre, user.rejectionReason);
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: "Aún puedes registrarte — Portal SNTSS Sección VII",
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log(`  [OK] ${user.nombre} <${user.email}>`);
      sent++;
    } catch (err: any) {
      const msg = err?.message ?? "error desconocido";
      console.error(`  [FAIL] ${user.nombre} <${user.email}> — ${msg}`);
      errors.push({ email: user.email, error: msg });
      failed++;
    }

    // 300ms entre envíos para no golpear el rate limit de Resend
    await sleep(300);
  }

  console.log(`\nResumen:`);
  console.log(`  Enviados: ${sent}`);
  console.log(`  Fallidos: ${failed}`);

  if (errors.length > 0) {
    console.log("\nErrores:");
    errors.forEach((e) => console.log(`  - ${e.email}: ${e.error}`));
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

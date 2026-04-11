// scripts/create-admin-users.ts
// Ejecutar con:
// GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/sntss-service-account.json \
//   npx ts-node -r tsconfig-paths/register scripts/create-admin-users.ts

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
    storageBucket: serviceAccount.project_id + ".appspot.com",
  });
}

const auth = admin.auth();
const db = admin.firestore();

interface AdminUserSpec {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  email: string;
  password: string; // CAMBIAR INMEDIATAMENTE DESPUÉS DE CREAR
  role: "SUPER_ADMIN" | "BOLSA";
  isDeveloper: boolean;
}

const ADMIN_USERS: AdminUserSpec[] = [
  {
    nombre: "Gerardo",
    apellidoPaterno: "Arroyo",
    email: "gerardoyx@gmail.com",
    password: "123456", // CAMBIAR INMEDIATAMENTE
    role: "SUPER_ADMIN",
    isDeveloper: true,
  },
  {
    nombre: "Juan Miguel",
    apellidoPaterno: "Espinoza",
    apellidoMaterno: "Aguilar",
    email: "admin@sntssvii.com",
    password: "123456", // CAMBIAR INMEDIATAMENTE
    role: "SUPER_ADMIN",
    isDeveloper: false,
  },
  {
    nombre: "Gabriela",
    apellidoPaterno: "Chapital",
    email: "gaby.chapital@hotmail.com",
    password: "123456", // CAMBIAR INMEDIATAMENTE
    role: "BOLSA",
    isDeveloper: false,
  },
];

async function createOrUpdateUser(spec: AdminUserSpec): Promise<void> {
  const displayName = [spec.nombre, spec.apellidoPaterno, spec.apellidoMaterno]
    .filter(Boolean)
    .join(" ");

  let uid: string;
  let action: "CREADO" | "ACTUALIZADO";

  try {
    const existing = await auth.getUserByEmail(spec.email);
    uid = existing.uid;
    action = "ACTUALIZADO";
  } catch {
    const created = await auth.createUser({
      email: spec.email,
      password: spec.password,
      displayName,
    });
    uid = created.uid;
    action = "CREADO";
  }

  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        uid,
        nombre: spec.nombre,
        apellidoPaterno: spec.apellidoPaterno,
        apellidoMaterno: spec.apellidoMaterno ?? null,
        email: spec.email,
        role: spec.role,
        status: "active",
        isDeveloper: spec.isDeveloper,
        matricula: "",
        documents: {
          identificacion: null,
          tarjeton: null,
          constanciaAfiliacion: null,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  console.log(
    `[${action}] ${spec.email} — rol: ${spec.role}, isDeveloper: ${spec.isDeveloper}, uid: ${uid}`,
  );
}

async function main() {
  console.log("=== create-admin-users ===\n");
  for (const user of ADMIN_USERS) {
    await createOrUpdateUser(user);
  }
  console.log("\n✓ Listo. RECUERDA CAMBIAR LAS CONTRASEÑAS INMEDIATAMENTE.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

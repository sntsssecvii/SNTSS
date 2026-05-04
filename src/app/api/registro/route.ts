import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { sendRegistrationEmail } from "@/lib/email";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { buildUserSearchFields } from "@/lib/firebase/user-search";
import { registroSchema } from "@/lib/schemas/registro";
import { assertSameOrigin } from "@/lib/security/cors";
import { RateLimitError } from "@/lib/security/rate-limit";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { toTitleCase } from "@/lib/utils/text";

export const dynamic = "force-dynamic";

const MAX_REGISTRATION_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_REGISTRATION_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

async function writeRegistrationAuditLog(input: {
  status: "SUCCESS" | "ERROR";
  email: string;
  uid?: string | null;
  ip: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
}) {
  await adminDb.collection("registration_audit_logs").add({
    ...input,
    createdAt: new Date(),
  });
}

function buildStorageDownloadUrl(
  bucketName: string,
  filePath: string,
  token: string,
) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

function getStringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getFileField(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function validateRegistrationFile(file: File | null, label: string) {
  if (!file) {
    throw new Error(`${label.toUpperCase()}_REQUIRED`);
  }

  if (!ALLOWED_REGISTRATION_FILE_TYPES.has(file.type)) {
    throw new Error(`${label.toUpperCase()}_INVALID_TYPE`);
  }

  if (file.size <= 0 || file.size > MAX_REGISTRATION_FILE_SIZE_BYTES) {
    throw new Error(`${label.toUpperCase()}_INVALID_SIZE`);
  }
}

async function uploadRegistrationFile(
  userUid: string,
  file: File,
  type: "identificacion" | "tarjeton" | "constanciaAfiliacion",
) {
  const bucket = adminStorage.bucket();
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
  const timestamp = Date.now();
  const safeExtension = extension ? `.${extension}` : "";
  const filePath = `uploads/${userUid}/${type}_${timestamp}${safeExtension}`;
  const downloadToken = randomUUID();
  const storageFile = bucket.file(filePath);
  const bytes = Buffer.from(await file.arrayBuffer());

  await storageFile.save(bytes, {
    resumable: false,
    contentType: file.type,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        originalName: file.name,
      },
    },
  });

  return {
    path: filePath,
    url: buildStorageDownloadUrl(bucket.name, filePath, downloadToken),
  };
}

export async function POST(request: NextRequest) {
  let createdUid: string | null = null;
  const uploadedPaths: string[] = [];
  let auditEmail = "";
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    assertSameOrigin(request);
    // Límite por IP generoso para cubrir redes compartidas (delegaciones, hospitales).
    // El límite real de abuso está en el bucket por email (3/hr).
    await enforceRateLimitRedis(request, {
      bucket: "api:registro:create:ip",
      limit: 200,
      windowMs: 5 * 60_000,
    });

    const formData = await request.formData();
    const payload = {
      nombre: toTitleCase(getStringField(formData, "nombre")),
      apellidoPaterno: toTitleCase(getStringField(formData, "apellidoPaterno")),
      apellidoMaterno: toTitleCase(getStringField(formData, "apellidoMaterno")),
      matricula: getStringField(formData, "matricula"),
      email: getStringField(formData, "email").toLowerCase(),
      password: getStringField(formData, "password"),
      confirmPassword: getStringField(formData, "confirmPassword"),
    };
    auditEmail = payload.email;

    await enforceRateLimitRedis(request, {
      bucket: "api:registro:create:email",
      limit: 3,
      windowMs: 60 * 60_000,
      identifier: payload.email,
    });

    const parsed = registroSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message || "Los datos de registro no son válidos.",
        },
        { status: 400 },
      );
    }

    const identificacion = getFileField(formData, "identificacion");
    const tarjeton = getFileField(formData, "tarjeton");
    const constanciaAfiliacion = getFileField(formData, "constanciaAfiliacion");
    const searchFields = buildUserSearchFields({
      email: parsed.data.email,
      matricula: parsed.data.matricula,
      nombre: parsed.data.nombre,
      apellidoPaterno: parsed.data.apellidoPaterno,
      apellidoMaterno: parsed.data.apellidoMaterno,
    });

    validateRegistrationFile(identificacion, "identificacion");
    validateRegistrationFile(tarjeton, "tarjeton");
    validateRegistrationFile(constanciaAfiliacion, "constanciaafiliacion");
    const constanciaAfiliacionFile = constanciaAfiliacion as File;

    const identificacionFile = identificacion as File;
    const tarjetonFile = tarjeton as File;

    const displayName = [
      parsed.data.nombre,
      parsed.data.apellidoPaterno,
      parsed.data.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const [existingEmailProfile, existingMatriculaProfile] = await Promise.all([
      adminDb
        .collection("users")
        .where("emailLowercase", "==", searchFields.emailLowercase)
        .limit(1)
        .get(),
      adminDb
        .collection("users")
        .where("matriculaNormalized", "==", searchFields.matriculaNormalized)
        .limit(1)
        .get(),
    ]);

    const docByEmail = existingEmailProfile.docs[0];
    const docByMatricula = existingMatriculaProfile.docs[0];

    // Usuarios rechazados pueden volver a registrarse — limpiamos su registro anterior.
    // Si el bloqueo es por un usuario activo o pendiente, rechazamos normalmente.
    if (docByEmail) {
      if (docByEmail.data().status === "rejected") {
        await Promise.all([
          adminAuth.deleteUser(docByEmail.id).catch(() => null),
          docByEmail.ref.delete(),
        ]);
      } else {
        return NextResponse.json(
          { error: "Este correo ya está registrado." },
          { status: 409 },
        );
      }
    }

    if (docByMatricula && docByMatricula.id !== docByEmail?.id) {
      if (docByMatricula.data().status === "rejected") {
        await Promise.all([
          adminAuth.deleteUser(docByMatricula.id).catch(() => null),
          docByMatricula.ref.delete(),
        ]);
      } else {
        return NextResponse.json(
          { error: "Ya existe una solicitud registrada para esta matrícula." },
          { status: 409 },
        );
      }
    }

    // Recuperar usuario huérfano: puede existir en Auth sin doc en Firestore si un
    // request anterior fue interrumpido (timeout, caída de red) después de createUser
    // pero antes de escribir en Firestore. En ese caso lo eliminamos para permitir
    // que el usuario vuelva a registrarse correctamente.
    try {
      const orphanedAuthUser = await adminAuth.getUserByEmail(
        parsed.data.email,
      );
      await adminAuth.deleteUser(orphanedAuthUser.uid);
    } catch (authLookupError: any) {
      if (authLookupError?.code !== "auth/user-not-found") {
        throw authLookupError;
      }
      // No existe en Auth → flujo normal
    }

    const authUser = await adminAuth.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      displayName,
    });
    createdUid = authUser.uid;

    const [identificacionUpload, tarjetonUpload, constanciaUpload] =
      await Promise.all([
        uploadRegistrationFile(
          authUser.uid,
          identificacionFile,
          "identificacion",
        ),
        uploadRegistrationFile(authUser.uid, tarjetonFile, "tarjeton"),
        uploadRegistrationFile(
          authUser.uid,
          constanciaAfiliacionFile,
          "constanciaAfiliacion",
        ),
      ]);

    uploadedPaths.push(
      identificacionUpload.path,
      tarjetonUpload.path,
      constanciaUpload.path,
    );

    await adminDb
      .collection("users")
      .doc(authUser.uid)
      .set({
        uid: authUser.uid,
        nombre: parsed.data.nombre,
        apellidoPaterno: parsed.data.apellidoPaterno,
        apellidoMaterno: parsed.data.apellidoMaterno ?? null,
        matricula: parsed.data.matricula,
        email: parsed.data.email,
        role: "user",
        status: "pending",
        documents: {
          identificacion: identificacionUpload.url,
          tarjeton: tarjetonUpload.url,
          constanciaAfiliacion: constanciaUpload.url,
        },
        ...searchFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    const adminUsersSnapshot = await adminDb
      .collection("users")
      .where("role", "in", ["ADMIN", "SUPER_ADMIN", "admin"])
      .get()
      .catch(() => null);

    if (adminUsersSnapshot) {
      const batch = adminDb.batch();
      adminUsersSnapshot.docs.forEach((adminDoc) => {
        batch.set(adminDb.collection("notifications").doc(), {
          userId: adminDoc.id,
          title: "Nuevo Registro Pendiente",
          message: `El usuario ${parsed.data.nombre} ${parsed.data.apellidoPaterno} se ha registrado y espera validación.`,
          type: "registration",
          link: "/admin/validaciones",
          read: false,
          createdAt: new Date(),
        });
      });
      await batch.commit();
    }

    let emailWarning: string | null = null;
    try {
      await sendRegistrationEmail(parsed.data.email, parsed.data.nombre);
    } catch (error) {
      console.error("Error enviando correo de registro:", error);
      emailWarning =
        "La solicitud se registró, pero no se pudo enviar el correo de confirmación.";
    }

    await writeRegistrationAuditLog({
      status: "SUCCESS",
      email: parsed.data.email,
      uid: authUser.uid,
      ip: clientIp,
      userAgent,
      metadata: {
        uploadedPathsCount: uploadedPaths.length,
        emailWarning: emailWarning || null,
      },
    }).catch((auditError) => {
      console.error(
        "Error escribiendo auditoría de registro exitoso:",
        auditError,
      );
    });

    return NextResponse.json({
      success: true,
      data: {
        uid: authUser.uid,
        status: "pending",
      },
      warning: emailWarning,
    });
  } catch (error: any) {
    console.error("Error en registro público:", error);

    if (error?.message === "CORS_FORBIDDEN") {
      return NextResponse.json(
        { error: "Acceso no permitido." },
        { status: 403 },
      );
    }

    if (uploadedPaths.length > 0) {
      const bucket = adminStorage.bucket();
      await Promise.all(
        uploadedPaths.map(async (filePath) => {
          try {
            await bucket.file(filePath).delete();
          } catch (cleanupError) {
            console.error("Error limpiando archivo de registro:", cleanupError);
          }
        }),
      );
    }

    if (createdUid) {
      try {
        await adminAuth.deleteUser(createdUid);
      } catch (cleanupError) {
        console.error(
          "Error limpiando usuario huérfano en Auth:",
          cleanupError,
        );
      }
    }

    await writeRegistrationAuditLog({
      status: "ERROR",
      email: auditEmail || "unknown",
      uid: createdUid,
      ip: clientIp,
      userAgent,
      metadata: {
        error: error?.message || "UNKNOWN_ERROR",
        uploadedPathsCount: uploadedPaths.length,
      },
    }).catch((auditError) => {
      console.error(
        "Error escribiendo auditoría de registro fallido:",
        auditError,
      );
    });

    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    if (error?.code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "Este correo ya está registrado." },
        { status: 409 },
      );
    }

    if (error?.code === "auth/weak-password") {
      return NextResponse.json(
        {
          error:
            "La contraseña no cumple los requisitos de seguridad de Firebase. Usa al menos 8 caracteres con letras y números.",
        },
        { status: 400 },
      );
    }

    if (typeof error?.message === "string") {
      if (error.message.endsWith("_REQUIRED")) {
        return NextResponse.json(
          { error: "Faltan documentos requeridos para completar el registro." },
          { status: 400 },
        );
      }

      if (error.message.endsWith("_INVALID_TYPE")) {
        return NextResponse.json(
          { error: "Solo se aceptan archivos JPG, PNG, WEBP o PDF." },
          { status: 400 },
        );
      }

      if (error.message.endsWith("_INVALID_SIZE")) {
        return NextResponse.json(
          { error: "Cada archivo debe pesar máximo 5 MB." },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        error: "No se pudo completar el registro.",
        details: error?.message || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}

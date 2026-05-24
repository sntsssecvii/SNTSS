import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";

import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

type DocType = "identificacion" | "tarjeton" | "constanciaAfiliacion";
const DOC_TYPES: DocType[] = [
  "identificacion",
  "tarjeton",
  "constanciaAfiliacion",
];

function buildStorageDownloadUrl(
  bucketName: string,
  filePath: string,
  token: string,
) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

async function uploadDoc(userUid: string, file: File, type: DocType) {
  const bucket = adminStorage.bucket();
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
  const filePath = `uploads/${userUid}/${type}_admin_${Date.now()}${ext}`;
  const token = randomUUID();
  const bytes = Buffer.from(await file.arrayBuffer());

  await bucket.file(filePath).save(bytes, {
    resumable: false,
    contentType: file.type,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token,
        originalName: file.name,
      },
    },
  });

  return buildStorageDownloadUrl(bucket.name, filePath, token);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  let actorUid = "";
  let actorEmail = "";
  let targetUid = "";

  try {
    enforceRateLimit(request, {
      bucket: "api:admin:validaciones:documentos",
      limit: 20,
      windowMs: 60_000,
    });

    const adminContext = await requireAdminRequest(request);
    actorUid = adminContext.uid;
    actorEmail = adminContext.email || "";

    const { uid } = await params;
    targetUid = uid;

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    }

    const formData = await request.formData();
    const updatedDocs: Partial<Record<DocType, string>> = {};

    for (const type of DOC_TYPES) {
      const file = formData.get(type);
      if (!(file instanceof File) || file.size === 0) continue;

      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Tipo de archivo no permitido para ${type}.` },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `El archivo ${type} supera el límite de 5 MB.` },
          { status: 400 },
        );
      }

      updatedDocs[type] = await uploadDoc(uid, file, type);
    }

    if (Object.keys(updatedDocs).length === 0) {
      return NextResponse.json(
        { error: "No se enviaron archivos." },
        { status: 400 },
      );
    }

    const docUpdates = Object.fromEntries(
      Object.entries(updatedDocs).map(([k, v]) => [`documents.${k}`, v]),
    );

    await userRef.update({
      ...docUpdates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAdminAuditLog({
      action: "USER_DOCUMENTS_REPLACED",
      actorUid,
      actorEmail,
      targetType: "users",
      targetId: uid,
      status: "SUCCESS",
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      metadata: { replacedDocs: Object.keys(updatedDocs) },
    });

    return NextResponse.json({
      success: true,
      data: { documents: updatedDocs },
    });
  } catch (error: any) {
    console.error("Error reemplazando documentos:", error);

    if (actorUid && targetUid) {
      await writeAdminAuditLog({
        action: "USER_DOCUMENTS_REPLACED",
        actorUid,
        actorEmail,
        targetType: "users",
        targetId: targetUid,
        status: "ERROR",
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
        metadata: { error: error?.message || "UNKNOWN_ERROR" },
      }).catch(() => null);
    }

    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Se requiere perfil de administrador." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "No se pudieron reemplazar los documentos." },
      { status: 500 },
    );
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { normalizeUserRole } from "@/lib/auth/roles";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { buildUserSearchFields } from "@/lib/firebase/user-search";
import {
  requireSuperAdminRequest,
  requireDeveloperRequest,
} from "@/lib/firebase/server-auth";
import { ROLES } from "@/types/roles";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { toTitleCase } from "@/lib/utils/text";

const ALLOWED_ROLES = new Set<string>(Object.values(ROLES));
const ALLOWED_STATUS = new Set(["pending", "active", "rejected"]);

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:global:usuarios:get",
      limit: 60,
      windowMs: 60_000,
    });
    await requireDeveloperRequest(request);

    const { uid } = await params;
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    }

    const data = userSnap.data() || {};

    // Generar signed URLs (1 hora) para los documentos en Storage
    const bucket = adminStorage.bucket();
    const docFields = [
      "identificacion",
      "tarjeton",
      "constanciaAfiliacion",
    ] as const;
    const signedDocs: Record<string, string | null> = {};

    await Promise.all(
      docFields.map(async (field) => {
        const rawPath: unknown = data.documents?.[field];
        if (!rawPath || typeof rawPath !== "string") {
          signedDocs[field] = null;
          return;
        }

        // Extraer la ruta relativa dentro del bucket desde la URL de Firebase Storage
        // Formato: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?...
        try {
          const match = rawPath.match(/\/o\/([^?]+)/);
          if (!match) {
            signedDocs[field] = rawPath;
            return;
          }
          const filePath = decodeURIComponent(match[1]);
          const file = bucket.file(filePath);
          const [url] = await file.getSignedUrl({
            action: "read",
            expires: Date.now() + 60 * 60 * 1000, // 1 hora
          });
          signedDocs[field] = url;
        } catch {
          signedDocs[field] = null;
        }
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        uid,
        email: data.email || null,
        nombre: data.nombre || null,
        apellidoPaterno: data.apellidoPaterno || null,
        apellidoMaterno: data.apellidoMaterno || null,
        matricula: data.matricula || null,
        curp: data.curp || null,
        role: normalizeUserRole(data.role),
        status: data.status || "pending",
        createdAtMs: data.createdAt?.toMillis?.() ?? null,
        updatedAtMs: data.updatedAt?.toMillis?.() ?? null,
        validatedAt: data.validatedAt?.toMillis?.() ?? null,
        validatedBy: data.validatedBy || null,
        documents: signedDocs,
      },
    });
  } catch (error: any) {
    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    }
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (
      error?.message === "SUPER_ADMIN_REQUIRED" ||
      error?.message === "DEVELOPER_REQUIRED"
    ) {
      return NextResponse.json(
        { error: "Se requiere acceso de desarrollador." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "No se pudo obtener el usuario." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  let actorUid = "";
  let actorEmail = "";
  let targetUid = "";

  try {
    enforceRateLimit(request, {
      bucket: "api:admin:global:usuarios:update",
      limit: 30,
      windowMs: 60_000,
    });
    const adminContext = await requireSuperAdminRequest(request);
    actorUid = adminContext.uid;
    actorEmail = adminContext.email || "";

    const { uid } = await params;
    targetUid = uid;
    const body = await request.json().catch(() => ({}));

    const nextRole =
      typeof body?.role === "string" ? normalizeUserRole(body.role) : undefined;
    const nextStatus =
      typeof body?.status === "string"
        ? body.status.trim().toLowerCase()
        : undefined;
    const nextNombre =
      typeof body?.nombre === "string" ? toTitleCase(body.nombre) : undefined;
    const nextApellidoPaterno =
      typeof body?.apellidoPaterno === "string"
        ? toTitleCase(body.apellidoPaterno)
        : undefined;
    const nextApellidoMaterno =
      typeof body?.apellidoMaterno === "string"
        ? toTitleCase(body.apellidoMaterno)
        : undefined;
    const nextMatricula =
      typeof body?.matricula === "string"
        ? body.matricula.trim().toUpperCase()
        : undefined;

    const hasProfileChange =
      nextNombre !== undefined ||
      nextApellidoPaterno !== undefined ||
      nextApellidoMaterno !== undefined ||
      nextMatricula !== undefined;

    if (!nextRole && !nextStatus && !hasProfileChange) {
      return NextResponse.json(
        { error: "No se enviaron cambios válidos." },
        { status: 400 },
      );
    }

    if (nextRole && !ALLOWED_ROLES.has(nextRole)) {
      return NextResponse.json({ error: "Rol no válido." }, { status: 400 });
    }

    if (nextStatus && !ALLOWED_STATUS.has(nextStatus)) {
      return NextResponse.json(
        { error: "Estatus no válido." },
        { status: 400 },
      );
    }

    if (actorUid === uid) {
      if (nextRole && nextRole !== ROLES.SUPER_ADMIN) {
        return NextResponse.json(
          {
            error:
              "No puedes quitarte el rol de admin global desde esta interfaz.",
          },
          { status: 400 },
        );
      }

      if (nextStatus && nextStatus !== "active") {
        return NextResponse.json(
          {
            error:
              "No puedes desactivar tu propia cuenta global desde esta interfaz.",
          },
          { status: 400 },
        );
      }
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    }

    const currentData = userSnap.data() || {};
    const currentRole = normalizeUserRole(currentData.role);
    const currentStatus = currentData.status || "pending";

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (nextRole && nextRole !== currentRole) {
      updates.role = nextRole;
    }

    if (nextStatus && nextStatus !== currentStatus) {
      updates.status = nextStatus;
      updates.rejectionReason =
        nextStatus === "rejected"
          ? currentData.rejectionReason || "Actualizado por admin global."
          : FieldValue.delete();
    }

    if (hasProfileChange) {
      const resolvedNombre = nextNombre ?? currentData.nombre ?? "";
      const resolvedApellidoPaterno =
        nextApellidoPaterno ?? currentData.apellidoPaterno ?? "";
      const resolvedApellidoMaterno =
        nextApellidoMaterno ?? currentData.apellidoMaterno ?? null;
      const resolvedMatricula = nextMatricula ?? currentData.matricula ?? "";

      if (nextNombre !== undefined) updates.nombre = resolvedNombre;
      if (nextApellidoPaterno !== undefined)
        updates.apellidoPaterno = resolvedApellidoPaterno;
      if (nextApellidoMaterno !== undefined)
        updates.apellidoMaterno = resolvedApellidoMaterno;
      if (nextMatricula !== undefined) updates.matricula = resolvedMatricula;

      const searchFields = buildUserSearchFields({
        email: currentData.email,
        matricula: resolvedMatricula,
        nombre: resolvedNombre,
        apellidoPaterno: resolvedApellidoPaterno,
        apellidoMaterno: resolvedApellidoMaterno,
      });
      Object.assign(updates, searchFields);

      // Actualizar displayName en Firebase Auth
      const newDisplayName = [
        resolvedNombre,
        resolvedApellidoPaterno,
        resolvedApellidoMaterno,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      await adminAuth
        .updateUser(uid, { displayName: newDisplayName })
        .catch(() => null);
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({
        success: true,
        data: {
          uid,
          role: currentRole,
          status: currentStatus,
          unchanged: true,
        },
      });
    }

    await userRef.update(updates);

    await writeAdminAuditLog({
      action: "GLOBAL_USER_UPDATED",
      actorUid,
      actorEmail,
      targetType: "users",
      targetId: uid,
      status: "SUCCESS",
      metadata: {
        previousRole: currentRole,
        nextRole: nextRole || currentRole,
        previousStatus: currentStatus,
        nextStatus: nextStatus || currentStatus,
        profileFieldsUpdated: hasProfileChange
          ? Object.keys({
              nombre: nextNombre,
              apellidoPaterno: nextApellidoPaterno,
              apellidoMaterno: nextApellidoMaterno,
              matricula: nextMatricula,
            }).filter((k) => updates[k] !== undefined)
          : [],
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        uid,
        role: nextRole || currentRole,
        status: nextStatus || currentStatus,
      },
    });
  } catch (error: any) {
    console.error("Error actualizando usuario global:", error);

    if (targetUid && actorUid) {
      await writeAdminAuditLog({
        action: "GLOBAL_USER_UPDATED",
        actorUid,
        actorEmail,
        targetType: "users",
        targetId: targetUid,
        status: "ERROR",
        metadata: {
          error: error?.message || "UNKNOWN_ERROR",
        },
      }).catch((auditError) => {
        console.error("Error escribiendo auditoría de fallo:", auditError);
      });
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

    if (error?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Perfil no encontrado." },
        { status: 404 },
      );
    }

    if (error?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa." },
        { status: 403 },
      );
    }

    if (error?.message === "SUPER_ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Se requiere perfil de admin global." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        error: "No se pudo actualizar el usuario.",
        details: error?.message || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  let actorUid = "";
  let actorEmail = "";
  let targetUid = "";

  try {
    enforceRateLimit(request, {
      bucket: "api:admin:global:usuarios:delete",
      limit: 10,
      windowMs: 60_000,
    });
    const adminContext = await requireDeveloperRequest(request);
    actorUid = adminContext.uid;
    actorEmail = adminContext.email || "";

    const { uid } = await params;
    targetUid = uid;

    if (actorUid === uid) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta desde esta interfaz." },
        { status: 400 },
      );
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    }

    await Promise.all([
      adminAuth.deleteUser(uid).catch(() => null),
      userRef.delete(),
    ]);

    await writeAdminAuditLog({
      action: "GLOBAL_USER_DELETED",
      actorUid,
      actorEmail,
      targetType: "users",
      targetId: uid,
      status: "SUCCESS",
      metadata: { deletedEmail: userSnap.data()?.email || null },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error eliminando usuario global:", error);

    if (targetUid && actorUid) {
      await writeAdminAuditLog({
        action: "GLOBAL_USER_DELETED",
        actorUid,
        actorEmail,
        targetType: "users",
        targetId: targetUid,
        status: "ERROR",
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

    if (
      error?.message === "SUPER_ADMIN_REQUIRED" ||
      error?.message === "DEVELOPER_REQUIRED"
    ) {
      return NextResponse.json(
        { error: "Se requiere acceso de desarrollador." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        error: "No se pudo eliminar el usuario.",
        details: error?.message || "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}

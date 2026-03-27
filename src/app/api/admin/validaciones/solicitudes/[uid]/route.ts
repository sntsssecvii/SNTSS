import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { sendApprovalEmail, sendRejectionEmail } from "@/lib/email";
import { adminDb } from "@/lib/firebase/admin";
import {
  requireAdminRequest,
  handleAdminRouteError,
} from "@/lib/firebase/server-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";

type UserStatus = "active" | "rejected";

function getFullName(data: Record<string, any>) {
  return [data.nombre, data.apellidoPaterno, data.apellidoMaterno]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:validaciones:accion",
      limit: 30,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const { uid } = await params;
    const body = await request.json().catch(() => ({}));
    const nextStatus = body?.status as UserStatus | undefined;
    const rejectionReason =
      typeof body?.rejectionReason === "string"
        ? body.rejectionReason.trim()
        : "";

    if (nextStatus !== "active" && nextStatus !== "rejected") {
      return NextResponse.json(
        { error: "Estatus de acción no válido." },
        { status: 400 },
      );
    }

    if (nextStatus === "rejected" && !rejectionReason) {
      return NextResponse.json(
        { error: "La razón de rechazo es obligatoria." },
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

    const userData = userSnap.data() || {};
    const fullName = getFullName(userData);

    await userRef.update({
      status: nextStatus,
      rejectionReason:
        nextStatus === "rejected" ? rejectionReason : FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: uid,
      title:
        nextStatus === "active" ? "¡Cuenta Activada!" : "Solicitud Rechazada",
      message:
        nextStatus === "active"
          ? "Tu solicitud de registro ha sido aprobada. Ya puedes acceder a todas las funcionalidades."
          : `Tu solicitud ha sido rechazada. Razón: ${rejectionReason}`,
      type: "system",
      link: nextStatus === "active" ? "/admin/perfil" : null,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (userData.email) {
      if (nextStatus === "active") {
        await sendApprovalEmail(userData.email, fullName);
      } else {
        await sendRejectionEmail(userData.email, fullName, rejectionReason);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        uid,
        status: nextStatus,
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, "No se pudo actualizar la solicitud.");
  }
}

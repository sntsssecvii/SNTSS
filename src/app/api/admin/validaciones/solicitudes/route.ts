import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import {
  requireAdminRequest,
  handleAdminRouteError,
} from "@/lib/firebase/server-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type UserStatus = "pending" | "active" | "rejected";

function isValidStatus(status: string | null): status is UserStatus {
  return status === "pending" || status === "active" || status === "rejected";
}

function toCreatedAtMs(value: any) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:validaciones:solicitudes",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const status = request.nextUrl.searchParams.get("status");

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: "Estatus de validación no válido." },
        { status: 400 },
      );
    }

    const snapshot = await adminDb
      .collection("users")
      .where("status", "==", status)
      .limit(500)
      .get();

    const requests = snapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          uid: doc.id,
          nombre: data.nombre || "",
          apellidoPaterno: data.apellidoPaterno || "",
          apellidoMaterno: data.apellidoMaterno || "",
          matricula: data.matricula || "",
          email: data.email || "",
          curp: data.curp || "",
          status: data.status || status,
          rejectionReason: data.rejectionReason || "",
          documents: {
            identificacion: data.documents?.identificacion || "",
            tarjeton: data.documents?.tarjeton || "",
          },
          createdAtMs: toCreatedAtMs(data.createdAt),
        };
      })
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    return NextResponse.json({
      success: true,
      data: {
        requests,
      },
    });
  } catch (error) {
    return handleAdminRouteError(
      error,
      "No se pudieron obtener las solicitudes.",
    );
  }
}

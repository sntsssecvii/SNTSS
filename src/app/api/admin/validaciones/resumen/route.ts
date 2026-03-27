import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import {
  requireAdminRequest,
  handleAdminRouteError,
} from "@/lib/firebase/server-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:validaciones:resumen",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const usersRef = adminDb.collection("users");

    const [pendingSnap, activeSnap, rejectedSnap] = await Promise.all([
      usersRef.where("status", "==", "pending").count().get(),
      usersRef.where("status", "==", "active").count().get(),
      usersRef.where("status", "==", "rejected").count().get(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pending: pendingSnap.data().count,
        active: activeSnap.data().count,
        rejected: rejectedSnap.data().count,
      },
    });
  } catch (error) {
    return handleAdminRouteError(
      error,
      "No se pudo obtener el resumen de validaciones.",
    );
  }
}

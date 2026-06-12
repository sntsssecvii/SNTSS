import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import type { BolsaPosicionMaterializada } from "@/types/bolsa-de-trabajo";

export const dynamic = "force-dynamic";

const POSITION_COLLECTION = "bolsa_posiciones_materializadas";

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:admin:bolsa:posiciones",
      limit: 20,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const syncId = request.nextUrl.searchParams.get("syncId")?.trim();
    if (!syncId) {
      return NextResponse.json({ error: "syncId requerido." }, { status: 400 });
    }

    const snap = await adminDb
      .collection(POSITION_COLLECTION)
      .where("syncId", "==", syncId)
      .get();

    const data = snap.docs.map((d) => d.data() as BolsaPosicionMaterializada);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    }
    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Error al cargar posiciones." },
      { status: 500 },
    );
  }
}

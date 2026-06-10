import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { listarLotesCambios } from "@/lib/firebase/cambios-escalafon-lotes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "cambios-lotes-get",
      limit: 30,
      windowMs: 60_000,
    });
    const lotes = await listarLotesCambios();
    return NextResponse.json({ lotes });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[cambios-escalafon/lotes GET]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { getPropuestaById } from "@/lib/firebase/propuestas";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:get",
      limit: 60,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role)) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }
    const propuesta = await getPropuestaById(params.id);
    if (!propuesta) {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }
    return NextResponse.json({ propuesta });
  } catch (error: any) {
    if (error instanceof RateLimitError)
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        { status: 429 },
      );
    if (error?.message === "AUTH_REQUIRED")
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    if (error?.message === "ADMIN_REQUIRED")
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    console.error("[api/propuestas/[id]]", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}

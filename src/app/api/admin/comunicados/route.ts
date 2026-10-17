import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { comunicadoInputSchema } from "@/lib/comunicados";
import {
  createComunicado,
  getComunicadosAdmin,
} from "@/lib/firebase/comunicados";
import { handleError } from "./handle-error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:comunicados",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);
    const comunicados = await getComunicadosAdmin();
    return NextResponse.json({ success: true, data: comunicados });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:comunicados",
      limit: 20,
      windowMs: 60_000,
    });
    const context = await requireAdminRequest(request);

    const parsed = comunicadoInputSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );

    const id = await createComunicado(parsed.data, context.uid);
    await writeAdminAuditLog({
      action: "COMUNICADO_CREAR",
      actorUid: context.uid,
      actorEmail: context.email ?? undefined,
      targetType: "comunicado",
      targetId: id,
      status: "SUCCESS",
      metadata: { publicado: parsed.data.publicado },
    }).catch(() => {});
    revalidatePath("/");

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return handleError(error);
  }
}

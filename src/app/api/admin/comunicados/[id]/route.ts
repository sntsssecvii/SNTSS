import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { comunicadoPatchSchema } from "@/lib/comunicados";
import { deleteComunicado, updateComunicado } from "@/lib/firebase/comunicados";
import { handleError } from "../handle-error";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:comunicados",
      limit: 30,
      windowMs: 60_000,
    });
    const context = await requireAdminRequest(request);

    const parsed = comunicadoPatchSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );

    const existe = await updateComunicado(params.id, parsed.data);
    if (!existe)
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });

    await writeAdminAuditLog({
      action: "COMUNICADO_EDITAR",
      actorUid: context.uid,
      actorEmail: context.email ?? undefined,
      targetType: "comunicado",
      targetId: params.id,
      status: "SUCCESS",
      metadata: { campos: Object.keys(parsed.data) },
    }).catch(() => {});
    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:comunicados",
      limit: 20,
      windowMs: 60_000,
    });
    const context = await requireAdminRequest(request);
    await deleteComunicado(params.id);

    await writeAdminAuditLog({
      action: "COMUNICADO_ELIMINAR",
      actorUid: context.uid,
      actorEmail: context.email ?? undefined,
      targetType: "comunicado",
      targetId: params.id,
      status: "SUCCESS",
    }).catch(() => {});
    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleError(error);
  }
}

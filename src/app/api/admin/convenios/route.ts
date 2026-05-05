import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { assertSameOrigin } from "@/lib/security/cors";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { RateLimitError } from "@/lib/security/rate-limit";
import {
  getConveniosAdmin,
  createConvenio,
  publishConvenios,
  reorderConvenios,
  getMaxOrden,
} from "@/lib/firebase/convenios";
import { adminStorage } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

function handleError(error: any) {
  if (error?.message === "CORS_FORBIDDEN")
    return NextResponse.json(
      { error: "Acceso no permitido." },
      { status: 403 },
    );
  if (error instanceof RateLimitError || error?.message === "RATE_LIMITED")
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      { status: 429 },
    );
  if (
    error?.message === "AUTH_REQUIRED" ||
    error?.message === "INSUFFICIENT_PERMISSIONS"
  )
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 60,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);
    const convenios = await getConveniosAdmin();
    return NextResponse.json({ success: true, data: convenios });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 20,
      windowMs: 60_000,
    });
    const context = await requireAdminRequest(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titulo = formData.get("titulo") as string | undefined;
    const link = formData.get("link") as string | undefined;

    if (!file)
      return NextResponse.json(
        { error: "Archivo requerido." },
        { status: 400 },
      );

    const storagePath = `convenios/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fileRef.save(buffer, { contentType: file.type, public: true });
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const orden = await getMaxOrden();
    const id = await createConvenio({
      imageUrl,
      titulo: titulo || undefined,
      link: link || undefined,
      orden,
      publicado: false,
      creadoEn: FieldValue.serverTimestamp() as any,
      creadoPor: context.uid,
    });

    return NextResponse.json({ success: true, id, imageUrl });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimitRedis(request, {
      bucket: "api:admin:convenios",
      limit: 30,
      windowMs: 60_000,
    });
    await requireAdminRequest(request);

    const body = await request.json();

    if (body.action === "publish") {
      await publishConvenios(body.publicadosIds, body.todosIds);
      return NextResponse.json({ success: true });
    }

    if (body.action === "reorder") {
      await reorderConvenios(body.orden);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error: any) {
    return handleError(error);
  }
}

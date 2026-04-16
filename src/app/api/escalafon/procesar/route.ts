import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { validateFileMagicBytes } from "@/lib/security/file-validation";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { parsearListadoCondicionalidad } from "@/lib/pdf/parsers/escalafon-condicionalidad";
import { listadoExiste, guardarListado } from "@/lib/firebase/escalafon";
import { calcularPosicionesPorZona } from "@/lib/escalafon/position-engine";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  let ctx: { uid: string; email: string | null } | null = null;

  try {
    ctx = await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "escalafon-procesar",
      limit: 10,
      windowMs: 60_000,
    });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió archivo" },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Archivo demasiado grande (máx. 25 MB)" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const isValidPdf = validateFileMagicBytes(buffer, "pdf");
    if (!isValidPdf) {
      return NextResponse.json(
        { error: "Archivo no es un PDF válido" },
        { status: 400 },
      );
    }

    // Guardar temporalmente para que pdfplumber pueda leerlo
    const tmpPath = join(tmpdir(), `escalafon-${randomUUID()}.pdf`);
    await writeFile(tmpPath, buffer);

    let parseResult: Awaited<ReturnType<typeof parsearListadoCondicionalidad>>;
    try {
      parseResult = await parsearListadoCondicionalidad(tmpPath);
    } finally {
      await unlink(tmpPath).catch(() => {});
    }

    const { listado, aspirantes, errores } = parseResult;

    if (!listado.categoriaCode || !listado.periodoDecierre) {
      return NextResponse.json(
        {
          error:
            "No se pudo extraer la metadata del PDF. Verifica que sea un listado de condicionalidad SIAP.",
          errores,
        },
        { status: 422 },
      );
    }

    // Verificar duplicado
    const existe = await listadoExiste(
      listado.categoriaCode,
      listado.periodoDecierre,
    );
    if (existe) {
      return NextResponse.json(
        {
          error: `Ya existe un listado para la categoría ${listado.categoriaCode} en el periodo ${listado.periodoDecierre}.`,
        },
        { status: 409 },
      );
    }

    const { aspirantesConPosicion, zonas } =
      calcularPosicionesPorZona(aspirantes);

    const listadoId = await guardarListado(
      {
        ...listado,
        aspirantesParsed: aspirantes.length,
        subidoPor: ctx.uid,
        creadoEn: new Date().toISOString(),
        zonas,
      },
      aspirantesConPosicion.map((a) => ({ ...a, listadoId: "" })),
    );

    await writeAdminAuditLog({
      action: "ESCALAFON_LISTADO_SUBIDO",
      actorUid: ctx.uid,
      actorEmail: ctx.email ?? undefined,
      targetType: "escalafon_listado",
      targetId: listadoId,
      status: "SUCCESS",
      metadata: {
        categoria: listado.categoriaCode,
        periodo: listado.periodoDecierre,
        aspirantesParsed: aspirantes.length,
      },
    });

    return NextResponse.json({
      listadoId,
      aspirantesParsed: aspirantes.length,
      errores,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[escalafon/procesar]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { validateFileMagicBytes } from "@/lib/security/file-validation";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { parsearListadoCambios } from "@/lib/pdf/parsers/cambios-escalafon";
import {
  obtenerListadoVigenteCambios,
  guardarListadoCambios,
  eliminarListadoCambios,
} from "@/lib/firebase/cambios-escalafon";
import {
  obtenerLoteAbiertoCambios,
  crearLoteCambios,
  generarNombreLoteCambios,
  incrementarTotalListadosCambios,
  decrementarTotalListadosCambios,
} from "@/lib/firebase/cambios-escalafon-lotes";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let ctx: { uid: string; email: string | null } | null = null;

  try {
    ctx = await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    enforceRateLimit(req, {
      bucket: "cambios-procesar",
      limit: 60,
      windowMs: 60_000,
    });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const loteIdParam = (formData.get("loteId") as string | null) || null;
    const nombreLoteParam =
      (formData.get("nombreLote") as string | null) || null;

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
    if (!validateFileMagicBytes(buffer, "pdf")) {
      return NextResponse.json(
        { error: "Archivo no es un PDF válido" },
        { status: 400 },
      );
    }

    const tmpPath = join(tmpdir(), `cambios-${randomUUID()}.pdf`);
    await writeFile(tmpPath, buffer);

    let parseResult: Awaited<ReturnType<typeof parsearListadoCambios>>;
    try {
      parseResult = await parsearListadoCambios(tmpPath);
    } finally {
      await unlink(tmpPath).catch(() => {});
    }

    const { listado, registros, errores } = parseResult;

    if (!listado.categoriaCode) {
      return NextResponse.json(
        {
          error:
            "No se pudo extraer la metadata del PDF. Verifica que sea un listado de cambios SIAP.",
          errores,
        },
        { status: 422 },
      );
    }

    // Auto-reemplazo: misma categoría + mismo concepto
    const listadoVigente = await obtenerListadoVigenteCambios(
      listado.categoriaCode,
      listado.concepto,
    );
    const reemplazarId = listadoVigente?.id ?? null;

    // Determinar loteId: parámetro > abierto > crear nuevo
    let loteIdFinal: string;
    if (loteIdParam) {
      loteIdFinal = loteIdParam;
    } else {
      const loteAbierto = await obtenerLoteAbiertoCambios();
      if (loteAbierto?.id) {
        loteIdFinal = loteAbierto.id;
      } else {
        loteIdFinal = await crearLoteCambios(
          nombreLoteParam ?? generarNombreLoteCambios(),
          ctx!.uid,
        );
      }
    }

    const listadoId = await guardarListadoCambios(
      {
        ...listado,
        loteId: loteIdFinal || undefined,
        registrosParsed: registros.length,
        subidoPor: ctx!.uid,
        creadoEn: new Date().toISOString(),
      },
      registros.map((r) => ({ ...r, listadoId: "" })),
    );

    if (loteIdFinal) {
      await incrementarTotalListadosCambios(loteIdFinal);
    }

    if (reemplazarId) {
      await eliminarListadoCambios(reemplazarId);
      const loteIdAnterior = listadoVigente?.loteId;
      if (loteIdAnterior) {
        await decrementarTotalListadosCambios(loteIdAnterior);
      }
    }

    await writeAdminAuditLog({
      action: reemplazarId
        ? "CAMBIOS_LISTADO_REEMPLAZADO"
        : "CAMBIOS_LISTADO_SUBIDO",
      actorUid: ctx!.uid,
      actorEmail: ctx!.email ?? undefined,
      targetType: "cambios_listado",
      targetId: listadoId,
      status: "SUCCESS",
      metadata: {
        categoria: listado.categoriaCode,
        concepto: listado.concepto,
        registrosParsed: registros.length,
        loteId: loteIdFinal || null,
        reemplazarId,
      },
    });

    return NextResponse.json({
      listadoId,
      loteId: loteIdFinal || null,
      registrosParsed: registros.length,
      errores,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 },
      );
    }
    console.error("[cambios-escalafon/procesar]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

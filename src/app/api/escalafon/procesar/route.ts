import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { validateFileMagicBytes } from "@/lib/security/file-validation";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { parsearListadoCondicionalidad } from "@/lib/pdf/parsers/escalafon-condicionalidad";
import {
  listadoExiste,
  guardarListado,
  eliminarListado,
  obtenerListado,
} from "@/lib/firebase/escalafon";
import {
  obtenerLoteAbierto,
  crearLote,
  generarNombreLote,
  incrementarTotalListados,
  decrementarTotalListados,
} from "@/lib/firebase/escalafon-lotes";
import { calcularPosicionesPorZona } from "@/lib/escalafon/position-engine";
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
      bucket: "escalafon-procesar",
      limit: 10,
      windowMs: 60_000,
    });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const reemplazarId =
      (formData.get("reemplazarId") as string | null) || null;
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

    // --- Determinar loteId ---
    let loteIdFinal: string;
    let loteIdDeReemplazo: string | null = null;

    if (reemplazarId) {
      // Modo reemplazo: usar el lote del listado que se reemplaza
      const listadoAnterior = await obtenerListado(reemplazarId);
      if (!listadoAnterior) {
        return NextResponse.json(
          { error: "Listado a reemplazar no encontrado" },
          { status: 404 },
        );
      }
      loteIdFinal = listadoAnterior.loteId ?? "";
      loteIdDeReemplazo = reemplazarId;
    } else {
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

      // Resolver lote: parámetro > abierto > crear nuevo
      if (loteIdParam) {
        loteIdFinal = loteIdParam;
      } else {
        const loteAbierto = await obtenerLoteAbierto();
        if (loteAbierto?.id) {
          loteIdFinal = loteAbierto.id;
        } else {
          loteIdFinal = await crearLote(
            nombreLoteParam ?? generarNombreLote(),
            ctx!.uid,
          );
        }
      }
    }

    const { aspirantesConPosicion, zonas } =
      calcularPosicionesPorZona(aspirantes);

    const listadoId = await guardarListado(
      {
        ...listado,
        loteId: loteIdFinal || undefined,
        aspirantesParsed: aspirantes.length,
        subidoPor: ctx!.uid,
        creadoEn: new Date().toISOString(),
        zonas,
      },
      aspirantesConPosicion.map((a) => ({ ...a, listadoId: "" })),
    );

    if (loteIdFinal) {
      await incrementarTotalListados(loteIdFinal);
    }

    // Eliminar listado anterior DESPUÉS de guardar el nuevo (evita pérdida de datos si falla)
    if (reemplazarId) {
      await eliminarListado(reemplazarId);
      if (loteIdFinal) {
        await decrementarTotalListados(loteIdFinal);
      }
    }

    await writeAdminAuditLog({
      action: reemplazarId
        ? "ESCALAFON_LISTADO_REEMPLAZADO"
        : "ESCALAFON_LISTADO_SUBIDO",
      actorUid: ctx!.uid,
      actorEmail: ctx!.email ?? undefined,
      targetType: "escalafon_listado",
      targetId: listadoId,
      status: "SUCCESS",
      metadata: {
        categoria: listado.categoriaCode,
        periodo: listado.periodoDecierre,
        aspirantesParsed: aspirantes.length,
        loteId: loteIdFinal || null,
        reemplazarId: loteIdDeReemplazo,
      },
    });

    return NextResponse.json({
      listadoId,
      loteId: loteIdFinal || null,
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

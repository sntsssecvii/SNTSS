import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { adminStorage } from "@/lib/firebase/admin";
import {
  createPropuesta,
  listPropuestas,
  propuestaActivaPorMatricula,
  curpExisteEnPropuestasActivas,
} from "@/lib/firebase/propuestas";
import { getRequerimientosActivos } from "@/lib/firebase/requerimientos";
import { generarNumeroCaso } from "@/lib/firebase/contadores";
import { calcularWarnings } from "@/lib/propuestas/warnings";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { z } from "zod";
import type { EstadoPropuesta } from "@/types/workflow";

export const dynamic = "force-dynamic";

const MAX_INE_BYTES = 5 * 1024 * 1024;

// GET — listar propuestas (solo admin/admision)
export async function GET(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:list",
      limit: 60,
      windowMs: 60_000,
    });
    const adminUser = await requireAdminRequest(request);
    if (!isAdmisionRole(adminUser.role)) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }
    const url = new URL(request.url);
    const estado = url.searchParams.get("estado") as EstadoPropuesta | null;
    const propuestas = await listPropuestas(estado ? { estado } : {});
    return NextResponse.json({ propuestas });
  } catch (error: any) {
    return handleError(error);
  }
}

// POST — crear propuesta desde formulario público (sin auth)
const CrearSchema = z.object({
  matricula: z.string().min(4).max(20),
  sinFamiliar: z.boolean().default(false),
  aspirante: z
    .object({
      nombreCompleto: z.string().min(2).max(120),
      curp: z.string().length(18),
      parentesco: z.enum(["Hijo", "Hija", "Cónyuge", "Otro"]).nullable(),
      telefono: z.string().regex(/^\d{10}$/),
    })
    .nullable(),
});

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, {
      bucket: "api:propuestas:create",
      limit: 5,
      windowMs: 60_000,
    });

    const formData = await request.formData();
    const raw = {
      matricula: formData.get("matricula"),
      sinFamiliar: formData.get("sinFamiliar") === "true",
      aspirante: formData.get("aspirante")
        ? JSON.parse(String(formData.get("aspirante")))
        : null,
    };
    const parsed = CrearSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos.", detalles: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { matricula, sinFamiliar, aspirante } = parsed.data;

    // Subir INE si viene
    let ineUrl: string | null = null;
    const ineFile = formData.get("ine") as File | null;
    if (ineFile && ineFile.size > 0) {
      if (ineFile.size > MAX_INE_BYTES) {
        return NextResponse.json(
          { error: "El archivo INE excede 5 MB." },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await ineFile.arrayBuffer());
      const destination = `propuestas/ine/${matricula}-${Date.now()}-${ineFile.name}`;
      const fileRef = adminStorage.bucket().file(destination);
      await fileRef.save(buffer, { metadata: { contentType: ineFile.type } });
      await fileRef.makePublic();
      ineUrl = `https://storage.googleapis.com/${adminStorage.bucket().name}/${destination}`;
    }

    // Calcular warnings
    const propuestaActiva = await propuestaActivaPorMatricula(matricula);
    const curpDuplicado = aspirante?.curp
      ? await curpExisteEnPropuestasActivas(aspirante.curp)
      : false;
    const requerimientos = await getRequerimientosActivos();
    const hayRequerimiento = requerimientos.some((r) =>
      r.partidas.some((p) => p.cantidadDisponible > 0),
    );

    const warnings = calcularWarnings({
      propuestaActivaExistente: Boolean(propuestaActiva),
      curpExisteEnActivas: curpDuplicado,
      hayRequerimientoDisponible: hayRequerimiento,
      ineSubida: Boolean(ineUrl) || sinFamiliar,
    });

    const numeroCaso = await generarNumeroCaso();
    const id = await createPropuesta({
      numeroCaso,
      matricula,
      sinFamiliar,
      aspirante,
      ineUrl,
      warnings,
      usuarioId: "publico",
    });

    return NextResponse.json({ id, numeroCaso }, { status: 201 });
  } catch (error: any) {
    return handleError(error);
  }
}

function handleError(error: any) {
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      {
        status: 429,
        headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
      },
    );
  }
  if (error?.message === "AUTH_REQUIRED")
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (error?.message === "ADMIN_REQUIRED")
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  console.error("[api/propuestas]", error);
  return NextResponse.json({ error: "Error interno." }, { status: 500 });
}

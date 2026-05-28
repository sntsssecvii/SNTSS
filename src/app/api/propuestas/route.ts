import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { isAdmisionRole } from "@/lib/auth/roles";
import { adminStorage } from "@/lib/firebase/admin";
import {
  createPropuesta,
  listPropuestas,
  propuestaActivaPorMatricula,
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
const PARENTESCO_VALUES = [
  "PADRE/MADRE",
  "ESPOSO/A",
  "HERMANO/A",
  "HIJO/A",
  "OTRO",
  "SIN FAMILIAR",
] as const;

const ZONAS_VALUES = [
  "01= San Luis RCS",
  "02= Mexicali",
  "03= Tijuana",
  "04= Ensenada",
  "05= Tecate",
  "06= Valle de Ensenada",
  "07= Valle de Mexicali",
  "08= Valle de San Luis RCS",
  "09= San Felipe",
] as const;

const DatosPropuestaSchema = z.object({
  categoriaSolicitada: z.string().min(1).max(100),
  zona: z.enum(ZONAS_VALUES),
});

const SolicitanteSchema = z.object({
  nombreCompleto: z.string().min(2).max(120),
  correo: z.string().email(),
  domicilioCalle: z.string().min(1).max(200),
  domicilioNumero: z.string().min(1).max(50),
  domicilioColonia: z.string().min(1).max(150),
  domicilioMunicipio: z.string().min(1).max(100),
  domicilioEstado: z.string().min(1).max(100),
  codigoPostal: z.string().regex(/^\d{5}$/),
  telefono: z.string().regex(/^\d{10}$/),
  escolaridad: z.string().min(1).max(100),
  fechaNacimiento: z.string().min(1),
  edad: z.coerce.number().min(16).max(100),
  estadoNacimiento: z.string().min(1).max(100),
  rfc: z
    .string()
    .regex(/^[A-Z]{4}\d{6}[A-Z0-9]{3}$/, "RFC inválido — 13 caracteres"),
});

const CrearSchema = z.object({
  matricula: z.string().min(4).max(20),
  solicitante: SolicitanteSchema.nullable(),
  datosPropuesta: DatosPropuestaSchema.nullable(),
  sinFamiliar: z.boolean().default(false),
  aspirante: z
    .object({
      nombreCompleto: z.string().min(2).max(120),
      parentesco: z.enum(PARENTESCO_VALUES).nullable(),
      matriculaFamiliar: z.string().max(20).optional().default(""),
      telefono: z.string().regex(/^\d{10}$/),
      tipoContratacion: z.string().min(1).max(60),
      correo: z.string().email(),
      antiguedad: z.string().min(1).max(100),
      fechaIngreso: z.string().min(1),
      unidadAdscripcion: z.string().min(1).max(200),
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
      solicitante: formData.get("solicitante")
        ? JSON.parse(String(formData.get("solicitante")))
        : null,
      datosPropuesta: formData.get("datosPropuesta")
        ? JSON.parse(String(formData.get("datosPropuesta")))
        : null,
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

    const { matricula, solicitante, datosPropuesta, sinFamiliar, aspirante } =
      parsed.data;

    // Subir INE si viene
    const ALLOWED_INE_TYPES = ["image/jpeg", "image/png", "application/pdf"];
    let ineUrl: string | null = null;
    const ineFile = formData.get("ine") as File | null;
    if (ineFile && ineFile.size > 0) {
      if (!ALLOWED_INE_TYPES.includes(ineFile.type)) {
        return NextResponse.json(
          { error: "Tipo de archivo no permitido. Use JPG, PNG o PDF." },
          { status: 400 },
        );
      }
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
    const curpDuplicado = false;
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
      solicitante,
      datosPropuesta,
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

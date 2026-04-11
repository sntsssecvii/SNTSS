import { NextRequest, NextResponse } from "next/server";
import { detectarTipoDocumento } from "@/lib/pdf/parser";
import { writeAdminAuditLog } from "@/lib/firebase/admin-audit";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export interface FilaCruda {
  id: string;
  lineaOriginal: string;
  numeroLinea: number;
  tipoLinea: "zona" | "categoria" | "registro" | "desconocido";
  zona?: string;
  categoria?: string;
  numeroProg?: string;
  nombre?: string;
  matricula?: string;
  fecha?: string;
  datosExtra?: string;
  validado?: boolean;
}

export interface ExtraerResponse {
  success: boolean;
  tipoDocumento: string;
  nombreArchivo: string;
  totalLineas: number;
  registrosEncontrados: number;
  filas: FilaCruda[];
  excelBase64?: string;
}

const ENCABEZADOS = [
  "NO. PROG",
  "NOMBRE",
  "MATRÍCULA",
  "FECHA",
  "GRUPO",
  "CALIFICACIÓN",
  "TIPO CONTRATACIÓN",
  "DÍAS LABORADOS",
  "ESTATUS",
  "OBSERVACIONES",
  "JORNADA ACTUAL",
  "ADSCRIPCIÓN ACTUAL",
  "TURNO ACTUAL",
  "RESIDENCIA",
  "CAMBIO SOLICITADO",
  "REGISTRO",
  "CLAVE",
  "SEXO",
  "ÁREA",
  "RAMA",
];

function esEncabezado(linea: string): boolean {
  const upper = linea.toUpperCase();
  return ENCABEZADOS.some((e) => upper.includes(e));
}

function esZona(linea: string): boolean {
  return /^Zona\s+\d+/.test(linea.trim());
}

function esCategoria(linea: string): boolean {
  return /^\d{6}\s*-\s*/.test(linea.trim());
}

function esRegistro(linea: string): boolean {
  const trimmed = linea.trim();
  if (!trimmed) return false;

  const tieneNumeroProg = /^\d+\s+/.test(trimmed);
  const tieneMatricula = /\b\d{7,10}\b/.test(trimmed);
  const tieneFecha = /\d{2}\/\d{2}\/\d{4}/.test(trimmed);

  return tieneNumeroProg && (tieneMatricula || tieneFecha);
}

function esRuido(linea: string): boolean {
  const t = linea.trim();
  return (
    t.startsWith("Página") ||
    t.startsWith("--") ||
    /^\d+\s+of\s+\d+$/.test(t) ||
    t.startsWith("IMSS-SIAP") ||
    t.startsWith("DIRECCIÓN") ||
    t.startsWith("LISTADO")
  );
}

async function extraerDatosCrudos(
  buffer: Buffer,
  nombreArchivo: string,
): Promise<{
  filas: FilaCruda[];
  tipoDocumento: string;
}> {
  const { parsePDF } = await import("@/lib/pdf/parser");

  // Usar parsePDF que ahora es robusto con pdfplumber
  // Pasamos un tipo genérico si no lo conocemos, pero parsePDF ahora retorna texto concatenado internamente
  // Para esta API de "datos crudos" necesitamos el texto completo
  const extractionResult = await parsePDF(
    buffer,
    "NUEVO_INGRESO",
    nombreArchivo,
  );

  // Re-extraemos el texto si es necesario o usamos lo que ya tenemos
  // Pero aquí procesamos linea por linea
  const texto =
    extractionResult.registros.length > 0
      ? extractionResult.registros.map((r) => r.nombre).join("\n") // Esto no es ideal, pero parsePDF ahora es opaco
      : "";

  // MEJOR: Llamar directamente a pdfplumber para obtener el texto crudo
  const { callPythonExtractor } = await import("@/lib/pdf/pythonBridge");
  const fs = await import("fs");
  const path = await import("path");
  const os = await import("os");
  const tempDir = path.join(os.tmpdir(), "sntss-extraer-" + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  const pdfPath = path.join(tempDir, nombreArchivo);
  fs.writeFileSync(pdfPath, buffer);

  let textoCrudo = "";
  try {
    const data = await callPythonExtractor(pdfPath);
    textoCrudo = data.pages.map((p) => p.text).join("\n");
  } finally {
    try {
      fs.unlinkSync(pdfPath);
      fs.rmdirSync(tempDir);
    } catch (e) {}
  }

  const lineas = textoCrudo
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  const filas: FilaCruda[] = [];
  let zonaActual = "";
  let categoriaActual = "";
  let tipoDocumento = "DESCONOCIDO";

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];

    if (esZona(linea)) {
      zonaActual = linea.replace("Zona ", "").trim();
      filas.push({
        id: `fila-${i}`,
        lineaOriginal: linea,
        numeroLinea: i + 1,
        tipoLinea: "zona",
        zona: zonaActual,
      });
      continue;
    }

    if (esCategoria(linea)) {
      categoriaActual = linea.trim();
      filas.push({
        id: `fila-${i}`,
        lineaOriginal: linea,
        numeroLinea: i + 1,
        tipoLinea: "categoria",
        categoria: categoriaActual,
      });
      continue;
    }

    if (esRuido(linea) || esEncabezado(linea)) {
      continue;
    }

    if (esRegistro(linea)) {
      const partes = linea.split(/\s+/).filter((p: string) => p.length > 0);

      let numeroProg = "";
      let nombre = "";
      let matricula = "";
      let fecha = "";
      let datosExtra = "";

      const numIdx = partes.findIndex((p: string) => /^\d+$/.test(p));
      if (numIdx >= 0) {
        numeroProg = partes[numIdx];
        nombre = partes.slice(numIdx + 1).join(" ");
      }

      const matMatch = linea.match(/\b(\d{7,10})\b/);
      if (matMatch) {
        matricula = matMatch[1];
      }

      const fechaMatch = linea.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (fechaMatch) {
        fecha = fechaMatch[1];
      }

      const datosDespues = linea
        .replace(/^\d+\s+/, "")
        .replace(/\b\d{7,10}\b/, "")
        .replace(/\d{2}\/\d{2}\/\d{4}/, "")
        .trim();
      if (datosDespues) {
        datosExtra = datosDespues;
      }

      filas.push({
        id: `fila-${i}`,
        lineaOriginal: linea,
        numeroLinea: i + 1,
        tipoLinea: "registro",
        zona: zonaActual,
        categoria: categoriaActual,
        numeroProg,
        nombre,
        matricula,
        fecha,
        datosExtra,
        validado: false,
      });
      continue;
    }

    filas.push({
      id: `fila-${i}`,
      lineaOriginal: linea,
      numeroLinea: i + 1,
      tipoLinea: "desconocido",
    });
  }

  return { filas, tipoDocumento };
}

function generarExcelBase64(filas: FilaCruda[], tipoDocumento: string): string {
  const headers = [
    "Validado",
    "Tipo Línea",
    "Zona",
    "Categoría",
    "No. Prog",
    "Nombre",
    "Matrícula",
    "Fecha",
    "Datos Extra",
    "Línea Original",
    "No. Línea",
  ];

  const rows = filas.map((f) => [
    f.validado ? "Sí" : "No",
    f.tipoLinea,
    f.zona || "",
    f.categoria || "",
    f.numeroProg || "",
    f.nombre || "",
    f.matricula || "",
    f.fecha || "",
    f.datosExtra || "",
    f.lineaOriginal,
    f.numeroLinea.toString(),
  ]);

  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos crudos");

  const wsResumen = XLSX.utils.aoa_to_sheet([
    ["Tipo de Documento", tipoDocumento],
    ["Total Filas", filas.length.toString()],
    [
      "Registros",
      filas.filter((f) => f.tipoLinea === "registro").length.toString(),
    ],
    ["Zonas", filas.filter((f) => f.tipoLinea === "zona").length.toString()],
    [
      "Categorías",
      filas.filter((f) => f.tipoLinea === "categoria").length.toString(),
    ],
    [
      "Desconocidos",
      filas.filter((f) => f.tipoLinea === "desconocido").length.toString(),
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  const buffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  return buffer;
}

export async function POST(request: NextRequest) {
  let adminUser: Awaited<ReturnType<typeof requireAdminRequest>> | null = null;
  try {
    enforceRateLimit(request, {
      bucket: "api:bolsa:extraer",
      limit: 8,
      windowMs: 60_000,
    });
    adminUser = await requireAdminRequest(request);
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const incluirExcel = formData.get("incluirExcel") === "true";

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo" },
        { status: 400 },
      );
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "El archivo debe ser un PDF" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { filas, tipoDocumento: tipoDetectado } = await extraerDatosCrudos(
      buffer,
      file.name,
    );

    const tipoManual = formData.get("tipo") as string;
    const tipoDocumento = tipoManual || tipoDetectado;

    const response: ExtraerResponse = {
      success: true,
      tipoDocumento,
      nombreArchivo: file.name,
      totalLineas: filas.length,
      registrosEncontrados: filas.filter((f) => f.tipoLinea === "registro")
        .length,
      filas,
    };

    if (incluirExcel) {
      response.excelBase64 = generarExcelBase64(filas, tipoDocumento);
    }

    await writeAdminAuditLog({
      action: "BOLSA_EXTRAER_ARCHIVO",
      actorUid: adminUser.uid,
      actorEmail: adminUser.email || "",
      targetType: "bolsa_extraccion",
      status: "SUCCESS",
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        undefined,
      userAgent: request.headers.get("user-agent") || undefined,
      metadata: {
        nombreArchivo: file.name,
        tipoDocumento,
        incluirExcel,
        registrosEncontrados: response.registrosEncontrados,
      },
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error extrayendo datos:", error);

    if (adminUser) {
      await writeAdminAuditLog({
        action: "BOLSA_EXTRAER_ARCHIVO",
        actorUid: adminUser.uid,
        actorEmail: adminUser.email || "",
        targetType: "bolsa_extraccion",
        status: "ERROR",
        ip:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          undefined,
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: {
          error: error?.message || "Error desconocido",
        },
      }).catch((auditError) => {
        console.error("Error escribiendo auditoría admin:", auditError);
      });
    }

    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    if (
      error?.code === "auth/id-token-expired" ||
      error?.code === "auth/argument-error"
    ) {
      return NextResponse.json(
        { error: "La sesión expiró. Vuelve a iniciar sesión." },
        { status: 401 },
      );
    }

    if (error?.code === "auth/invalid-id-token") {
      return NextResponse.json(
        { error: "La sesión no es válida. Vuelve a iniciar sesión." },
        { status: 401 },
      );
    }

    if (error?.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (error?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Perfil de usuario no encontrado." },
        { status: 404 },
      );
    }

    if (error?.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { error: "La cuenta no está activa para operar bolsa de trabajo." },
        { status: 403 },
      );
    }

    if (error?.message === "ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "No tienes permisos para extraer información." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Error interno al procesar el documento." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "API de extracción cruda de documentos PDF",
    seguridad: "Requiere token válido de Firebase y rol ADMIN",
    uso: "POST con archivo PDF en formData",
    parametros: {
      file: "Archivo PDF (requerido)",
      tipo: "Tipo de documento (opcional): NUEVO_INGRESO, AMPLIACIONES_JORNADA, CAMBIOS_AREA, etc.",
      incluirExcel: "true para incluir Excel base64 en la respuesta",
    },
  });
}

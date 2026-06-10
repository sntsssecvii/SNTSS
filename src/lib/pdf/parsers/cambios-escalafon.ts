import { readFile } from "fs/promises";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
import * as XLSX from "xlsx";
import { callPythonExtractor } from "@/lib/pdf/pythonBridge";
import { AdobePdfService } from "@/lib/excel/services/adobePdfService";
import type {
  CambiosParseResult,
  CambiosRegistro,
} from "@/types/cambios-escalafon";

// ---------------------------------------------------------------------------
// pdfjs — extracción espacial de texto (mismo patrón que escalafon-condicionalidad)
// ---------------------------------------------------------------------------

async function extraerLineasConPdfjs(
  pdfPath: string,
): Promise<{ page_number: number; lines: string[] }[]> {
  const buffer = await readFile(pdfPath);

  if (typeof global !== "undefined") {
    if (!(global as Record<string, unknown>).DOMMatrix)
      (global as Record<string, unknown>).DOMMatrix = class DOMMatrix {};
    if (!(global as Record<string, unknown>).Path2D)
      (global as Record<string, unknown>).Path2D = class Path2D {};
    if (!(global as Record<string, unknown>).ImageData)
      (global as Record<string, unknown>).ImageData = class ImageData {};
  }

  const pdfjsLib = await import("pdfjs-dist");
  const req = createRequire(import.meta.url);
  const workerPath = req.resolve("pdfjs-dist/build/pdf.worker.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
    .promise;
  const results: { page_number: number; lines: string[] }[] = [];
  const Y_TOLERANCE = 5;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const rows: { y: number; items: { x: number; text: string }[] }[] = [];

    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const typed = item as { transform: number[]; str: string };
      const x = typed.transform[4];
      const y = typed.transform[5];

      const row = rows.find((r) => Math.abs(r.y - y) <= Y_TOLERANCE);
      if (row) {
        row.items.push({ x, text: typed.str });
      } else {
        rows.push({ y, items: [{ x, text: typed.str }] });
      }
    }

    rows.sort((a, b) => b.y - a.y);

    const lines = rows
      .map((row) => {
        row.items.sort((a, b) => a.x - b.x);
        return row.items
          .map((i) => i.text)
          .join(" ")
          .trim();
      })
      .filter((l) => l.length > 0);

    results.push({ page_number: pageNum, lines });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

interface CambiosHeader {
  delegacion: string;
  sectorCode: string;
  sectorDesc: string;
  categoriaCode: string;
  categoriaDesc: string;
  concepto: string;
  fechaEmision: string;
}

function parsearHeaderCambios(lines: string[]): Partial<CambiosHeader> {
  const texto = lines.join(" ");

  // DELEGACION: 02-BAJA CALIFORNIA   CONCEPTO: 014  (o vacío)
  const delegMatch = texto.match(
    /DELEGACI[OÓ]N[:\s]+([^\s].+?)(?=\s+CONCEPTO|\s+SECTOR)/i,
  );
  const delegacion = delegMatch?.[1]?.trim() ?? "";

  const conceptoMatch = texto.match(/CONCEPTO[:\s]+(\d+)/i);
  const concepto = conceptoMatch?.[1]?.trim() ?? "";

  // SECTOR: 02   FARMACIA
  const sectorMatch = texto.match(
    /SECTOR[:\s]+(\d+)\s+([A-Z\s]+?)(?=\s+CATEGORIA|\s*$)/i,
  );
  const sectorCode = sectorMatch?.[1]?.trim() ?? "";
  const sectorDesc = sectorMatch?.[2]?.trim() ?? "";

  // CATEGORIA: 22230080   AYUDANTE DE FARMACIA 80
  const catMatch = texto.match(
    /CATEGORIA[:\s]+(\d{8})\s+([A-Z\s0-9]+?)(?=\s+FECHA|\s+CONCEPTO|\s*$)/i,
  );
  const categoriaCode = catMatch?.[1]?.trim() ?? "";
  const categoriaDesc = catMatch?.[2]?.trim() ?? "";

  // Fecha de emisión: del footer "IMSS - SIAP DD/MM/YYYY"
  const fechaMatch = texto.match(/IMSS\s*[-–]\s*SIAP\s+(\d{2}\/\d{2}\/\d{4})/i);
  const fechaEmision = fechaMatch?.[1]?.trim() ?? "";

  return {
    delegacion,
    sectorCode,
    sectorDesc,
    categoriaCode,
    categoriaDesc,
    concepto,
    fechaEmision,
  };
}

// ---------------------------------------------------------------------------
// Row parsing (fallback texto)
// ---------------------------------------------------------------------------

// Zonas conocidas para anclar el regex (incluye "SAN LUIS" de dos palabras)
const ZONAS_PATTERN =
  "\\d-(?:ENSENADA|MEXICALLI|SAN\\s+LUIS|TECATE|TIJUANA|INCONDICIONAL)";

// Fila: fecha hora no_solicitud matricula [nombre + adsc_origen + percibe?] zona adsc_sol esp tipo turno con_conceptos
const ROW_PATTERN = new RegExp(
  [
    /^(\d{2}\/\d{2}\/\d{4})/.source, // 1: fecha_registro
    /\s+(\d{2}:\d{2}:\d{2})/.source, // 2: hora_registro
    /\s+([A-Z]\d+)/.source, // 3: no_solicitud
    /\s+(\d{7,10})/.source, // 4: matricula
    /\s+(.+?)/.source, // 5: nombre+origen+percibe (lazy)
    `\\s+(${ZONAS_PATTERN})`, // 6: zona
    /\s+(.+?)/.source, // 7: adscripcion_solicitada (lazy)
    /\s+(\d{3})/.source, // 8: especialidad_area
    /\s+(TURNO|ADSCRIPCI[OÓ]N)/.source, // 9: tipo
    /\s+(MATUTINO|VESPERTINO|NOCTURNO|INCONDICIONAL)/.source, // 10: turno
    /\s+(SI|NO)$/.source, // 11: con_conceptos
  ].join(""),
  "i",
);

function esLineaDatoCambios(line: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s+[A-Z]\d+/.test(line);
}

// Separa grupo 5 (nombre + adscripcion_origen + percibe_concepto opcional)
function splitNombreOrigenPercibe(raw: string): {
  nombre: string;
  adscripcionOrigen: string;
  percibeConcepto: string;
} {
  let percibeConcepto = "";
  let rest = raw;

  // Percibe al final: "... SI" o "... NO"
  const percibeMatch = raw.match(/\s+(SI|NO)$/i);
  if (percibeMatch) {
    percibeConcepto = percibeMatch[1].toUpperCase();
    rest = raw.slice(0, raw.length - percibeMatch[0].length).trim();
  }

  // Nombre termina cuando empieza nombre de unidad médica
  const facilityMatch = rest.match(
    /^(.+?)\s+(HOSPITAL|UNIDAD|CLINICA|CENTRO|C\/MF|HGZ|HGR|UMF)\b/i,
  );
  if (facilityMatch) {
    const nombre = facilityMatch[1].trim();
    const adscripcionOrigen = rest.slice(nombre.length).trim();
    return { nombre, adscripcionOrigen, percibeConcepto };
  }

  // Fallback: separar por el patrón APELLIDO/APELLIDO/NOMBRE <espacio> texto
  const slashMatch = rest.match(
    /^([A-Z&]+(?:\/[A-Z&]+)+(?:\s+[A-Z&]+)*?)\s+([A-Z].+)$/i,
  );
  if (slashMatch) {
    return {
      nombre: slashMatch[1].trim(),
      adscripcionOrigen: slashMatch[2].trim(),
      percibeConcepto,
    };
  }

  return { nombre: rest, adscripcionOrigen: "", percibeConcepto };
}

function parsearFilaTexto(
  line: string,
): Omit<CambiosRegistro, "id" | "listadoId"> | null {
  const m = line.match(ROW_PATTERN);
  if (!m) return null;

  const { nombre, adscripcionOrigen, percibeConcepto } =
    splitNombreOrigenPercibe(m[5]);

  return {
    fechaRegistro: m[1],
    horaRegistro: m[2],
    noSolicitud: m[3],
    matricula: m[4],
    nombre: nombre.toUpperCase(),
    adscripcionOrigen: adscripcionOrigen.trim(),
    percibeConcepto,
    zona: m[6].trim(),
    adscripcionSolicitada: m[7].trim(),
    especialidadArea: Number(m[8]),
    tipo: m[9].toUpperCase().replace("ADSCRIPCION", "ADSCRIPCIÓN"),
    turnoSolicitado: m[10].toUpperCase(),
    conConceptos: m[11].toUpperCase(),
  };
}

// ---------------------------------------------------------------------------
// Adobe PDF Services — parser por columnas del Excel
// ---------------------------------------------------------------------------

/**
 * Estructura esperada del Excel de Adobe para cambios SIAP:
 *   Col 0:  FECHA REGISTRO   (serial numérico o DD/MM/YYYY)
 *   Col 1:  HORA REGISTRO
 *   Col 2:  NO. SOLICITUD
 *   Col 3:  MATRICULA - NOMBRE  (pueden venir juntas: "97020210 APELLIDO/APELLIDO/NOMBRE")
 *   Col 4:  ADSCRIPCION ORIGEN
 *   Col 5:  PERCIBE CONCEPTO
 *   Col 6:  ZONA
 *   Col 7:  ADSCRIPCION SOLICITADA
 *   Col 8:  ESPECIALIDAD AREA
 *   Col 9:  TIPO
 *   Col 10: TURNO SOLICITADO
 *   Col 11: CON CONCEPTOS
 */
function excelSerialAFecha(serial: number): string {
  const msDesdeUnix = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(msDesdeUnix);
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function parsearFilaExcel(
  row: (string | number | null)[],
): Omit<CambiosRegistro, "id" | "listadoId"> | null {
  const str = (v: unknown): string => (v == null ? "" : String(v).trim());
  const fechaRaw = row[0];

  // Saltar filas vacías o de encabezado
  if (
    !fechaRaw ||
    (typeof fechaRaw === "string" &&
      !/\d{2}\/\d{2}\/\d{4}/.test(fechaRaw) &&
      typeof fechaRaw !== "number")
  ) {
    return null;
  }

  const fechaRegistro =
    typeof fechaRaw === "number" ? excelSerialAFecha(fechaRaw) : str(fechaRaw);

  if (!fechaRegistro.match(/^\d{2}\/\d{2}\/\d{4}$/)) return null;

  // La columna MATRICULA-NOMBRE puede ser una sola celda "97020210 APELLIDO/APELLIDO/NOMBRE"
  const matriculaNombre = str(row[3]);
  const mnMatch = matriculaNombre.match(/^(\d{7,10})\s+(.+)$/);
  const matricula = mnMatch ? mnMatch[1] : str(row[3]);
  const nombre = mnMatch ? mnMatch[2].trim().toUpperCase() : "";

  return {
    fechaRegistro,
    horaRegistro: str(row[1]),
    noSolicitud: str(row[2]),
    matricula,
    nombre,
    adscripcionOrigen: str(row[4]),
    percibeConcepto: str(row[5]).toUpperCase(),
    zona: str(row[6]),
    adscripcionSolicitada: str(row[7]),
    especialidadArea: Number(str(row[8])) || 0,
    tipo: str(row[9]).toUpperCase().replace("ADSCRIPCION", "ADSCRIPCIÓN"),
    turnoSolicitado: str(row[10]).toUpperCase(),
    conConceptos: str(row[11]).toUpperCase(),
  };
}

async function parsearDesdeAdobe(pdfPath: string): Promise<CambiosParseResult> {
  const buffer = await readFile(pdfPath);
  const excelBuffer = await AdobePdfService.convertPdfToExcel(
    buffer,
    path.basename(pdfPath),
  );

  const workbook = XLSX.read(excelBuffer);
  const errores: string[] = [];
  const registros: Omit<CambiosRegistro, "id" | "listadoId">[] = [];
  let headerData: Partial<CambiosHeader> = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
    });

    for (const row of rows) {
      const nonNull = row.filter((c) => c !== null);
      if (nonNull.length === 0) continue;

      // Bloque de metadata (celda única con \r\n)
      if (
        nonNull.length === 1 &&
        typeof nonNull[0] === "string" &&
        nonNull[0].includes("\r\n")
      ) {
        const lines = nonNull[0]
          .split("\r\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const parsed = parsearHeaderCambios(lines);
        if (parsed.categoriaCode || parsed.concepto !== undefined) {
          headerData = { ...headerData, ...parsed };
        }
        continue;
      }

      const registro = parsearFilaExcel(row);
      if (registro) registros.push(registro);
    }
  }

  return {
    listado: {
      delegacion: headerData.delegacion ?? "",
      sectorCode: headerData.sectorCode ?? "",
      sectorDesc: headerData.sectorDesc ?? "",
      categoriaCode: headerData.categoriaCode ?? "",
      categoriaDesc: headerData.categoriaDesc ?? "",
      concepto: headerData.concepto ?? "",
      fechaEmision: headerData.fechaEmision ?? "",
      totalRegistros: registros.length,
    },
    registros,
    errores,
  };
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

export async function parsearListadoCambios(
  pdfPath: string,
): Promise<CambiosParseResult> {
  const adobeClientId = process.env.ADOBE_CLIENT_ID;
  const adobeClientSecret = process.env.ADOBE_CLIENT_SECRET;

  // 1. Adobe PDF Services (primario en Vercel)
  if (adobeClientId && adobeClientSecret) {
    try {
      return await parsearDesdeAdobe(pdfPath);
    } catch (adobeErr) {
      console.error(
        "[cambios] Adobe falló, usando fallback de texto:",
        adobeErr,
      );
    }
  }

  // 2. Fallback: texto (Python → pdfjs-dist)
  const errores: string[] = [];
  const registros: Omit<CambiosRegistro, "id" | "listadoId">[] = [];
  let headerData: Partial<CambiosHeader> = {};

  try {
    let pages: { page_number: number; lines: string[] }[];

    try {
      const data = await callPythonExtractor(pdfPath);
      pages = data.pages.map((p) => ({
        page_number: p.page_number,
        lines: p.lines ?? [],
      }));
    } catch {
      pages = await extraerLineasConPdfjs(pdfPath);
    }

    for (const page of pages) {
      if (page.page_number === 1 && page.lines?.length) {
        headerData = parsearHeaderCambios(page.lines);
      }

      for (const rawLine of page.lines) {
        const line = rawLine.replace(/\s+/g, " ").trim();
        if (!esLineaDatoCambios(line)) continue;

        const registro = parsearFilaTexto(line);
        if (registro) registros.push(registro);
        else errores.push(`Fila no reconocida: ${line.slice(0, 80)}`);
      }
    }
  } catch (error) {
    errores.push(
      `Error al procesar PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    listado: {
      delegacion: headerData.delegacion ?? "",
      sectorCode: headerData.sectorCode ?? "",
      sectorDesc: headerData.sectorDesc ?? "",
      categoriaCode: headerData.categoriaCode ?? "",
      categoriaDesc: headerData.categoriaDesc ?? "",
      concepto: headerData.concepto ?? "",
      fechaEmision: headerData.fechaEmision ?? "",
      totalRegistros: registros.length,
    },
    registros,
    errores,
  };
}

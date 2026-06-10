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

function excelSerialAFecha(serial: number): string {
  const msDesdeUnix = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(msDesdeUnix);
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function excelTimeSerialAHora(n: number): string {
  const totalSecs = Math.round(n * 24 * 3600);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Detección dinámica de columnas desde la fila de encabezado del Excel
// ---------------------------------------------------------------------------

interface ColMap {
  fecha: number;
  hora: number;
  noSolicitud: number;
  matricula: number;
  nombre: number;
  adscripcionOrigen: number;
  percibeConcepto: number;
  zona: number;
  adscripcionSolicitada: number;
  especialidadArea: number;
  tipo: number;
  turnoSolicitado: number;
  conConceptos: number;
}

function detectarEncabezado(rows: (string | number | null)[][]): ColMap | null {
  for (const row of rows.slice(0, 8)) {
    const nonNull = row.filter((c) => c !== null && c !== "");
    if (nonNull.length < 5) continue;
    const allStr = nonNull.every((c) => typeof c === "string");
    if (!allStr) continue;

    const upper = row.map((c) =>
      c == null ? "" : String(c).toUpperCase().trim(),
    );

    const hasFecha = upper.some(
      (s) => s.includes("FECHA") && !s.includes("EMISION"),
    );
    const hasSolicitud = upper.some((s) => s.includes("SOLICITUD"));
    if (!hasFecha || !hasSolicitud) continue;

    // Es fila de encabezado — mapear columnas
    const col = (pred: (s: string) => boolean) => upper.findIndex(pred);

    const mapa: Partial<ColMap> = {
      fecha: col((s) => s.includes("FECHA") && !s.includes("EMISION")),
      hora: col((s) => s.includes("HORA")),
      noSolicitud: col((s) => s.includes("SOLICITUD")),
      matricula: col((s) => s.includes("MATRICULA") || s.includes("MATR")),
      nombre: col(
        (s) =>
          s === "NOMBRE" ||
          (s.includes("NOMBRE") && !s.includes("ADSCRIPCION")),
      ),
      adscripcionOrigen: col(
        (s) => s.includes("ADSCRIPCION") && s.includes("ORIGEN"),
      ),
      percibeConcepto: col((s) => s.includes("PERCIBE")),
      zona: col(
        (s) =>
          s === "ZONA" || (s.includes("ZONA") && !s.includes("ADSCRIPCION")),
      ),
      adscripcionSolicitada: col(
        (s) =>
          s.includes("ADSCRIPCION") &&
          (s.includes("SOLIC") || s.includes("SOLICI")),
      ),
      especialidadArea: col((s) => s.includes("ESPECIALIDAD")),
      tipo: col((s) => s === "TIPO"),
      turnoSolicitado: col((s) => s.includes("TURNO")),
      conConceptos: col(
        (s) => s.includes("CONCEPTOS") && !s.includes("PERCIBE"),
      ),
    };

    // Solo requerir campos mínimos
    if (mapa.fecha !== -1 && mapa.noSolicitud !== -1 && mapa.matricula !== -1) {
      console.log(
        "[cambios-parser] Encabezado detectado:",
        JSON.stringify(mapa),
      );
      return mapa as ColMap;
    }
  }
  return null;
}

function parsearFilaConMapa(
  row: (string | number | null)[],
  map: ColMap,
): Omit<CambiosRegistro, "id" | "listadoId"> | null {
  const get = (idx: number): string => {
    if (idx < 0 || idx >= row.length || row[idx] == null) return "";
    return String(row[idx]).trim();
  };

  // Fecha
  const fechaRaw = map.fecha >= 0 ? row[map.fecha] : null;
  if (!fechaRaw) return null;
  const fechaRegistro =
    typeof fechaRaw === "number"
      ? excelSerialAFecha(fechaRaw)
      : String(fechaRaw).trim();
  if (!fechaRegistro.match(/^\d{2}\/\d{2}\/\d{4}$/)) return null;

  // Hora (puede ser serial decimal)
  let horaRegistro = "";
  if (map.hora >= 0 && row[map.hora] != null) {
    const horaRaw = row[map.hora];
    if (typeof horaRaw === "number" && horaRaw > 0 && horaRaw < 1) {
      horaRegistro = excelTimeSerialAHora(horaRaw);
    } else {
      horaRegistro = String(horaRaw).trim();
    }
  }

  return {
    fechaRegistro,
    horaRegistro,
    noSolicitud: get(map.noSolicitud),
    matricula: get(map.matricula),
    nombre: get(map.nombre).toUpperCase(),
    adscripcionOrigen: get(map.adscripcionOrigen),
    percibeConcepto: get(map.percibeConcepto).toUpperCase(),
    zona: get(map.zona),
    adscripcionSolicitada: get(map.adscripcionSolicitada),
    especialidadArea: Number(get(map.especialidadArea)) || 0,
    tipo: get(map.tipo).toUpperCase().replace("ADSCRIPCION", "ADSCRIPCIÓN"),
    turnoSolicitado: get(map.turnoSolicitado).toUpperCase(),
    conConceptos: get(map.conConceptos).toUpperCase(),
  };
}

// Fallback posicional (si no se detecta encabezado)
function parsearFilaExcel(
  row: (string | number | null)[],
): Omit<CambiosRegistro, "id" | "listadoId"> | null {
  const str = (v: unknown): string => (v == null ? "" : String(v).trim());
  const fechaRaw = row[0];

  if (
    !fechaRaw ||
    (typeof fechaRaw === "string" && !/\d{2}\/\d{2}\/\d{4}/.test(fechaRaw))
  )
    return null;

  const fechaRegistro =
    typeof fechaRaw === "number" ? excelSerialAFecha(fechaRaw) : str(fechaRaw);
  if (!fechaRegistro.match(/^\d{2}\/\d{2}\/\d{4}$/)) return null;

  // Hora puede ser serial decimal
  let horaRegistro = "";
  const horaRaw = row[1];
  if (typeof horaRaw === "number" && horaRaw > 0 && horaRaw < 1) {
    horaRegistro = excelTimeSerialAHora(horaRaw);
  } else {
    horaRegistro = str(horaRaw);
  }

  // Matricula y nombre: intentar juntos en col 3 o separados en cols 3/4
  const col3 = str(row[3]);
  const mnMatch = col3.match(/^(\d{7,10})\s+(.+)$/);
  const matricula = mnMatch ? mnMatch[1] : col3;
  const nombre = mnMatch
    ? mnMatch[2].trim().toUpperCase()
    : str(row[4]).toUpperCase();
  const shift = mnMatch ? 0 : 1; // si están separados, todo se corre +1

  return {
    fechaRegistro,
    horaRegistro,
    noSolicitud: str(row[2]),
    matricula,
    nombre,
    adscripcionOrigen: str(row[4 + shift]),
    percibeConcepto: str(row[5 + shift]).toUpperCase(),
    zona: str(row[6 + shift]),
    adscripcionSolicitada: str(row[7 + shift]),
    especialidadArea: Number(str(row[8 + shift])) || 0,
    tipo: str(row[9 + shift])
      .toUpperCase()
      .replace("ADSCRIPCION", "ADSCRIPCIÓN"),
    turnoSolicitado: str(row[10 + shift]).toUpperCase(),
    conConceptos: str(row[11 + shift]).toUpperCase(),
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

    // Detectar encabezado de columnas dinámicamente
    const colMap = detectarEncabezado(rows);

    for (const row of rows) {
      const nonNull = row.filter((c) => c !== null);
      if (nonNull.length === 0) continue;

      // Bloque de metadata: celda única con salto de línea (\r\n o \n)
      if (
        nonNull.length === 1 &&
        typeof nonNull[0] === "string" &&
        (nonNull[0].includes("\r\n") || nonNull[0].includes("\n"))
      ) {
        const lines = nonNull[0]
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        const parsed = parsearHeaderCambios(lines);
        if (parsed.categoriaCode || parsed.concepto !== undefined) {
          headerData = { ...headerData, ...parsed };
        }
        continue;
      }

      // Metadata distribuida en múltiples celdas — intentar parsear como texto plano
      if (
        !headerData.categoriaCode &&
        nonNull.some(
          (c) =>
            typeof c === "string" && /CATEGORIA|DELEGACI[OÓ]N|SECTOR/i.test(c),
        )
      ) {
        const textoFila = nonNull.map(String).join(" ");
        const parsed = parsearHeaderCambios([textoFila]);
        if (parsed.categoriaCode) {
          headerData = { ...headerData, ...parsed };
        }
        continue;
      }

      // Saltar la fila de encabezado de columnas
      if (
        colMap &&
        nonNull.length >= 5 &&
        nonNull.every((c) => typeof c === "string") &&
        nonNull.some(
          (c) =>
            typeof c === "string" &&
            (String(c).toUpperCase().includes("FECHA") ||
              String(c).toUpperCase().includes("SOLICITUD")),
        )
      ) {
        continue;
      }

      const registro = colMap
        ? parsearFilaConMapa(row, colMap)
        : parsearFilaExcel(row);
      if (registro) registros.push(registro);
    }

    // Si aún falta categoriaCode, intentar parsear las primeras 20 filas como bloque de texto
    if (!headerData.categoriaCode) {
      const textoGlobal = rows
        .slice(0, 20)
        .flatMap((row: (string | number | null)[]) =>
          row.filter((c) => c !== null).map(String),
        )
        .join(" ");
      const parsed = parsearHeaderCambios([textoGlobal]);
      if (parsed.categoriaCode) {
        headerData = { ...headerData, ...parsed };
      }
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

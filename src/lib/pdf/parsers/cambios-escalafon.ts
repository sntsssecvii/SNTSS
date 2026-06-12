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

// ---------------------------------------------------------------------------
// Parser por patrones de valor — Adobe Excel produce columnas sparse/variables
// ---------------------------------------------------------------------------

const ZONAS_RE =
  /^\d-(ENSENADA|MEXICALLI|SAN[\s_]+LUIS|TECATE|TIJUANA|INCONDICIONAL)$/i;
const FACILITY_RE =
  /\b(HOSPITAL|UNIDAD|CLINICA|CENTRO|C\/MF|HGZ|HGR|UMF|COORDINACION|JEFATURA|OFICINA|MODULO)\b/i;

function parsearFilaExcelPorPatron(
  row: (string | number | null)[],
): Omit<CambiosRegistro, "id" | "listadoId"> | null {
  const cells: { idx: number; val: string | number }[] = [];
  for (let i = 0; i < row.length; i++) {
    if (row[i] != null) cells.push({ idx: i, val: row[i] as string | number });
  }

  const s = (v: string | number) => String(v).trim();

  // 1. Fecha
  let fechaRegistro = "";
  let fechaIdx = -1;
  for (const { idx, val } of cells) {
    if (typeof val === "number" && val > 40000 && val < 55000) {
      fechaRegistro = excelSerialAFecha(val);
      fechaIdx = idx;
      break;
    }
    if (typeof val === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      fechaRegistro = val;
      fechaIdx = idx;
      break;
    }
  }
  if (!fechaRegistro) return null;

  // 2. Hora (serial decimal o string decimal o HH:MM:SS)
  let horaRegistro = "";
  for (const { idx, val } of cells) {
    if (idx <= fechaIdx) continue;
    if (typeof val === "number" && val > 0 && val < 1) {
      horaRegistro = excelTimeSerialAHora(val);
      break;
    }
    if (typeof val === "string") {
      const t = val.trim();
      if (/^\d{2}:\d{2}:\d{2}$/.test(t)) {
        horaRegistro = t;
        break;
      }
      const n = parseFloat(t);
      if (!isNaN(n) && n > 0 && n < 1) {
        horaRegistro = excelTimeSerialAHora(n);
        break;
      }
    }
  }

  // 3. noSolicitud ([A-Z]\d{5,})
  let noSolicitud = "";
  let noSolicitudIdx = -1;
  for (const { idx, val } of cells) {
    const t = s(val);
    if (/^[A-Z]\d{5,}$/.test(t)) {
      noSolicitud = t;
      noSolicitudIdx = idx;
      break;
    }
  }

  // 4. Matrícula (número 7-11 dígitos, ≥ 1M)
  let matricula = "";
  let matriculaIdx = -1;
  for (const { idx, val } of cells) {
    if (typeof val === "number") {
      const n = Math.round(val);
      const ns = String(n);
      if (n >= 1_000_000 && ns.length <= 11) {
        matricula = ns;
        matriculaIdx = idx;
        break;
      }
    } else {
      const t = val.trim();
      if (/^\d{7,11}$/.test(t) && parseInt(t) >= 1_000_000) {
        matricula = t;
        matriculaIdx = idx;
        break;
      }
    }
  }

  // 5. Nombre (APELLIDO/APELLIDO/NOMBRE o solo letras/espacios, ≠ facilidad, ≠ zona, ≠ tipo)
  let nombre = "";
  let nombreIdx = -1;
  // Primero intentar patrón con slash
  for (const { idx, val } of cells) {
    const t = s(val);
    if (/[A-ZÁÉÍÓÚÑ]+\/[A-ZÁÉÍÓÚÑ]+/.test(t)) {
      nombre = t.toUpperCase();
      nombreIdx = idx;
      break;
    }
  }
  // Si no hay slash, buscar celda de solo letras/espacios que no sea zona ni facilidad ni tipo
  if (!nombre) {
    for (const { idx, val } of cells) {
      if (typeof val !== "string") continue;
      const t = val.trim();
      if (t.length < 4) continue;
      if (ZONAS_RE.test(t)) continue;
      if (FACILITY_RE.test(t)) continue;
      if (
        /^(TURNO|ADSCRIPCI[OÓ]N|MATUTINO|VESPERTINO|NOCTURNO|INCONDICIONAL|JORNADA(\s+ACUMULADA)?|J\.?ACUM\.?|SI|NO)$/i.test(
          t,
        )
      )
        continue;
      if (/^[A-ZÁÉÍÓÚÑ\s]+$/.test(t) && t.split(" ").length >= 2) {
        nombre = t.toUpperCase();
        nombreIdx = idx;
        break;
      }
    }
  }

  // 6. Zona
  let zona = "";
  let zonaIdx = -1;
  for (const { idx, val } of cells) {
    const t = s(val);
    if (ZONAS_RE.test(t)) {
      zona = t;
      zonaIdx = idx;
      break;
    }
  }

  // 7. Adscripciones (antes de zona = origen, después = solicitada)
  // Si no hay zona: primera = origen, segunda = solicitada (orden posicional)
  const facilidades: { idx: number; name: string }[] = [];
  for (const { idx, val } of cells) {
    const t = s(val);
    if (FACILITY_RE.test(t) && t.length > 5) {
      facilidades.push({ idx, name: t });
    }
  }
  let adscripcionOrigen = "";
  let adscripcionSolicitada = "";
  if (zonaIdx >= 0) {
    adscripcionOrigen = facilidades.find((f) => f.idx < zonaIdx)?.name ?? "";
    adscripcionSolicitada =
      facilidades.find((f) => f.idx > zonaIdx)?.name ?? "";
  } else {
    adscripcionOrigen = facilidades[0]?.name ?? "";
    adscripcionSolicitada = facilidades[1]?.name ?? "";
  }

  // 8. EspecialidadArea (2-4 dígitos, después del nombre)
  let especialidadArea = 0;
  const afterNombreIdx = Math.max(
    nombreIdx,
    matriculaIdx,
    noSolicitudIdx,
    fechaIdx,
  );
  for (const { idx, val } of cells) {
    if (idx <= afterNombreIdx) continue;
    const n = typeof val === "number" ? Math.round(val) : parseInt(s(val), 10);
    if (!isNaN(n) && n >= 1 && n <= 9999 && String(n) !== matricula) {
      especialidadArea = n;
      break;
    }
  }

  // 9. Tipo (TURNO/ADSCRIPCION)
  let tipo = "";
  for (const { val } of cells) {
    const t = s(val).toUpperCase();
    if (/^(TURNO|ADSCRIPCI[OÓ]N)$/.test(t)) {
      tipo = t.replace("ADSCRIPCION", "ADSCRIPCIÓN");
      break;
    }
  }

  // 10. TurnoSolicitado
  let turnoSolicitado = "";
  for (const { val } of cells) {
    const t = s(val).toUpperCase();
    if (
      /^(MATUTINO|VESPERTINO|NOCTURNO|INCONDICIONAL|J\.?ACUM\.?|JORNADA\s+ACUMULADA)$/.test(
        t,
      )
    ) {
      turnoSolicitado = t;
      break;
    }
  }

  // 11. PercibeConcepto (antes de zona) y ConConceptos (después de zona)
  let percibeConcepto = "";
  let conConceptos = "";
  for (const { idx, val } of cells) {
    const t = s(val).toUpperCase();
    if (t === "SI" || t === "NO") {
      if (zonaIdx >= 0 && idx < zonaIdx) {
        if (!percibeConcepto) percibeConcepto = t;
      } else {
        if (!conConceptos) conConceptos = t;
      }
    }
  }

  return {
    fechaRegistro,
    horaRegistro,
    noSolicitud,
    matricula,
    nombre,
    adscripcionOrigen,
    percibeConcepto,
    zona,
    adscripcionSolicitada,
    especialidadArea,
    tipo,
    turnoSolicitado,
    conConceptos,
  };
}

// Fallback posicional (conservado por compatibilidad — no se usa en Adobe path)
function parsearFilaExcel(
  row: (string | number | null)[],
): Omit<CambiosRegistro, "id" | "listadoId"> | null {
  return parsearFilaExcelPorPatron(row);
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

      // Parsear fila por patrones de valor (robusto ante Excel sparse de Adobe)
      const registro = parsearFilaExcelPorPatron(row);
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

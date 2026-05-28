import { readFile } from "fs/promises";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
import * as XLSX from "xlsx";
import { callPythonExtractor } from "@/lib/pdf/pythonBridge";
import { AdobePdfService } from "@/lib/excel/services/adobePdfService";
import type {
  EscalafonParseResult,
  EscalafonAspirante,
  EscalafonPreferencia,
} from "@/types/escalafon";

// Extrae líneas del PDF usando pdfjs-dist con reconstrucción espacial por coordenada Y.
// A diferencia de pdf-parse, agrupa los items de texto por posición Y (tolerancia 5pt)
// y los ordena por X, preservando el layout de columnas de los PDFs SIAP.
// Carga lazy para no inicializar pdfjs-dist en el entorno de tests.
async function extraerLineasConPdfjs(
  pdfPath: string,
): Promise<{ page_number: number; lines: string[] }[]> {
  const buffer = await readFile(pdfPath);

  // Polyfill mínimo para que pdfjs-dist funcione en Node.js sin DOM
  if (typeof global !== "undefined") {
    if (!(global as Record<string, unknown>).DOMMatrix)
      (global as Record<string, unknown>).DOMMatrix = class DOMMatrix {};
    if (!(global as Record<string, unknown>).Path2D)
      (global as Record<string, unknown>).Path2D = class Path2D {};
    if (!(global as Record<string, unknown>).ImageData)
      (global as Record<string, unknown>).ImageData = class ImageData {};
  }

  const pdfjsLib = await import("pdfjs-dist");
  // Apuntar al worker real para que pdfjs pueda inicializar en Node.js.
  // Requiere que pdfjs-dist esté en serverExternalPackages en next.config.js.
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

    // Agrupar items por coordenada Y (reconstrucción de filas horizontales)
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

    // PDF coords son de abajo hacia arriba → ordenar descendente = top-first
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

// --- Helpers ---

function normalizarTexto(val: string | null | undefined): string {
  return (val ?? "").trim().toUpperCase();
}

/**
 * pdfplumber fragmenta las columnas de forma impredecible (14-19 cols).
 * Estrategia: unir toda la fila en un string y parsear con regex usando
 * la fecha (DD/MM/YYYY) como ancla central.
 */
const ROW_PATTERN = new RegExp(
  [
    /^(\d+)/.source, // 1: lugar
    /\s+(PEI|Activo)/i.source, // 2: estatus
    /\s+(\d{7,10})/.source, // 3: matricula
    /\s+(.+?)/.source, // 4: nombre (lazy, hasta deleg)
    /\s+(\d{2})/.source, // 5: delegacion code
    /\s+(\d{2}\/\d{2}\/\d{4})/.source, // 6: fecha registro
    /\s+(.+)$/.source, // 7: rest (preferencia)
  ].join(""),
);

/**
 * Parsea el "rest" después de la fecha: delegación solicitada, zona,
 * localidad, adscripción y turno.
 *
 * Ejemplos reales:
 * - "02 BAJA 1 ENSENADA Incondic ional Incondicional I ncondicion"
 * - "02 BAJA 1 ENSENADA 0203361 02HA230000 HOSPITAL GENERAL 1 Matutino"
 * - "02 BAJA 7 TIJUANA 0205321 RIO 02HA010000 HOSPITAL GENERAL 1 Matutino"
 * - "02 BAJA 6 TECATE 0202011 TECATE 02HF060000 HOSPITAL GENERAL 5 Jornada"
 */
function parsearPreferenciaDesdeTexto(rest: string): EscalafonPreferencia {
  // Normalizar fragmentos de "Incondicional" que pdfplumber rompe
  const normalized = rest
    .replace(/[Ii]ncondic\s*ional/g, "Incondicional")
    .replace(/[Ii]n\s*condicional/g, "Incondicional")
    .replace(/[Ii]\s*ncondicion\w*/g, "Incondicional")
    .replace(/\s+/g, " ")
    .trim();

  // Delegación solicitada: "NN DESC"
  const delegMatch = normalized.match(/^(\d{2}\s+\S+)\s+(.+)$/);
  const delegacionSolicitada = delegMatch?.[1] ?? "Incondicional";
  const afterDeleg = delegMatch?.[2] ?? normalized;

  // Zona solicitada: "N DESC" (1-2 dígitos + nombre)
  const zonaMatch = afterDeleg.match(/^(\d{1,2}\s+\S+(?:\s+\S+)?)\s+(.+)$/);
  let zonaSolicitada = "Incondicional";
  let afterZona = afterDeleg;

  if (zonaMatch) {
    // zona puede tomar de más - hay que ser cuidadoso
    // La zona es "N WORD" donde N es 1-2 dígitos y WORD es el nombre de zona
    const zonaSimple = afterDeleg.match(
      /^(\d{1,2}\s+[A-Z]+(?:\s+(?!Incondicional\b)[A-Z]+)?)\s+(.+)$/i,
    );
    if (zonaSimple) {
      // Verify what comes after isn't still part of zone by checking if next is a code or Incondicional
      const remaining = zonaSimple[2];
      if (
        remaining.match(/^\d{7}/) || // localidad code
        remaining.match(/^Incondicional/i)
      ) {
        zonaSolicitada = zonaSimple[1];
        afterZona = remaining;
      } else {
        // Might be multi-word zone like "SAN LUIS" - try broader match
        const zonaBroad = afterDeleg.match(
          /^(\d{1,2}\s+[A-Z]+(?:\s+[A-Z]+)*?)\s+((?:\d{7}|Incondicional).*)$/i,
        );
        if (zonaBroad) {
          zonaSolicitada = zonaBroad[1];
          afterZona = zonaBroad[2];
        } else {
          zonaSolicitada = zonaSimple[1];
          afterZona = remaining;
        }
      }
    }
  }

  // Ahora afterZona es: localidad + adscripcion + turno
  // localidad: "NNNNNNN DESC" (7 dígitos + nombre) o "Incondicional"
  let localidadSolicitada = "Incondicional";
  let adscripcionCode = "Incondicional";
  let adscripcionDesc = "Incondicional";
  let turnoNum: number | null = null;
  let turnoDesc = "Incondicional";

  if (/^Incondicional/i.test(afterZona)) {
    // Todo incondicional a partir de aquí
    localidadSolicitada = "Incondicional";
    adscripcionCode = "Incondicional";
    adscripcionDesc = "Incondicional";
    turnoDesc = "Incondicional";
  } else {
    // localidad: 7-digit code + name
    const locMatch = afterZona.match(/^(\d{7})\s+(.+)$/);
    if (locMatch) {
      const locCode = locMatch[1];
      const afterLocCode = locMatch[2];

      // Adscripción: 10-char code (e.g. 02HA230000) + desc + turno
      const adscMatch = afterLocCode.match(
        /^([A-Z0-9]*?)\s*(\d{2}[A-Z]{2}\d{6})\s+(.+)$/,
      );
      if (adscMatch) {
        // locName is before the adscription code
        const locName = adscMatch[1].trim();
        localidadSolicitada = locName ? `${locCode} ${locName}` : locCode;
        adscripcionCode = adscMatch[2];
        const adscRest = adscMatch[3];

        // Turno: last part "N Desc" or "Incondicional"
        const turnoMatch = adscRest.match(/^(.+?)\s+(\d)\s+(\S+)$/);
        if (turnoMatch) {
          adscripcionDesc = turnoMatch[1].trim();
          turnoNum = Number(turnoMatch[2]);
          turnoDesc = turnoMatch[3];
        } else if (/Incondicional/i.test(adscRest)) {
          // Split adscDesc from Incondicional turno
          const parts = adscRest.split(/\s+Incondicional/i);
          adscripcionDesc = parts[0].trim() || "Incondicional";
          turnoDesc = "Incondicional";
        } else {
          adscripcionDesc = adscRest;
        }
      } else {
        // No adscription code found - try simpler pattern
        // Maybe localidad name + Incondicional
        localidadSolicitada = `${locCode}`;
        const simpleAdsc = afterLocCode.match(/^(.+?)\s+Incondicional/i);
        if (simpleAdsc) {
          const locNamePart = simpleAdsc[1].trim();
          localidadSolicitada = locNamePart
            ? `${locCode} ${locNamePart}`
            : locCode;
        }
      }
    }
  }

  return {
    delegacionSolicitada,
    zonaSolicitada,
    localidadSolicitada,
    adscripcionCode,
    adscripcionDesc,
    turnoNum,
    turnoDesc,
  };
}

// --- Header parser (de las líneas de texto de la página 1) ---

interface HeaderData {
  delegacion: string;
  numeroListado: string;
  sector: string;
  fechaEmision: string;
  categoriaCode: string;
  categoriaDesc: string;
  areaCode: string;
  areaDesc: string;
  convocatoria: string;
  vigenciaInicio: string;
  vigenciaFin: string;
  periodoDecierre: string;
  totalAspirantes: number;
}

function parsearHeader(lines: string[]): Partial<HeaderData> {
  const texto = lines.join(" ");
  const get = (pattern: RegExp) => (texto.match(pattern)?.[1] ?? "").trim();

  const totalMatch = texto.match(/NUMERO DE ASPIRANTES[:\s]+(\d+)/);
  const totalAspirantes = totalMatch ? Number(totalMatch[1]) : 0;

  // Categoría: código (8 dígitos) + descripción opcional hasta keyword siguiente
  const catCodeMatch = texto.match(/CATEGORIA[:\s]+(\d{8})/);
  const categoriaCode = catCodeMatch?.[1] ?? "";
  const catDescMatch = texto.match(
    /CATEGORIA[:\s]+\d{8}\s+([A-Z\s0-9]+?)(?=\s+CONVOCATORIA|\s+VIGENCIA|\s+AREA|\s+PERIODO)/,
  );
  const categoriaDesc = catDescMatch?.[1]?.trim() ?? "";

  // Area: código (3 dígitos) + descripción
  const areaMatch = texto.match(
    /AREA[:\s]+(\d{3})\s+([A-Z\s]+?)(?:\s+CONVOCATORIA|\s+PERIODO|\s*$)/,
  );
  const areaCode = areaMatch?.[1] ?? "";
  const areaDesc = areaMatch?.[2]?.trim() ?? "";

  // Fechas de vigencia: "01/02/2026 A: 31/01/2027"
  const vigMatch = texto.match(
    /VIGENCIA[:\s]+(\d{2}\/\d{2}\/\d{4})\s+A[:\s]+(\d{2}\/\d{2}\/\d{4})/,
  );

  return {
    delegacion: get(/DELEGACI[OÓ]N[:\s]+([A-Z\s]+?)(?:\s+NUMERO|\s+FECHA)/),
    numeroListado: get(/NUMERO DE LISTADO[:\s]+(\S+)/),
    sector: get(/SECTOR[:\s]+([A-Z0-9\s]+?)(?:\s+NUMERO|\s+CONVOCATORIA)/),
    fechaEmision: get(/FECHA DE EMISION[:\s]+(\d{2}\/\d{2}\/\d{4})/),
    categoriaCode,
    categoriaDesc,
    areaCode,
    areaDesc,
    convocatoria: get(/CONVOCATORIA[:\s]+(\S+)/),
    vigenciaInicio: vigMatch?.[1] ?? "",
    vigenciaFin: vigMatch?.[2] ?? "",
    periodoDecierre: get(/PERIODO DE CIERRE[:\s]+(\S+)/),
    totalAspirantes,
  };
}

/**
 * Detecta si una línea de texto es una fila de datos (empieza con número + estatus + matrícula).
 */
function esLineaDato(line: string): boolean {
  return ROW_PATTERN.test(line);
}

// --- Extracción vía Adobe PDF Services → Excel ---

/**
 * Convierte el PDF a Excel con Adobe y aplana cada fila en una línea de texto.
 * Esto replica el mismo output que pdfplumber/pdfjs (lista de líneas por página),
 * por lo que los parsers de header y filas de datos no necesitan cambios.
 */
async function extraerLineasConAdobe(
  pdfPath: string,
): Promise<{ page_number: number; lines: string[] }[]> {
  const buffer = await readFile(pdfPath);
  const excelBuffer = await AdobePdfService.convertPdfToExcel(
    buffer,
    path.basename(pdfPath),
  );

  const workbook = XLSX.read(excelBuffer);
  const results: { page_number: number; lines: string[] }[] = [];

  for (let i = 0; i < workbook.SheetNames.length; i++) {
    const sheet = workbook.Sheets[workbook.SheetNames[i]];
    // Cada fila del Excel → array de celdas; unimos con espacio para reconstruir la línea
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
    });

    const lines = rows
      .map((row) =>
        row
          .filter((cell) => cell !== null && String(cell).trim() !== "")
          .map((cell) => String(cell).trim())
          .join(" ")
          .trim(),
      )
      .filter((l) => l.length > 0);

    // DEBUG: loguear las primeras 15 líneas para ver el formato real del Excel
    if (i === 0) {
      console.log(
        "[escalafon-adobe-debug] Primeras 15 líneas del Excel:",
        JSON.stringify(lines.slice(0, 15)),
      );
      // También loguear las primeras 5 filas crudas para ver la estructura de celdas
      const rawRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
        sheet,
        { header: 1, defval: null },
      );
      console.log(
        "[escalafon-adobe-debug] Primeras 5 filas crudas:",
        JSON.stringify(
          rawRows.slice(0, 5).map((r) => r.filter((c) => c !== null)),
        ),
      );
    }

    results.push({ page_number: i + 1, lines });
  }

  return results;
}

// --- Función principal ---

export async function parsearListadoCondicionalidad(
  pdfPath: string,
): Promise<EscalafonParseResult> {
  const errores: string[] = [];
  // Map key: `${lugar}_${matricula}` para agrupar preferencias
  const aspirantesMap = new Map<
    string,
    Omit<EscalafonAspirante, "id" | "listadoId">
  >();
  let headerData: Partial<HeaderData> = {};

  try {
    let pages: { page_number: number; lines: string[] }[];

    // 1. Adobe PDF Services (primario) — igual que bolsa de trabajo
    // 2. Python bridge (local dev con venv)
    // 3. pdfjs-dist (último recurso en Node.js)
    const adobeClientId = process.env.ADOBE_CLIENT_ID;
    const adobeClientSecret = process.env.ADOBE_CLIENT_SECRET;

    if (adobeClientId && adobeClientSecret) {
      try {
        pages = await extraerLineasConAdobe(pdfPath);
      } catch (adobeErr) {
        errores.push(
          `Adobe falló, usando fallback: ${adobeErr instanceof Error ? adobeErr.message : String(adobeErr)}`,
        );
        pages = await extraerLineasConPdfjs(pdfPath);
      }
    } else {
      try {
        const data = await callPythonExtractor(pdfPath);
        pages = data.pages.map((p) => ({
          page_number: p.page_number,
          lines: p.lines ?? [],
        }));
      } catch {
        // Python no disponible (Vercel u otro entorno sin venv) — usar pdfjs-dist
        pages = await extraerLineasConPdfjs(pdfPath);
      }
    }

    for (const page of pages) {
      // Parsear header solo en página 1
      if (page.page_number === 1 && page.lines?.length) {
        headerData = parsearHeader(page.lines);
      }

      for (const rawLine of page.lines) {
        const line = rawLine.replace(/\s+/g, " ").trim();
        if (!esLineaDato(line)) continue;

        const m = line.match(ROW_PATTERN);
        if (!m) continue;

        const lugar = Number(m[1]);
        const estatus =
          normalizarTexto(m[2]) === "PEI"
            ? ("PEI" as const)
            : ("Activo" as const);
        const matricula = m[3];
        const nombre = normalizarTexto(m[4]);
        const delegacion = m[5];
        const fechaRegistro = m[6];
        const rest = m[7];

        const key = `${lugar}_${matricula}`;
        const preferencia = parsearPreferenciaDesdeTexto(rest);

        if (aspirantesMap.has(key)) {
          aspirantesMap.get(key)!.preferencias.push(preferencia);
        } else {
          aspirantesMap.set(key, {
            lugar,
            estatus,
            matricula,
            nombre,
            delegacion,
            fechaRegistro,
            preferencias: [preferencia],
          });
        }
      }
    }
  } catch (error) {
    errores.push(
      `Error al procesar PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const aspirantes = Array.from(aspirantesMap.values()).sort(
    (a, b) => a.lugar - b.lugar,
  );
  const parsed = aspirantes.length;

  if (headerData.totalAspirantes && parsed !== headerData.totalAspirantes) {
    errores.push(
      `Advertencia: el PDF declara ${headerData.totalAspirantes} aspirantes pero se extrajeron ${parsed}.`,
    );
  }

  const listado = {
    delegacion: headerData.delegacion ?? "",
    numeroListado: headerData.numeroListado ?? "",
    sector: headerData.sector ?? "",
    fechaEmision: headerData.fechaEmision ?? "",
    categoriaCode: headerData.categoriaCode ?? "",
    categoriaDesc: headerData.categoriaDesc ?? "",
    areaCode: headerData.areaCode ?? "",
    areaDesc: headerData.areaDesc ?? "",
    convocatoria: headerData.convocatoria ?? "",
    vigenciaInicio: headerData.vigenciaInicio ?? "",
    vigenciaFin: headerData.vigenciaFin ?? "",
    periodoDecierre: headerData.periodoDecierre ?? "",
    totalAspirantes: headerData.totalAspirantes ?? 0,
  };

  return { listado, aspirantes, errores };
}

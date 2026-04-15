import { callPythonExtractor } from "@/lib/pdf/pythonBridge";
import type {
  EscalafonParseResult,
  EscalafonAspirante,
  EscalafonPreferencia,
} from "@/types/escalafon";

// --- Helpers ---

function normalizarTexto(val: string | null | undefined): string {
  return (val ?? "").trim().toUpperCase();
}

function esFilaEncabezado(row: (string | null)[]): boolean {
  const cell0 = (row[0] ?? "").trim();
  return !cell0 || isNaN(Number(cell0));
}

function esFilaDato(row: (string | null)[]): boolean {
  const lugar = (row[0] ?? "").trim();
  const mat = (row[2] ?? "").trim();
  return /^\d+$/.test(lugar) && /^\d{7,10}$/.test(mat);
}

function parsearPreferencia(row: (string | null)[]): EscalafonPreferencia {
  const adscripcionRaw = normalizarTexto(row[9]);
  const turnoRaw = normalizarTexto(row[10]);

  // Adscripción puede ser "02HA230000 HOSPITAL GENERAL REGIONAL 23" o "INCONDICIONAL"
  let adscripcionCode = "Incondicional";
  let adscripcionDesc = "Incondicional";
  if (adscripcionRaw && adscripcionRaw !== "INCONDICIONAL") {
    const match = adscripcionRaw.match(/^(\w+)\s+(.+)$/);
    if (match) {
      adscripcionCode = match[1];
      adscripcionDesc = match[2];
    } else {
      adscripcionCode = adscripcionRaw;
      adscripcionDesc = adscripcionRaw;
    }
  }

  // Turno puede ser "1 MATUTINO", "INCONDICIONAL", etc.
  let turnoNum: number | null = null;
  let turnoDesc = "Incondicional";
  if (turnoRaw && turnoRaw !== "INCONDICIONAL") {
    const match = turnoRaw.match(/^(\d+)\s*(.*)$/);
    if (match) {
      turnoNum = Number(match[1]);
      turnoDesc = match[2] || `Turno ${match[1]}`;
    }
  }

  return {
    delegacionSolicitada: normalizarTexto(row[6]) || "Incondicional",
    zonaSolicitada: normalizarTexto(row[7]) || "Incondicional",
    localidadSolicitada: normalizarTexto(row[8]) || "Incondicional",
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

  // Categoría: código (8 dígitos) + descripción
  const catMatch = texto.match(/CATEGORIA[:\s]+(\d{8})\s+([A-Z\s]+?\d{2})/);
  const categoriaCode = catMatch?.[1] ?? "";
  const categoriaDesc = catMatch?.[2]?.trim() ?? "";

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
    const data = await callPythonExtractor(pdfPath);

    for (const page of data.pages) {
      // Parsear header solo en página 1
      if (page.page_number === 1 && page.lines?.length) {
        headerData = parsearHeader(page.lines);
      }

      if (!page.tables) continue;

      for (const table of page.tables) {
        if (!table) continue;

        for (const row of table) {
          if (!row || row.length < 11) continue;
          if (esFilaEncabezado(row)) continue;
          if (!esFilaDato(row)) continue;

          const lugar = Number((row[0] ?? "").trim());
          const estatus =
            normalizarTexto(row[1]) === "PEI"
              ? ("PEI" as const)
              : ("Activo" as const);
          const matricula = (row[2] ?? "").trim();
          const nombre = normalizarTexto(row[3]);
          const delegacion = (row[4] ?? "").trim();
          const fechaRegistro = (row[5] ?? "").trim();

          const key = `${lugar}_${matricula}`;
          const preferencia = parsearPreferencia(row);

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

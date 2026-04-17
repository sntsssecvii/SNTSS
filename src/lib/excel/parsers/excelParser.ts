import * as XLSX from "xlsx";
import type {
  BolsaDeTrabajoRegistro,
  TipoBolsaDeTrabajo,
  MetadataBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";
import { parseUtils } from "../../pdf/parser";
import { SCHEMAS, validateRegistro } from "../../pdf/schemas";

// El schema se obtiene dinámicamente por tipo en cada parser específico

export interface ExcelParseResult {
  registros: BolsaDeTrabajoRegistro[];
  metadata: MetadataBolsaDeTrabajo;
  errores: string[];
}

/**
 * Parser genérico para archivos Excel de la Bolsa de Trabajo
 */
export async function parseExcel(
  buffer: Buffer,
  tipo: TipoBolsaDeTrabajo,
  nombreArchivo?: string,
): Promise<ExcelParseResult> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });

    let resultado: ExcelParseResult;

    switch (tipo) {
      case "NUEVO_INGRESO":
        resultado = parseNuevoIngresoExcel(workbook);
        break;
      case "CAMBIOS_TURNO_ADSCRIPCION":
        resultado = parseCambiosTurnoExcel(workbook);
        break;
      case "AMPLIACIONES_JORNADA":
        resultado = parseAmpliacionesJornadaExcel(workbook);
        break;
      case "CAMBIOS_AREA":
        resultado = parseCambiosAreaExcel(workbook);
        break;
      case "CAMBIOS_RAMA":
        resultado = parseCambiosRamaExcel(workbook);
        break;
      case "CAMBIOS_RESIDENCIA_DESTINO":
        resultado = parseCambiosResidenciaExcel(
          workbook,
          "CAMBIOS_RESIDENCIA_DESTINO",
        );
        break;
      case "CAMBIOS_RESIDENCIA_ORIGEN":
        resultado = parseCambiosResidenciaExcel(
          workbook,
          "CAMBIOS_RESIDENCIA_ORIGEN",
        );
        break;
      case "CAMBIOS_TIPO_PLAZA":
        resultado = parseCambiosTipoPlazaExcel(workbook);
        break;
      default:
        console.log(`Usando parser genérico para tipo: ${tipo}`);
        resultado = parseGenericoExcel(workbook, tipo);
        break;
    }

    resultado.metadata.totalRegistros = resultado.registros.length;
    resultado.metadata.extraidoCon = "EXCEL";

    return resultado;
  } catch (error: any) {
    console.error("Error parseando Excel:", error);
    return {
      registros: [],
      metadata: {},
      errores: [`Error al parsear Excel: ${error.message}`],
    };
  }
}

/**
 * Parser específico para Nuevo Ingreso
 * Basado en la estructura observada:
 * Col 0: No. Prog
 * Col 1: Nombre
 * Col 2: Matrícula
 * Col 3: Fecha de Registro
 * Col 4: Grupo
 * Col 5: Calificación
 * Col 6: Tipo Contratación
 * Col 7: Días Laborados
 * Col 8: Estatus
 * Col 9: Observaciones
 */
function parseNuevoIngresoExcel(workbook: XLSX.WorkBook): ExcelParseResult {
  const registros: BolsaDeTrabajoRegistro[] = [];
  const errores: string[] = [];
  const schema = SCHEMAS.NUEVO_INGRESO;

  // zonaActual persiste entre hojas porque el Excel puede no repetir la zona en cada hoja
  let zonaActual = "";
  // categoriaActual SE RESETEA en cada hoja para evitar contaminar con categorías de hojas previas
  let categoriaActual = "";
  let subcategoriaActual = "";

  // Procesamos todas las hojas
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    // Convertimos a matriz de arreglos para manejar filas irregulares o headers
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    // NOTA: Ambas variables persisten entre hojas porque algunas hojas continúan
    // registros de la hoja anterior sin repetir zona/categoría.

    rows.forEach((row, index) => {
      // Ignorar filas vacías
      if (!row || row.length === 0) return;

      const firstColRaw = String(row[0] || "").trim();
      if (!firstColRaw) return;

      // Normalización para comparaciones (quitar acentos y pasar a mayúsculas)
      const firstColNorm = firstColRaw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

      const col1 = String(row[1] || "").trim();
      const col2 = String(row[2] || "").trim();

      // ─────────────────────────────────────────────────────────────
      // 1. Detectar ZONA
      //    Formatos: "9-SAN FELIPE", "ZONA: MEXICALI", "ZONA TIJUANA"
      //    Solo cuando col1 y col2 están vacías (es una fila de encabezado)
      // ─────────────────────────────────────────────────────────────
      const isZonePattern =
        /^\d{1,2}-\S/.test(firstColRaw) || // "9-SANFELIPE", "10-MEXICALI"
        firstColNorm.startsWith("ZONA");

      if (isZonePattern && !col1 && !col2) {
        zonaActual = firstColRaw.replace(/^zona:?\s*/i, "").trim();
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // 2. Detectar DATOS DEL REGISTRO (No. Prog numérico, con nombre y matrícula)
      //    Es lo más importante: detectar PRIMERO los registros reales.
      // ─────────────────────────────────────────────────────────────
      const isNumericNoProg = /^\d+$/.test(firstColRaw);
      if (isNumericNoProg && row.length >= 3 && col1 && col2) {
        try {
          const nombre = col1;
          const matricula = col2;

          // La fecha puede venir como número serial de Excel o string
          let fechaRaw = row[3];
          let fecha = "";
          if (typeof fechaRaw === "number") {
            const d = new Date(Math.round((fechaRaw - 25569) * 86400 * 1000));
            fecha = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
          } else {
            fecha = String(fechaRaw || "").trim();
          }

          // Corrección para el caso de "0" en días laborados
          const rawDias = row[7];
          let diasLaborados = "";
          if (rawDias === 0) {
            diasLaborados = "0";
          } else if (rawDias) {
            diasLaborados = String(rawDias).trim().replace(/,/g, "");
          }

          const registro: BolsaDeTrabajoRegistro = {
            id: parseUtils.generarIdRegistro("NUEVO_INGRESO", registros.length),
            tipoDocumento: "NUEVO_INGRESO",
            numeroProg: firstColRaw,
            nombre,
            matricula,
            fecha,
            grupo: String(row[4] || "").trim(),
            calificacion: String(row[5] || "").trim(),
            tipoContratacion: String(row[6] || "").trim(),
            diasLaborados,
            estatus: String(row[8] || "").trim(),
            observaciones: String(row[9] || "").trim() || undefined,
            zona: zonaActual,
            categoria: categoriaActual,
            subcategoria: subcategoriaActual || undefined,
            filaOriginal: index + 1,
            confianza: 1.0,
            necesitaValidacion: false,
          } as BolsaDeTrabajoRegistro;

          const validationErrors = validateRegistro(registro, schema);
          if (validationErrors.length > 0) {
            errores.push(
              `Hoja ${sheetName}, Fila ${index + 1}: ${validationErrors.join("; ")}`,
            );
          }

          registros.push(registro);
        } catch (e: any) {
          errores.push(
            `Error en Hoja ${sheetName}, Fila ${index + 1}: ${e.message}`,
          );
        }
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // 3. Detectar CATEGORÍA
      //    ÚNICO formato aceptado: "XXXXXX - NOMBRE" (6 dígitos seguido de guión)
      //    Cualquier otra cosa se ignora (encabezados admin, textos sueltos, etc.)
      // ─────────────────────────────────────────────────────────────
      if (/^\d{5,6}\s*-\s*\S/.test(firstColRaw) && !col1 && !col2) {
        categoriaActual = firstColRaw;
        subcategoriaActual = "";
        return;
      }

      if (
        /^\d{1,3}\s+[A-ZÁÉÍÓÚÑ]/.test(firstColRaw) &&
        !col1 &&
        !col2 &&
        !firstColRaw.includes("/")
      ) {
        subcategoriaActual = firstColRaw;
        return;
      }

      // Todo lo demás (headers admin, títulos, fechas, "TODAS", texto libre) → ignorar
    });
  });

  return {
    registros,
    metadata: {
      totalRegistros: registros.length,
      extraidoCon: "EXCEL",
      zona: zonaActual,
    },
    errores,
  };
}

/**
 * Parser específico para Cambios de Turno y/o Adscripción
 * Basado en la estructura observada:
 * Col 0: No. Prog
 * Col 1: Tipo/Registro (CAT/CAD)
 * Col 2: Clave Adscripción Nueva (Solicitada)
 * Col 4: Turno Nuevo (Solicitado)
 * Col 6: Fecha
 * Col 7: Estatus
 * Col 9: Matrícula
 * Col 10: Nombre
 * Col 12: Clave Adscripción Anterior (Actual)
 * Col 14: Nombre Adscripción Anterior (Actual)
 * Col 18: Turno Anterior (Actual)
 */
function parseCambiosTurnoExcel(workbook: XLSX.WorkBook): ExcelParseResult {
  const registros: BolsaDeTrabajoRegistro[] = [];
  const errores: string[] = [];
  const schema = SCHEMAS.CAMBIOS_TURNO_ADSCRIPCION;

  let zonaActual = "";
  let categoriaActual = "";
  let subcategoriaActual = "";

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    rows.forEach((row, index) => {
      if (!row || row.length === 0) return;

      const firstColRaw = String(row[0] || "").trim();
      if (!firstColRaw) return;

      const firstColNorm = firstColRaw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

      const col1 = String(row[1] || "").trim();
      const col2 = String(row[2] || "").trim();
      const col9 = String(row[9] || "").trim();
      const col10 = String(row[10] || "").trim();

      // 1. Detectar ZONA
      const isZonePattern =
        /^\d{1,2}-\S/.test(firstColRaw) || firstColNorm.startsWith("ZONA");

      if (isZonePattern && !col1 && !col2) {
        zonaActual = firstColRaw.replace(/^zona:?\s*/i, "").trim();
        return;
      }

      // 2. Detectar REGISTRO
      const isNumericNoProg = /^\d+$/.test(firstColRaw);
      if (isNumericNoProg && col9 && (col10 || col1)) {
        try {
          // Procesar Fecha (index 6) - Usar UTC para evitar desfase de 1 día por zona horaria
          let fecha = row[6];
          if (typeof fecha === "number") {
            const d = new Date(Math.round((fecha - 25569) * 86400 * 1000));
            fecha = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
          } else {
            fecha = String(fecha || "").trim();
          }

          // Días laborados con formato
          const rawDias = row[8];
          let diasLaborados = "";
          if (rawDias === 0) diasLaborados = "0";
          else if (rawDias)
            diasLaborados = String(rawDias).trim().replace(/,/g, "");

          const registro: BolsaDeTrabajoRegistro = {
            id: parseUtils.generarIdRegistro(
              "CAMBIOS_TURNO_ADSCRIPCION",
              registros.length,
            ),
            tipoDocumento: "CAMBIOS_TURNO_ADSCRIPCION",
            numeroProg: firstColRaw,
            registro: col1, // Tipo de Cambio (CAT/CAD)
            adscripcionNueva: col2, // Adscripción Solicitada
            turnoNuevo: String(row[4] || "").trim(), // Turno Solicitado
            fecha, // Fecha de Registro
            estatus: String(row[7] || "").trim(),
            diasLaborados,
            matricula: col9,
            nombre: col10,
            sexo: String(row[11] || "").trim(),
            adscripcionAnterior: `${String(row[12] || "").trim()} - ${String(row[14] || "").trim()}`,
            turnoAnterior: String(row[18] || "").trim(),
            numeroPlaza: String(row[16] || "").trim(),
            jornadaActual: String(row[17] || "").trim(),
            zona: zonaActual,
            categoria: categoriaActual,
            subcategoria: subcategoriaActual || undefined,
            filaOriginal: index + 1,
            confianza: 1.0,
            necesitaValidacion: false,
          } as BolsaDeTrabajoRegistro;

          const validationErrors = validateRegistro(registro, schema);
          if (validationErrors.length > 0) {
            errores.push(
              `Hoja ${sheetName}, Fila ${index + 1}: ${validationErrors.join("; ")}`,
            );
          }

          registros.push(registro);
        } catch (e: any) {
          errores.push(
            `Error en Hoja ${sheetName}, Fila ${index + 1}: ${e.message}`,
          );
        }
        return;
      }

      // 3. Detectar CATEGORÍA
      if (/^\d{5,6}\s*-\s*\S/.test(firstColRaw) && !col1 && !col2) {
        categoriaActual = firstColRaw;
        subcategoriaActual = "";
        return;
      }

      if (
        /^\d{1,3}\s+[A-ZÁÉÍÓÚÑ]/.test(firstColRaw) &&
        !col1 &&
        !col2 &&
        !firstColRaw.includes("/")
      ) {
        subcategoriaActual = firstColRaw;
        return;
      }
    });
  });

  return {
    registros,
    metadata: {
      totalRegistros: registros.length,
      extraidoCon: "EXCEL",
      zona: zonaActual,
    },
    errores,
  };
}

/**
 * Convierte un número serial de Excel a string de fecha dd/mm/yyyy usando UTC (evita desfase por zona horaria)
 */
function excelDateToString(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/**
 * Parser compartido para tipos que tienen la misma estructura de columnas:
 * AMPLIACIONES_JORNADA, CAMBIOS_AREA, CAMBIOS_TIPO_PLAZA
 *
 * Estructura:
 * Col 0: NoProg | Col 1: Tipo/Jornada/CAR/CTP | Col 2: AdscripcionNueva(Clave)
 * Col 3: TurnoNuevo | Col 4: JornadaNueva (solo Area, null en CTP) | Col 5: Fecha (CTP usa col5, otros col4)
 * Col 5(Área/Ampl)/5: Estatus | Col 6(CTP)/5+1: NoPlaza
 * Col 7(CTP)/6: Matrícula | Col 8(CTP)/7: Nombre | Col 9(CTP)/8: Sexo
 * Col 10(CTP)/9: AdscAnteriorClave | Col 11(CTP)/10: AdscAnteriorNombre
 * Col 12(CTP)/11: Plaza | Col 13(CTP)/12: Jornada | Col 14(CTP)/13: TurnoAnterior
 */
function parseAmpliacionesJornadaExcel(
  workbook: XLSX.WorkBook,
): ExcelParseResult {
  const registros: BolsaDeTrabajoRegistro[] = [];
  const errores: string[] = [];
  const schema = SCHEMAS.AMPLIACIONES_JORNADA;
  let zonaActual = "";
  let categoriaActual = "";
  let subcategoriaActual = "";

  // Layout confirmado:
  // 0:NoProg  1:JorNueva(hrs)  2:AdscNuevaClave  3:TurnoNuevo
  // 4:Fecha   5:Estatus        6:NoPlaza          7:Matricula
  // 8:Nombre  9:Sexo           10:AdscAnteriorClave  11:AdscAnteriorNombre
  // 12:PlazaAnterior  13:JornadaAnterior  14:TurnoAnterior

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    rows.forEach((row, index) => {
      if (!row || row.length === 0) return;
      const col0 = String(row[0] || "").trim();
      if (!col0) return;
      const col0Norm = col0
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      const col1 = String(row[1] || "").trim();
      const col2 = String(row[2] || "").trim();

      // Zona
      if (
        (/^\d{1,2}-\S/.test(col0) || col0Norm.startsWith("ZONA")) &&
        !col1 &&
        !col2
      ) {
        zonaActual = col0.replace(/^zona:?\s*/i, "").trim();
        return;
      }

      // Registro: NoProg numérico entero, col7=matrícula numérica, col8=nombre
      const isNumericNoProg = /^\d+$/.test(col0);
      const col7 = String(row[7] || "").trim();
      const col8 = String(row[8] || "").trim();
      if (isNumericNoProg && col7 && col8) {
        try {
          const fechaRaw = row[4];
          const fecha =
            typeof fechaRaw === "number"
              ? excelDateToString(fechaRaw)
              : String(fechaRaw || "").trim();

          const registro: BolsaDeTrabajoRegistro = {
            id: parseUtils.generarIdRegistro(
              "AMPLIACIONES_JORNADA",
              registros.length,
            ),
            tipoDocumento: "AMPLIACIONES_JORNADA",
            numeroProg: col0,
            jornadaNueva: col1 ? String(col1) : undefined,
            adscripcionNueva: col2 || undefined,
            turnoNuevo: String(row[3] || "").trim() || undefined,
            fecha,
            estatus: String(row[5] || "").trim() || undefined,
            diasLaborados: String(row[6] || "").trim() || undefined,
            numeroPlaza: String(row[12] || "").trim() || undefined,
            matricula: col7,
            nombre: col8,
            sexo: String(row[9] || "").trim() || undefined,
            adscripcionAnterior:
              [String(row[10] || "").trim(), String(row[11] || "").trim()]
                .filter(Boolean)
                .join(" - ") || undefined,
            jornadaActual: row[13] !== undefined ? String(row[13]) : undefined,
            turnoAnterior: String(row[14] || "").trim() || undefined,
            zona: zonaActual,
            categoria: categoriaActual,
            subcategoria: subcategoriaActual || undefined,
            filaOriginal: index + 1,
            confianza: 1.0,
            necesitaValidacion: false,
          } as BolsaDeTrabajoRegistro;

          const validationErrors = validateRegistro(registro, schema);
          if (validationErrors.length > 0)
            errores.push(
              `Hoja ${sheetName}, Fila ${index + 1}: ${validationErrors.join("; ")}`,
            );
          registros.push(registro);
        } catch (e: any) {
          errores.push(
            `Error en Hoja ${sheetName}, Fila ${index + 1}: ${e.message}`,
          );
        }
        return;
      }

      // Categoría: código 5-6 dígitos + guión + texto, cols siguientes vacías
      if (/^\d{5,6}\s*-\s*\S/.test(col0) && !col1 && !col2) {
        categoriaActual = col0;
        subcategoriaActual = "";
        return;
      }

      if (
        /^\d{1,3}\s+[A-ZÁÉÍÓÚÑ]/.test(col0) &&
        !col1 &&
        !col2 &&
        !col0.includes("/")
      ) {
        subcategoriaActual = col0;
        return;
      }
    });
  });

  return {
    registros,
    metadata: {
      totalRegistros: registros.length,
      extraidoCon: "EXCEL",
      zona: zonaActual,
    },
    errores,
  };
}

/**
 * Parser para CAMBIOS_AREA
 * Layout:
 * 0:NoProg  1:Tipo(CAR)  2:AdscNuevaClave  3:TurnoNuevo  4:JornadaNueva  5:Fecha
 * 6:Estatus  7:NoPlaza  8:Matricula  9:Nombre  10:Sexo
 * 11:AdscAnteriorClave  12:AdscAnteriorNombre  13:PlazaAnterior  14:JornadaAnterior  15:TurnoAnterior
 */
function parseCambiosAreaExcel(workbook: XLSX.WorkBook): ExcelParseResult {
  const registros: BolsaDeTrabajoRegistro[] = [];
  const errores: string[] = [];
  const schema = SCHEMAS.CAMBIOS_AREA;
  let zonaActual = "";
  let categoriaActual = "";
  let subcategoriaActual = "";

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    rows.forEach((row, index) => {
      if (!row || row.length === 0) return;
      const col0 = String(row[0] || "").trim();
      if (!col0) return;
      const col0Norm = col0
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      const col1 = String(row[1] || "").trim();
      const col2 = String(row[2] || "").trim();

      if (
        (/^\d{1,2}-\S/.test(col0) || col0Norm.startsWith("ZONA")) &&
        !col1 &&
        !col2
      ) {
        zonaActual = col0.replace(/^zona:?\s*/i, "").trim();
        return;
      }

      const isNumericNoProg = /^\d+$/.test(col0);
      const col8 = String(row[8] || "").trim(); // Matrícula
      const col9 = String(row[9] || "").trim(); // Nombre
      if (isNumericNoProg && col8 && col9) {
        try {
          const fechaRaw = row[5];
          const fecha =
            typeof fechaRaw === "number"
              ? excelDateToString(fechaRaw)
              : String(fechaRaw || "").trim();

          const adscAnt = [
            String(row[11] || "").trim(),
            String(row[12] || "").trim(),
          ]
            .filter(Boolean)
            .join(" - ");
          const registro: BolsaDeTrabajoRegistro = {
            id: parseUtils.generarIdRegistro("CAMBIOS_AREA", registros.length),
            tipoDocumento: "CAMBIOS_AREA",
            numeroProg: col0,
            registro: col1 || undefined,
            adscripcionNueva: col2 || undefined,
            turnoNuevo: String(row[3] || "").trim() || undefined,
            jornadaNueva: row[4] !== undefined ? String(row[4]) : undefined,
            fecha,
            estatus: String(row[6] || "").trim() || undefined,
            diasLaborados: String(row[7] || "").trim() || undefined,
            numeroPlaza: String(row[13] || "").trim() || undefined,
            matricula: col8,
            nombre: col9,
            sexo: String(row[10] || "").trim() || undefined,
            adscripcionAnterior: adscAnt || undefined,
            jornadaActual: row[14] !== undefined ? String(row[14]) : undefined,
            turnoAnterior: String(row[15] || "").trim() || undefined,
            zona: zonaActual,
            categoria: categoriaActual,
            subcategoria: subcategoriaActual || undefined,
            filaOriginal: index + 1,
            confianza: 1.0,
            necesitaValidacion: false,
          } as BolsaDeTrabajoRegistro;

          const validationErrors = validateRegistro(registro, schema);
          if (validationErrors.length > 0)
            errores.push(
              `Hoja ${sheetName}, Fila ${index + 1}: ${validationErrors.join("; ")}`,
            );
          registros.push(registro);
        } catch (e: any) {
          errores.push(
            `Error en Hoja ${sheetName}, Fila ${index + 1}: ${e.message}`,
          );
        }
        return;
      }

      if (/^\d{5,6}\s*-\s*\S/.test(col0) && !col1 && !col2) {
        categoriaActual = col0;
        subcategoriaActual = "";
        return;
      }

      if (
        /^\d{1,3}\s+[A-ZÁÉÍÓÚÑ]/.test(col0) &&
        !col1 &&
        !col2 &&
        !col0.includes("/")
      ) {
        subcategoriaActual = col0;
        return;
      }
    });
  });

  return {
    registros,
    metadata: {
      totalRegistros: registros.length,
      extraidoCon: "EXCEL",
      zona: zonaActual,
    },
    errores,
  };
}

/**
 * Parser para CAMBIOS_RAMA
 * Layout:
 * 0:NoProg  1:RamaNueva(código)  2:Calificacion  3:Fecha  4:Estatus
 * 5:NoPlaza  6:Matricula  7:Nombre  8:Sexo  9:AdscClave
 * (Col 10 vacía)  11:AdscNombre  (cols 12-13 vacías)  14:Plaza  15:Jornada  16:Turno
 */
function parseCambiosRamaExcel(workbook: XLSX.WorkBook): ExcelParseResult {
  const registros: BolsaDeTrabajoRegistro[] = [];
  const errores: string[] = [];
  const schema = SCHEMAS.CAMBIOS_RAMA;
  let zonaActual = "";
  let categoriaActual = "";
  let subcategoriaActual = "";

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    rows.forEach((row, index) => {
      if (!row || row.length === 0) return;
      const col0 = String(row[0] || "").trim();
      if (!col0) return;
      const col0Norm = col0
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      const col1 = String(row[1] || "").trim();
      const col2 = String(row[2] || "").trim();

      if (
        (/^\d{1,2}-\S/.test(col0) || col0Norm.startsWith("ZONA")) &&
        !col1 &&
        !col2
      ) {
        zonaActual = col0.replace(/^zona:?\s*/i, "").trim();
        return;
      }

      const isNumericNoProg = /^\d+$/.test(col0);
      // Detectar formato "LISTADO DE CAMBIOS DE RAMA" (columnas desplazadas):
      // En el formato LISTADO, col7 es la matrícula (8-10 dígitos) y col6 es días laborados (4 dígitos).
      // En el formato original, col6 es la matrícula (7-10 dígitos) y col7 es el nombre.
      const col6 = String(row[6] || "").trim();
      const col7 = String(row[7] || "").trim();
      const isListadoFormat =
        /^\d{8,10}$/.test(col7) && !/^\d{8,10}$/.test(col6);
      const matriculaCandidate = isListadoFormat ? col7 : col6;
      const nombreCandidate = isListadoFormat
        ? String(row[8] || "").trim()
        : col7;
      if (isNumericNoProg && matriculaCandidate && nombreCandidate) {
        try {
          const fechaRaw = row[3];
          const fecha =
            typeof fechaRaw === "number"
              ? excelDateToString(fechaRaw)
              : String(fechaRaw || "").trim();

          const adscAnt = isListadoFormat
            ? [String(row[10] || "").trim(), String(row[12] || "").trim()]
                .filter(Boolean)
                .join(" - ")
            : [String(row[9] || "").trim(), String(row[11] || "").trim()]
                .filter(Boolean)
                .join(" - ");
          const registro: BolsaDeTrabajoRegistro = {
            id: parseUtils.generarIdRegistro("CAMBIOS_RAMA", registros.length),
            tipoDocumento: "CAMBIOS_RAMA",
            numeroProg: col0,
            ramaNueva: col1 ? String(col1) : undefined,
            calificacion: col2 ? String(col2) : undefined,
            fecha,
            estatus: isListadoFormat
              ? String(row[5] || "").trim() || undefined
              : String(row[4] || "").trim() || undefined,
            numeroPlaza: isListadoFormat
              ? String(row[15] || "").trim() || undefined
              : String(row[5] || "").trim() || undefined,
            matricula: matriculaCandidate,
            nombre: nombreCandidate.replace(/\//g, " "),
            sexo: isListadoFormat
              ? String(row[9] || "").trim() || undefined
              : String(row[8] || "").trim() || undefined,
            adscripcionAnterior: adscAnt || undefined,
            diasLaborados: isListadoFormat
              ? String(row[6] || "").trim() || undefined
              : String(row[14] || "").trim() || undefined,
            jornadaActual: isListadoFormat
              ? row[16] !== undefined
                ? String(row[16])
                : undefined
              : row[15] !== undefined
                ? String(row[15])
                : undefined,
            turnoAnterior: isListadoFormat
              ? String(row[17] || "").trim() || undefined
              : String(row[16] || "").trim() || undefined,
            zona: zonaActual,
            categoria: categoriaActual,
            subcategoria: subcategoriaActual || undefined,
            filaOriginal: index + 1,
            confianza: 1.0,
            necesitaValidacion: false,
          } as BolsaDeTrabajoRegistro;

          const validationErrors = validateRegistro(registro, schema);
          if (validationErrors.length > 0)
            errores.push(
              `Hoja ${sheetName}, Fila ${index + 1}: ${validationErrors.join("; ")}`,
            );
          registros.push(registro);
        } catch (e: any) {
          errores.push(
            `Error en Hoja ${sheetName}, Fila ${index + 1}: ${e.message}`,
          );
        }
        return;
      }

      if (/^\d{5,6}\s*-\s*\S/.test(col0) && !col1 && !col2) {
        categoriaActual = col0;
        subcategoriaActual = "";
        return;
      }

      if (
        /^\d{1,3}\s+[A-ZÁÉÍÓÚÑ]/.test(col0) &&
        !col1 &&
        !col2 &&
        !col0.includes("/")
      ) {
        subcategoriaActual = col0;
        return;
      }
    });
  });

  return {
    registros,
    metadata: {
      totalRegistros: registros.length,
      extraidoCon: "EXCEL",
      zona: zonaActual,
    },
    errores,
  };
}

/**
 * Parser compartido para CAMBIOS_RESIDENCIA_DESTINO y CAMBIOS_RESIDENCIA_ORIGEN
 * Layout (ambos idénticos):
 * 0:NoProg  1:Delegacion(destino/origen)  (col2 vacía)  3:Turno  4:Fecha  5:Estatus
 * (col6 vacío en destino, NoPlaza en origen)  7:Matricula  8:Nombre  9:Sexo
 * 10:AdscClave  (col11 vacía)  12:AdscNombre  (col13 vacía)  14:Plaza  15:Jornada  16:Turno
 */
function parseCambiosResidenciaExcel(
  workbook: XLSX.WorkBook,
  tipo: "CAMBIOS_RESIDENCIA_DESTINO" | "CAMBIOS_RESIDENCIA_ORIGEN",
): ExcelParseResult {
  const registros: BolsaDeTrabajoRegistro[] = [];
  const errores: string[] = [];
  const schema = SCHEMAS[tipo];
  let zonaActual = "";
  let categoriaActual = "";
  let subcategoriaActual = "";

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    rows.forEach((row, index) => {
      if (!row || row.length === 0) return;
      const col0 = String(row[0] || "").trim();
      if (!col0) return;
      const col0Norm = col0
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      const col1 = String(row[1] || "").trim();
      const col2 = String(row[2] || "").trim();

      if (
        (/^\d{1,2}-\S/.test(col0) || col0Norm.startsWith("ZONA")) &&
        !col1 &&
        !col2
      ) {
        zonaActual = col0.replace(/^zona:?\s*/i, "").trim();
        return;
      }

      const isNumericNoProg = /^\d+$/.test(col0);
      const col7 = String(row[7] || "").trim(); // Matrícula
      const col8 = String(row[8] || "").trim(); // Nombre
      if (isNumericNoProg && col7 && col8) {
        try {
          const fechaRaw = row[4];
          const fecha =
            typeof fechaRaw === "number"
              ? excelDateToString(fechaRaw)
              : String(fechaRaw || "").trim();

          const adscAnt = [
            String(row[10] || "").trim(),
            String(row[12] || "").trim(),
          ]
            .filter(Boolean)
            .join(" - ");
          const registro: BolsaDeTrabajoRegistro = {
            id: parseUtils.generarIdRegistro(tipo, registros.length),
            tipoDocumento: tipo,
            numeroProg: col0,
            delegacionDestino:
              tipo === "CAMBIOS_RESIDENCIA_DESTINO"
                ? col1 || undefined
                : undefined,
            delegacionOrigen:
              tipo === "CAMBIOS_RESIDENCIA_ORIGEN"
                ? col1 || undefined
                : undefined,
            turnoNuevo: String(row[3] || "").trim() || undefined,
            fecha,
            estatus: String(row[5] || "").trim() || undefined,
            diasLaborados: String(row[6] || "").trim() || undefined,
            numeroPlaza: String(row[14] || "").trim() || undefined,
            matricula: col7,
            nombre: col8,
            sexo: String(row[9] || "").trim() || undefined,
            adscripcionAnterior: adscAnt || undefined,
            jornadaActual: row[15] !== undefined ? String(row[15]) : undefined,
            turnoAnterior: String(row[16] || "").trim() || undefined,
            zona: zonaActual,
            categoria: categoriaActual,
            subcategoria: subcategoriaActual || undefined,
            filaOriginal: index + 1,
            confianza: 1.0,
            necesitaValidacion: false,
          } as BolsaDeTrabajoRegistro;

          const validationErrors = validateRegistro(registro, schema);
          if (validationErrors.length > 0)
            errores.push(
              `Hoja ${sheetName}, Fila ${index + 1}: ${validationErrors.join("; ")}`,
            );
          registros.push(registro);
        } catch (e: any) {
          errores.push(
            `Error en Hoja ${sheetName}, Fila ${index + 1}: ${e.message}`,
          );
        }
        return;
      }

      if (/^\d{5,6}\s*-\s*\S/.test(col0) && !col1 && !col2) {
        categoriaActual = col0;
        subcategoriaActual = "";
        return;
      }

      if (
        /^\d{1,3}\s+[A-ZÁÉÍÓÚÑ]/.test(col0) &&
        !col1 &&
        !col2 &&
        !col0.includes("/")
      ) {
        subcategoriaActual = col0;
        return;
      }
    });
  });

  return {
    registros,
    metadata: {
      totalRegistros: registros.length,
      extraidoCon: "EXCEL",
      zona: zonaActual,
    },
    errores,
  };
}

/**
 * Parser para CAMBIOS_TIPO_PLAZA
 * Layout (nota: col4 está vacía en este tipo):
 * 0:NoProg  1:Tipo(CTP)  2:AdscNuevaClave  3:TurnoNuevo  4:(vacía)  5:Fecha
 * 6:Estatus  7:NoPlaza  8:Matricula  9:Nombre  10:Sexo
 * 11:AdscAnteriorClave  12:AdscAnteriorNombre  13:PlazaAnterior  14:JornadaAnterior  15:TurnoAnterior
 */
function parseCambiosTipoPlazaExcel(workbook: XLSX.WorkBook): ExcelParseResult {
  const registros: BolsaDeTrabajoRegistro[] = [];
  const errores: string[] = [];
  const schema = SCHEMAS.CAMBIOS_TIPO_PLAZA;
  let zonaActual = "";
  let categoriaActual = "";
  let subcategoriaActual = "";

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    rows.forEach((row, index) => {
      if (!row || row.length === 0) return;
      const col0 = String(row[0] || "").trim();
      if (!col0) return;
      const col0Norm = col0
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      const col1 = String(row[1] || "").trim();
      const col2 = String(row[2] || "").trim();

      if (
        (/^\d{1,2}-\S/.test(col0) || col0Norm.startsWith("ZONA")) &&
        !col1 &&
        !col2
      ) {
        zonaActual = col0.replace(/^zona:?\s*/i, "").trim();
        return;
      }

      const isNumericNoProg = /^\d+$/.test(col0);
      const col8 = String(row[8] || "").trim(); // Matrícula
      const col9 = String(row[9] || "").trim(); // Nombre
      if (isNumericNoProg && col8 && col9) {
        try {
          const fechaRaw = row[5]; // Col4 es null en este tipo, Fecha está en col5
          const fecha =
            typeof fechaRaw === "number"
              ? excelDateToString(fechaRaw)
              : String(fechaRaw || "").trim();

          const adscAnt = [
            String(row[11] || "").trim(),
            String(row[12] || "").trim(),
          ]
            .filter(Boolean)
            .join(" - ");
          const registro: BolsaDeTrabajoRegistro = {
            id: parseUtils.generarIdRegistro(
              "CAMBIOS_TIPO_PLAZA",
              registros.length,
            ),
            tipoDocumento: "CAMBIOS_TIPO_PLAZA",
            numeroProg: col0,
            registro: col1 || undefined,
            adscripcionNueva: col2 || undefined,
            turnoNuevo: String(row[3] || "").trim() || undefined,
            fecha,
            estatus: String(row[6] || "").trim() || undefined,
            diasLaborados: String(row[7] || "").trim() || undefined,
            numeroPlaza: String(row[13] || "").trim() || undefined,
            matricula: col8,
            nombre: col9,
            sexo: String(row[10] || "").trim() || undefined,
            adscripcionAnterior: adscAnt || undefined,
            jornadaActual: row[14] !== undefined ? String(row[14]) : undefined,
            turnoAnterior: String(row[15] || "").trim() || undefined,
            zona: zonaActual,
            categoria: categoriaActual,
            subcategoria: subcategoriaActual || undefined,
            filaOriginal: index + 1,
            confianza: 1.0,
            necesitaValidacion: false,
          } as BolsaDeTrabajoRegistro;

          const validationErrors = validateRegistro(registro, schema);
          if (validationErrors.length > 0)
            errores.push(
              `Hoja ${sheetName}, Fila ${index + 1}: ${validationErrors.join("; ")}`,
            );
          registros.push(registro);
        } catch (e: any) {
          errores.push(
            `Error en Hoja ${sheetName}, Fila ${index + 1}: ${e.message}`,
          );
        }
        return;
      }

      if (/^\d{5,6}\s*-\s*\S/.test(col0) && !col1 && !col2) {
        categoriaActual = col0;
        subcategoriaActual = "";
        return;
      }

      if (
        /^\d{1,3}\s+[A-ZÁÉÍÓÚÑ]/.test(col0) &&
        !col1 &&
        !col2 &&
        !col0.includes("/")
      ) {
        subcategoriaActual = col0;
        return;
      }
    });
  });

  return {
    registros,
    metadata: {
      totalRegistros: registros.length,
      extraidoCon: "EXCEL",
      zona: zonaActual,
    },
    errores,
  };
}

/**
 * Parser genérico para otros tipos de documentos
 * Intenta detectar columnas por nombre de encabezado
 */
function parseGenericoExcel(
  workbook: XLSX.WorkBook,
  tipo: TipoBolsaDeTrabajo,
): ExcelParseResult {
  const registros: BolsaDeTrabajoRegistro[] = [];
  const errores: string[] = [];
  let zonaActual = "";
  let categoriaActual = "";

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    let headers: string[] = [];
    let headerRowIndex = -1;

    // 1. Buscar fila de encabezados
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i];
      if (!row) continue;
      const rowStr = row.map((c) => String(c || "").toUpperCase());
      if (
        rowStr.includes("NOMBRE") &&
        (rowStr.includes("MATRICULA") || rowStr.includes("MATRÍCULA"))
      ) {
        headers = rowStr;
        headerRowIndex = i;
        break;
      }
    }

    // 2. Procesar filas después de los encabezados
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const firstCol = String(row[0] || "").trim();
      const row1 = String(row[1] || "").trim();

      // Detectar Zona/Categoría si no hay headers o antes de ellos
      const isZonePattern =
        /^\d+-/.test(firstCol) || firstCol.toUpperCase().includes("ZONA");
      if (isZonePattern && !row1) {
        zonaActual = firstCol.replace(/ZONA:?\s*/i, "").trim();
        continue;
      }

      // Si la fila parece un registro pero no tenemos headers claros, intentamos mapeo por posición
      // O si tenemos headers, mapeamos por nombre
      if (row.length >= 2) {
        const nombreIdx = headers.findIndex((h) => h.includes("NOMBRE"));
        const matriculaIdx = headers.findIndex(
          (h) => h.includes("MATRICULA") || h.includes("MATRÍCULA"),
        );
        const adscripcionIdx = headers.findIndex(
          (h) => h.includes("ADSCRIPCION") || h.includes("ADSCRIPCIÓN"),
        );
        const fechaIdx = headers.findIndex((h) => h.includes("FECHA"));

        const nombre =
          nombreIdx !== -1 ? String(row[nombreIdx] || "").trim() : "";
        const matricula =
          matriculaIdx !== -1 ? String(row[matriculaIdx] || "").trim() : "";

        if (nombre && matricula && matricula.length >= 4) {
          let fechaStr = "";
          if (fechaIdx !== -1) {
            const val = row[fechaIdx];
            if (typeof val === "number") {
              const d = new Date(Math.round((val - 25569) * 86400 * 1000));
              fechaStr = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
            } else {
              fechaStr = String(val || "").trim();
            }
          }

          const registro: BolsaDeTrabajoRegistro = {
            id: parseUtils.generarIdRegistro(tipo, registros.length),
            tipoDocumento: tipo,
            nombre,
            matricula,
            fecha: fechaStr,
            adscripcion:
              adscripcionIdx !== -1
                ? String(row[adscripcionIdx] || "").trim()
                : "",
            zona: zonaActual,
            categoria: categoriaActual || NOMBRES_TIPOS[tipo],
            filaOriginal: i + 1,
            confianza: 0.9,
            necesitaValidacion: false,
          } as BolsaDeTrabajoRegistro;

          // Mapear campos específicos basados en headers si existen
          headers.forEach((h, idx) => {
            if (h.includes("TURNO"))
              registro.turnoActual = String(row[idx] || "").trim();
            if (h.includes("JORNADA"))
              registro.jornadaActual = String(row[idx] || "").trim();
            if (h.includes("PLAZA"))
              registro.numeroPlaza = String(row[idx] || "").trim();
          });

          registros.push(registro);
        }
      }
    }
  });

  return {
    registros,
    metadata: {
      totalRegistros: registros.length,
      extraidoCon: "EXCEL",
      zona: zonaActual,
    },
    errores,
  };
}

import { NOMBRES_TIPOS } from "@/types/bolsa-de-trabajo";

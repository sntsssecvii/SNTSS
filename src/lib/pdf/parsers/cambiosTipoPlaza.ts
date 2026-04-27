import type {
  ParseResult,
  BolsaDeTrabajoRegistro,
} from "@/types/bolsa-de-trabajo";
import { parseUtils } from "../parser";
import {
  dividirLineas,
  debeDescartarLinea,
  limpiarFooter,
  esEncabezadoSeccion,
} from "../preprocessing";
import { SCHEMAS, validateRegistro } from "../schemas";

const schema = SCHEMAS.CAMBIOS_TIPO_PLAZA;

// Format: "1 CTP 02HF120000 Mat 09/05/2025 A 1,894 98029912 NOMBRE F CLAVE DEPT_NAME NUM NUM TURNO"
const REGEX_ESTRICTO =
  /^(\d+)\s+([A-Z]+)\s+([A-Z0-9]+)\s+(Mat|Ves|Noc|JAcum|Acum)\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Z])\s+([\d,]+)\s+(\d{7,10})\s+(.+?)\s+([MF])\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+([\d.]+)\s+(Mat|Ves|Noc|JAcum|Acum)$/;

const TURNO_VALORES = /^(Mat|Ves|Noc|JAcum|Acum)$/;

function unirLineasPartidas(lineas: string[]): string[] {
  const resultado: string[] = [];
  let i = 0;

  while (i < lineas.length) {
    let linea = lineas[i];
    const empiezaConNumero = /^\d+\s+/.test(linea);
    const tieneMatricula = /\b\d{7,10}\b/.test(linea);

    // Si la siguiente línea es solo el turno/tipo plaza nuevo (ej: "Ves", "Mat"), unir para no perder la columna
    if (empiezaConNumero && tieneMatricula && i + 1 < lineas.length) {
      const siguiente = lineas[i + 1].trim();
      if (TURNO_VALORES.test(siguiente) && siguiente.length <= 6) {
        linea = `${linea} ${siguiente}`;
        i++;
      }
    }

    if (empiezaConNumero && tieneMatricula && i + 1 < lineas.length) {
      const siguiente = lineas[i + 1].trim();
      const esContinuacion =
        !/^\d+\s+/.test(siguiente) &&
        !/^\d+$/.test(siguiente) &&
        !esEncabezadoSeccion(siguiente) &&
        siguiente.length > 0 &&
        !TURNO_VALORES.test(siguiente);
      if (esContinuacion) {
        linea = `${linea} ${siguiente}`;
        i++;
      }
    }

    resultado.push(linea);
    i++;
  }

  return resultado;
}

export function parseCambiosTipoPlaza(texto: string): ParseResult {
  const registros: BolsaDeTrabajoRegistro[] = [];
  const errores: string[] = [];
  let zonaActual = "";
  let categoriaActual = "";
  let subcategoriaActual = "";

  const lineasRaw = dividirLineas(texto);
  const lineas = unirLineasPartidas(lineasRaw);

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    if (!linea) continue;

    if (linea.startsWith("Zona ")) {
      zonaActual = linea.replace("Zona ", "").trim();
      continue;
    }

    const categoriaMatch = linea.match(/^(\d{6})\s*-\s*(.+)$/);
    if (categoriaMatch) {
      categoriaActual = linea.trim();
      subcategoriaActual = "";
      continue;
    }

    const subcategoriaMatch = linea.match(
      /^(\d{1,3})\s+([A-ZÁÉÍÓÚÑ\s.-]{5,})$/,
    );
    if (
      subcategoriaMatch &&
      !linea.includes("Matrícula") &&
      !linea.includes("Nombre")
    ) {
      const posibleNombre = subcategoriaMatch[2].trim();
      if (
        posibleNombre.length > 5 &&
        !posibleNombre.includes("/") &&
        !posibleNombre.includes("&")
      ) {
        subcategoriaActual = `${subcategoriaMatch[1]} ${posibleNombre}`;
      }
      continue;
    }

    const esRegistroPotencial = /^\d+\s+[A-Z]{2,}\s+/.test(linea);

    if (
      debeDescartarLinea(linea, esRegistroPotencial) ||
      (!esRegistroPotencial &&
        (linea.includes(" of ") || linea.includes("No. Prog")))
    ) {
      continue;
    }

    const lineaLimpia = limpiarFooter(linea);
    if (!lineaLimpia) continue;

    const match = lineaLimpia.match(REGEX_ESTRICTO);

    if (match) {
      const [
        ,
        numeroProg,
        cambio,
        _adscripActClave,
        tipoPlazaAnterior,
        fecha,
        registro,
        _dias,
        matricula,
        nombre,
        sexo,
        _adscripNuevaClave,
        _adscripNuevaNombre,
        _plaza,
        _jornada,
        tipoPlazaNuevo,
      ] = match;

      const registroObj: BolsaDeTrabajoRegistro = {
        id: parseUtils.generarIdRegistro(
          "CAMBIOS_TIPO_PLAZA",
          registros.length,
        ),
        tipoDocumento: "CAMBIOS_TIPO_PLAZA",
        numeroProg,
        tipoPlazaAnterior,
        tipoPlazaNuevo,
        fecha,
        registro,
        matricula,
        nombre: nombre.trim(),
        sexo,
        zona: zonaActual,
        categoria: categoriaActual,
        subcategoria: subcategoriaActual || undefined,
        filaOriginal: i + 1,
        necesitaValidacion: false,
      };

      const validationErrors = validateRegistro(registroObj, schema);
      registroObj.confianza = validationErrors.length === 0 ? 0.95 : 0.85;
      if (validationErrors.length > 0) {
        errores.push(`Fila ${i + 1}: ${validationErrors.join("; ")}`);
      }

      registros.push(registroObj);
      continue;
    }

    // Fallback: flexible parsing
    const partes = lineaLimpia.split(/\s+/).filter((p) => p.length > 0);
    if (partes.length < 8 || !/^\d+$/.test(partes[0])) continue;

    const matIdx = partes.findIndex((p) => /^\d{7,10}$/.test(p));
    if (matIdx === -1) continue;

    const fechaIdx = partes.findIndex((p) => /^\d{2}\/\d{2}\/\d{4}$/.test(p));
    if (fechaIdx === -1) continue;

    const turnoAnteriorIdx = partes.findIndex(
      (p, idx) => idx < fechaIdx && /^(Mat|Ves|Noc|JAcum|Acum)$/.test(p),
    );
    const lastPart = partes[partes.length - 1];
    const turnoNuevoVal = /^(Mat|Ves|Noc|JAcum|Acum)$/.test(lastPart)
      ? lastPart
      : undefined;

    const sexIdx = partes.findIndex(
      (p, idx) => idx > matIdx && (p === "M" || p === "F"),
    );

    const registroObj: BolsaDeTrabajoRegistro = {
      id: parseUtils.generarIdRegistro("CAMBIOS_TIPO_PLAZA", registros.length),
      tipoDocumento: "CAMBIOS_TIPO_PLAZA",
      numeroProg: partes[0],
      tipoPlazaAnterior:
        turnoAnteriorIdx !== -1 ? partes[turnoAnteriorIdx] : "",
      tipoPlazaNuevo: turnoNuevoVal,
      fecha: partes[fechaIdx],
      registro: partes[fechaIdx + 1] || "",
      matricula: partes[matIdx],
      nombre:
        sexIdx !== -1
          ? partes.slice(matIdx + 1, sexIdx).join(" ")
          : partes.slice(matIdx + 1, matIdx + 4).join(" "),
      sexo: sexIdx !== -1 ? partes[sexIdx] : "",
      zona: zonaActual,
      categoria: categoriaActual,
      subcategoria: subcategoriaActual || undefined,
      confianza: 0.7,
      filaOriginal: i + 1,
      necesitaValidacion: true,
    };

    const validationErrors = validateRegistro(registroObj, schema);
    if (validationErrors.length > 0) {
      errores.push(`Fila ${i + 1} (flexible): ${validationErrors.join("; ")}`);
    }

    registros.push(registroObj);
  }

  return {
    registros,
    metadata: {
      zona: zonaActual || undefined,
      categoria: categoriaActual || undefined,
    },
    errores,
  };
}

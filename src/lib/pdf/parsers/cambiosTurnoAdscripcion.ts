import type { ParseResult, BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'
import { parseUtils } from '../parser'
import { dividirLineas, debeDescartarLinea, limpiarFooter, esEncabezadoSeccion } from '../preprocessing'
import { SCHEMAS, validateRegistro } from '../schemas'

const schema = SCHEMAS.CAMBIOS_TURNO_ADSCRIPCION

// Format: "1 CAT 02UA380000 Mat 08/09/2023 A 2,384 98277598 NOMBRE M CLAVE DEPT_NAME NUM NUM TURNO"
// 1:num, 2:cambio, 3:adscripActClave, 4:turnoAct, 5:fecha, 6:registro, 7:dias,
// 8:mat, 9:nombre, 10:sexo, 11:adscripNuevaClave, 12:adscripNuevaNombre, 13:plaza, 14:jornada, 15:turnoNuevo
const REGEX_ESTRICTO = /^(\d+)\s+([A-Z]+)\s+([A-Z0-9]+)\s+(Mat|Ves|Noc|JAcum|Acum)\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Z])\s+([\d,]+)\s+(\d{7,10})\s+(.+?)\s+([MF])\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+([\d.]+)\s+(Mat|Ves|Noc|JAcum|Acum)$/

const TURNO_VALORES = /^(Mat|Ves|Noc|JAcum|Acum)$/

function unirLineasPartidas(lineas: string[]): string[] {
  const resultado: string[] = []
  let i = 0

  while (i < lineas.length) {
    let linea = lineas[i]
    const empiezaConNumero = /^\d+\s+/.test(linea)
    const tieneMatricula = /\b\d{7,10}\b/.test(linea)

    // Si la siguiente línea es solo el turno nuevo (ej: "Ves", "Mat"), unir para no perder la columna
    if (empiezaConNumero && tieneMatricula && i + 1 < lineas.length) {
      const siguiente = lineas[i + 1].trim()
      if (TURNO_VALORES.test(siguiente) && siguiente.length <= 6) {
        linea = `${linea} ${siguiente}`
        i++
      }
    }

    if (empiezaConNumero && tieneMatricula && i + 1 < lineas.length) {
      const siguiente = lineas[i + 1].trim()
      const esContinuacion =
        !/^\d+\s+/.test(siguiente) &&
        !/^\d+$/.test(siguiente) &&
        !esEncabezadoSeccion(siguiente) &&
        siguiente.length > 0 &&
        !TURNO_VALORES.test(siguiente)
      if (esContinuacion) {
        linea = `${linea} ${siguiente}`
        i++
        // Check for another continuation (e.g., split across 3 lines)
        if (i + 1 < lineas.length) {
          const sig2 = lineas[i + 1].trim()
          if (!/^\d+\s+[A-Z]/.test(sig2) && !esEncabezadoSeccion(sig2) && sig2.length > 0 && !/^\d+$/.test(sig2) && !TURNO_VALORES.test(sig2)) {
            linea = `${linea} ${sig2}`
            i++
          }
        }
      }
    } else if (empiezaConNumero && !tieneMatricula && i + 1 < lineas.length) {
      // Name split across lines - merge until we find matrícula
      let buffer = linea
      let j = i + 1
      while (j < lineas.length) {
        const l = lineas[j].trim()
        if (/^\d+\s+[A-Z]{2,}/.test(l)) break
        if (esEncabezadoSeccion(l)) break
        buffer += ' ' + l
        j++
        if (/\b\d{7,10}\b/.test(buffer)) break
      }
      if (j > i + 1) {
        linea = buffer
        i = j - 1
      }
    }

    resultado.push(linea)
    i++
  }

  return resultado
}

export function parseCambiosTurnoAdscripcion(texto: string): ParseResult {
  const registros: BolsaDeTrabajoRegistro[] = []
  const errores: string[] = []
  let zonaActual = ''
  let categoriaActual = ''

  const lineasRaw = dividirLineas(texto)
  const lineas = unirLineasPartidas(lineasRaw)

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (!linea) continue

    if (linea.startsWith('Zona ')) {
      zonaActual = linea.replace('Zona ', '').trim()
      continue
    }

    const categoriaMatch = linea.match(/^(\d{6})\s*-\s*(.+)$/)
    if (categoriaMatch) {
      categoriaActual = linea.trim()
      continue
    }

    const esRegistroPotencial = /^\d+\s+[A-Z]{2,}\s+/.test(linea)

    if (debeDescartarLinea(linea, esRegistroPotencial) ||
      (!esRegistroPotencial && (linea.includes(' of ') || linea.includes('No. Prog')))) {
      continue
    }

    const lineaLimpia = limpiarFooter(linea)
    if (!lineaLimpia) continue

    const match = lineaLimpia.match(REGEX_ESTRICTO)

    if (match) {
      const [
        , numeroProg, tipoCambio, _adscripActClave, turnoAnterior,
        fecha, status, _dias, matricula, nombre, sexo,
        adscripcionNueva, adscripcionNuevaNombre, _plaza, _jornada, turnoNuevo,
      ] = match

      const registroObj: BolsaDeTrabajoRegistro = {
        id: parseUtils.generarIdRegistro('CAMBIOS_TURNO_ADSCRIPCION', registros.length),
        tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION',
        numeroProg,
        turnoAnterior,
        turnoNuevo,
        fecha,
        registro: tipoCambio, // CAT o CAD
        estatus: status,
        matricula,
        nombre: nombre.trim(),
        sexo,
        adscripcionNueva,
        adscripcionNuevaNombre: adscripcionNuevaNombre.trim(),
        zona: zonaActual,
        categoria: categoriaActual,
        filaOriginal: i + 1,
        necesitaValidacion: false,
      }

      const validationErrors = validateRegistro(registroObj, schema)
      registroObj.confianza = validationErrors.length === 0 ? 0.95 : 0.85
      if (validationErrors.length > 0) {
        errores.push(`Fila ${i + 1}: ${validationErrors.join('; ')}`)
      }

      registros.push(registroObj)
      continue
    }

    // Fallback: flexible parsing
    const partes = lineaLimpia.split(/\s+/).filter((p) => p.length > 0)
    if (partes.length < 8 || !/^\d+$/.test(partes[0])) continue

    const matIdx = partes.findIndex(p => /^\d{7,10}$/.test(p))
    if (matIdx === -1) continue

    const fechaIdx = partes.findIndex(p => /^\d{2}\/\d{2}\/\d{4}$/.test(p))
    if (fechaIdx === -1) continue

    // turnoAnterior is right before the date (formats: Mat, Ves, Noc, JAcum, Acum)
    const turnoIdx = partes.findIndex((p, idx) => idx < fechaIdx && /^(Mat|Ves|Noc|JAcum|Acum)$/.test(p))
    // turnoNuevo is the last part if it matches turno pattern
    const lastPart = partes[partes.length - 1]
    const turnoNuevoVal = /^(Mat|Ves|Noc|JAcum|Acum)$/.test(lastPart) ? lastPart : ''

    const sexIdx = partes.findIndex((p, idx) => idx > matIdx && (p === 'M' || p === 'F'))

    const registroObj: BolsaDeTrabajoRegistro = {
      id: parseUtils.generarIdRegistro('CAMBIOS_TURNO_ADSCRIPCION', registros.length),
      tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION',
      numeroProg: partes[0],
      registro: partes[1] || '', // CAT/CAD
      turnoAnterior: turnoIdx !== -1 ? partes[turnoIdx] : '',
      turnoNuevo: turnoNuevoVal,
      fecha: partes[fechaIdx],
      matricula: partes[matIdx],
      nombre: sexIdx !== -1
        ? partes.slice(matIdx + 1, sexIdx).join(' ')
        : partes.slice(matIdx + 1, matIdx + 4).join(' '),
      sexo: sexIdx !== -1 ? partes[sexIdx] : '',
      zona: zonaActual,
      categoria: categoriaActual,
      confianza: 0.7,
      filaOriginal: i + 1,
      necesitaValidacion: true,
    }

    const validationErrors = validateRegistro(registroObj, schema)
    if (validationErrors.length > 0) {
      errores.push(`Fila ${i + 1} (flexible): ${validationErrors.join('; ')}`)
    }

    registros.push(registroObj)
  }

  return {
    registros,
    metadata: {
      zona: zonaActual || undefined,
      categoria: categoriaActual || undefined,
    },
    errores,
  }
}

import type { BolsaDeTrabajoParseResult, BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'
import { parseUtils } from '../parser'
import { dividirLineas, limpiarFooter, debeDescartarLinea } from '../preprocessing'
import { SCHEMAS, validateRegistro } from '../schemas'

const schema = SCHEMAS.AMPLIACIONES_JORNADA

/**
 * Unir líneas partidas por nombres largos en AMPLIACIONES_JORNADA.
 * Si la línea tiene matrícula y la siguiente no empieza con número, es continuación.
 */
function unirLineasPartidas(lineas: string[]): string[] {
  const resultado: string[] = []
  let i = 0

  while (i < lineas.length) {
    let linea = lineas[i]
    const tieneMatricula = /\b\d{7,10}\b/.test(linea)
    const empiezaConNumero = /^\d+\s+/.test(linea)

    if (empiezaConNumero && tieneMatricula && i + 1 < lineas.length) {
      const siguiente = lineas[i + 1].trim()
      const esContinuacion =
        !/^\d+\s+/.test(siguiente) &&
        !/^\d+$/.test(siguiente) &&
        !siguiente.startsWith('Zona ') &&
        !/^\d{6}\s*-/.test(siguiente) &&
        siguiente.length > 0
      if (esContinuacion) {
        linea = `${linea} ${siguiente}`
        i++
      }
    }

    resultado.push(linea)
    i++
  }

  return resultado
}

// 15-column strict regex:
// 1:num, 2:jornadaAct, 3:adscripActClave, 4:turnoAct, 5:fecha, 6:estatus, 7:dias,
// 8:mat, 9:nombre, 10:sexo, 11:adscripNuevaClave, 12:adscripNuevaNombre, 13:plaza, 14:jornadaNva, 15:turnoNva
const REGEX_ESTRICTO = /^(\d+)\s+(\d+)\s+([A-Z0-9]+)\s+([A-Za-z]+)\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Z])\s+([\d,]+)\s+(\d{7,10})\s+(.+?)\s+([MF])(?:\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+([\d.]+)\s+([A-Za-z]+))?$/

export function parseAmpliacionesJornada(texto: string): BolsaDeTrabajoParseResult {
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

    const esRegistroPotencial = /^\d+\s+\d+/.test(linea)

    if (debeDescartarLinea(linea, esRegistroPotencial) ||
        (!esRegistroPotencial && (linea.includes(' of ') || linea.includes('No. Prog')))) {
      continue
    }

    const lineaLimpia = limpiarFooter(linea)
    if (!lineaLimpia) continue

    const match = lineaLimpia.match(REGEX_ESTRICTO)

    if (match) {
      const [
        ,
        numeroProg,
        jornadaActual,
        adscripcionActualClave,
        turnoActual,
        fecha,
        estatus,
        diasLaborados,
        matricula,
        nombre,
        sexo,
        adscripcionNuevaClave,
        adscripcionNuevaNombre,
        numeroPlaza,
        jornadaNueva,
        turnoNueva,
      ] = match

      const registroObj: BolsaDeTrabajoRegistro = {
        id: parseUtils.generarIdRegistro('AMPLIACIONES_JORNADA', registros.length),
        tipoDocumento: 'AMPLIACIONES_JORNADA',
        numeroProg,
        jornadaActual,
        adscripcionActualClave,
        turnoActual,
        fecha,
        estatus,
        diasLaborados: diasLaborados.replace(/,/g, ''),
        matricula,
        nombre: nombre.trim(),
        sexo,
        adscripcionNuevaClave: adscripcionNuevaClave || '',
        adscripcionNuevaNombre: (adscripcionNuevaNombre || '').trim(),
        numeroPlaza: numeroPlaza || '',
        jornadaNueva: jornadaNueva || '',
        turnoNueva: turnoNueva || '',
        zona: zonaActual,
        categoria: categoriaActual,
        confianza: adscripcionNuevaClave ? 1.0 : 0.9,
        filaOriginal: i + 1,
        necesitaValidacion: false,
      }

      const validationErrors = validateRegistro(registroObj, schema)
      if (validationErrors.length > 0) {
        errores.push(`Fila ${i + 1}: ${validationErrors.join('; ')}`)
      }

      registros.push(registroObj)
      continue
    }

    // Fallback: parseo flexible
    const partes = lineaLimpia.split(/\s+/).filter((p) => p.length > 0)
    if (partes.length >= 10 && /^\d+$/.test(partes[0])) {
      const matIdx = partes.findIndex((p) => p.match(/^\d{7,10}$/))
      if (matIdx !== -1) {
        const sexIdx = partes.findIndex((p, idx) => idx > matIdx && (p === 'M' || p === 'F'))

        const registroObj: BolsaDeTrabajoRegistro = {
          id: parseUtils.generarIdRegistro('AMPLIACIONES_JORNADA', registros.length),
          tipoDocumento: 'AMPLIACIONES_JORNADA',
          numeroProg: partes[0],
          jornadaActual: partes[1],
          adscripcionActualClave: partes[2],
          turnoActual: partes[3],
          fecha: partes[4].includes('/') ? partes[4] : '',
          estatus: partes[5],
          matricula: partes[matIdx],
          nombre: sexIdx !== -1
            ? partes.slice(matIdx + 1, sexIdx).join(' ')
            : partes.slice(matIdx + 1, matIdx + 4).join(' '),
          sexo: sexIdx !== -1 ? partes[sexIdx] : '',
          zona: zonaActual,
          categoria: categoriaActual,
          confianza: 0.5,
          filaOriginal: i + 1,
          necesitaValidacion: true,
        }

        const validationErrors = validateRegistro(registroObj, schema)
        if (validationErrors.length > 0) {
          errores.push(`Fila ${i + 1} (flexible): ${validationErrors.join('; ')}`)
        }

        registros.push(registroObj)
      }
    }
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

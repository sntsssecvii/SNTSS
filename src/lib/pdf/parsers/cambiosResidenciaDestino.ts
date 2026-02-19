import type { ParseResult, BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'
import { parseUtils } from '../parser'
import { dividirLineas, debeDescartarLinea, limpiarFooter, esEncabezadoSeccion } from '../preprocessing'
import { SCHEMAS, validateRegistro } from '../schemas'

const schema = SCHEMAS.CAMBIOS_RESIDENCIA_DESTINO

// Matches: "1 02 - BAJA CALIFORNIA Ves 25/03/2025 A 12,817 8769672 NOMBRE M CLAVE 0 8"
// State can be any "XX - STATE NAME" pattern
const REGEX_RESIDENCIA = /^(\d+)\s+(\d{2}\s+-\s+[A-ZÁÉÍÓÚÑ\s]+?)\s+(Mat|Ves|Noc|JAcum|Acum)\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Z])\s+([\d,]+)\s+(\d{7,10})\s+([A-ZÁÉÍÓÚÑ&\/\s]+?)\s+([MF])\s+([A-Z0-9]+)\s+(\d+)\s+(\d+)/

export function parseCambiosResidenciaDestino(texto: string): ParseResult {
  const registros: BolsaDeTrabajoRegistro[] = []
  const errores: string[] = []
  let zonaActual = ''
  let categoriaActual = ''

  const lineasRaw = dividirLineas(texto)

  // Pre-join lines where numbers (like "12,817") got split
  const lineas = unirLineasPartidasResidencia(lineasRaw)

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    if (linea.startsWith('Zona ')) {
      zonaActual = linea.replace('Zona ', '').trim()
      continue
    }

    const categoriaMatch = linea.match(/^(\d{6})\s*-\s*(.+)$/)
    if (categoriaMatch) {
      categoriaActual = linea.trim()
      continue
    }

    if (debeDescartarLinea(linea) || linea.includes('IMSS-SIAP')) {
      continue
    }

    const lineaLimpia = limpiarFooter(linea)
    if (!lineaLimpia) continue

    const match = lineaLimpia.match(REGEX_RESIDENCIA)

    if (match) {
      const [, numero, estado, cambioSolicitado, fecha, registro, _dias, matricula, nombre, sexo, clave] = match

      const registroObj: BolsaDeTrabajoRegistro = {
        id: parseUtils.generarIdRegistro('CAMBIOS_RESIDENCIA_DESTINO', registros.length),
        tipoDocumento: 'CAMBIOS_RESIDENCIA_DESTINO',
        numeroProg: numero,
        residenciaDestino: estado.trim(),
        cambioSolicitado: cambioSolicitado.trim(),
        fecha: fecha.trim(),
        registro: registro.trim(),
        matricula: matricula.trim(),
        nombre: nombre.trim(),
        sexo,
        clave: clave.trim(),
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

    // Fallback flexible: find matrícula and date
    const partes = lineaLimpia.split(/\s+/).filter(p => p.length > 0)
    const matIdx = partes.findIndex(p => /^\d{7,10}$/.test(p))
    const fechaIdx = partes.findIndex(p => /^\d{2}\/\d{2}\/\d{4}$/.test(p))
    const estadoMatch = lineaLimpia.match(/(\d{2}\s+-\s+[A-ZÁÉÍÓÚÑ\s]+?)\s+(Mat|Ves|Noc|JAcum|Acum)/)

    if (matIdx !== -1 && fechaIdx !== -1 && estadoMatch && /^\d+$/.test(partes[0])) {
      const sexIdx = partes.findIndex((p, idx) => idx > matIdx && (p === 'M' || p === 'F'))

      const registroObj: BolsaDeTrabajoRegistro = {
        id: parseUtils.generarIdRegistro('CAMBIOS_RESIDENCIA_DESTINO', registros.length),
        tipoDocumento: 'CAMBIOS_RESIDENCIA_DESTINO',
        numeroProg: partes[0],
        residenciaDestino: estadoMatch[1].trim(),
        cambioSolicitado: estadoMatch[2].trim(),
        fecha: partes[fechaIdx],
        registro: partes[fechaIdx + 1] || '',
        matricula: partes[matIdx],
        nombre: sexIdx !== -1
          ? partes.slice(matIdx + 1, sexIdx).join(' ')
          : partes.slice(matIdx + 1, matIdx + 5).join(' '),
        sexo: sexIdx !== -1 ? partes[sexIdx] : '',
        zona: zonaActual,
        categoria: categoriaActual,
        confianza: 0.7,
        filaOriginal: i + 1,
        necesitaValidacion: true,
      }

      registros.push(registroObj)
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

/**
 * Joins lines that were split mid-record (e.g., "12,817" on next line,
 * or state name wrapping like "02 - BAJA\nCALIFORNIA...").
 */
function unirLineasPartidasResidencia(lineas: string[]): string[] {
  const resultado: string[] = []
  let i = 0

  while (i < lineas.length) {
    let linea = lineas[i]

    if (i + 1 < lineas.length) {
      const siguiente = lineas[i + 1].trim()

      // Num + state start but state continues on next line
      // e.g. "1 02 - BAJA" + "CALIFORNIA Ves 25/03/2025..."
      if (/^\d+\s+\d{2}\s+-\s+[A-Z]+$/.test(linea.trim()) && /^[A-ZÁÉÍÓÚÑ]/.test(siguiente)) {
        linea = `${linea} ${siguiente}`
        i++
      }
      // Record with matrícula but number split on next line (e.g., "12,817" alone)
      else if (/^\d+\s+\d{2}\s+-/.test(linea.trim()) && /^\d[\d,]+$/.test(siguiente)) {
        linea = `${linea} ${siguiente}`
        i++
      }
      // State name continued (e.g., "CALIFORNIA" or "SUR")
      else if (/^\d+\s+\d{2}\s+-\s+[A-Z]+$/.test(linea.trim()) && /^[A-Z]+\s/.test(siguiente) && !esEncabezadoSeccion(siguiente)) {
        linea = `${linea} ${siguiente}`
        i++
      }
    }

    resultado.push(linea)
    i++
  }

  return resultado
}

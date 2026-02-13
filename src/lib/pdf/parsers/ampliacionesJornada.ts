import type { EscalafonParseResult, EscalafonRegistro } from '@/types/escalafon'
import { parseUtils } from '../parser'

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

    // Si parece registro y la siguiente línea es continuación (no empieza con número)
    if (empiezaConNumero && tieneMatricula && i + 1 < lineas.length) {
      const siguiente = lineas[i + 1].trim()
      const esContinuacion =
        !/^\d+\s+/.test(siguiente) &&
        !/^\d+$/.test(siguiente) && // Evitar fusionar líneas con solo un número (ej: "8")
        !siguiente.startsWith('Zona ') &&
        !/^\d{6}\s*-/.test(siguiente) &&
        siguiente.length > 0
      if (esContinuacion) {
        linea = `${linea} ${siguiente}`
        i++ // Consumir línea de continuación
      }
    }

    resultado.push(linea)
    i++
  }

  return resultado
}

export function parseAmpliacionesJornada(texto: string): EscalafonParseResult {
  const registros: EscalafonRegistro[] = []
  const errores: string[] = []
  let zonaActual = ''
  let categoriaActual = ''

  let lineasRaw = parseUtils.dividirLineas(texto)
  let lineas = unirLineasPartidas(lineasRaw)

  console.log('AMPLIACIONES JORNADA - Procesando', lineas.length, 'líneas')

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (!linea) continue

    // Detectar zona
    if (linea.startsWith('Zona ')) {
      zonaActual = linea.replace('Zona ', '').trim()
      continue
    }

    // Detectar categoría (formato: "205700 - TECNICO RADIOLOGO")
    const categoriaMatch = linea.match(/^(\d{6})\s*-\s*(.+)$/)
    if (categoriaMatch) {
      categoriaActual = linea.trim()
      continue
    }

    // --- LÓGICA DE EXTRACCIÓN MEJORADA ---

    // Si la línea empieza con un número y luego otro (ej: "90 80"), es probablemente un registro
    const esRegistroPotencial = /^\d+\s+\d+/.test(linea)

    // Saltar encabezados y líneas de paginación solo si NO parece ser un registro
    // Esto evita que "IMSS-SIAP" al final de la última fila de una hoja cause que se ignore el registro
    if (!esRegistroPotencial && (
      parseUtils.esEncabezado(linea) ||
      linea.includes('--') ||
      linea.includes(' of ') ||
      linea.includes('IMSS-SIAP') ||
      linea.includes('DIRECCIÓN') ||
      linea.includes('LISTADO') ||
      linea.includes('No. Prog')
    )) {
      continue
    }

    // Limpiar rastro de footer o paginación si está pegado al final de la línea
    const lineaLimpia = linea
      .replace(/IMSS-SIAP.*/, '')
      .replace(/\s+\d+\s+of\s+\d+$/, '')
      .trim()

    if (!lineaLimpia) continue

    // Regex completo que captura las 15 columnas del formato
    // Se ha hecho la segunda parte (Situación Actual) opcional usando (?: ... )?
    // 1:num, 2:jornadaAct, 3:adscripActClave, 4:turnoAct, 5:fecha, 6:estatus, 7:dias, 
    // 8:mat, 9:nombre, 10:sexo, 11:adscripNuevaClave, 12:adscripNuevaNombre, 13:plaza, 14:jornadaNva, 15:turnoNva
    const regexEstricto = /^(\d+)\s+(\d+)\s+([A-Z0-9]+)\s+([A-Za-z]+)\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Z])\s+([\d,]+)\s+(\d{7,10})\s+(.+?)\s+([MF])(?:\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+([\d.]+)\s+([A-Za-z]+))?$/

    const match = lineaLimpia.match(regexEstricto)

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

      registros.push({
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
        confianza: adscripcionNuevaClave ? 1.0 : 0.9, // Un poco menos si faltan datos
        filaOriginal: i + 1,
        necesitaValidacion: false,
      })
      continue
    }

    // Parseo flexible para líneas que no cumplen el regex estricto
    const partes = lineaLimpia.split(/\s+/).filter((p) => p.length > 0)
    if (partes.length >= 10 && /^\d+$/.test(partes[0])) {
      const matIdx = partes.findIndex((p) => p.match(/^\d{7,10}$/))
      if (matIdx !== -1) {
        // Encontrar el sexo (M o F) para delimitar el nombre
        const sexIdx = partes.findIndex((p, idx) => idx > matIdx && (p === 'M' || p === 'F'))

        registros.push({
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
          observaciones: 'Parseo flexible'
        })
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

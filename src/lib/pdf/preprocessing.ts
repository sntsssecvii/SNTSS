/**
 * Módulo de preprocesamiento compartido para todos los parsers PDF.
 * Centraliza: limpieza de footers, detección de zona/categoría,
 * unión de líneas partidas y filtrado de encabezados.
 */

const ENCABEZADOS_KEYWORDS = [
  'CAMBIO SOLICITADO',
  'SITUACIÓN ACTUAL',
  'ADSCRIPCIÓN',
  'REGISTRO',
  'NOMBRE',
  'MATRÍCULA',
  'No. Prog',
  'CATEGORÍA',
  'IMSS-SIAP',
  'DIRECCIÓN',
  'LISTADO',
]

const FOOTER_PATTERNS = [
  /IMSS-SIAP.*/,
  /\s+\d+\s+of\s+\d+$/,
]

const SECTION_HEADER_PATTERNS = [
  /^Zona\s+/,
  /^IMSS-SIAP/,
  /^DIRECCIÓN/,
  /^UNIDAD/,
  /^COORDINACIÓN/,
  /^DIVISIÓN/,
  /^OFICINA/,
  /^LISTADO/,
  /^No\.\s*Prog/,
  /Nombre\s+Matrícula/,
  /^\d{6}\s*-/,
  /^--\s*\d+\s+of/,
]

export interface PreprocessedContext {
  lineas: string[]
  zonas: Map<number, string>
  categorias: Map<number, string>
}

/**
 * Divide texto en líneas no vacías (trimmed).
 */
export function dividirLineas(texto: string): string[] {
  return texto
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
}

/**
 * Limpia footers/paginación pegados al final de una línea.
 */
export function limpiarFooter(linea: string): string {
  let resultado = linea
  for (const pattern of FOOTER_PATTERNS) {
    resultado = resultado.replace(pattern, '')
  }
  return resultado.trim()
}

/**
 * Determina si una línea es un encabezado de tabla (nombres de columna).
 */
export function esEncabezado(linea: string): boolean {
  const upper = linea.toUpperCase()
  return ENCABEZADOS_KEYWORDS.some(enc => upper.includes(enc))
}

/**
 * Determina si una línea es un encabezado de sección del PDF.
 */
export function esEncabezadoSeccion(linea: string): boolean {
  const t = linea.trim()
  return SECTION_HEADER_PATTERNS.some(p => p.test(t))
}

/**
 * Determina si una línea es ruido (paginación, separadores, footers).
 */
export function esRuido(linea: string): boolean {
  return (
    linea.includes('--') ||
    /^\s*\d+\s+of\s+\d+\s*$/.test(linea) ||
    linea.startsWith('Página')
  )
}

/**
 * Filtro genérico: determina si una línea debe descartarse.
 * esRegistroPotencial permite que la línea NO se descarte si parece dato.
 */
export function debeDescartarLinea(linea: string, esRegistroPotencial: boolean = false): boolean {
  if (esRegistroPotencial) return false
  return (
    esEncabezado(linea) ||
    esRuido(linea) ||
    /^IMSS-SIAP/.test(linea) ||
    /^DIRECCIÓN/.test(linea) ||
    /^LISTADO/.test(linea)
  )
}

/**
 * Extrae zona de una línea si aplica.
 * Retorna la zona detectada o null.
 */
export function extraerZona(linea: string): string | null {
  if (linea.startsWith('Zona ')) {
    return linea.replace('Zona ', '').trim()
  }
  return null
}

/**
 * Extrae categoría de una línea si aplica.
 * Formato: "202100 - AUX DE ENFERMERIA GRAL"
 */
export function extraerCategoria(linea: string): string | null {
  const match = linea.match(/^(\d{6})\s*-\s*(.+)$/)
  if (match) {
    return linea.trim()
  }
  return null
}

/**
 * Preprocesamiento genérico de líneas con detección de zona/categoría.
 * Retorna las líneas limpias con metadatos de zona/categoría por índice.
 */
export function preprocessLines(texto: string): PreprocessedContext {
  const raw = dividirLineas(texto)
  const lineas: string[] = []
  const zonas = new Map<number, string>()
  const categorias = new Map<number, string>()

  let zonaActual = ''
  let categoriaActual = ''

  for (const linea of raw) {
    const zona = extraerZona(linea)
    if (zona !== null) {
      zonaActual = zona
      continue
    }

    const categoria = extraerCategoria(linea)
    if (categoria !== null) {
      categoriaActual = categoria
      continue
    }

    const idx = lineas.length
    lineas.push(linea)
    if (zonaActual) zonas.set(idx, zonaActual)
    if (categoriaActual) categorias.set(idx, categoriaActual)
  }

  return { lineas, zonas, categorias }
}

/**
 * Une líneas partidas cuando un registro se divide en 2+ líneas.
 * Versión genérica: si la línea actual empieza con número y tiene matrícula,
 * y la siguiente NO empieza con número, se asume continuación.
 */
export function unirLineasPartidasGeneric(lineas: string[]): string[] {
  const resultado: string[] = []
  let i = 0

  while (i < lineas.length) {
    let linea = lineas[i]
    const empiezaConNumero = /^\d+\s+/.test(linea)
    const tieneMatricula = /\b\d{7,10}\b/.test(linea)

    if (empiezaConNumero && tieneMatricula && i + 1 < lineas.length) {
      const siguiente = lineas[i + 1].trim()
      const esContinuacion =
        !/^\d+\s+/.test(siguiente) &&
        !/^\d+$/.test(siguiente) &&
        !esEncabezadoSeccion(siguiente) &&
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

/**
 * Divide líneas que contienen múltiples registros pegados horizontalmente.
 * Busca patrones "Num + Nombre" repetidos en una sola línea.
 */
export function dividirLineasPegadas(lineas: string[]): string[] {
  const resultado: string[] = []

  for (const linea of lineas) {
    if (!linea.trim()) continue

    const regexRegistro = /(?:^|\s+)(\d+)\s+(?=[A-ZÁÉÍÓÚÑ&\/])/g
    const matches = Array.from(linea.matchAll(regexRegistro))

    if (matches.length > 1) {
      for (let i = 0; i < matches.length; i++) {
        const matchStr = matches[i][0]
        const offsetDigito = matchStr.search(/\d/)
        const start = matches[i].index! + offsetDigito

        let end = linea.length
        if (i + 1 < matches.length) {
          const nextMatchStr = matches[i + 1][0]
          const nextOffsetDigito = nextMatchStr.search(/\d/)
          end = matches[i + 1].index! + nextOffsetDigito
        }

        const segmento = linea.substring(start, end).trim()
        if (segmento) resultado.push(segmento)
      }
    } else {
      resultado.push(linea)
    }
  }

  return resultado
}

/**
 * Obtiene zona y categoría para una línea dada su índice
 * buscando la más reciente <= idx.
 */
export function getContextForIndex(
  idx: number,
  zonas: Map<number, string>,
  categorias: Map<number, string>
): { zona: string; categoria: string } {
  let zona = ''
  let categoria = ''

  for (const [k, v] of zonas) {
    if (k <= idx) zona = v
    else break
  }
  for (const [k, v] of categorias) {
    if (k <= idx) categoria = v
    else break
  }

  return { zona, categoria }
}

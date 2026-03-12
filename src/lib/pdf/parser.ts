// Extracción de texto PDF usando pdfplumber (Python Bridge) para máxima precisión
import type {
  BolsaDeTrabajoRegistro,
  TipoBolsaDeTrabajo,
  BolsaDeTrabajoDocumento,
  MetadataBolsaDeTrabajo,
} from '@/types/bolsa-de-trabajo'
import { parseNuevoIngreso } from './parsers/nuevoIngreso'
import { parseAmpliacionesJornada } from './parsers/ampliacionesJornada'
import { parseCambiosArea } from './parsers/cambiosArea'
import { parseCambiosRama } from './parsers/cambiosRama'
import { parseCambiosResidenciaDestino } from './parsers/cambiosResidenciaDestino'
import { parseCambiosResidenciaOrigen } from './parsers/cambiosResidenciaOrigen'
import { parseCambiosTipoPlaza } from './parsers/cambiosTipoPlaza'
import { parseCambiosTurnoAdscripcion } from './parsers/cambiosTurnoAdscripcion'

export interface ParseResult {
  registros: BolsaDeTrabajoRegistro[]
  metadata: MetadataBolsaDeTrabajo
  errores: string[]
  texto?: string // Texto crudo extraído
}

/**
 * Función principal para parsear un PDF según su tipo
 */
export async function parsePDF(
  buffer: Buffer,
  tipo: TipoBolsaDeTrabajo,
  nombreArchivo?: string,
  options: { maxPages?: number } = {}
): Promise<ParseResult> {
  try {
    // Intentar usar pdfplumber (Python) como motor principal para extracción de texto
    let texto = ''
    try {
      console.log(`Usando pdfplumber para extraer texto de ${tipo}: ${nombreArchivo || 'identificador desconocido'}`)
      const { callPythonExtractor } = await import('./pythonBridge')

      let pdfPath = ''
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      const tempDir = path.join(os.tmpdir(), 'sntss-pdf-' + Date.now())
      fs.mkdirSync(tempDir, { recursive: true })
      pdfPath = path.join(tempDir, nombreArchivo || 'temp.pdf')
      fs.writeFileSync(pdfPath, buffer)

      try {
        const extraction = await callPythonExtractor(pdfPath)
        // Concatenar texto de todas las páginas
        texto = extraction.pages.map(p => p.text).join('\n')
      } finally {
        try { fs.unlinkSync(pdfPath); fs.rmdirSync(tempDir); } catch (e) { }
      }
    } catch (plumberError) {
      console.warn('Error con pdfplumber extractive, intentando fallback de JavaScript (Baja Precisión):', plumberError)

      try {
        // Polyfill para evitar errores de DOMMatrix/Canvas en Vercel (solo lo mínimo necesario)
        if (typeof global !== 'undefined') {
          if (!(global as any).DOMMatrix) (global as any).DOMMatrix = class DOMMatrix { };
          if (!(global as any).Path2D) (global as any).Path2D = class Path2D { };
          if (!(global as any).ImageData) (global as any).ImageData = class ImageData { };
        }

        const pdfParseModule = await import('pdf-parse');
        const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule as any).default || pdfParseModule;

        const data = await (pdfParse as any)(buffer)
        texto = data.text
        if (texto) {
          console.log('Extracción exitosa con pdf-parse (fallback JS)')
        }
      } catch (parseError) {
        console.error('Error crítico: Falló también el fallback de pdf-parse:', parseError)
        throw new Error(`No se pudo extraer texto del PDF con ningún motor disponible (Python/Adobe/JS).`)
      }
    }

    if (!texto) {
      throw new Error('No se pudo extraer texto del PDF.')
    }

    // Determinar parser según el tipo
    let resultado: ParseResult

    switch (tipo) {
      case 'NUEVO_INGRESO':
        resultado = parseNuevoIngreso(texto)
        break
      case 'AMPLIACIONES_JORNADA':
        resultado = parseAmpliacionesJornada(texto)
        break
      case 'CAMBIOS_AREA':
        resultado = parseCambiosArea(texto)
        break
      case 'CAMBIOS_RAMA':
        resultado = parseCambiosRama(texto)
        break
      case 'CAMBIOS_RESIDENCIA_DESTINO':
        resultado = parseCambiosResidenciaDestino(texto)
        break
      case 'CAMBIOS_RESIDENCIA_ORIGEN':
        resultado = parseCambiosResidenciaOrigen(texto)
        break
      case 'CAMBIOS_TIPO_PLAZA':
        resultado = parseCambiosTipoPlaza(texto)
        break
      case 'CAMBIOS_TURNO_ADSCRIPCION':
        resultado = parseCambiosTurnoAdscripcion(texto)
        break
      default:
        throw new Error(`Tipo de documento no soportado: ${tipo}`)
    }

    // Agregar metadata adicional
    resultado.metadata.totalRegistros = resultado.registros.length
    resultado.metadata.extraidoCon = 'PDF'
    resultado.texto = texto

    return resultado
  } catch (error: any) {
    console.error('Error parseando PDF:', error)
    return {
      registros: [],
      metadata: {
        totalRegistros: 0,
        extraidoCon: 'PDF'
      },
      errores: [`Error al parsear PDF: ${error.message}`],
    }
  }
}

import { MAPEO_TIPOS_ARCHIVO } from '@/types/bolsa-de-trabajo'

/**
 * Detectar el tipo de documento basado en el nombre del archivo o contenido
 */
export function detectarTipoDocumento(
  nombreArchivo?: string,
  contenido?: string
): TipoBolsaDeTrabajo | null {
  if (nombreArchivo) {
    const nombreUpper = nombreArchivo.normalize('NFC').toUpperCase()

    // 1. Intentar con el mapeo exacto
    for (const [key, value] of Object.entries(MAPEO_TIPOS_ARCHIVO)) {
      if (nombreUpper.includes(key.normalize('NFC').toUpperCase())) {
        return value
      }
    }

    // 2. Fallbacks flexibles (por si el nombre no es exacto)
    if (nombreUpper.includes('AMPLIACIONES') && nombreUpper.includes('JORNADA')) {
      return 'AMPLIACIONES_JORNADA'
    }
    if (nombreUpper.includes('CAMBIOS') && nombreUpper.includes('ÁREA')) {
      return 'CAMBIOS_AREA'
    }
    if (nombreUpper.includes('CAMBIOS') && nombreUpper.includes('RAMA')) {
      return 'CAMBIOS_RAMA'
    }
    if (nombreUpper.includes('CAMBIOS') && nombreUpper.includes('RESIDENCIA') && nombreUpper.includes('DESTINO')) {
      return 'CAMBIOS_RESIDENCIA_DESTINO'
    }
    if (nombreUpper.includes('CAMBIOS') && nombreUpper.includes('RESIDENCIA') && nombreUpper.includes('ORIGEN')) {
      return 'CAMBIOS_RESIDENCIA_ORIGEN'
    }
    if (nombreUpper.includes('CAMBIOS') && nombreUpper.includes('TIPO') && nombreUpper.includes('PLAZA')) {
      return 'CAMBIOS_TIPO_PLAZA'
    }
    if (nombreUpper.includes('CAMBIOS') && (nombreUpper.includes('TURNO') || nombreUpper.includes('ADSCRIPCIÓN'))) {
      return 'CAMBIOS_TURNO_ADSCRIPCION'
    }
    if (nombreUpper.includes('NUEVO') && nombreUpper.includes('INGRESO')) {
      return 'NUEVO_INGRESO'
    }
  }

  // Intentar detectar por contenido si no se pudo por nombre
  if (contenido) {
    const contenidoNorm = contenido.normalize('NFC')
    const contenidoUpper = contenidoNorm.toUpperCase()
    const primerasLineas = contenidoNorm.split('\n').slice(0, 30).join(' ').toUpperCase()

    // Detectar NUEVO INGRESO por el formato característico de columnas
    // Buscar patrones como "No. Prog", "Nombre", "Matrícula", "Fecha de Registro"
    if (
      (primerasLineas.includes('NO. PROG') || primerasLineas.includes('NO PROG')) &&
      primerasLineas.includes('NOMBRE') &&
      primerasLineas.includes('MATRÍCULA') &&
      (primerasLineas.includes('FECHA DE REGISTRO') || primerasLineas.includes('FECHA'))
    ) {
      return 'NUEVO_INGRESO'
    }

    if (contenidoUpper.includes('LISTADO DE AMPLIACIONES DE JORNADA')) {
      return 'AMPLIACIONES_JORNADA'
    }
    if (contenidoUpper.includes('LISTADO DE CAMBIOS DE ÁREA')) {
      return 'CAMBIOS_AREA'
    }
    if (contenidoUpper.includes('LISTADO DE CAMBIOS DE RAMA')) {
      return 'CAMBIOS_RAMA'
    }
    if (contenidoUpper.includes('LISTADO DE CAMBIOS DE RESIDENCIA') && contenidoUpper.includes('DESTINO')) {
      return 'CAMBIOS_RESIDENCIA_DESTINO'
    }
    if (contenidoUpper.includes('LISTADO DE CAMBIOS DE RESIDENCIA') && contenidoUpper.includes('ORIGEN')) {
      return 'CAMBIOS_RESIDENCIA_ORIGEN'
    }
    if (contenidoUpper.includes('LISTADO DE CAMBIOS DE TIPO DE PLAZA')) {
      return 'CAMBIOS_TIPO_PLAZA'
    }
    if (contenidoUpper.includes('LISTADO DE CAMBIOS DE TURNO') || contenidoUpper.includes('ADSCRIPCIÓN')) {
      return 'CAMBIOS_TURNO_ADSCRIPCION'
    }
    if (contenidoUpper.includes('LISTADO DE CANDIDATOS DE NUEVO INGRESO') || contenidoUpper.includes('NUEVO INGRESO')) {
      return 'NUEVO_INGRESO'
    }
  }

  return null
}

/**
 * Utilidades para parsing.
 * Las funciones de preprocesamiento se centralizan en ./preprocessing.ts
 */
import {
  dividirLineas,
  esEncabezado,
  limpiarFooter,
  esEncabezadoSeccion,
  esRuido,
  debeDescartarLinea,
  extraerZona,
  extraerCategoria,
  preprocessLines,
  unirLineasPartidasGeneric,
  dividirLineasPegadas,
} from './preprocessing'

export {
  dividirLineas,
  esEncabezado,
  limpiarFooter,
  esEncabezadoSeccion,
  esRuido,
  debeDescartarLinea,
  extraerZona,
  extraerCategoria,
  preprocessLines,
  unirLineasPartidasGeneric,
  dividirLineasPegadas,
}

export const parseUtils = {
  limpiarTexto(texto: string): string {
    return texto
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
  },

  extraerFecha(texto: string): string | undefined {
    const fechaRegex = /(\d{2}\/\d{2}\/\d{4})/g
    const match = texto.match(fechaRegex)
    return match ? match[0] : undefined
  },

  extraerMatricula(texto: string): string | undefined {
    const matriculaRegex = /\b\d{7,10}\b/g
    const match = texto.match(matriculaRegex)
    return match ? match[0] : undefined
  },

  dividirLineas,
  esEncabezado,

  generarIdRegistro(tipo: TipoBolsaDeTrabajo, indice: number): string {
    return `${tipo}_${Date.now()}_${indice}`
  },
}

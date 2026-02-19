// Importación dinámica de pdf-parse para evitar problemas con Next.js bundling
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
    // Importar pdf-parse dinámicamente para evitar problemas con Next.js bundling
    // En el servidor, usar require directamente ya que está excluido del bundling
    let PDFParseClass: any
    if (typeof window === 'undefined') {
      // En el servidor, usar require
      const pdfParseModule = require('pdf-parse')
      // pdf-parse v2.4.5 exporta PDFParse como clase
      PDFParseClass = pdfParseModule.PDFParse
    } else {
      // En el cliente (no debería llegar aquí, pero por si acaso)
      const pdfParseModule = await import('pdf-parse')
      PDFParseClass = pdfParseModule.PDFParse
    }

    if (!PDFParseClass || typeof PDFParseClass !== 'function') {
      throw new Error(`PDFParse no está disponible. Tipo: ${typeof PDFParseClass}`)
    }

    // Crear instancia de PDFParse con el buffer
    // @ts-ignore - pdf-parse types might not include max option
    const parser = new PDFParseClass({
      data: buffer,
      max: options.maxPages
    })

    // Extraer texto del PDF usando getText()
    const result = await parser.getText()
    const texto = result.text

    // Limpiar recursos
    await parser.destroy()

    // Log para debugging (solo primeras 500 caracteres)
    console.log('Texto extraído del PDF (primeros 500 caracteres):', texto.substring(0, 500))
    console.log('Total de caracteres extraídos:', texto.length)

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

    return resultado
  } catch (error: any) {
    console.error('Error parseando PDF:', error)
    return {
      registros: [],
      metadata: {},
      errores: [`Error al parsear PDF: ${error.message}`],
    }
  }
}

/**
 * Detectar el tipo de documento basado en el nombre del archivo o contenido
 */
export function detectarTipoDocumento(
  nombreArchivo?: string,
  contenido?: string
): TipoBolsaDeTrabajo | null {
  if (nombreArchivo) {
    const nombreUpper = nombreArchivo.toUpperCase()

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
    const contenidoUpper = contenido.toUpperCase()
    const primerasLineas = contenido.split('\n').slice(0, 30).join(' ').toUpperCase()

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

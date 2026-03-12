import type { ExtractorInterface, ExtraccionOpciones, ResultadoExtraccion, FilaExtraida } from './base'

const ENCABEZADOS = [
  'NO. PROG', 'NOMBRE', 'MATRÍCULA', 'FECHA', 'GRUPO', 'CALIFICACIÓN',
  'TIPO CONTRATACIÓN', 'DÍAS LABORADOS', 'ESTATUS', 'OBSERVACIONES',
  'JORNADA ACTUAL', 'ADSCRIPCIÓN ACTUAL', 'TURNO ACTUAL', 'RESIDENCIA',
  'CAMBIO SOLICITADO', 'REGISTRO', 'CLAVE', 'SEXO', 'ÁREA', 'RAMA'
]

const PDFParse = require('pdf-parse')

export class ExtractorPdfParse implements ExtractorInterface {
  readonly nombre = 'pdf-parse'
  readonly descripcion = 'Extractor básico que usa pdf-parse para texto plano'

  async extraer(buffer: Buffer, opciones?: ExtraccionOpciones): Promise<ResultadoExtraccion> {
    const inicio = Date.now()
    const errores: string[] = []
    const filas: FilaExtraida[] = []
    const zonasSet = new Set<string>()
    const categoriasSet = new Set<string>()

    try {
      const parser = new PDFParse({ data: buffer, max: opciones?.maxPaginas })
      const result = await parser.getText()
      const texto = result.text
      await parser.destroy()

      const lineas = texto.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
      
      let zonaActual = ''
      let categoriaActual = ''

      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i]
        
        // Detectar zona
        if (this.esZona(linea)) {
          zonaActual = linea.replace('Zona ', '').trim()
          zonasSet.add(zonaActual)
          filas.push(this.crearFila(i, 'zona', { zona: zonaActual, textoOriginal: linea }))
          continue
        }

        // Detectar categoría
        if (this.esCategoria(linea)) {
          categoriaActual = linea.trim()
          categoriasSet.add(categoriaActual)
          filas.push(this.crearFila(i, 'categoria', { categoria: categoriaActual, textoOriginal: linea }))
          continue
        }

        // Ignorar ruido
        if (this.esRuido(linea) || this.esEncabezado(linea)) {
          filas.push(this.crearFila(i, 'ruido', { textoOriginal: linea }))
          continue
        }

        // Detectar registro
        if (this.esRegistro(linea)) {
          const datos = this.extraerDatosRegistro(linea)
          filas.push(this.crearFila(i, 'dato', {
            zona: zonaActual,
            categoria: categoriaActual,
            numeroProg: datos.numeroProg,
            nombre: datos.nombre,
            matricula: datos.matricula,
            fecha: datos.fecha,
            datosExtra: datos.datosExtra,
            textoOriginal: linea,
            confianza: datos.matricula ? 0.8 : 0.5
          }))
          continue
        }

        // Desconocido
        filas.push(this.crearFila(i, 'desconocido', { textoOriginal: linea }))
      }

      return {
        exito: true,
        extractor: this.nombre,
        tipoDocumento: opciones?.tipoDocumento,
        totalLineas: lineas.length,
        filas,
        metadata: {
          zonas: Array.from(zonasSet),
          categorias: Array.from(categoriasSet),
          totalRegistros: filas.filter(f => f.tipo === 'dato').length,
          totalErrores: errores.length
        },
        errores,
        tiempoMs: Date.now() - inicio
      }

    } catch (error: any) {
      return {
        exito: false,
        extractor: this.nombre,
        totalLineas: 0,
        filas: [],
        metadata: { zonas: [], categorias: [], totalRegistros: 0, totalErrores: 1 },
        errores: [error.message],
        tiempoMs: Date.now() - inicio
      }
    }
  }

  private crearFila(
    indice: number, 
    tipo: FilaExtraida['tipo'], 
    datos: Partial<FilaExtraida>
  ): FilaExtraida {
    return {
      id: `fila-${indice}`,
      numeroLinea: indice + 1,
      tipo,
      ...datos
    } as FilaExtraida
  }

  private esZona(linea: string): boolean {
    return /^Zona\s+\d+/.test(linea.trim())
  }

  private esCategoria(linea: string): boolean {
    return /^\d{6}\s*-\s*/.test(linea.trim())
  }

  private esEncabezado(linea: string): boolean {
    const upper = linea.toUpperCase()
    return ENCABEZADOS.some(e => upper.includes(e))
  }

  private esRuido(linea: string): boolean {
    const t = linea.trim()
    return (
      t.startsWith('Página') ||
      t.startsWith('--') ||
      /^\d+\s+of\s+\d+$/.test(t) ||
      t.startsWith('IMSS-SIAP') ||
      t.startsWith('DIRECCIÓN') ||
      t.startsWith('LISTADO')
    )
  }

  private esRegistro(linea: string): boolean {
    const trimmed = linea.trim()
    if (!trimmed) return false
    
    const tieneNumeroProg = /^\d+\s+/.test(trimmed)
    const tieneMatricula = /\b\d{7,10}\b/.test(trimmed)
    const tieneFecha = /\d{2}\/\d{2}\/\d{4}/.test(trimmed)
    
    return tieneNumeroProg && (tieneMatricula || tieneFecha)
  }

  private extraerDatosRegistro(linea: string): {
    numeroProg: string
    nombre: string
    matricula: string
    fecha: string
    datosExtra: string
  } {
    const partes = linea.split(/\s+/).filter((p: string) => p.length > 0)
    
    let numeroProg = ''
    let nombre = ''
    let matricula = ''
    let fecha = ''
    let datosExtra = ''

    const numIdx = partes.findIndex((p: string) => /^\d+$/.test(p))
    if (numIdx >= 0) {
      numeroProg = partes[numIdx]
      nombre = partes.slice(numIdx + 1).join(' ')
    }

    const matMatch = linea.match(/\b(\d{7,10})\b/)
    if (matMatch) {
      matricula = matMatch[1]
    }

    const fechaMatch = linea.match(/(\d{2}\/\d{2}\/\d{4})/)
    if (fechaMatch) {
      fecha = fechaMatch[1]
    }

    const datosDespues = linea
      .replace(/^\d+\s+/, '')
      .replace(/\b\d{7,10}\b/, '')
      .replace(/\d{2}\/\d{2}\/\d{4}/, '')
      .trim()
    if (datosDespues) {
      datosExtra = datosDespues
    }

    return { numeroProg, nombre, matricula, fecha, datosExtra }
  }
}

export const extractorPdfParse = new ExtractorPdfParse()

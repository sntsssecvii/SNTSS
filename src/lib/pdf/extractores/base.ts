export interface FilaExtraida {
  id: string
  numeroLinea: number
  tipo: 'dato' | 'zona' | 'categoria' | 'encabezado' | 'ruido' | 'desconocido'
  
  // Datos comunes
  zona?: string
  categoria?: string
  
  // Datos del registro
  numeroProg?: string
  nombre?: string
  matricula?: string
  fecha?: string
  
  // Datos extra (texto que no se pudo parsear)
  datosExtra?: string
  textoOriginal?: string
  
  // Metadata
  confianza?: number
  errores?: string[]
}

export interface ResultadoExtraccion {
  exito: boolean
  extractor: string
  tipoDocumento?: string
  totalLineas: number
  filas: FilaExtraida[]
  metadata: {
    zonas: string[]
    categorias: string[]
    totalRegistros: number
    totalErrores: number
  }
  errores: string[]
  tiempoMs: number
}

export interface ExtractorInterface {
  readonly nombre: string
  readonly descripcion: string
  extraer(buffer: Buffer, opciones?: ExtraccionOpciones): Promise<ResultadoExtraccion>
}

export interface ExtraccionOpciones {
  tipoDocumento?: string
  incluirExcel?: boolean
  maxPaginas?: number
}

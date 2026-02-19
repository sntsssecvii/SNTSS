import { Timestamp } from 'firebase/firestore'

// Tipos de documentos de bolsa de trabajo
export type TipoBolsaDeTrabajo =
  | 'AMPLIACIONES_JORNADA'
  | 'CAMBIOS_AREA'
  | 'CAMBIOS_RAMA'
  | 'CAMBIOS_RESIDENCIA_DESTINO'
  | 'CAMBIOS_RESIDENCIA_ORIGEN'
  | 'CAMBIOS_TIPO_PLAZA'
  | 'CAMBIOS_TURNO_ADSCRIPCION'
  | 'NUEVO_INGRESO'

// Estados de procesamiento
export type EstadoProcesamiento = 'PROCESANDO' | 'COMPLETADO' | 'ERROR' | 'VALIDANDO'

// Resultado del parseo de un PDF (registros + metadata + errores)
export interface BolsaDeTrabajoParseResult {
  registros: BolsaDeTrabajoRegistro[]
  metadata: Pick<MetadataBolsaDeTrabajo, 'zona' | 'categoria'>
  errores: string[]
}

/** @deprecated Usar BolsaDeTrabajoParseResult */
export type ParseResult = BolsaDeTrabajoParseResult

// Metadata del documento
export interface MetadataBolsaDeTrabajo {
  zona?: string
  categoria?: string
  fechaActualizacionOriginal?: string
  totalRegistros?: number
  organoOperacion?: string
}

// Registro extraído de un PDF
export interface BolsaDeTrabajoRegistro {
  id: string
  tipoDocumento: TipoBolsaDeTrabajo

  // Campos comunes a todos los tipos
  nombre?: string
  matricula?: string
  registro?: string
  fecha?: string
  adscripcion?: string
  clave?: string
  zona?: string
  categoria?: string

  // Campos específicos para AMPLIACIONES DE JORNADA
  jornadaActual?: string
  adscripcionActualClave?: string
  turnoActual?: string
  jornadaNueva?: string
  turnoNueva?: string // Ya existía turnoNuevo, pero mantenemos consistencia
  sexo?: string
  numeroPlaza?: string
  adscripcionNuevaClave?: string
  adscripcionNuevaNombre?: string

  // Campos genéricos/anteriores (mantener por compatibilidad si es necesario)
  cambioSolicitado?: string
  situacionActual?: string

  // Campos específicos para CAMBIOS DE ÁREA/RAMA
  cambioSolicitadoArea?: string
  situacionActualArea?: string

  // Campos específicos para CAMBIOS DE RESIDENCIA
  residenciaDestino?: string
  residenciaOrigen?: string
  organoOperacion?: string

  // Campos específicos para CAMBIOS DE TIPO DE PLAZA
  tipoPlazaAnterior?: string
  tipoPlazaNuevo?: string

  // Campos específicos para CAMBIOS DE TURNO Y-O ADSCRIPCIÓN
  turnoAnterior?: string
  turnoNuevo?: string
  adscripcionAnterior?: string
  adscripcionNueva?: string

  // Campos específicos para NUEVO INGRESO
  numeroProg?: string
  grupo?: string
  calificacion?: string
  tipoContratacion?: string
  diasLaborados?: string
  estatus?: string
  observaciones?: string

  // Metadata de extracción
  confianza?: number // 0-1, nivel de confianza de la extracción
  filaOriginal?: number // Número de fila en el PDF
  necesitaValidacion?: boolean
  validado?: boolean
  validadoPor?: string
  fechaValidacion?: Timestamp
}

// Documento de bolsa de trabajo completo
export interface BolsaDeTrabajoDocumento {
  id?: string
  tipo: TipoBolsaDeTrabajo
  fechaActualizacion: Timestamp | Date // Fecha del documento original
  fechaCarga: Timestamp | Date // Cuándo se subió al sistema
  subidoPor: string // UID del usuario
  subidoPorEmail?: string // Email del usuario
  estado: EstadoProcesamiento
  urlArchivo: string // Firebase Storage URL
  nombreArchivo?: string // Nombre original del archivo
  metadata: MetadataBolsaDeTrabajo
  registros: BolsaDeTrabajoRegistro[] // Array de registros extraídos
  errores?: string[] // Errores durante la extracción
  version: number // Versión del documento (para historial)
  totalRegistros?: number // Total de registros extraídos
  registrosValidados?: number // Cantidad de registros validados
  registrosConErrores?: number // Cantidad de registros con errores
}

// Filtros para búsqueda
export interface FiltrosBolsaDeTrabajo {
  tipo?: TipoBolsaDeTrabajo[]
  zona?: string[]
  categoria?: string[]
  fechaDesde?: Date
  fechaHasta?: Date
  estado?: EstadoProcesamiento[]
  necesitaValidacion?: boolean
  textoBusqueda?: string // Búsqueda en nombres, matrículas, etc.
}

// Estadísticas de bolsa de trabajo
export interface EstadisticasBolsaDeTrabajo {
  totalDocumentos: number
  documentosPorTipo: Record<TipoBolsaDeTrabajo, number>
  documentosPorEstado: Record<EstadoProcesamiento, number>
  totalRegistros: number
  registrosValidados: number
  registrosPendientes: number
  documentosUltimos30Dias: number
}

// Mapeo de nombres de archivo a tipos
export const MAPEO_TIPOS_ARCHIVO: Record<string, TipoBolsaDeTrabajo> = {
  'AMPLIACIONES DE JORNADA': 'AMPLIACIONES_JORNADA',
  'CAMBIOS DE ÁREA': 'CAMBIOS_AREA',
  'CAMBIOS DE RAMA': 'CAMBIOS_RAMA',
  'CAMBIOS DE RESIDENCIA DESTINO': 'CAMBIOS_RESIDENCIA_DESTINO',
  'CAMBIOS DE RESIDENCIA ORIGEN': 'CAMBIOS_RESIDENCIA_ORIGEN',
  'CAMBIOS DE TIPO DE PLAZA': 'CAMBIOS_TIPO_PLAZA',
  'CAMBIOS DE TURNO Y-O ADSCRIPCIÓN': 'CAMBIOS_TURNO_ADSCRIPCION',
  'NUEVO INGRESO': 'NUEVO_INGRESO',
}

// Nombres legibles para los tipos
export const NOMBRES_TIPOS: Record<TipoBolsaDeTrabajo, string> = {
  AMPLIACIONES_JORNADA: 'Ampliaciones de Jornada',
  CAMBIOS_AREA: 'Cambios de Área',
  CAMBIOS_RAMA: 'Cambios de Rama',
  CAMBIOS_RESIDENCIA_DESTINO: 'Cambios de Residencia Destino',
  CAMBIOS_RESIDENCIA_ORIGEN: 'Cambios de Residencia Origen',
  CAMBIOS_TIPO_PLAZA: 'Cambios de Tipo de Plaza',
  CAMBIOS_TURNO_ADSCRIPCION: 'Cambios de Turno y/o Adscripción',
  NUEVO_INGRESO: 'Nuevo Ingreso',
}

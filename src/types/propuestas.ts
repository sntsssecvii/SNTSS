// Enumeración de categorías basadas en la tabla proporcionada
export enum CategoriaPropuesta {
  ASISTENTE_MEDICA = 'Asistente Médica',
  AUX_ADMON_UM = 'Aux. Admon en UM',
  AUX_ALMACEN = 'Aux. de Almacen',
  AUX_FARMACIA = 'Aux. de Farmacia',
  AUX_LABORATORIO = 'Aux. de Laboratorio',
  AUX_SERV_GRALES_UM = 'Aux. Serv. Grales UM',
  AUX_SERV_INTENDEN = 'Aux. Serv. Intenden.',
  AUX_SERV_ADMTVOS = 'Aux. Serv. Admtvos.',
  AUX_TRABAJO_SOCIAL = 'Aux. Trabajo Social',
  AUX_UNIV_OFNA = 'Aux. Univ. De Ofna.',
  CHOFER = 'Chofer',
  LABORATORIO = 'Laboratorio',
  MANEJADOR_ALIM = 'Manejador de Alim.',
  MENSAJERO = 'Mensajero',
  OFICIAL_PUERICULTURA = 'Oficial de Puericultura',
  OP_AMBULANCIAS = 'Op. De Ambulancias',
  OP_LAVANDERIA = 'Op. De Lavanderia',
  TEC_POLIVALENTE = 'Tec. Polivalente',
  TEC_RADIOLOGA = 'Tec. Radióloga',
  TRABAJO_SOCIAL = 'Trabajo Social',
  NUTRICIONISTA_DIETISTA = 'Nutricionista Dietista',
  ESTOMATOLOGO = 'Estomatólogo',
  PSICOLOGO = 'Psicólogo',
  MEDICO_GENERAL = 'MEDICO GENERAL',
  AUX_ENF_GRAL = 'AUX. ENF. GRAL',
  ENFERMERA_GRAL = 'ENFERMERA GRAL',
}

// Constantes para parentescos comunes
export const PARENTESCOS = [
  'Cónyuge',
  'Hijo(a)',
  'Padre',
  'Madre',
  'Hermano(a)',
  'Otro',
] as const

export type Parentesco = typeof PARENTESCOS[number]

// Interface para datos del Trabajador Activo
export interface TrabajadorActivo {
  nombre: string
  matricula: string
  adscripcion: string
  localidad: string
  antiguedad: string
  telefono: string
}

// Interface para datos del Aspirante
export interface Aspirante {
  nombre: string
  domicilio: string
  curp?: string
  rfc?: string
  parentesco: Parentesco
  localidadDeseada: string
  telefono: string
  categoria: CategoriaPropuesta
}

// Importar tipos de workflow
import { EstadoPropuesta, HistorialCambio, ComentarioPropuesta } from './workflow'

// Interface principal de Propuesta
export interface Propuesta {
  id?: string
  trabajadorActivo: TrabajadorActivo
  aspirante: Aspirante
  fechaCreacion: Date | any // Firestore Timestamp
  fechaActualizacion: Date | any // Firestore Timestamp
  creadoPor: string // UID del usuario que creó la propuesta
  creadoPorEmail?: string // Email del usuario que creó la propuesta
  // Nuevos campos del sistema de workflow
  estado?: EstadoPropuesta
  historial?: HistorialCambio[]
  comentarios?: ComentarioPropuesta[]
  etiquetas?: string[]
  prioridad?: 'ALTA' | 'MEDIA' | 'BAJA'
  fechaVencimiento?: Date | any // Firestore Timestamp
  archivosAdjuntos?: string[] // URLs de archivos en Firebase Storage
}

// Interface para resultados de búsqueda de duplicados
export interface DuplicadoDetectado {
  propuesta: Propuesta
  camposCoincidentes: string[] // Lista de campos que coinciden
  porcentajeCoincidencia?: number
}

// Interface para filtros de búsqueda
export interface FiltrosPropuesta {
  fechaDesde?: Date
  fechaHasta?: Date
  categoria?: CategoriaPropuesta
  trabajadorNombre?: string
  trabajadorMatricula?: string
  aspiranteNombre?: string
  localidad?: string
}

// Helper para obtener todas las categorías como array
export const CATEGORIAS_ARRAY = Object.values(CategoriaPropuesta)

// Helper para validar CURP (18 caracteres alfanuméricos)
export const validarCURP = (curp: string): boolean => {
  if (!curp) return true // Opcional
  const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/
  return curpRegex.test(curp.toUpperCase())
}

// Helper para validar RFC (12-13 caracteres)
export const validarRFC = (rfc: string): boolean => {
  if (!rfc) return true // Opcional
  const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
  return rfcRegex.test(rfc.toUpperCase())
}

// Helper para validar teléfono (10 dígitos)
export const validarTelefono = (telefono: string): boolean => {
  if (!telefono) return false
  const telefonoRegex = /^\d{10}$/
  return telefonoRegex.test(telefono.replace(/\D/g, ''))
}

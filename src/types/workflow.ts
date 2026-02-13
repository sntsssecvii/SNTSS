// Estados del flujo de trabajo de propuestas
export enum EstadoPropuesta {
  BORRADOR = 'BORRADOR',
  EN_REVISION = 'EN_REVISION',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  ENVIADA_IMSS = 'ENVIADA_IMSS',
  COMPLETADA = 'COMPLETADA',
}

// Transiciones válidas entre estados
export const TRANSICIONES_VALIDAS: Record<EstadoPropuesta, EstadoPropuesta[]> = {
  [EstadoPropuesta.BORRADOR]: [
    EstadoPropuesta.EN_REVISION,
    EstadoPropuesta.RECHAZADA, // Puede rechazarse directamente si hay errores
  ],
  [EstadoPropuesta.EN_REVISION]: [
    EstadoPropuesta.APROBADA,
    EstadoPropuesta.RECHAZADA,
    EstadoPropuesta.BORRADOR, // Puede volver a borrador para correcciones
  ],
  [EstadoPropuesta.APROBADA]: [
    EstadoPropuesta.ENVIADA_IMSS,
    EstadoPropuesta.EN_REVISION, // Puede volver a revisión si hay problemas
  ],
  [EstadoPropuesta.RECHAZADA]: [
    EstadoPropuesta.BORRADOR, // Puede corregirse y volver a borrador
    EstadoPropuesta.EN_REVISION, // Puede apelarse y volver a revisión
  ],
  [EstadoPropuesta.ENVIADA_IMSS]: [
    EstadoPropuesta.COMPLETADA,
    EstadoPropuesta.EN_REVISION, // Si hay problemas con el envío
  ],
  [EstadoPropuesta.COMPLETADA]: [], // Estado final, no hay transiciones
}

// Información de cada estado
export interface EstadoInfo {
  label: string
  color: string
  icon: string
  descripcion: string
}

export const ESTADOS_INFO: Record<EstadoPropuesta, EstadoInfo> = {
  [EstadoPropuesta.BORRADOR]: {
    label: 'Borrador',
    color: 'gray',
    icon: 'FileText',
    descripcion: 'Propuesta en proceso de creación',
  },
  [EstadoPropuesta.EN_REVISION]: {
    label: 'En Revisión',
    color: 'yellow',
    icon: 'Clock',
    descripcion: 'Propuesta siendo revisada por el administrador',
  },
  [EstadoPropuesta.APROBADA]: {
    label: 'Aprobada',
    color: 'green',
    icon: 'CheckCircle',
    descripcion: 'Propuesta aprobada y lista para envío',
  },
  [EstadoPropuesta.RECHAZADA]: {
    label: 'Rechazada',
    color: 'red',
    icon: 'XCircle',
    descripcion: 'Propuesta rechazada, requiere correcciones',
  },
  [EstadoPropuesta.ENVIADA_IMSS]: {
    label: 'Enviada al IMSS',
    color: 'blue',
    icon: 'Send',
    descripcion: 'Propuesta enviada al sistema del IMSS',
  },
  [EstadoPropuesta.COMPLETADA]: {
    label: 'Completada',
    color: 'emerald',
    icon: 'CheckCircle2',
    descripcion: 'Proceso completado exitosamente',
  },
}

// Entrada del historial de cambios
export interface HistorialCambio {
  id: string
  fecha: Date | any // Firestore Timestamp
  usuarioId: string
  usuarioEmail?: string
  usuarioNombre?: string
  estadoAnterior: EstadoPropuesta | null
  estadoNuevo: EstadoPropuesta
  comentario?: string
  motivo?: string
  metadata?: Record<string, any>
}

// Comentario asociado a una propuesta
export interface ComentarioPropuesta {
  id: string
  fecha: Date | any // Firestore Timestamp
  usuarioId: string
  usuarioEmail?: string
  usuarioNombre?: string
  contenido: string
  mencionados?: string[] // IDs de usuarios mencionados
  respuestaA?: string // ID del comentario padre si es respuesta
  archivosAdjuntos?: string[] // URLs de archivos adjuntos
}

// Helper para verificar si una transición es válida
export function esTransicionValida(
  estadoActual: EstadoPropuesta,
  estadoNuevo: EstadoPropuesta
): boolean {
  return TRANSICIONES_VALIDAS[estadoActual]?.includes(estadoNuevo) ?? false
}

// Helper para obtener el siguiente estado sugerido
export function obtenerSiguienteEstado(
  estadoActual: EstadoPropuesta
): EstadoPropuesta | null {
  const transiciones = TRANSICIONES_VALIDAS[estadoActual]
  return transiciones?.[0] ?? null
}

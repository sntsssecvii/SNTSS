import type { TipoBolsaDeTrabajo, BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'

/**
 * Definición de una columna en un tipo de tabla PDF.
 */
export interface ColumnSchema {
  field: keyof BolsaDeTrabajoRegistro
  label: string
  required: boolean
  pattern?: RegExp
}

/**
 * Esquema completo de un tipo de tabla PDF.
 */
export interface TableSchema {
  tipo: TipoBolsaDeTrabajo
  nombre: string
  columnas: ColumnSchema[]
  requiredFields: (keyof BolsaDeTrabajoRegistro)[]
}

export const SCHEMAS: Record<TipoBolsaDeTrabajo, TableSchema> = {
  NUEVO_INGRESO: {
    tipo: 'NUEVO_INGRESO',
    nombre: 'Nuevo Ingreso',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: true, pattern: /^\d+$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'fecha', label: 'Fecha de Registro', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'grupo', label: 'Grupo', required: false },
      { field: 'calificacion', label: 'Calificación', required: false },
      { field: 'tipoContratacion', label: 'Tipo Contratación', required: false },
      { field: 'diasLaborados', label: 'Días Laborados', required: false, pattern: /^[\d,.NA/]+$/ },
      { field: 'estatus', label: 'Estatus', required: false, pattern: /^[A-Z]$/ },
      { field: 'observaciones', label: 'Observaciones', required: false },
    ],
    requiredFields: ['numeroProg', 'nombre', 'matricula', 'fecha'],
  },

  AMPLIACIONES_JORNADA: {
    tipo: 'AMPLIACIONES_JORNADA',
    nombre: 'Ampliaciones de Jornada',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: true, pattern: /^\d+$/ },
      { field: 'jornadaActual', label: 'Jornada Actual', required: true, pattern: /^\d+$/ },
      { field: 'adscripcionActualClave', label: 'Adscripción Actual (Clave)', required: true },
      { field: 'turnoActual', label: 'Turno Actual', required: true },
      { field: 'fecha', label: 'Fecha', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'estatus', label: 'Estatus', required: true, pattern: /^[A-Z]$/ },
      { field: 'diasLaborados', label: 'Días Laborados', required: true, pattern: /^[\d,]+$/ },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: true, pattern: /^[MF]$/ },
      { field: 'adscripcionNuevaClave', label: 'Adscripción Nueva (Clave)', required: false },
      { field: 'adscripcionNuevaNombre', label: 'Adscripción Nueva (Nombre)', required: false },
      { field: 'numeroPlaza', label: 'No. Plaza', required: false, pattern: /^\d+$/ },
      { field: 'jornadaNueva', label: 'Jornada Nueva', required: false },
      { field: 'turnoNueva', label: 'Turno Nuevo', required: false },
    ],
    requiredFields: ['numeroProg', 'matricula', 'nombre', 'fecha', 'jornadaActual'],
  },

  CAMBIOS_AREA: {
    tipo: 'CAMBIOS_AREA',
    nombre: 'Cambios de Área',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false, pattern: /^[MF]$/ },
      { field: 'fecha', label: 'Fecha', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },

  CAMBIOS_RAMA: {
    tipo: 'CAMBIOS_RAMA',
    nombre: 'Cambios de Rama',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false, pattern: /^[MF]$/ },
      { field: 'fecha', label: 'Fecha', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },

  CAMBIOS_RESIDENCIA_DESTINO: {
    tipo: 'CAMBIOS_RESIDENCIA_DESTINO',
    nombre: 'Cambios de Residencia Destino',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: true, pattern: /^\d+$/ },
      { field: 'residenciaDestino', label: 'Residencia Destino', required: true },
      { field: 'cambioSolicitado', label: 'Cambio Solicitado', required: true },
      { field: 'fecha', label: 'Fecha', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'registro', label: 'Registro', required: true, pattern: /^[A-Z]$/ },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false, pattern: /^[MF]$/ },
      { field: 'clave', label: 'Clave', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha', 'residenciaDestino'],
  },

  CAMBIOS_RESIDENCIA_ORIGEN: {
    tipo: 'CAMBIOS_RESIDENCIA_ORIGEN',
    nombre: 'Cambios de Residencia Origen',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: true, pattern: /^\d+$/ },
      { field: 'residenciaOrigen', label: 'Residencia Origen', required: true },
      { field: 'cambioSolicitado', label: 'Cambio Solicitado', required: true },
      { field: 'fecha', label: 'Fecha', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'registro', label: 'Registro', required: true, pattern: /^[A-Z]$/ },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false, pattern: /^[MF]$/ },
      { field: 'clave', label: 'Clave', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha', 'residenciaOrigen'],
  },

  CAMBIOS_TIPO_PLAZA: {
    tipo: 'CAMBIOS_TIPO_PLAZA',
    nombre: 'Cambios de Tipo de Plaza',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'fecha', label: 'Fecha', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'registro', label: 'Registro', required: false, pattern: /^[A-Z]$/ },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'tipoPlazaAnterior', label: 'Tipo Plaza Anterior', required: false },
      { field: 'tipoPlazaNuevo', label: 'Tipo Plaza Nuevo', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },

  CAMBIOS_TURNO_ADSCRIPCION: {
    tipo: 'CAMBIOS_TURNO_ADSCRIPCION',
    nombre: 'Cambios de Turno y/o Adscripción',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'fecha', label: 'Fecha', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'registro', label: 'Registro', required: false, pattern: /^[A-Z]$/ },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'turnoAnterior', label: 'Turno Anterior', required: false },
      { field: 'turnoNuevo', label: 'Turno Nuevo', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },
}

/**
 * Valida un registro contra su esquema y retorna los campos que fallan.
 */
export function validateRegistro(
  registro: BolsaDeTrabajoRegistro,
  schema: TableSchema
): string[] {
  const errores: string[] = []

  for (const col of schema.columnas) {
    const valor = registro[col.field]

    if (col.required && (valor === undefined || valor === null || valor === '')) {
      errores.push(`Campo requerido '${col.label}' (${col.field}) está vacío`)
      continue
    }

    if (valor && col.pattern && typeof valor === 'string') {
      if (!col.pattern.test(valor)) {
        errores.push(`Campo '${col.label}' (${col.field}) no coincide con el patrón esperado: "${valor}"`)
      }
    }
  }

  return errores
}

/**
 * Obtiene el esquema para un tipo de tabla.
 */
export function getSchema(tipo: TipoBolsaDeTrabajo): TableSchema {
  return SCHEMAS[tipo]
}

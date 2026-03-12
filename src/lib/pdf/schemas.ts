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
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'jornadaNueva', label: 'Jornada Solicitada (Hrs)', required: false },
      { field: 'adscripcionNueva', label: 'Adscripción Solicitada (Clave)', required: false },
      { field: 'turnoNuevo', label: 'Turno Solicitado', required: false },
      { field: 'fecha', label: 'Fecha de Registro', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'estatus', label: 'Estatus', required: false },
      { field: 'numeroPlaza', label: 'No. Plaza', required: false },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false },
      { field: 'diasLaborados', label: 'Días Laborados', required: false },
      { field: 'adscripcionAnterior', label: 'Adscripción Actual', required: false },
      { field: 'turnoAnterior', label: 'Turno Actual', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },

  CAMBIOS_AREA: {
    tipo: 'CAMBIOS_AREA',
    nombre: 'Cambios de Área',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'registro', label: 'Tipo de Cambio', required: false },
      { field: 'adscripcionNueva', label: 'Adscripción Solicitada (Clave)', required: false },
      { field: 'turnoNuevo', label: 'Turno Solicitado', required: false },
      { field: 'jornadaNueva', label: 'Jornada Solicitada', required: false },
      { field: 'fecha', label: 'Fecha de Registro', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'estatus', label: 'Estatus', required: false },
      { field: 'numeroPlaza', label: 'No. Plaza', required: false },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false },
      { field: 'adscripcionAnterior', label: 'Adscripción Actual', required: false },
      { field: 'turnoAnterior', label: 'Turno Actual', required: false },
      { field: 'jornadaActual', label: 'Jornada Actual', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },

  CAMBIOS_RAMA: {
    tipo: 'CAMBIOS_RAMA',
    nombre: 'Cambios de Rama',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'ramaNueva', label: 'Rama Solicitada', required: false },
      { field: 'calificacion', label: 'Puntos de Evaluación', required: false },
      { field: 'fecha', label: 'Fecha de Registro', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'estatus', label: 'Estatus', required: false },
      { field: 'numeroPlaza', label: 'No. Plaza', required: false },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false },
      { field: 'adscripcionAnterior', label: 'Adscripción Actual', required: false },
      { field: 'jornadaActual', label: 'Jornada Actual', required: false },
      { field: 'turnoAnterior', label: 'Turno Actual', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },

  CAMBIOS_RESIDENCIA_DESTINO: {
    tipo: 'CAMBIOS_RESIDENCIA_DESTINO',
    nombre: 'Cambios de Residencia Destino',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'delegacionDestino', label: 'Delegación Destino', required: false },
      { field: 'turnoNuevo', label: 'Turno Solicitado', required: false },
      { field: 'fecha', label: 'Fecha de Registro', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'estatus', label: 'Estatus', required: false },
      { field: 'numeroPlaza', label: 'No. Plaza', required: false },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false },
      { field: 'adscripcionAnterior', label: 'Adscripción Actual', required: false },
      { field: 'jornadaActual', label: 'Jornada Actual', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },

  CAMBIOS_RESIDENCIA_ORIGEN: {
    tipo: 'CAMBIOS_RESIDENCIA_ORIGEN',
    nombre: 'Cambios de Residencia Origen',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'delegacionOrigen', label: 'Delegación Origen', required: false },
      { field: 'turnoNuevo', label: 'Turno Solicitado', required: false },
      { field: 'fecha', label: 'Fecha de Registro', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'estatus', label: 'Estatus', required: false },
      { field: 'numeroPlaza', label: 'No. Plaza', required: false },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false },
      { field: 'adscripcionAnterior', label: 'Adscripción Actual', required: false },
      { field: 'jornadaActual', label: 'Jornada Actual', required: false },
      { field: 'turnoAnterior', label: 'Turno Actual', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },

  CAMBIOS_TIPO_PLAZA: {
    tipo: 'CAMBIOS_TIPO_PLAZA',
    nombre: 'Cambios de Tipo de Plaza',
    columnas: [
      { field: 'numeroProg', label: 'No. Prog', required: false, pattern: /^\d+$/ },
      { field: 'registro', label: 'Tipo de Cambio', required: false },
      { field: 'adscripcionNueva', label: 'Adscripción Solicitada (Clave)', required: false },
      { field: 'turnoNuevo', label: 'Turno Solicitado', required: false },
      { field: 'fecha', label: 'Fecha de Registro', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'estatus', label: 'Estatus', required: false },
      { field: 'numeroPlaza', label: 'No. Plaza', required: false },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'sexo', label: 'Sexo', required: false },
      { field: 'adscripcionAnterior', label: 'Adscripción Actual', required: false },
      { field: 'jornadaActual', label: 'Jornada Actual', required: false },
      { field: 'turnoAnterior', label: 'Turno Actual', required: false },
    ],
    requiredFields: ['matricula', 'nombre', 'fecha'],
  },

  CAMBIOS_TURNO_ADSCRIPCION: {
    tipo: 'CAMBIOS_TURNO_ADSCRIPCION',
    nombre: 'Cambios de Turno y/o Adscripción',
    columnas: [
      { field: 'numeroProg', label: 'No. Progresivo', required: false, pattern: /^\d+$/ },
      { field: 'registro', label: 'Tipo de Cambio', required: false }, // CAT/CAD
      { field: 'adscripcionNueva', label: 'Adscripción Solicitada', required: false },
      { field: 'turnoNuevo', label: 'Turno Solicitado', required: false },
      { field: 'fecha', label: 'Fecha de Registro', required: true, pattern: /^\d{2}\/\d{2}\/\d{4}$/ },
      { field: 'estatus', label: 'Estatus', required: false },
      { field: 'sexo', label: 'Sexo', required: false },
      { field: 'diasLaborados', label: 'Días Laborados', required: false },
      { field: 'matricula', label: 'Matrícula', required: true, pattern: /^\d{7,10}$/ },
      { field: 'nombre', label: 'Nombre', required: true },
      { field: 'adscripcionAnterior', label: 'Adscripción Actual', required: false },
      { field: 'turnoAnterior', label: 'Turno Actual', required: false },
      { field: 'numeroPlaza', label: 'No. Plaza', required: false },
      { field: 'jornadaActual', label: 'Jornada', required: false },
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

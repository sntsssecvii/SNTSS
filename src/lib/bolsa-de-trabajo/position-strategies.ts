import type { PositionResult, PositionStrategy } from '@/lib/bolsa-de-trabajo/position-contracts'
import type { PositionEngineContext } from '@/lib/bolsa-de-trabajo/position-engine'
import type { TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

function withExplanation(result: PositionResult, explanation: string): PositionResult {
  return {
    ...result,
    explicacion: explanation,
  }
}

function normalizeLabel(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function isZonaIncondicional(value?: string): boolean {
  return normalizeLabel(value) === 'INCONDICIONAL'
}

export const nuevoIngresoStrategy: PositionStrategy = {
  tipo: 'NUEVO_INGRESO',
  buildGroupKey(record) {
    return `${record.zona || ''}::${record.categoria || ''}`
  },
  buildGroupInfo(record) {
    return {
      zona: record.zona,
      categoria: record.categoria,
    }
  },
  getSortValue(record) {
    return record.numeroProg
  },
  shouldDeduplicateByMatricula() {
    return true
  },
  computeSecondaryMetrics(records, target) {
    const eventuales = records.filter((record) => record.tipoContratacion === '8')
    const esEventual = target.tipoContratacion === '8'

    return {
      totalEventualesEnCategoria: eventuales.length,
      posicionInterinato: esEventual
        ? eventuales.findIndex((record) => record.matricula === target.matricula) + 1
        : 0,
    }
  },
  explain(result, target) {
    if (target.tipoContratacion === '8') {
      return `Posicion calculada por consecutivo oficial dentro de ${target.categoria || 'la categoria'} en ${target.zona || 'la zona'}, con posicion adicional entre eventuales.`
    }

    return `Posicion calculada por consecutivo oficial dentro de ${target.categoria || 'la categoria'} en ${target.zona || 'la zona'}.`
  },
}

export const cambiosTurnoAdscripcionStrategy: PositionStrategy = {
  tipo: 'CAMBIOS_TURNO_ADSCRIPCION',
  buildGroupKey(record) {
    const turno = record.registro === 'CAT' ? record.turnoNuevo || '' : ''
    return `${record.zona || ''}::${record.categoria || ''}::${record.registro || ''}::${record.adscripcionNueva || ''}::${turno}`
  },
  buildGroupInfo(record) {
    return {
      zona: record.zona,
      categoria: record.categoria,
      registro: record.registro,
      adscripcionNueva: record.adscripcionNueva,
      turnoNuevo: record.registro === 'CAT' ? record.turnoNuevo : undefined,
    }
  },
  getSortValue(record) {
    return record.numeroProg
  },
  shouldDeduplicateByMatricula() {
    return true
  },
  explain(result, target) {
    if (target.registro === 'CAT') {
      return `Posicion calculada por consecutivo oficial dentro del grupo ${target.categoria || 'categoria'} / ${target.zona || 'zona'} / CAT / ${target.adscripcionNueva || 'adscripcion'} / ${target.turnoNuevo || 'turno'}.`
    }

    return `Posicion calculada por consecutivo oficial dentro del grupo ${target.categoria || 'categoria'} / ${target.zona || 'zona'} / ${target.registro || 'registro'} / ${target.adscripcionNueva || 'adscripcion'}.`
  },
}

function buildSimpleZoneCategoryStrategy(tipo: TipoBolsaDeTrabajo, descripcion: string): PositionStrategy {
  return {
    tipo,
    buildGroupKey(record) {
      return `${record.zona || ''}::${record.categoria || ''}`
    },
    buildGroupInfo(record) {
      return {
        zona: record.zona,
        categoria: record.categoria,
      }
    },
    getSortValue(record) {
      return record.numeroProg
    },
    shouldDeduplicateByMatricula() {
      return true
    },
    explain(_result, target) {
      return `Posicion calculada por consecutivo oficial dentro de ${descripcion} para ${target.categoria || 'la categoria'} en ${target.zona || 'la zona'}.`
    },
  }
}

function buildSimpleZoneTurnStrategy(tipo: TipoBolsaDeTrabajo, descripcion: string): PositionStrategy {
  return {
    tipo,
    buildGroupKey(record) {
      return `${record.zona || ''}::${record.turnoNuevo || ''}`
    },
    buildGroupInfo(record) {
      return {
        zona: record.zona,
        turnoNuevo: record.turnoNuevo,
      }
    },
    getSortValue(record) {
      return record.numeroProg
    },
    shouldDeduplicateByMatricula() {
      return true
    },
    explain(_result, target) {
      return `Posicion calculada por consecutivo oficial dentro de ${descripcion} para ${target.zona || 'la zona'} y turno ${target.turnoNuevo || 'sin turno'}.`
    },
  }
}

export const cambiosAreaStrategy = buildSimpleZoneCategoryStrategy(
  'CAMBIOS_AREA',
  'cambios de area'
)

export const cambiosTipoPlazaStrategy = buildSimpleZoneCategoryStrategy(
  'CAMBIOS_TIPO_PLAZA',
  'cambios de tipo de plaza'
)

export const cambiosResidenciaOrigenStrategy = buildSimpleZoneTurnStrategy(
  'CAMBIOS_RESIDENCIA_ORIGEN',
  'cambios de residencia origen'
)

export const cambiosResidenciaDestinoStrategy = buildSimpleZoneTurnStrategy(
  'CAMBIOS_RESIDENCIA_DESTINO',
  'cambios de residencia destino'
)

export const ampliacionesJornadaStrategy: PositionStrategy = {
  tipo: 'AMPLIACIONES_JORNADA',
  buildGroupKey(record) {
    return `${record.jornadaNueva || ''}::${record.adscripcionNueva || ''}::${record.turnoNuevo || ''}`
  },
  buildGroupInfo(record) {
    return {
      jornadaNueva: record.jornadaNueva,
      adscripcionNueva: record.adscripcionNueva,
      turnoNuevo: record.turnoNuevo,
    }
  },
  getSortValue(record) {
    return record.numeroProg
  },
  shouldDeduplicateByMatricula() {
    return true
  },
  explain(_result, target) {
    return `Posicion calculada por consecutivo oficial dentro del grupo ${target.jornadaNueva || 'jornada'} / ${target.adscripcionNueva || 'adscripcion'} / ${target.turnoNuevo || 'turno'}.`
  },
}

export const cambiosRamaStrategy: PositionStrategy = {
  tipo: 'CAMBIOS_RAMA',
  buildGroupKey(record) {
    return `${record.categoria || ''}`
  },
  buildGroupInfo(record) {
    return {
      categoria: record.categoria,
      zona: record.zona,
    }
  },
  getSortValue(record) {
    return record.numeroProg
  },
  shouldDeduplicateByMatricula() {
    return true
  },
  selectComparableRecords(records, target) {
    const mismaCategoria = records.filter((record) => record.categoria === target.categoria)

    if (isZonaIncondicional(target.zona)) {
      return mismaCategoria.filter((record) => isZonaIncondicional(record.zona))
    }

    return mismaCategoria.filter((record) =>
      record.zona === target.zona || isZonaIncondicional(record.zona)
    )
  },
  applyPriorityRules(records, target) {
    if (isZonaIncondicional(target.zona)) return records

    const prioritarios = records.filter((record) => isZonaIncondicional(record.zona))
    const mismaZona = records.filter((record) => record.zona === target.zona)
    return [...prioritarios, ...mismaZona]
  },
  explain(_result, target) {
    if (isZonaIncondicional(target.zona)) {
      return `Posicion calculada por consecutivo oficial dentro del grupo incondicional de ${target.categoria || 'la categoria'}.`
    }

    return `Posicion calculada por consecutivo oficial dentro de ${target.categoria || 'la categoria'} en ${target.zona || 'la zona'}, priorizando primero a la zona incondicional.`
  },
}

export const positionStrategies: Partial<Record<TipoBolsaDeTrabajo, PositionStrategy>> = {
  NUEVO_INGRESO: nuevoIngresoStrategy,
  CAMBIOS_TURNO_ADSCRIPCION: cambiosTurnoAdscripcionStrategy,
  AMPLIACIONES_JORNADA: ampliacionesJornadaStrategy,
  CAMBIOS_AREA: cambiosAreaStrategy,
  CAMBIOS_RAMA: cambiosRamaStrategy,
  CAMBIOS_TIPO_PLAZA: cambiosTipoPlazaStrategy,
  CAMBIOS_RESIDENCIA_ORIGEN: cambiosResidenciaOrigenStrategy,
  CAMBIOS_RESIDENCIA_DESTINO: cambiosResidenciaDestinoStrategy,
}

export function buildStrategyResult(context: PositionEngineContext, strategy: PositionStrategy): PositionResult {
  const baseResult: PositionResult = {
    matricula: context.target.matricula,
    nombre: context.target.nombre || '',
    categoria: context.target.categoria || '',
    zona: context.target.zona || '',
    tipoDocumento: context.tipoDocumento,
    tipoContratacion: context.target.tipoContratacion,
    adscripcionNueva: context.target.adscripcionNueva,
    turnoNuevo: context.target.turnoNuevo,
    posicionBase: context.posicionBase,
    totalEnCategoria: context.uniqueRecords.length,
    grupoComparable: strategy.buildGroupInfo(context.target),
    sortValue: strategy.getSortValue(context.target),
    reglasAplicadas: ['sort:numeroProg', 'dedupe:matricula', `strategy:${strategy.tipo}`],
  }

  const secondaryMetrics = strategy.computeSecondaryMetrics?.(context.uniqueRecords, context.target)

  const result: PositionResult = {
    ...baseResult,
    metricasSecundarias: secondaryMetrics,
    posicionInterinato: secondaryMetrics?.posicionInterinato || undefined,
    totalEventualesEnCategoria: secondaryMetrics?.totalEventualesEnCategoria,
  }

  return withExplanation(result, strategy.explain(result, context.target))
}

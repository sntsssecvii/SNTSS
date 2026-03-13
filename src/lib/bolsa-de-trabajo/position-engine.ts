import type { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import type { NormalizedPositionRecord, PositionResult, PositionStrategy } from '@/lib/bolsa-de-trabajo/position-contracts'

export interface PositionEngineOptions {
  tipoDocumento: TipoBolsaDeTrabajo
  matriculaBuscada: string
  buildResult?: (context: PositionEngineContext) => PositionResult
  strategy?: PositionStrategy
}

export interface PositionEngineContext {
  tipoDocumento: TipoBolsaDeTrabajo
  target: NormalizedPositionRecord
  normalizedRecords: NormalizedPositionRecord[]
  orderedRecords: NormalizedPositionRecord[]
  comparableRecords: NormalizedPositionRecord[]
  uniqueRecords: NormalizedPositionRecord[]
  posicionBase: number
}

export function normalizePositionRecord(record: BolsaDeTrabajoRegistro): NormalizedPositionRecord | null {
  if (!record.matricula) return null

  const turnoRaw =
    record.turnoNuevo ||
    record.turnoNueva ||
    (
      (record.tipoDocumento === 'CAMBIOS_RESIDENCIA_ORIGEN' || record.tipoDocumento === 'CAMBIOS_RESIDENCIA_DESTINO')
        ? record.cambioSolicitado
        : undefined
    )
  const turnoNormalizado = turnoRaw ? turnoRaw.toUpperCase() : undefined

  return {
    id: record.id,
    tipoDocumento: record.tipoDocumento,
    matricula: record.matricula,
    nombre: record.nombre,
    numeroProg: parseInt(record.numeroProg || '999999'),
    zona: record.zona,
    categoria: record.categoria,
    subcategoria: record.subcategoria,
    grupo: record.grupo,
    registro: record.registro,
    adscripcionNueva: record.adscripcionNueva,
    turnoNuevo: turnoNormalizado,
    jornadaNueva: record.jornadaNueva,
    tipoContratacion: record.tipoContratacion,
    source: record,
  }
}

export function normalizePositionRecords(records: BolsaDeTrabajoRegistro[]): NormalizedPositionRecord[] {
  return records
    .map(normalizePositionRecord)
    .filter((record): record is NormalizedPositionRecord => record !== null)
}

export function sortPositionRecords(records: NormalizedPositionRecord[]): NormalizedPositionRecord[] {
  return [...records].sort((a, b) => a.numeroProg - b.numeroProg)
}

export function dedupePositionRecords(records: NormalizedPositionRecord[]): NormalizedPositionRecord[] {
  const seen = new Set<string>()
  const uniqueRecords: NormalizedPositionRecord[] = []

  records.forEach((record) => {
    if (seen.has(record.matricula)) return
    seen.add(record.matricula)
    uniqueRecords.push(record)
  })

  return uniqueRecords
}

export function buildDefaultPositionResult(context: PositionEngineContext): PositionResult {
  const { tipoDocumento, target, uniqueRecords, posicionBase } = context

  return {
    matricula: target.matricula,
    nombre: target.nombre || '',
    categoria: target.categoria || '',
    zona: target.zona || '',
    tipoDocumento,
    tipoContratacion: target.tipoContratacion,
    adscripcionNueva: target.adscripcionNueva,
    turnoNuevo: target.turnoNuevo,
    posicionBase,
    totalEnCategoria: uniqueRecords.length,
    grupoComparable: {
      zona: target.zona,
      categoria: target.categoria,
      subcategoria: target.subcategoria,
      grupo: target.grupo,
      registro: target.registro,
      adscripcionNueva: target.adscripcionNueva,
      turnoNuevo: target.turnoNuevo,
      jornadaNueva: target.jornadaNueva,
    },
    sortValue: target.numeroProg,
    reglasAplicadas: ['sort:numeroProg', 'dedupe:matricula'],
  }
}

export function runPositionEngine(
  records: BolsaDeTrabajoRegistro[],
  options: PositionEngineOptions
): PositionResult | null {
  const normalizedRecords = normalizePositionRecords(records)
  const strategy = options.strategy
  const orderedRecords = [...normalizedRecords].sort((a, b) => {
    const sortA = strategy ? strategy.getSortValue(a) : a.numeroProg
    const sortB = strategy ? strategy.getSortValue(b) : b.numeroProg
    return sortA - sortB
  })
  const orderedTarget = orderedRecords.find((record) => record.matricula === options.matriculaBuscada)
  if (!orderedTarget) return null

  let comparableRecords = strategy?.selectComparableRecords
    ? strategy.selectComparableRecords(orderedRecords, orderedTarget)
    : strategy
      ? orderedRecords.filter((record) => strategy.buildGroupKey(record) === strategy.buildGroupKey(orderedTarget))
      : orderedRecords

  if (strategy?.applyPriorityRules) {
    comparableRecords = strategy.applyPriorityRules(comparableRecords, orderedTarget)
  }

  const uniqueRecords = strategy && !strategy.shouldDeduplicateByMatricula()
    ? comparableRecords
    : dedupePositionRecords(comparableRecords)
  const posicionBase = uniqueRecords.findIndex((record) => record.matricula === options.matriculaBuscada) + 1

  if (posicionBase === 0) return null

  const target = uniqueRecords.find((record) => record.matricula === options.matriculaBuscada)
  if (!target) return null

  const context: PositionEngineContext = {
    tipoDocumento: options.tipoDocumento,
    target,
    normalizedRecords,
    orderedRecords,
    comparableRecords,
    uniqueRecords,
    posicionBase,
  }

  return options.buildResult ? options.buildResult(context) : buildDefaultPositionResult(context)
}

import type { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

export interface PositionGroupInfo {
  zona?: string
  categoria?: string
  subcategoria?: string
  grupo?: string
  registro?: string
  adscripcionNueva?: string
  turnoNuevo?: string
  jornadaNueva?: string
  [key: string]: string | undefined
}

export interface NormalizedPositionRecord {
  id: string
  tipoDocumento: TipoBolsaDeTrabajo
  matricula: string
  nombre?: string
  numeroProg: number
  zona?: string
  categoria?: string
  subcategoria?: string
  grupo?: string
  registro?: string
  adscripcionNueva?: string
  turnoNuevo?: string
  jornadaNueva?: string
  tipoContratacion?: string
  source: BolsaDeTrabajoRegistro
}

export interface PositionResult {
  matricula: string
  nombre: string
  categoria: string
  zona: string
  tipoDocumento: TipoBolsaDeTrabajo
  posicionBase: number
  totalEnCategoria: number
  posicionInterinato?: number
  totalEventualesEnCategoria?: number
  tipoContratacion?: string
  adscripcionNueva?: string
  turnoNuevo?: string
  grupoComparable?: PositionGroupInfo
  sortValue?: number
  metricasSecundarias?: Record<string, number>
  reglasAplicadas?: string[]
  explicacion?: string
}

export interface PositionStrategy {
  tipo: TipoBolsaDeTrabajo
  buildGroupKey(record: NormalizedPositionRecord): string
  buildGroupInfo(record: NormalizedPositionRecord): PositionGroupInfo
  getSortValue(record: NormalizedPositionRecord): number
  shouldDeduplicateByMatricula(): boolean
  selectComparableRecords?(
    records: NormalizedPositionRecord[],
    target: NormalizedPositionRecord
  ): NormalizedPositionRecord[]
  applyPriorityRules?(
    records: NormalizedPositionRecord[],
    target: NormalizedPositionRecord
  ): NormalizedPositionRecord[]
  computeSecondaryMetrics?(
    records: NormalizedPositionRecord[],
    target: NormalizedPositionRecord
  ): Record<string, number>
  explain(
    result: PositionResult,
    target: NormalizedPositionRecord
  ): string
}

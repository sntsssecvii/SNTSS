import type { PositionResult } from '@/lib/bolsa-de-trabajo/position-contracts'
import type {
  BolsaPosicionMaterializada,
  PeriodoBolsa,
  TipoBolsaDeTrabajo,
} from '@/types/bolsa-de-trabajo'

export const POSITION_LOOKUP_COLLECTION = 'bolsa_posiciones_materializadas'
export const POSITION_LOOKUP_VERSION = 'v2'

function normalizeMatricula(matricula: string): string {
  return matricula.trim().toUpperCase()
}

export function buildBolsaPositionLookupId(
  syncId: string,
  matricula: string,
  tipoDocumento: TipoBolsaDeTrabajo,
  recordId?: string
): string {
  const suffix = recordId?.trim() || 'no-record-id'
  return `${syncId}__${normalizeMatricula(matricula)}__${tipoDocumento}__${suffix}`
}

interface BuildBolsaPositionLookupParams {
  syncId: string
  documentoId: string
  periodo: PeriodoBolsa
  resultado: PositionResult
}

export function buildBolsaPositionLookup({
  syncId,
  documentoId,
  periodo,
  resultado,
}: BuildBolsaPositionLookupParams): BolsaPosicionMaterializada {
  return {
    id: buildBolsaPositionLookupId(syncId, resultado.matricula, resultado.tipoDocumento, resultado.recordId),
    syncId,
    matricula: normalizeMatricula(resultado.matricula),
    recordId: resultado.recordId,
    tipoDocumento: resultado.tipoDocumento,
    documentoId,
    periodo,
    versionCalculo: POSITION_LOOKUP_VERSION,
    fechaMaterializacion: new Date(),
    nombre: resultado.nombre,
    categoria: resultado.categoria,
    zona: resultado.zona,
    posicionBase: resultado.posicionBase,
    totalEnCategoria: resultado.totalEnCategoria,
    posicionInterinato: resultado.posicionInterinato,
    totalEventualesEnCategoria: resultado.totalEventualesEnCategoria,
    tipoContratacion: resultado.tipoContratacion,
    adscripcionNueva: resultado.adscripcionNueva,
    turnoNuevo: resultado.turnoNuevo,
    grupoComparable: resultado.grupoComparable,
    sortValue: resultado.sortValue,
    metricasSecundarias: resultado.metricasSecundarias,
    reglasAplicadas: resultado.reglasAplicadas,
    explicacion: resultado.explicacion,
  }
}

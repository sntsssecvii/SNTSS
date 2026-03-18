import { calcularPosiciones } from '@/lib/bolsa-de-trabajo/calculos'
import { getComparisonRecordsForWorker } from '@/lib/bolsa-de-trabajo/comparison-groups'
import { buildBolsaPositionLookup } from '@/lib/bolsa-de-trabajo/position-materialization'
import type {
  BolsaDeTrabajoRegistro,
  BolsaPosicionMaterializada,
  PeriodoBolsa,
  TipoBolsaDeTrabajo,
} from '@/types/bolsa-de-trabajo'

interface MaterializeDocumentParams {
  syncId: string
  documentoId: string
  tipoDocumento: TipoBolsaDeTrabajo
  periodo: PeriodoBolsa
  registros: BolsaDeTrabajoRegistro[]
}

export function materializeDocumentPositions({
  syncId,
  documentoId,
  tipoDocumento,
  periodo,
  registros,
}: MaterializeDocumentParams): BolsaPosicionMaterializada[] {
  return registros
    .map((targetRecord) => {
      const matricula = targetRecord.matricula?.trim().toUpperCase()
      if (!matricula) {
        return null
      }

      const comparisonRecords = getComparisonRecordsForWorker(registros, targetRecord, tipoDocumento)
      const resultado = calcularPosiciones(comparisonRecords, matricula, tipoDocumento, {
        targetRecordId: targetRecord.id,
      })

      if (!resultado) {
        return null
      }

      return buildBolsaPositionLookup({
        syncId,
        documentoId,
        periodo,
        resultado,
      })
    })
    .filter((lookup): lookup is BolsaPosicionMaterializada => lookup !== null)
}

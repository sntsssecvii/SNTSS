import type { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

function buildGroupKey(record: BolsaDeTrabajoRegistro, tipo: TipoBolsaDeTrabajo) {
  let key = `${record.categoria || ''}-${record.zona || ''}`

  if (tipo === 'NUEVO_INGRESO') {
    return `${record.categoria || ''}-${record.zona || ''}-${record.subcategoria || ''}`
  }

  if (tipo === 'AMPLIACIONES_JORNADA') {
    return `${record.jornadaNueva || ''}-${record.adscripcionNueva || ''}-${record.turnoNuevo || ''}`
  }

  if (tipo === 'CAMBIOS_RAMA') {
    return `${record.categoria || ''}`
  }

  if (tipo === 'CAMBIOS_TURNO_ADSCRIPCION') {
    key += `-${record.registro || ''}-${record.adscripcionNueva || ''}`
    if (record.registro === 'CAT') {
      key += `-${record.turnoNuevo || ''}`
    }
  }

  return key
}

export function getComparisonRecordsForWorker(
  registros: BolsaDeTrabajoRegistro[],
  target: BolsaDeTrabajoRegistro,
  tipo: TipoBolsaDeTrabajo
) {
  if (
    tipo !== 'NUEVO_INGRESO' &&
    tipo !== 'AMPLIACIONES_JORNADA' &&
    tipo !== 'CAMBIOS_TURNO_ADSCRIPCION' &&
    tipo !== 'CAMBIOS_RAMA'
  ) {
    return registros
  }

  const targetKey = buildGroupKey(target, tipo)
  return registros.filter((record) => buildGroupKey(record, tipo) === targetKey)
}

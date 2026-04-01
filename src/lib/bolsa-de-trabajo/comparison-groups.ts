import type { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

function normalizeLabel(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function buildGroupKey(record: BolsaDeTrabajoRegistro, tipo: TipoBolsaDeTrabajo) {
  let key = `${record.categoria || ''}-${record.subcategoria || ''}-${record.zona || ''}`

  if (tipo === 'NUEVO_INGRESO') {
    return `${record.categoria || ''}-${record.zona || ''}-${record.subcategoria || ''}`
  }

  if (tipo === 'AMPLIACIONES_JORNADA') {
    return `${record.categoria || ''}-${record.subcategoria || ''}-${record.adscripcionNueva || ''}-${record.turnoNuevo || ''}`
  }

  if (tipo === 'CAMBIOS_RESIDENCIA_ORIGEN' || tipo === 'CAMBIOS_RESIDENCIA_DESTINO') {
    return `${record.zona || ''}-${record.categoria || ''}-${record.subcategoria || ''}-${record.turnoNuevo || ''}`
  }

  if (tipo === 'CAMBIOS_RAMA') {
    return `${record.categoria || ''}-${record.subcategoria || ''}`
  }

  if (tipo === 'CAMBIOS_TURNO_ADSCRIPCION') {
    key += `-${normalizeLabel(record.registro)}-${record.adscripcionNueva || ''}-${record.turnoNuevo || ''}`
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
    tipo !== 'CAMBIOS_RAMA' &&
    tipo !== 'CAMBIOS_RESIDENCIA_ORIGEN' &&
    tipo !== 'CAMBIOS_RESIDENCIA_DESTINO'
  ) {
    return registros
  }

  const targetKey = buildGroupKey(target, tipo)
  return registros.filter((record) => buildGroupKey(record, tipo) === targetKey)
}

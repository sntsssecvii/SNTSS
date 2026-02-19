import type { ParseResult } from '@/types/bolsa-de-trabajo'
import { parseUtils } from '../parser'
import { parseCambiosArea } from './cambiosArea'

export function parseCambiosRama(texto: string): ParseResult {
  const resultado = parseCambiosArea(texto)
  resultado.registros = resultado.registros.map((reg, idx) => ({
    ...reg,
    tipoDocumento: 'CAMBIOS_RAMA' as const,
    id: parseUtils.generarIdRegistro('CAMBIOS_RAMA', idx),
  }))
  return resultado
}

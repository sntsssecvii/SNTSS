import type { ParseResult, EscalafonRegistro } from '@/types/escalafon'
import { parseUtils } from '../parser'
import { parseCambiosArea } from './cambiosArea'

export function parseCambiosRama(texto: string): ParseResult {
  // Similar estructura a cambios de área pero con tipo diferente
  const resultado = parseCambiosArea(texto)
  // Actualizar tipo de documento en los registros
  resultado.registros = resultado.registros.map((reg) => ({
    ...reg,
    tipoDocumento: 'CAMBIOS_RAMA',
    id: parseUtils.generarIdRegistro('CAMBIOS_RAMA', resultado.registros.indexOf(reg)),
  }))
  return resultado
}

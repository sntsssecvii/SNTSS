import type { ParseResult, EscalafonRegistro } from '@/types/escalafon'
import { parseUtils } from '../parser'

export function parseCambiosTipoPlaza(texto: string): ParseResult {
  // Similar estructura a otros cambios
  const registros: EscalafonRegistro[] = []
  const errores: string[] = []
  let zonaActual = ''
  let categoriaActual = ''

  const lineas = parseUtils.dividirLineas(texto)

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    if (linea.startsWith('Zona ')) {
      zonaActual = linea.replace('Zona ', '').trim()
      continue
    }

    const categoriaMatch = linea.match(/^(\d{6})\s*-\s*(.+)$/)
    if (categoriaMatch) {
      categoriaActual = linea.trim()
      continue
    }

    if (
      parseUtils.esEncabezado(linea) ||
      linea.includes('--') ||
      linea.includes('of') ||
      linea.includes('IMSS-SIAP')
    ) {
      continue
    }

    // Buscar patrón similar a otros cambios
    const partes = linea.split(/\s+/).filter((p) => p.length > 0)
    const matriculaIndex = partes.findIndex((p) => p.match(/^\d{8}$/))

    if (matriculaIndex > 0 && matriculaIndex < partes.length - 2) {
      const fecha = partes.find((p) => p.match(/^\d{2}\/\d{2}\/\d{4}$/)) || ''
      const registro = partes.find((p) => p === 'A' || p === 'B') || ''
      const matricula = partes[matriculaIndex]
      const nombre = partes.slice(matriculaIndex + 1, -2).join(' ')
      const tipoPlazaAnterior = partes[partes.length - 2] || ''
      const tipoPlazaNuevo = partes[partes.length - 1] || ''

      const registroObj: EscalafonRegistro = {
        id: parseUtils.generarIdRegistro('CAMBIOS_TIPO_PLAZA', registros.length),
        tipoDocumento: 'CAMBIOS_TIPO_PLAZA',
        tipoPlazaAnterior,
        tipoPlazaNuevo,
        fecha,
        registro,
        matricula,
        nombre,
        zona: zonaActual,
        categoria: categoriaActual,
        confianza: 0.8,
        filaOriginal: i + 1,
        necesitaValidacion: true,
      }

      registros.push(registroObj)
    }
  }

  return {
    registros,
    metadata: {
      zona: zonaActual || undefined,
      categoria: categoriaActual || undefined,
    },
    errores,
  }
}

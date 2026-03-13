import type { ParseResult, BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'
import { parseUtils } from '../parser'
import { dividirLineas, debeDescartarLinea, limpiarFooter } from '../preprocessing'
import { SCHEMAS, validateRegistro } from '../schemas'

const schema = SCHEMAS.CAMBIOS_AREA

export function parseCambiosArea(texto: string): ParseResult {
  const registros: BolsaDeTrabajoRegistro[] = []
  const errores: string[] = []
  let zonaActual = ''
  let categoriaActual = ''
  let subcategoriaActual = ''

  const lineas = dividirLineas(texto)

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (!linea) continue

    if (linea.startsWith('Zona ')) {
      zonaActual = linea.replace('Zona ', '').trim()
      continue
    }

    const categoriaMatch = linea.match(/^(\d{6})\s*-\s*(.+)$/)
    if (categoriaMatch) {
      categoriaActual = linea.trim()
      subcategoriaActual = ''
      continue
    }

    const subcategoriaMatch = linea.match(/^(\d{1,3})\s+([A-ZÁÉÍÓÚÑ\s.-]{5,})$/)
    if (subcategoriaMatch && !linea.includes('Matrícula') && !linea.includes('Nombre')) {
      const posibleNombre = subcategoriaMatch[2].trim()
      if (posibleNombre.length > 5 && !posibleNombre.includes('/') && !posibleNombre.includes('&')) {
        subcategoriaActual = `${subcategoriaMatch[1]} ${posibleNombre}`
      }
      continue
    }

    if (debeDescartarLinea(linea) || linea.includes('of') || linea.includes('IMSS-SIAP')) {
      continue
    }

    const lineaLimpia = limpiarFooter(linea)
    if (!lineaLimpia) continue

    const partes = lineaLimpia.split(/\s+/).filter((p) => p.length > 0)
    const matriculaIdx = partes.findIndex((p) => /^\d{7,10}$/.test(p))
    const fechaIdx = partes.findIndex((p) => /^\d{2}\/\d{2}\/\d{4}$/.test(p))

    if (matriculaIdx !== -1 && fechaIdx !== -1) {
      const numProg = /^\d+$/.test(partes[0]) ? partes[0] : ''
      const matricula = partes[matriculaIdx]
      const fecha = partes[fechaIdx]

      const sexIdx = partes.findIndex((p, idx) => idx > matriculaIdx && (p === 'M' || p === 'F'))

      const registroObj: BolsaDeTrabajoRegistro = {
        id: parseUtils.generarIdRegistro('CAMBIOS_AREA', registros.length),
        tipoDocumento: 'CAMBIOS_AREA',
        numeroProg: numProg,
        matricula,
        fecha,
        nombre: sexIdx !== -1
          ? partes.slice(matriculaIdx + 1, sexIdx).join(' ')
          : partes.slice(matriculaIdx + 1, matriculaIdx + 4).join(' '),
        sexo: sexIdx !== -1 ? partes[sexIdx] : '',
        zona: zonaActual,
        categoria: categoriaActual,
        subcategoria: subcategoriaActual || undefined,
        filaOriginal: i + 1,
        necesitaValidacion: true,
      }

      const validationErrors = validateRegistro(registroObj, schema)
      registroObj.confianza = validationErrors.length === 0 ? 0.9 : 0.7
      if (validationErrors.length > 0) {
        errores.push(`Fila ${i + 1}: ${validationErrors.join('; ')}`)
      }

      registros.push(registroObj)
    }
  }

  return {
    registros,
    metadata: {
      zona: zonaActual || undefined,
      categoria: categoriaActual || undefined,
      totalRegistros: registros.length,
      extraidoCon: 'PDF',
    },
    errores,
  }
}

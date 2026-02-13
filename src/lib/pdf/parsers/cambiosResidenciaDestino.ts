import type { ParseResult, EscalafonRegistro } from '@/types/escalafon'
import { parseUtils } from '../parser'

export function parseCambiosResidenciaDestino(texto: string): ParseResult {
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

    // Formato: "1 02 - BAJA CALIFORNIA Ves 25/03/2025 A 12,817 8769672 MANJARREZ/LAFARGA/JESUS ADRIAN M 26DL267202 0 8"
    const registroMatch = linea.match(/^(\d+)\s+02\s+-\s+BAJA CALIFORNIA\s+([A-Za-z]+)\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Z])\s+([\d,]+)\s+(\d{7,8})\s+([A-ZÁÉÍÓÚÑ\/\s]+)\s+([MF])\s+([A-Z0-9]+)\s+(\d+)\s+(\d+)$/)

    if (registroMatch) {
      const [
        ,
        numero,
        cambioSolicitado,
        fecha,
        registro,
        codigo1,
        matricula,
        nombreCompleto,
        genero,
        clave,
        codigo2,
        codigo3,
      ] = registroMatch

      const registroObj: EscalafonRegistro = {
        id: parseUtils.generarIdRegistro('CAMBIOS_RESIDENCIA_DESTINO', registros.length),
        tipoDocumento: 'CAMBIOS_RESIDENCIA_DESTINO',
        residenciaDestino: '02 - BAJA CALIFORNIA',
        cambioSolicitado: cambioSolicitado.trim(),
        fecha: fecha.trim(),
        registro: registro.trim(),
        matricula: matricula.trim(),
        nombre: nombreCompleto.trim(),
        clave: clave.trim(),
        zona: zonaActual,
        categoria: categoriaActual,
        confianza: 0.9,
        filaOriginal: i + 1,
        necesitaValidacion: false,
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

import type { ParseResult, BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'
import { parseUtils } from '../parser'
import { dividirLineas, debeDescartarLinea, limpiarFooter } from '../preprocessing'
import { SCHEMAS, validateRegistro } from '../schemas'

const schema = SCHEMAS.CAMBIOS_RAMA

/**
 * Parser específico para CAMBIOS DE RAMA.
 *
 * Formato de línea de datos del PDF:
 * numProg ramaSolicitada puntos fecha estatus plaza matricula NOMBRE sexo claveAdsc nombreAdsc dias jornada turno
 *
 * Ejemplo:
 * 1 2021003 99.99 13/12/2021 A 5,915 99026239 SALAZAR/CRUZ/OSCAR GUADALUPE M 02UA18210A JEFATURA DE MEDICINA FAMILIAR 23075 8 JAcum
 */
export function parseCambiosRama(texto: string): ParseResult {
  const registros: BolsaDeTrabajoRegistro[] = []
  const errores: string[] = []
  let zonaActual = ''
  let categoriaActual = ''

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
      continue
    }

    if (debeDescartarLinea(linea) || linea.includes('of') || linea.includes('IMSS-SIAP')) {
      continue
    }

    const lineaLimpia = limpiarFooter(linea)
    if (!lineaLimpia) continue

    const partes = lineaLimpia.split(/\s+/).filter((p) => p.length > 0)
    const fechaIdx = partes.findIndex((p) => /^\d{2}\/\d{2}\/\d{4}$/.test(p))
    // La matrícula viene DESPUÉS de la fecha (rama también tiene 7 dígitos, así que buscamos después de fecha)
    const matriculaIdx = partes.findIndex((p, idx) => idx > fechaIdx && /^\d{7,10}$/.test(p))

    if (fechaIdx === -1 || matriculaIdx === -1) continue

    // Formato: numProg ramaSolicitada puntos fecha estatus plaza matricula NOMBRE sexo claveAdsc ... dias jornada turno
    const numProg = /^\d+$/.test(partes[0]) ? partes[0] : ''
    const matricula = partes[matriculaIdx]
    const fecha = partes[fechaIdx]

    // Rama solicitada: está entre numProg y puntos/fecha
    // Si numProg existe, rama está en partes[1]; si no, puede variar
    const startIdx = numProg ? 1 : 0
    const ramaNueva = startIdx < fechaIdx ? partes[startIdx] : undefined

    // Puntos de evaluación: entre rama y fecha (normalmente partes[2] = "99.99")
    let calificacion: string | undefined
    if (startIdx + 1 < fechaIdx) {
      const posiblePuntos = partes[startIdx + 1]
      if (/^\d+(\.\d+)?$/.test(posiblePuntos)) {
        calificacion = posiblePuntos
      }
    }

    // Estatus: justo después de la fecha (partes[fechaIdx + 1])
    const estatus = fechaIdx + 1 < matriculaIdx ? partes[fechaIdx + 1] : undefined

    // No. Plaza: entre estatus y matrícula, puede tener coma (e.g., "5,915")
    let numeroPlaza: string | undefined
    if (fechaIdx + 2 <= matriculaIdx) {
      // Reconstruir la plaza (puede estar separada por espacio si tiene coma)
      const plazaParts = partes.slice(fechaIdx + 2, matriculaIdx)
      if (plazaParts.length > 0) {
        numeroPlaza = plazaParts.join('')
      }
    }

    // Sexo: buscar M o F después de la matrícula
    const sexIdx = partes.findIndex((p, idx) => idx > matriculaIdx && (p === 'M' || p === 'F'))

    // Nombre: entre matrícula y sexo
    const nombre = sexIdx !== -1
      ? partes.slice(matriculaIdx + 1, sexIdx).join(' ')
      : partes.slice(matriculaIdx + 1, matriculaIdx + 4).join(' ')

    const sexo = sexIdx !== -1 ? partes[sexIdx] : ''

    // Después del sexo: claveAdsc nombreAdsc dias jornada turno
    let adscripcionAnterior: string | undefined
    let diasLaborados: string | undefined
    let jornadaActual: string | undefined
    let turnoAnterior: string | undefined

    if (sexIdx !== -1) {
      // Clave de adscripción: patrón alfanumérico tipo "02UA18210A"
      const claveAdscIdx = sexIdx + 1
      if (claveAdscIdx < partes.length && /^\d{2}[A-Z]{2}/.test(partes[claveAdscIdx])) {
        // Buscar desde el final: turno, jornada, días laborados
        // Los últimos 3 campos numéricos/texto son: dias, jornada, turno
        const afterClave = partes.slice(claveAdscIdx + 1)

        // Buscar desde el final
        if (afterClave.length >= 3) {
          turnoAnterior = afterClave[afterClave.length - 1]
          jornadaActual = afterClave[afterClave.length - 2]
          diasLaborados = afterClave[afterClave.length - 3]

          // Nombre de adscripción: todo entre clave y días laborados
          const nombreAdscParts = afterClave.slice(0, afterClave.length - 3)
          if (nombreAdscParts.length > 0) {
            adscripcionAnterior = `${partes[claveAdscIdx]} ${nombreAdscParts.join(' ')}`
          } else {
            adscripcionAnterior = partes[claveAdscIdx]
          }
        } else {
          adscripcionAnterior = partes.slice(claveAdscIdx).join(' ')
        }
      }
    }

    const registroObj: BolsaDeTrabajoRegistro = {
      id: parseUtils.generarIdRegistro('CAMBIOS_RAMA', registros.length),
      tipoDocumento: 'CAMBIOS_RAMA',
      numeroProg: numProg,
      matricula,
      fecha,
      nombre,
      sexo,
      ramaNueva,
      calificacion,
      estatus,
      numeroPlaza,
      adscripcionAnterior,
      diasLaborados,
      jornadaActual,
      turnoAnterior,
      zona: zonaActual,
      categoria: categoriaActual,
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

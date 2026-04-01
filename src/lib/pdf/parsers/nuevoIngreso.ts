import type { BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'
import type { ParseResult } from '../parser'
import { parseUtils } from '../parser'
import { dividirLineas, esEncabezadoSeccion, dividirLineasPegadas } from '../preprocessing'
import { SCHEMAS, validateRegistro } from '../schemas'

const schema = SCHEMAS.NUEVO_INGRESO

function pareceContinuacionNombre(linea: string): boolean {
  const trimmed = linea.trim()
  if (!trimmed) return false
  if (/^\d+\s+[A-Z]/.test(trimmed)) return false
  if (trimmed.includes('@') || trimmed.includes('No. Prog') || trimmed.includes('Nombre')) return false
  const parteNombre = trimmed.split(/\d{2}\/\d{2}\/\d{4}/)[0]?.trim() || trimmed
  if (!parteNombre) return false
  if (!/^[A-ZÁÉÍÓÚÑa-záéíóúñ\/\s]+$/.test(parteNombre)) return false
  const palabras = parteNombre.split(/\s+/).filter(Boolean)
  if (palabras.length > 4 || parteNombre.length > 30) return false
  const noNombre = /\b(CARECE|TITULO|CEDULA|ESPECIALIDAD|expediente|completo|TRASLADO|OF)\b/i
  if (noNombre.test(parteNombre)) return false
  return true
}

function pareceContinuacionObservaciones(linea: string): boolean {
  const t = linea.trim()
  if (!t || t.length > 120) return false
  if (/^\d{1,2}\/\d{2}\/\d{4}$/.test(t)) return true
  if (/^\d{1,3},\d{3}\s+[A-Z]\b/.test(t)) return true
  if (/^(expediente|of\.|pendiente|fecha|de\s+fecha)/i.test(t)) return true
  return false
}

function pareceContinuacionData(linea: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}/.test(linea.trim())
}

function unirLineasPartidas(lineas: string[]): string[] {
  const resultado: string[] = []
  let i = 0

  while (i < lineas.length) {
    let linea = lineas[i]

    const empiezaConNumero = /^\d+\s+/.test(linea)
    const tieneMatricula = /\b\d{8,10}\b/.test(linea)
    const tieneFecha = /\d{2}\/\d{2}\/\d{4}/.test(linea)

    if (i + 1 < lineas.length) {
      const siguiente = lineas[i + 1].trim()

      const esNuevoRegistro = /^\d+\s+[A-Z]/.test(siguiente) && /\b\d{7,10}\b/.test(siguiente);
      const esRestoDatos =
        /^[\d,.]+(\s+[A-Z])?(\s+.*)?$/.test(siguiente) || // Número (+ Letra opcional) (+ Texto opcional)
        /^[A-Z](\s+.*)?$/.test(siguiente) ||              // Letra (+ Texto opcional)
        /^(expediente|of\.|pendiente|fecha|de\s+fecha|traslado|carece|titulo|cedula)/i.test(siguiente);

      if (empiezaConNumero && tieneMatricula && tieneFecha && (pareceContinuacionData(siguiente) || esRestoDatos) && !esNuevoRegistro) {
        linea = `${linea} ${siguiente}`
        i++
      } else if (empiezaConNumero && !tieneMatricula && !esEncabezadoSeccion(siguiente)) {
        let j = i + 1
        let buffer = linea
        let consumido = false
        while (j < lineas.length) {
          const l = lineas[j].trim()
          if (/^(\d+\s*)+$/.test(l) && l.length <= 10) break
          if (/^\d+\s+[A-Z]/.test(l)) break
          if (esEncabezadoSeccion(l)) break
          if (l.includes('@')) break
          buffer += ' ' + l
          j++
          consumido = true
          if (/\b\d{8,10}\b/.test(buffer)) break
        }
        if (consumido) {
          linea = buffer
          i = j - 1
        }
      } else if (empiezaConNumero && !tieneMatricula && /^\d{8,10}/.test(siguiente)) {
        linea = `${linea} ${siguiente}`
        i++
      }
    }

    resultado.push(linea)
    i++
  }
  return resultado
}

export function parseNuevoIngreso(texto: string): ParseResult {
  const registros: BolsaDeTrabajoRegistro[] = []
  const errores: string[] = []
  let zonaActual = ''
  let categoriaActual = ''
  let subcategoriaActual = ''

  const lineasRaw = dividirLineas(texto)
  let lineas = dividirLineasPegadas(lineasRaw)
  lineas = unirLineasPartidas(lineas)

  let nombresPendientes: { num: string; nombre: string }[] = []
  let matriculasPendientes: string[] = []

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (!linea) continue
    // Ignorar líneas auxiliares: solo dígitos en una o más columnas (ej. "1", "1 1" — tercera columna y similares)
    if (/^(\d+\s*)+$/.test(linea) && linea.length <= 10) continue

    if (linea.startsWith('Zona ')) {
      zonaActual = linea.replace('Zona ', '').trim()
      continue
    }

    // Detección de Categoría Principal (ej. "202100 - AUX DE ENFERMERIA GRAL")
    const categoriaMatch = linea.match(/^(\d{6})\s*-\s*(.+)$/)
    if (categoriaMatch) {
      categoriaActual = linea.trim()
      subcategoriaActual = ''
      continue
    }

    // Detección de subcategoría interna de la categoría principal.
    // Ejemplo: "16 CIRUGIA GENERAL"
    const subcategoriaMatch = linea.match(/^(\d{1,3})\s+([A-ZÁÉÍÓÚÑ\s.-]{5,})$/)
    if (subcategoriaMatch && !linea.includes('No. Prog') && !linea.includes('Nombre') && !linea.includes('Matrícula')) {
      const posibleNombre = subcategoriaMatch[2].trim()

      if (posibleNombre.length > 5 && !posibleNombre.includes('/') && !posibleNombre.includes('&')) {
        subcategoriaActual = `${subcategoriaMatch[1]} ${posibleNombre}`
        continue
      }
    }

    // Caso 1: Línea que empieza con número (posible registro o bloque de nombres)
    const numeroMatch = linea.match(/^(\d+)\s+([A-ZÁÉÍÓÚÑ&\/\s]{3,})/)
    if (numeroMatch) {
      const num = numeroMatch[1]
      const resto = linea.substring(num.length).trim()

      const matriculaMatch = resto.match(/\b(\d{7,10})\b/)
      const fechaMatch = resto.match(/(\d{2}\/\d{2}\/\d{4})/)

      if (matriculaMatch && fechaMatch) {
        procesarLineaRegistro(linea, registros, errores, zonaActual, categoriaActual, subcategoriaActual, i)
        continue
      } else {
        if (matriculaMatch) {
          matriculasPendientes.push(matriculaMatch[1])
        }

        const nombreLimpio = resto.split(/\b\d{7,10}\b/)[0].split(/\d{2}\/\d{2}\/\d{4}/)[0].trim()

        const esObservacion = /CAMBIO|ZONA|AUTORIZACION|SCMBT|PAGINA|OFICIO|FECHA|EXPEDIENTE/i.test(nombreLimpio)
        const tieneFormatoNombre = nombreLimpio.includes('/') || nombreLimpio.split(' ').length >= 2
        const esSoloDigitos = /^\d+(\s+\d+)*$/.test(nombreLimpio)

        if (nombreLimpio && tieneFormatoNombre && !esObservacion && !esSoloDigitos) {
          nombresPendientes.push({ num, nombre: nombreLimpio })
          continue
        }
      }
    }

    // Caso 2: Línea que contiene matrículas (formato bloque)
    const todasMatriculas = linea.match(/\b\d{8,10}\b/g)
    if (todasMatriculas && !linea.includes('/')) {
      matriculasPendientes.push(...todasMatriculas)
      continue
    }

    // Caso 3: Línea de datos (empieza con fecha)
    if (/^\d{2}\/\d{2}\/\d{4}/.test(linea)) {
      if (nombresPendientes.length > 0) {
        const nomObj = nombresPendientes.shift()!
        const mat = matriculasPendientes.shift() || '00000000'

        const reg = extraerDatosDesdeFecha(linea, i, zonaActual, categoriaActual, subcategoriaActual)
        if (reg) {
          const registroObj: BolsaDeTrabajoRegistro = {
            ...reg,
            id: parseUtils.generarIdRegistro('NUEVO_INGRESO', registros.length),
            tipoDocumento: 'NUEVO_INGRESO',
            numeroProg: nomObj.num,
            nombre: nomObj.nombre,
            matricula: mat,
            confianza: mat === '00000000' ? 0.7 : 0.95,
            necesitaValidacion: mat === '00000000',
          } as BolsaDeTrabajoRegistro

          const validationErrors = validateRegistro(registroObj, schema)
          if (validationErrors.length > 0) {
            errores.push(`Fila ${i + 1}: ${validationErrors.join('; ')}`)
          }

          registros.push(registroObj)
          continue
        }
      }
    }

    // Detectar encabezados al final
    if (
      parseUtils.esEncabezado(linea) ||
      linea.includes('--') ||
      (linea.includes(' of ') && /\d+\s+of\s+\d+/.test(linea)) ||
      linea.includes('PROG') ||
      linea.includes('Nombre Matrícula') ||
      linea.includes('IMSS-SIAP') ||
      linea.includes('LISTADO') ||
      linea.startsWith('Página')
    ) {
      continue
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

function procesarLineaRegistro(
  linea: string,
  registros: BolsaDeTrabajoRegistro[],
  errores: string[],
  zona: string,
  categoria: string,
  subcategoria: string,
  i: number
) {
  const partes = linea.split(/\s+/).filter((p: string) => p.length > 0)
  const matIndex = partes.findIndex((p: string) => p.match(/^\d{7,10}$/))
  if (matIndex <= 0) return

  const nombre = partes.slice(1, matIndex).join(' ')
  const mat = partes[matIndex]

  const datos = extraerDatosDesdeFecha(linea, i, zona, categoria, subcategoria)
  if (datos) {
    const registroObj: BolsaDeTrabajoRegistro = {
      ...datos,
      id: parseUtils.generarIdRegistro('NUEVO_INGRESO', registros.length),
      tipoDocumento: 'NUEVO_INGRESO',
      numeroProg: partes[0],
      nombre: nombre.trim(),
      matricula: mat,
      confianza: 1.0,
      necesitaValidacion: false,
    } as BolsaDeTrabajoRegistro

    const validationErrors = validateRegistro(registroObj, schema)
    if (validationErrors.length > 0) {
      errores.push(`Fila ${i + 1}: ${validationErrors.join('; ')}`)
    }

    registros.push(registroObj)
  }
}

function extraerDatosDesdeFecha(
  linea: string,
  fila: number,
  zona: string,
  categoria: string,
  subcategoria: string
): Partial<BolsaDeTrabajoRegistro> | null {
  const partes = linea.split(/\s+/).filter(p => p.length > 0)
  const fechaIndex = partes.findIndex(p => p.match(/^\d{2}\/\d{2}\/\d{4}$/))
  if (fechaIndex === -1) return null

  const fecha = partes[fechaIndex]
  const dataPartes = partes.slice(fechaIndex + 1)

  let grupo = '', calificacion = '', tipoContratacion = '', diasLaborados = '', estatus = '', observaciones = ''

  if (dataPartes.length > 0) grupo = dataPartes[0]
  if (dataPartes.length > 1) calificacion = dataPartes[1]

  // En el PDF el orden después de Calificación es: (col opcional), Días laborados, Estatus (A), Tipo Contratación, Observaciones
  // En el PDF el orden después de Calificación es: (col opcional), Días laborados, Estatus (A), Tipo Contratación, Observaciones
  const OBSERVACION_KEYWORDS = /^(expediente|of\.|pendiente|fecha|de\s+fecha|CARECE|TITULO|CEDULA|TRASLADO|OF|completo)/i

  let estatusFound = false
  for (let idx = 2; idx < dataPartes.length; idx++) {
    const p = dataPartes[idx]

    // Estatus suelto (una letra mayúscula, ej. "A") — solo si el token anterior es numérico (días laborados)
    if (/^[A-Z]$/.test(p) && /^[\d,.]+$/.test(dataPartes[idx - 1])) {
      estatus = p
      diasLaborados = dataPartes[idx - 1]

      // Tipo contratación está entre Calificación (idx 1; dataPartes[2] start) y Días Laborados (idx-1)
      // dataPartes[0] = Grupo
      // dataPartes[1] = Calificación
      // dataPartes[2...idx-2] = Tipo Contratación
      if (idx > 2) {
        tipoContratacion = dataPartes.slice(2, idx - 1).join(' ').trim()
      }

      observaciones = dataPartes.slice(idx + 1).join(' ').trim()
      estatusFound = true
      break
    }

    // Días y Estatus pegados (ej. "393A" or "1,249A")
    const matchPegado = p.match(/^([\d,./NA-]+)([A-Z])$/)
    if (matchPegado) {
      diasLaborados = matchPegado[1]
      estatus = matchPegado[2]

      // Tipo contratación está antes de este token
      if (idx > 2) {
        tipoContratacion = dataPartes.slice(2, idx).join(' ').trim()
      }

      observaciones = dataPartes.slice(idx + 1).join(' ').trim()
      estatusFound = true
      break
    }
  }

  if (!estatusFound && dataPartes.length >= 2) {
    const esZona = (val: string) => /^\d+-/.test(val) || val.includes('San Luis') || val.includes('Ensenada') || val.includes('Tijuana')
    const esObs = (val: string) => OBSERVACION_KEYWORDS.test(val) || val.includes('@')

    let obsStart = 2
    if (dataPartes.length >= 3 && !esZona(dataPartes[2]) && !esObs(dataPartes[2])) {
      if (/^[\d,.]+$/.test(dataPartes[2]) || dataPartes[2] === 'N/A' || dataPartes[2] === 'NA') {
        diasLaborados = dataPartes[2]
        obsStart = 3
      } else {
        tipoContratacion = dataPartes[2]
        obsStart = 3
        if (dataPartes[3] && !esZona(dataPartes[3]) && !esObs(dataPartes[3])) {
          diasLaborados = dataPartes[3]
          obsStart = 4
        }
      }
    }

    observaciones = dataPartes.slice(obsStart)
      .filter(p => !esZona(p))
      .join(' ')
  }

  return {
    tipoDocumento: 'NUEVO_INGRESO',
    fecha,
    grupo,
    calificacion,
    tipoContratacion,
    diasLaborados: (diasLaborados || '').replace(/,/g, '').replace(/[^\d.N\/A-]/g, ''),
    estatus,
    observaciones: observaciones.trim() || undefined,
    zona,
    categoria,
    subcategoria: subcategoria || undefined,
    filaOriginal: fila + 1,
  }
}

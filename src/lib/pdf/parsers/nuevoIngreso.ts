import type { EscalafonRegistro } from '@/types/escalafon'
import type { ParseResult } from '../parser'
import { parseUtils } from '../parser'

/**
 * Verifica si una línea parece ser continuación de un nombre (ej: "MANUEL", "DE LOS ANGELES").
 * Puede ser solo el nombre o "MANUEL 27/11/2023 2023003..." (nombre + resto del registro).
 * Excluye observaciones largas como "CARECE DE TITULO Y CEDULA DE ESPECIALIDAD".
 */
function pareceContinuacionNombre(linea: string): boolean {
  const trimmed = linea.trim()
  if (!trimmed) return false
  // No debe ser un nuevo registro (empieza con número secuencial)
  if (/^\d+\s+[A-Z]/.test(trimmed)) return false
  // No debe ser encabezado, email, etc.
  if (trimmed.includes('@') || trimmed.includes('No. Prog') || trimmed.includes('Nombre')) return false
  // Extraer la parte del nombre (antes de la fecha si existe)
  const parteNombre = trimmed.split(/\d{2}\/\d{2}\/\d{4}/)[0]?.trim() || trimmed
  if (!parteNombre) return false
  // La parte del nombre debe parecer nombre: letras, espacios, barras
  if (!/^[A-ZÁÉÍÓÚÑa-záéíóúñ\/\s]+$/.test(parteNombre)) return false
  // Debe ser corta (máx 4 palabras / 30 chars) para evitar observaciones
  const palabras = parteNombre.split(/\s+/).filter(Boolean)
  if (palabras.length > 4 || parteNombre.length > 30) return false
  // Excluir palabras típicas de observaciones
  const noNombre = /\b(CARECE|TITULO|CEDULA|ESPECIALIDAD|expediente|completo|TRASLADO|OF)\b/i
  if (noNombre.test(parteNombre)) return false
  return true
}

/**
 * Verifica si la línea es un encabezado de sección (no debe fusionarse con registros)
 */
function esEncabezadoSeccion(linea: string): boolean {
  const t = linea.trim()
  return (
    t.startsWith('Zona ') ||
    t.startsWith('IMSS-SIAP') ||
    t.startsWith('DIRECCIÓN') ||
    t.startsWith('UNIDAD') ||
    t.startsWith('COORDINACIÓN') ||
    t.startsWith('DIVISIÓN') ||
    t.startsWith('OFICINA') ||
    t.startsWith('LISTADO') ||
    t.startsWith('No. Prog') ||
    t.includes('Nombre Matrícula') ||
    /^\d{6}\s*-/.test(t) || // "202100 - CATEGORIA"
    /^--\s*\d+\s+of/.test(t) // "-- 1 of 130"
  )
}

/**
 * Verifica si la línea parece continuación de observaciones o campos finales
 * Ej: "7/05/2025", "1,249 A Expediente completo...", "09/01/2025"
 */
function pareceContinuacionObservaciones(linea: string): boolean {
  const t = linea.trim()
  if (!t || t.length > 120) return false
  // Fecha suelta (resto de observaciones)
  if (/^\d{1,2}\/\d{2}\/\d{4}$/.test(t)) return true
  // "1,249 A" o "1,249 A expediente..." - diasLaborados + estatus + observaciones
  if (/^\d{1,3},\d{3}\s+[A-Z]\b/.test(t)) return true
  // "expediente completo...", "of. 1514 fecha...", etc.
  if (/^(expediente|of\.|pendiente|fecha|de\s+fecha)/i.test(t)) return true
  return false
}

/**
 * Unir líneas que fueron partidas por nombres largos u observaciones.
 * Case A: "14 MOROYOQUI/LUQUE/REYNA DE LOS" + "ANGELES 97028xxx..." (nombre partido, matrícula en línea 2)
 * Case B: "13 CASTELLANOS/GRANADOS/HUMBERTO 97024746" + "MANUEL" (nombre partido, matrícula en línea 1)
 * Case C: "4 MORALES... expediente completo of. 1683 de fecha" + "7/05/2025" (observaciones partidas)
 * Case C2: "6 MARTINEZ... 9.389 8" + "1,249 A Expediente completo..." (diasLaborados/estatus partidos)
 */
/**
 * Intenta dividir líneas que contienen múltiples registros pegados (ej: "1 NOMBRE 2 NOMBRE")
 * Estrategia mejorada: Buscar los INICIOS de cada registro (Num + Cadena) y cortar basándonos en los índices.
 */
function preprocesarLineasPegadas(lineas: string[]): string[] {
  const resultado: string[] = []


  for (const linea of lineas) {
    if (!linea.trim()) continue

    // Regex para identificar inicio de registro:
    // (Inicio o Espacio) + Digitos + Espacio + Letra
    // El lookahead (?=[A-Z]) asegura que sea un nombre y no una matrícula
    const regexRegistro = /(?:^|\s+)(\d+)\s+(?=[A-ZÁÉÍÓÚÑ&\/])/g

    // Necesitamos los índices, matchAll es ideal
    const matches = Array.from(linea.matchAll(regexRegistro))

    if (matches.length > 1) {
      // Hay múltiples registros en una línea
      for (let i = 0; i < matches.length; i++) {
        // Calcular inicio real (ignorando espacio inicial del match si existe)
        const matchStr = matches[i][0]
        const offsetDigito = matchStr.search(/\d/)
        const start = matches[i].index! + offsetDigito

        // Calcular final (inicio del siguiente match o fin de línea)
        let end = linea.length
        if (i + 1 < matches.length) {
          const nextMatchStr = matches[i + 1][0]
          const nextOffsetDigito = nextMatchStr.search(/\d/)
          end = matches[i + 1].index! + nextOffsetDigito
        }

        const segmento = linea.substring(start, end).trim()
        if (segmento) resultado.push(segmento)
      }
    } else {
      resultado.push(linea)
    }
  }
  return resultado
}

function pareceContinuacionData(linea: string): boolean {
  // Ej: "27/02/2025" (fecha suelta al inicio)
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

      // Case: Registro Serial con observaciones cortadas que continúan en línea que parece fecha
      // e.g. Line 1: "... obs..." \n Line 2: "27/02/2025" (parte de obs)
      // Solo fusionar si Line 1 YA tiene su fecha principal
      if (empiezaConNumero && tieneMatricula && tieneFecha && pareceContinuacionData(siguiente) && !/^\d+\s+/.test(siguiente)) {
        linea = `${linea} ${siguiente}`
        i++
      }

      // Case: Nombre partido (sin matrícula en línea 1)
      else if (empiezaConNumero && !tieneMatricula && !esEncabezadoSeccion(siguiente)) {
        // Fusionar hasta encontrar matrícula o nuevo registro
        let j = i + 1
        let buffer = linea
        let consumido = false
        while (j < lineas.length) {
          const l = lineas[j].trim()
          // Si encontramos un nuevo registro (Num + Letra), paramos
          if (/^\d+\s+[A-Z]/.test(l)) break
          // Si encontramos un encabezado, paramos
          if (esEncabezadoSeccion(l)) break

          buffer += ' ' + l
          j++
          consumido = true
          // Si tras fusionar ya tenemos matrícula, podemos parar (optimización)
          if (/\b\d{8,10}\b/.test(buffer)) break
        }
        if (consumido) {
          linea = buffer
          i = j - 1
        }
      }

      // Case: Matrícula huérfana en línea siguiente (cuando linea 1 es solo nombre y numero)
      else if (empiezaConNumero && !tieneMatricula && /^\d{8,10}/.test(siguiente)) {
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
  const registros: EscalafonRegistro[] = []
  const errores: string[] = []
  let zonaActual = ''
  let categoriaActual = ''

  let lineasRaw = parseUtils.dividirLineas(texto)
  // 1. Dividir líneas pegadas horizontalmente
  let lineas = preprocesarLineasPegadas(lineasRaw)
  // 2. Unir líneas partidas verticalmente
  lineas = unirLineasPartidas(lineas)

  // Buffers para manejar el formato de bloques "paralelos"
  let nombresPendientes: { num: string; nombre: string }[] = []
  let matriculasPendientes: string[] = []

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (!linea) continue

    // Detectar zona
    if (linea.startsWith('Zona ')) {
      zonaActual = linea.replace('Zona ', '').trim()
      continue
    }

    // Detectar categoría (formato: "202100 - AUX DE ENFERMERIA GRAL")
    const categoriaMatch = linea.match(/^(\d{6})\s*-\s*(.+)$/)
    if (categoriaMatch) {
      categoriaActual = linea.trim()
      continue
    }

    // Detectar subcategoría (mejorado para evitar confundir con nombres)
    const subcategoriaMatch = linea.match(/^(\d+)\s+([A-ZÁÉÍÓÚÑ\s]{5,})$/)
    if (subcategoriaMatch && !linea.includes('No. Prog') && !linea.includes('Nombre') && !linea.includes('Matrícula')) {
      const posibleNombre = subcategoriaMatch[2].trim()
      if (posibleNombre.length < 40 && !posibleNombre.includes('/') && !posibleNombre.includes('&')) {
        categoriaActual = `${categoriaActual} - ${posibleNombre}`
        continue
      }
    }

    // --- LÓGICA DE EXTRACCIÓN MEJORADA ---

    // Priorizamos la extracción de datos sobre el filtrado de encabezados
    // porque en bloques "paralelos" los datos a veces se mezclan con encabezados pie de página

    // Caso 1: Línea que empieza con número (posible registro o bloque de nombres)
    const numeroMatch = linea.match(/^(\d+)\s+([A-ZÁÉÍÓÚÑ&\/\s]{3,})/)
    if (numeroMatch) {
      const num = numeroMatch[1]
      let resto = linea.substring(num.length).trim()

      // Intentar encontrar matrícula y fecha en esta misma línea (serial)
      const matriculaMatch = resto.match(/\b(\d{7,10})\b/)
      const fechaMatch = resto.match(/(\d{2}\/\d{2}\/\d{4})/)

      if (matriculaMatch && fechaMatch) {
        // Es un registro completo en una línea
        procesarLineaRegistro(linea, registros, zonaActual, categoriaActual, i)
        continue
      } else {
        // Bloque "paralelo" o registro partido
        // Primero extraemos la matrícula si existe para el buffer
        if (matriculaMatch) {
          matriculasPendientes.push(matriculaMatch[1])
        }

        // Extraemos el nombre limpiando posible basura
        const nombreLimpio = resto.split(/\b\d{7,10}\b/)[0].split(/\d{2}\/\d{2}\/\d{4}/)[0].trim()

        // Validación para asegurar que es un nombre y no una observación o pie de página
        // Los nombres suelen tener barras "/" o al menos 2 palabras y NO palabras clave de observaciones
        const esObservacion = /CAMBIO|ZONA|AUTORIZACION|SCMBT|PAGINA|OFICIO|FECHA|EXPEDIENTE/i.test(nombreLimpio)
        const tieneFormatoNombre = nombreLimpio.includes('/') || nombreLimpio.split(' ').length >= 2

        if (nombreLimpio && tieneFormatoNombre && !esObservacion) {
          nombresPendientes.push({ num, nombre: nombreLimpio })
          continue
        }
      }
    }

    // Caso 2: Línea que contiene matrículas (formato bloque)
    // A veces la línea tiene texto de pie de página al final (e.g. "99123456 DIRECCIÓN DE...")
    // Por eso revisamos esto ANTES de descartar por encabezado
    const todasMatriculas = linea.match(/\b\d{8,10}\b/g)
    if (todasMatriculas && !linea.includes('/')) {
      // Si la línea contiene "No. Prog" o "Matrícula" (cabeceras), pero TAMBIÉN números largos,
      // asumimos que son matrículas válidas mezcladas.
      matriculasPendientes.push(...todasMatriculas)
      continue
    }

    // Caso 3: Línea de datos (empieza con fecha)
    if (/^\d{2}\/\d{2}\/\d{4}/.test(linea)) {
      if (nombresPendientes.length > 0) {
        const nomObj = nombresPendientes.shift()!
        const mat = matriculasPendientes.shift() || '00000000'

        // Usar la función robusta de procesamiento de línea
        const reg = extraerDatosDesdeFecha(linea, i, zonaActual, categoriaActual)
        if (reg) {
          registros.push({
            ...reg,
            id: parseUtils.generarIdRegistro('NUEVO_INGRESO', registros.length),
            tipoDocumento: 'NUEVO_INGRESO', // Asegurar tipo
            numeroProg: nomObj.num,
            nombre: nomObj.nombre,
            matricula: mat,
            confianza: mat === '00000000' ? 0.7 : 0.95,
            necesitaValidacion: mat === '00000000',
          } as EscalafonRegistro)
          continue
        }
      }
    }

    // Detectar encabezados y saltarlos (LO HACEMOS AL FINAL)
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

  // Limpieza de huerfanos si quedaron
  if (nombresPendientes.length > 0 || matriculasPendientes.length > 0) {
    console.log(`Pariendo huerfanos: Nombres: ${nombresPendientes.length}, Mats: ${matriculasPendientes.length}`)
  }

  console.log(`NUEVO INGRESO - Total de registros extraídos: ${registros.length}`)
  return {
    registros,
    metadata: {
      zona: zonaActual || undefined,
      categoria: categoriaActual || undefined,
    },
    errores,
  }
}

/**
 * Procesa una línea que se espera tenga el formato serial completo
 */
function procesarLineaRegistro(linea: string, registros: EscalafonRegistro[], zona: string, categoria: string, i: number) {
  const partes = linea.split(/\s+/).filter((p: string) => p.length > 0)
  const matIndex = partes.findIndex((p: string) => p.match(/^\d{7,10}$/))
  if (matIndex <= 0) return

  const nombre = partes.slice(1, matIndex).join(' ')
  const mat = partes[matIndex]

  const datos = extraerDatosDesdeFecha(linea, i, zona, categoria)
  if (datos) {
    registros.push({
      ...datos,
      id: parseUtils.generarIdRegistro('NUEVO_INGRESO', registros.length),
      tipoDocumento: 'NUEVO_INGRESO', // Asegurar tipo
      numeroProg: partes[0], // numProg is the first part
      nombre: nombre.trim(),
      matricula: mat,
      confianza: 1.0,
      necesitaValidacion: false,
    } as EscalafonRegistro)
  }
}

/**
 * Función robusta para extraer campos de datos (Grupo, Calif, Tipo, Días, Estatus) 
 * desde una parte de la línea que contiene la fecha.
 */
function extraerDatosDesdeFecha(linea: string, fila: number, zona: string, categoria: string): Partial<EscalafonRegistro> | null {
  const partes = linea.split(/\s+/).filter(p => p.length > 0)
  const fechaIndex = partes.findIndex(p => p.match(/^\d{2}\/\d{2}\/\d{4}$/))
  if (fechaIndex === -1) return null

  const fecha = partes[fechaIndex]
  const dataPartes = partes.slice(fechaIndex + 1)

  let grupo = '', calificacion = '', tipoContratacion = '', diasLaborados = '', estatus = '', observaciones = ''

  if (dataPartes.length > 0) grupo = dataPartes[0]
  if (dataPartes.length > 1) calificacion = dataPartes[1]

  // Encontrar el estatus (una sola letra mayúscula sola o pegada a números)
  // Buscamos candidatos para "Días + Estatus"
  let estatusFound = false
  for (let idx = 2; idx < dataPartes.length; idx++) {
    const p = dataPartes[idx]

    // Caso 1: Estatus solo (ej: "A")
    if (/^[A-Z]$/.test(p)) {
      estatus = p
      diasLaborados = dataPartes[idx - 1]
      // Si hay algo entre Calificación y Días, es el Tipo
      if (idx > 3) tipoContratacion = dataPartes.slice(2, idx - 1).join(' ')
      observaciones = dataPartes.slice(idx + 1).join(' ')
      estatusFound = true
      break
    }

    // Caso 2: Días y Estatus pegados (ej: "500A")
    const matchPegado = p.match(/^([\d,./NA-]+)([A-Z])$/)
    if (matchPegado) {
      diasLaborados = matchPegado[1]
      estatus = matchPegado[2]
      if (idx > 2) tipoContratacion = dataPartes.slice(2, idx).join(' ')
      observaciones = dataPartes.slice(idx + 1).join(' ')
      estatusFound = true
      break
    }
  }

  // Fallback si no se encontró estatus claro
  if (!estatusFound && dataPartes.length >= 2) {
    // Si el tercer elemento (idx 2) parece ser Días (número o N/A)
    // Pero evitamos que sea la Zona (ej: "1-San Luis")
    const esZona = (val: string) => /^\d+-/.test(val) || val.includes('San Luis') || val.includes('Ensenada') || val.includes('Tijuana')

    if (dataPartes.length >= 3 && !esZona(dataPartes[2])) {
      if (/^[\d,.]+$/.test(dataPartes[2]) || dataPartes[2] === 'N/A' || dataPartes[2] === 'NA') {
        diasLaborados = dataPartes[2]
        tipoContratacion = '' // Asumimos que falta el tipo
      } else {
        tipoContratacion = dataPartes[2]
        // Solo tomar el siguiente como días si no es Zona
        if (dataPartes[3] && !esZona(dataPartes[3])) {
          diasLaborados = dataPartes[3]
        }
      }
    } else if (dataPartes.length === 2) {
      // Solo hay Grupo y Calif
    }

    // Las observaciones son todo lo que no hayamos procesado y que no sea la Zona
    observaciones = dataPartes.slice(tipoContratacion ? 3 : 2)
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
    filaOriginal: fila + 1
  }
}

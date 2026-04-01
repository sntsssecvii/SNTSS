import type { BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'
import type { ParseResult } from '../parser'
import { parseUtils } from '../parser'
import { SCHEMAS, validateRegistro } from '../schemas'
import { callPythonExtractor, PDFExtractionResult } from '../pythonBridge'

const schema = SCHEMAS.NUEVO_INGRESO

/**
 * Extrae los campos después de la fecha (Grupo, Calif, Tipo, Días, Estatus, Obs)
 * de forma robusta, ignorando espacios vacíos y validando por patrones.
 */
function extraerCamposRest(tokens: string[], grupoExistente: string = '') {
    let grupo = grupoExistente.trim()
    let calificacion = ''
    let tipoContratacion = ''
    let diasLaborados = ''
    let estatus = ''
    let observations: string[] = []

    // Limpiar tokens vacíos y separar si hay múltiples valores en una celda
    const activeTokens = tokens.flatMap(t => (t || '').trim().split(/\s+/)).filter(Boolean)
    let i = 0

    // REGLA ESPECIAL: Recuperar dígito perdido del grupo.
    // Ej: "201800" + "1" -> "2018001"
    if (grupo && grupo.length === 6 && activeTokens[i] && /^\d$/.test(activeTokens[i])) {
        grupo += activeTokens[i++]
    }

    // 1. Grupo: 6-8 dígitos (si no lo capturamos antes con la fecha)
    if (!grupo && activeTokens[i] && /^\d{6,8}$/.test(activeTokens[i])) {
        grupo = activeTokens[i++]
    }

    // 2. Calificación: Debe tener un punto decimal (ej: 73.000 o 4.000)
    if (activeTokens[i] && /^\d+\.\d+$/.test(activeTokens[i])) {
        calificacion = activeTokens[i++]
    }

    // 3. Tipo Contratación: 1 o 2 dígitos (ej: 2, 8)
    if (activeTokens[i] && /^\d{1,2}$/.test(activeTokens[i])) {
        tipoContratacion = activeTokens[i++]
    }

    // 4. Días Laborados: Número con comas/puntos (ej: 497, 3,938) o N/A
    // Evitamos capturar el Estatus (una sola letra) aquí.
    if (activeTokens[i] && (/^[\d,.]+$/.test(activeTokens[i]) || activeTokens[i].toUpperCase() === 'N/A') && !/^[A-Z]$/.test(activeTokens[i])) {
        diasLaborados = activeTokens[i++].replace(/,/g, '')
    }

    // 5. Estatus: Generalmente una letra sola (A, B, etc.)
    if (activeTokens[i] && /^[A-Z]$/.test(activeTokens[i])) {
        estatus = activeTokens[i++]
    }

    // 6. El resto son observaciones
    observations = activeTokens.slice(i)

    return { grupo, calificacion, tipoContratacion, diasLaborados, estatus, observations }
}

/**
 * Procesa una fila (array de celdas) para extraer un registro
 */
function procesarFila(row: any[], registros: Map<string, BolsaDeTrabajoRegistro>, zona: string, categoria: string, i: number, pageNum: number, errores: string[]) {
    if (!row || row.length < 4) return

    const numProg = row[0]?.trim()
    if (!numProg || !/^\d+$/.test(numProg)) return

    let matriculaIdx = -1
    let fechaIdx = -1
    let matricula = ''
    let fecha = ''

    for (let j = 1; j < row.length; j++) {
        const cell = (row[j] || '').trim()
        if (!cell) continue

        if (matriculaIdx === -1 && /^\d{7,10}$/.test(cell)) {
            matriculaIdx = j
            matricula = cell
        }
        const fechaMatch = cell.match(/(\d{2}\/\d{2}\/\d{4})/)
        if (fechaIdx === -1 && fechaMatch) {
            fechaIdx = j
            fecha = fechaMatch[1]
        }
    }

    if (matriculaIdx === -1 || fechaIdx === -1) return

    // Nombre: celdas entre el No. Prog y la Matrícula
    const nombrePartes = row.slice(1, matriculaIdx).map(c => c?.trim()).filter(Boolean)
    const nombreCompleto = nombrePartes.join(' ').trim()

    // Grupo: a veces pegado a la fecha o en celdas intermedias
    let grupoTmp = ''
    if (fechaIdx > matriculaIdx + 1) {
        grupoTmp = row.slice(matriculaIdx + 1, fechaIdx).join(' ').trim()
    }
    const fechaCell = row[fechaIdx] || ''
    if (fechaCell.includes(' ')) {
        const partes = fechaCell.trim().split(/\s+/)
        if (partes.length > 1 && !grupoTmp) grupoTmp = partes[1]
    }

    // Extraer resto usando el helper robusto
    const { grupo, calificacion, tipoContratacion, diasLaborados, estatus, observations } =
        extraerCamposRest(row.slice(fechaIdx + 1), grupoTmp)

    const key = `${numProg}_${matricula}_${fecha}`
    if (registros.has(key)) return

    const registroObj: BolsaDeTrabajoRegistro = {
        id: parseUtils.generarIdRegistro('NUEVO_INGRESO', registros.size),
        tipoDocumento: 'NUEVO_INGRESO',
        numeroProg: numProg,
        nombre: nombreCompleto,
        matricula: matricula,
        fecha: fecha,
        grupo: grupo,
        calificacion: calificacion,
        tipoContratacion: tipoContratacion,
        diasLaborados: diasLaborados,
        estatus: estatus,
        observaciones: observations.join(' ').trim() || undefined,
        zona: zona,
        categoria: categoria,
        filaOriginal: registros.size + 1,
        confianza: 1.0,
        necesitaValidacion: false,
    } as BolsaDeTrabajoRegistro

    const validationErrors = validateRegistro(registroObj, schema)
    if (validationErrors.length > 0) {
        errores.push(`Página ${pageNum}, Fila ${numProg}: ${validationErrors.join('; ')}`)
    }

    registros.set(key, registroObj)
}

/**
 * Procesa una línea de texto plano para extraer un registro
 */
function procesarLinea(line: string, registros: Map<string, BolsaDeTrabajoRegistro>, zona: string, categoria: string, pageNum: number, errores: string[]) {
    const trimmed = line.trim()
    if (!trimmed) return

    // Pattern robusto: No. Prog, Nombre, Matrícula, Fecha...
    const match = trimmed.match(/^(\d+)\s+(.+?)\s+(\d{7,10})\s+(\d{2}\/\d{2}\/\d{4})(.*)$/)

    if (match) {
        const [, numProg, nombreRaw, matricula, fecha, restRaw] = match
        const key = `${numProg}_${matricula}_${fecha}`
        if (registros.has(key)) return

        // Extraer resto usando el helper robusto
        const { grupo, calificacion, tipoContratacion, diasLaborados, estatus, observations } =
            extraerCamposRest(restRaw.trim().split(/\s+/))

        const registroObj: BolsaDeTrabajoRegistro = {
            id: parseUtils.generarIdRegistro('NUEVO_INGRESO', registros.size),
            tipoDocumento: 'NUEVO_INGRESO',
            numeroProg: numProg,
            nombre: nombreRaw.trim(),
            matricula: matricula,
            fecha: fecha,
            grupo: grupo,
            calificacion: calificacion,
            tipoContratacion: tipoContratacion,
            diasLaborados: diasLaborados,
            estatus: estatus,
            observaciones: observations.join(' ').trim() || undefined,
            zona: zona,
            categoria: categoria,
            filaOriginal: registros.size + 1,
            confianza: 0.9,
            necesitaValidacion: false,
        } as BolsaDeTrabajoRegistro

        const validationErrors = validateRegistro(registroObj, schema)
        if (validationErrors.length > 0) {
            errores.push(`Página ${pageNum} (Texto), Fila ${numProg}: ${validationErrors.join('; ')}`)
        }

        registros.set(key, registroObj)
    }
}

export async function parseWithPdfPlumber(
    pdfPath: string,
    options: { maxPages?: number } = {}
): Promise<ParseResult> {
    const registrosMap = new Map<string, BolsaDeTrabajoRegistro>()
    const errores: string[] = []
    let zonaActual = ''
    let categoriaActual = ''

    try {
        const data: PDFExtractionResult = await callPythonExtractor(pdfPath)

        for (const page of data.pages) {
            // 1. Metadata
            const lineasTexto = page.lines || page.text.split('\n')
            for (const linea of lineasTexto) {
                const l = linea.trim()
                if (l.startsWith('Zona ')) zonaActual = l.replace('Zona ', '').trim()
                const catMatch = l.match(/^(\d{6})\s*-\s*(.+)$/)
                if (catMatch) categoriaActual = l.trim()
            }

            // 2. Procesar Tablas (Fuente 1)
            if (page.tables) {
                for (const table of page.tables) {
                    if (!table) continue
                    for (let i = 0; i < table.length; i++) {
                        procesarFila(table[i], registrosMap, zonaActual, categoriaActual, i, page.page_number, errores)
                    }
                }
            }

            // 3. Procesar Líneas (Fuente 2 - Backup para cuando fallan las tablas)
            if (page.lines) {
                for (const line of page.lines) {
                    procesarLinea(line, registrosMap, zonaActual, categoriaActual, page.page_number, errores)
                }
            }
        }

        const finalRegistros = Array.from(registrosMap.values())

        return {
            registros: finalRegistros,
            metadata: {
                zona: zonaActual || undefined,
                categoria: categoriaActual || undefined,
                totalRegistros: finalRegistros.length,
                extraidoCon: 'PDF',
            },
            errores,
        }

    } catch (error) {
        return {
            registros: [],
            metadata: {
                totalRegistros: 0,
                extraidoCon: 'PDF',
            },
            errores: [`Error en pdfplumber: ${error instanceof Error ? error.message : String(error)}`],
        }
    }
}

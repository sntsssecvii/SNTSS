import type { ParseResult, EscalafonRegistro } from '@/types/escalafon'
import { parseUtils } from '../parser'

/**
 * Parser para Cambios de Área.
 * Utiliza una lógica flexible para extraer registros basada en matrícula y fecha.
 */
export function parseCambiosArea(texto: string): ParseResult {
    const registros: EscalafonRegistro[] = []
    const errores: string[] = []
    let zonaActual = ''
    let categoriaActual = ''

    const lineas = parseUtils.dividirLineas(texto)

    for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i].trim()
        if (!linea) continue

        // Detectar zona
        if (linea.startsWith('Zona ')) {
            zonaActual = linea.replace('Zona ', '').trim()
            continue
        }

        // Detectar categoría
        const categoriaMatch = linea.match(/^(\d{6})\s*-\s*(.+)$/)
        if (categoriaMatch) {
            categoriaActual = linea.trim()
            continue
        }

        // Saltar encabezados
        if (
            parseUtils.esEncabezado(linea) ||
            linea.includes('--') ||
            linea.includes('of') ||
            linea.includes('IMSS-SIAP') ||
            linea.includes('LISTADO')
        ) {
            continue
        }

        // Lógica flexible: buscar matrícula (8-10 dígitos) y fecha (DD/MM/YYYY)
        const partes = linea.split(/\s+/).filter((p) => p.length > 0)
        const matriculaIdx = partes.findIndex((p) => /^\d{7,10}$/.test(p))
        const fechaIdx = partes.findIndex((p) => /^\d{2}\/\d{2}\/\d{4}$/.test(p))

        if (matriculaIdx !== -1 && fechaIdx !== -1) {
            // El nombre suele estar después de la matrícula o antes del sexo/clave
            // En este formato flexible, intentamos capturar lo que parece ser el nombre
            const numProg = /^\d+$/.test(partes[0]) ? partes[0] : ''
            const matricula = partes[matriculaIdx]
            const fecha = partes[fechaIdx]

            // Encontrar el sexo (M o F) si existe para delimitar el nombre
            const sexIdx = partes.findIndex((p, idx) => idx > matriculaIdx && (p === 'M' || p === 'F'))

            const registroObj: EscalafonRegistro = {
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
                confianza: 0.7,
                filaOriginal: i + 1,
                necesitaValidacion: true,
                observaciones: 'Parseo flexible'
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

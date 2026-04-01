import { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import type { PositionResult } from '@/lib/bolsa-de-trabajo/position-contracts'
import { dedupePositionRecords, normalizePositionRecords } from '@/lib/bolsa-de-trabajo/position-engine'
import { buildStrategyResult, positionStrategies } from '@/lib/bolsa-de-trabajo/position-strategies'
import { runPositionEngine } from '@/lib/bolsa-de-trabajo/position-engine'

export type CalculoPosicion = PositionResult

/**
 * Calcula las posiciones de un trabajador dentro de un conjunto de registros.
 * El conjunto de registros debe venir ya filtrado por los criterios de comparación
 * adecuados para el tipo de documento (ej: Cat/Zona o Cat/Zona/Adscripción).
 */
export function calcularPosiciones(
    registros: BolsaDeTrabajoRegistro[],
    matriculaBuscada: string,
    tipoDocumento: TipoBolsaDeTrabajo,
    options: { targetRecordId?: string } = {}
): CalculoPosicion | null {
    const strategy = positionStrategies[tipoDocumento]

    return runPositionEngine(registros, {
        tipoDocumento,
        matriculaBuscada,
        targetRecordId: options.targetRecordId,
        strategy,
        buildResult: strategy
            ? (context) => buildStrategyResult(context, strategy)
            : undefined,
    })
}

export interface TrabajadorAnterior {
    posicionBase: number
    registro: BolsaDeTrabajoRegistro
}

export function getTrabajadoresAntes(
    registros: BolsaDeTrabajoRegistro[],
    matriculaBuscada: string,
    tipoDocumento: TipoBolsaDeTrabajo,
    options: { targetRecordId?: string } = {}
): TrabajadorAnterior[] {
    const strategy = positionStrategies[tipoDocumento]
    const normalizedRecords = normalizePositionRecords(registros)
    const orderedRecords = [...normalizedRecords].sort((a, b) => {
        const sortA = strategy ? strategy.getSortValue(a) : a.numeroProg
        const sortB = strategy ? strategy.getSortValue(b) : b.numeroProg
        return sortA - sortB
    })

    const target = options.targetRecordId
        ? orderedRecords.find((record) => record.id === options.targetRecordId)
        : orderedRecords.find((record) => record.matricula === matriculaBuscada)
    if (!target) return []

    let comparableRecords = strategy?.selectComparableRecords
        ? strategy.selectComparableRecords(orderedRecords, target)
        : strategy
            ? orderedRecords.filter((record) => strategy.buildGroupKey(record) === strategy.buildGroupKey(target))
            : orderedRecords

    if (strategy?.applyPriorityRules) {
        comparableRecords = strategy.applyPriorityRules(comparableRecords, target)
    }

    const uniqueRecords = strategy && !strategy.shouldDeduplicateByMatricula()
        ? comparableRecords
        : dedupePositionRecords(comparableRecords)

    const posicionTarget = uniqueRecords.findIndex((record) =>
        options.targetRecordId ? record.id === options.targetRecordId : record.matricula === matriculaBuscada
    )
    if (posicionTarget <= 0) return []

    return uniqueRecords.slice(0, posicionTarget).map((record, index) => ({
        posicionBase: index + 1,
        registro: record.source,
    }))
}

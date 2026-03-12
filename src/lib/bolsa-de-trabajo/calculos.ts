import { BolsaDeTrabajoRegistro, TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import type { PositionResult } from '@/lib/bolsa-de-trabajo/position-contracts'
import { runPositionEngine } from '@/lib/bolsa-de-trabajo/position-engine'
import { buildStrategyResult, positionStrategies } from '@/lib/bolsa-de-trabajo/position-strategies'

export type CalculoPosicion = PositionResult

/**
 * Calcula las posiciones de un trabajador dentro de un conjunto de registros.
 * El conjunto de registros debe venir ya filtrado por los criterios de comparación
 * adecuados para el tipo de documento (ej: Cat/Zona o Cat/Zona/Adscripción).
 */
export function calcularPosiciones(
    registros: BolsaDeTrabajoRegistro[],
    matriculaBuscada: string,
    tipoDocumento: TipoBolsaDeTrabajo
): CalculoPosicion | null {
    const strategy = positionStrategies[tipoDocumento]

    return runPositionEngine(registros, {
        tipoDocumento,
        matriculaBuscada,
        strategy,
        buildResult: strategy
            ? (context) => buildStrategyResult(context, strategy)
            : undefined,
    })
}

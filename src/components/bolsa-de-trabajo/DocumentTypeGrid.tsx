'use client'

import { motion } from 'framer-motion'
import { DocumentTypeCard } from './DocumentTypeCard'
import type { TipoBolsaDeTrabajo, BolsaDeTrabajoDocumento } from '@/types/bolsa-de-trabajo'
import { NOMBRES_TIPOS } from '@/types/bolsa-de-trabajo'

interface DocumentTypeGridProps {
    documentos: BolsaDeTrabajoDocumento[]
    onTipoClick: (tipo: TipoBolsaDeTrabajo) => void
}

const TIPOS: TipoBolsaDeTrabajo[] = [
    'NUEVO_INGRESO',
    'AMPLIACIONES_JORNADA',
    'CAMBIOS_AREA',
    'CAMBIOS_RAMA',
    'CAMBIOS_RESIDENCIA_DESTINO',
    'CAMBIOS_RESIDENCIA_ORIGEN',
    'CAMBIOS_TIPO_PLAZA',
    'CAMBIOS_TURNO_ADSCRIPCION',
]

export function DocumentTypeGrid({ documentos, onTipoClick }: DocumentTypeGridProps) {
    const getStatsForTipo = (tipo: TipoBolsaDeTrabajo) => {
        const docs = documentos.filter(d => d.tipo === tipo)
        return {
            count: docs.length,
            validados: docs.filter(d => d.estado === 'COMPLETADO').length,
            errores: docs.filter(d => d.estado === 'ERROR').length,
            procesando: docs.filter(d => d.estado === 'PROCESANDO' || d.estado === 'VALIDANDO').length,
        }
    }

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
            {TIPOS.map((tipo) => {
                const stats = getStatsForTipo(tipo)
                return (
                    <DocumentTypeCard
                        key={tipo}
                        tipo={tipo}
                        {...stats}
                        onClick={() => onTipoClick(tipo)}
                    />
                )
            })}
        </motion.div>
    )
}

'use client'

import { motion } from 'framer-motion'
import { FileText, ArrowRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import { NOMBRES_TIPOS } from '@/types/bolsa-de-trabajo'

interface DocumentTypeCardProps {
    tipo: TipoBolsaDeTrabajo
    count: number
    validados: number
    errores: number
    procesando: number
    onClick: () => void
}

const ICONOS: Record<TipoBolsaDeTrabajo, any> = {
    AMPLIACIONES_JORNADA: FileText,
    CAMBIOS_AREA: FileText,
    CAMBIOS_RAMA: FileText,
    CAMBIOS_RESIDENCIA_DESTINO: FileText,
    CAMBIOS_RESIDENCIA_ORIGEN: FileText,
    CAMBIOS_TIPO_PLAZA: FileText,
    CAMBIOS_TURNO_ADSCRIPCION: FileText,
    NUEVO_INGRESO: FileText,
}

const GRADIENTS: Record<TipoBolsaDeTrabajo, string> = {
    AMPLIACIONES_JORNADA: "from-blue-500/20 to-indigo-500/10 border-blue-200/50 hover:border-blue-300",
    CAMBIOS_AREA: "from-emerald-500/20 to-teal-500/10 border-emerald-200/50 hover:border-emerald-300",
    CAMBIOS_RAMA: "from-amber-500/20 to-orange-500/10 border-amber-200/50 hover:border-amber-300",
    CAMBIOS_RESIDENCIA_DESTINO: "from-purple-500/20 to-fuchsia-500/10 border-purple-200/50 hover:border-purple-300",
    CAMBIOS_RESIDENCIA_ORIGEN: "from-cyan-500/20 to-sky-500/10 border-cyan-200/50 hover:border-cyan-300",
    CAMBIOS_TIPO_PLAZA: "from-rose-500/20 to-pink-500/10 border-rose-200/50 hover:border-rose-300",
    CAMBIOS_TURNO_ADSCRIPCION: "from-violet-500/20 to-purple-500/10 border-violet-200/50 hover:border-violet-300",
    NUEVO_INGRESO: "from-orange-500/20 to-yellow-500/10 border-orange-200/50 hover:border-orange-300",
}

const COLORS: Record<string, string> = {
    AMPLIACIONES_JORNADA: "text-blue-600",
    CAMBIOS_AREA: "text-emerald-600",
    CAMBIOS_RAMA: "text-amber-600",
    CAMBIOS_RESIDENCIA_DESTINO: "text-purple-600",
    CAMBIOS_RESIDENCIA_ORIGEN: "text-cyan-600",
    CAMBIOS_TIPO_PLAZA: "text-rose-600",
    CAMBIOS_TURNO_ADSCRIPCION: "text-violet-600",
    NUEVO_INGRESO: "text-orange-600",
}

export function DocumentTypeCard({ tipo, count, validados, errores, procesando, onClick }: DocumentTypeCardProps) {
    const Icono = ICONOS[tipo]
    const colorClass = COLORS[tipo]
    const estado =
        errores > 0
            ? 'Revisar'
            : procesando > 0
                ? 'Procesando'
                : count > 0
                    ? 'Listo'
                    : 'Pendiente'

    return (
        <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
        >
            <Card
                onClick={onClick}
                className={cn(
                    "relative h-full overflow-hidden cursor-pointer group bg-gradient-to-br border-2 transition-all duration-300",
                    GRADIENTS[tipo]
                )}
            >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-125 transition-transform duration-500">
                    <Icono className="w-32 h-32" />
                </div>

                <div className="p-6 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-6">
                        <div className={cn("p-3 rounded-2xl bg-white/50 dark:bg-card/50 shadow-sm", colorClass)}>
                            <Icono className="w-6 h-6" />
                        </div>
                        <div className="flex -space-x-2">
                            {validados > 0 && (
                                <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center" title="Completados">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                </div>
                            )}
                            {procesando > 0 && (
                                <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center animate-pulse" title="Procesando">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                </div>
                            )}
                            {errores > 0 && (
                                <div className="w-8 h-8 rounded-full bg-red-100 border-2 border-white flex items-center justify-center" title="Errores">
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1">
                        <h3 className="text-lg font-extrabold tracking-tight mb-1 group-hover:text-primary transition-colors">
                            {NOMBRES_TIPOS[tipo]}
                        </h3>
                        <p className="text-3xl font-black mb-4">
                            {count} <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Documentos</span>
                        </p>

                        <div className="space-y-3">
                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <span>Estado del tipo</span>
                                <span>{estado}</span>
                            </div>
                            <div className="rounded-2xl bg-white/50 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-black/20 dark:text-slate-300">
                                {count === 0
                                    ? 'Aún no hay documento cargado para este tipo.'
                                    : errores > 0
                                        ? 'Hay documentos con error y requieren revisión.'
                                        : procesando > 0
                                            ? 'Hay documentos todavía en procesamiento.'
                                            : 'Ya existe al menos un documento listo para consulta.'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between">
                        <div className="flex gap-4">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">OK</p>
                                <p className="text-sm font-extrabold text-emerald-600 leading-none">{validados}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Pend</p>
                                <p className="text-sm font-extrabold text-blue-600 leading-none">{procesando}</p>
                            </div>
                        </div>
                        <Button size="sm" variant="ghost" className="rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                            <span className="font-bold text-xs mr-2">Explorar</span>
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Card>
        </motion.div>
    )
}

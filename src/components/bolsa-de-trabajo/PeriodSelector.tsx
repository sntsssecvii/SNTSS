'use client'

import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PeriodSelectorProps {
    anio: number
    mes: number
    quincena: 1 | 2
    onChange: (periodo: { anio: number; mes: number; quincena: 1 | 2 }) => void
}

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export function PeriodSelector({ anio, mes, quincena, onChange }: PeriodSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)

    const handleAnioChange = (delta: number) => {
        onChange({ anio: anio + delta, mes, quincena })
    }

    const handleMesChange = (nuevoMes: number) => {
        onChange({ anio, mes: nuevoMes, quincena })
    }

    const handleQuincenaChange = (nuevaQuincena: 1 | 2) => {
        onChange({ anio, mes, quincena: nuevaQuincena })
    }

    return (
        <div className="relative z-20">
            <motion.div
                initial={false}
                animate={isOpen ? "open" : "closed"}
                className="flex items-center gap-3"
            >
                <Button
                    variant="outline"
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "h-12 px-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-3 bg-white dark:bg-card hover:shadow-lg",
                        isOpen ? "border-primary shadow-primary/10 ring-4 ring-primary/5" : "border-border shadow-sm"
                    )}
                >
                    <Calendar className={cn("h-5 w-5 transition-colors", isOpen ? "text-primary" : "text-muted-foreground")} />
                    <div className="text-left">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1">Periodo Actual</p>
                        <p className="text-sm font-extrabold leading-none">
                            {MESES[mes - 1]} {anio} • <span className="text-primary">{quincena}ª Qna</span>
                        </p>
                    </div>
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        className="ml-2"
                    >
                        <ChevronRight className="h-4 w-4 opacity-50" />
                    </motion.div>
                </Button>
            </motion.div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-10 bg-black/5 backdrop-blur-[2px]"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ type: "spring", damping: 20, stiffness: 300 }}
                            className="absolute top-14 left-0 z-20 w-[340px] origin-top-left"
                        >
                            <Card className="p-4 shadow-2xl border-2 border-primary/10 bg-white/95 dark:bg-card/95 backdrop-blur-xl overflow-hidden">
                                {/* Selector de Año */}
                                <div className="flex items-center justify-between mb-6 bg-primary/5 p-2 rounded-xl">
                                    <Button variant="ghost" size="icon" onClick={() => handleAnioChange(-1)} className="hover:bg-white dark:hover:bg-card rounded-lg h-8 w-8">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="font-extrabold text-lg tracking-tight">{anio}</span>
                                    <Button variant="ghost" size="icon" onClick={() => handleAnioChange(1)} className="hover:bg-white dark:hover:bg-card rounded-lg h-8 w-8">
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Grid de Meses */}
                                <div className="grid grid-cols-3 gap-2 mb-6">
                                    {MESES.map((nombreMes, index) => {
                                        const mesNum = index + 1
                                        const isSelected = mes === mesNum
                                        return (
                                            <button
                                                key={nombreMes}
                                                onClick={() => handleMesChange(mesNum)}
                                                className={cn(
                                                    "px-2 py-2.5 rounded-lg text-xs font-bold transition-all duration-200",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                                                        : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                                )}
                                            >
                                                {nombreMes.slice(0, 3)}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Selector de Quincena */}
                                <div className="flex gap-2 p-1 bg-muted rounded-xl">
                                    {[1, 2].map((q) => {
                                        const isSelected = quincena === q
                                        return (
                                            <button
                                                key={q}
                                                onClick={() => handleQuincenaChange(q as 1 | 2)}
                                                className={cn(
                                                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200",
                                                    isSelected
                                                        ? "bg-white dark:bg-card text-primary shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                {q}ª Quincena
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="mt-4 pt-4 border-t flex justify-end">
                                    <Button
                                        size="sm"
                                        className="rounded-lg font-bold"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Aplicar Filtro
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

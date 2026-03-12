'use client'

import { Calendar } from 'lucide-react'
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
    const years = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - 2 + index)

    return (
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                        <Calendar className="h-4 w-4" />
                        Periodo de trabajo
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Selecciona la quincena antes de revisar archivos o iniciar una nueva sincronización.
                    </p>
                </div>

                <div className="grid w-full gap-4 xl:grid-cols-[minmax(260px,1.4fr)_180px]">
                    <div className="grid gap-4 md:grid-cols-[minmax(240px,1fr)_160px]">
                        <label className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mes</span>
                            <select
                                value={mes}
                                onChange={(e) => onChange({ anio, mes: Number(e.target.value), quincena })}
                                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-primary dark:border-slate-800 dark:bg-slate-950/60"
                            >
                                {MESES.map((nombreMes, index) => (
                                    <option key={nombreMes} value={index + 1}>
                                        {nombreMes}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Año</span>
                            <select
                                value={anio}
                                onChange={(e) => onChange({ anio: Number(e.target.value), mes, quincena })}
                                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-primary dark:border-slate-800 dark:bg-slate-950/60"
                            >
                                {years.map((year) => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quincena</span>
                        <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/60">
                            {[1, 2].map((value) => (
                                <button
                                    key={value}
                                    onClick={() => onChange({ anio, mes, quincena: value as 1 | 2 })}
                                    className={cn(
                                        'rounded-xl px-4 py-3 text-sm font-black transition-all',
                                        quincena === value
                                            ? 'bg-white text-primary shadow-sm dark:bg-slate-800'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    )}
                                >
                                    {value}ª Qna
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

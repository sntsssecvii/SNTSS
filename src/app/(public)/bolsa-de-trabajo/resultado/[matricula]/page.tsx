'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    ArrowLeft, User, Briefcase, MapPin,
    TrendingUp, Award, Clock, Share2,
    ChevronRight, AlertCircle, CheckCircle2,
    Sparkles, Zap, Building2, ClipboardList, Repeat
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PosicionData {
    matricula: string
    nombre: string
    categoria: string
    zona: string
    tipoDocumento: string
    tipoContratacion?: string
    adscripcionNueva?: string
    turnoNuevo?: string
    registro?: string // CAT/CAD
    posicionBase: number
    posicionInterinato?: number
    totalEnCategoria: number
    totalEventualesEnCategoria?: number
}

interface Periodo {
    anio: number
    mes: number
    quincena: number
}

export default function ResultadoTrabajadorPage() {
    const { matricula } = useParams()
    const router = useRouter()
    const [data, setData] = useState<PosicionData | null>(null)
    const [periodo, setPeriodo] = useState<Periodo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const res = await fetch(`/api/trabajador/posicion?matricula=${matricula}`)
                const json = await res.json()

                if (!res.ok) {
                    throw new Error(json.error || 'Error al obtener los datos')
                }

                setData(json.data)
                setPeriodo(json.periodo)
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        if (matricula) fetchData()
    }, [matricula])

    if (loading) return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center space-y-6">
            <div className="relative w-24 h-24">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-[2rem]"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Zap className="w-8 h-8 text-primary animate-pulse" />
                </div>
            </div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] animate-pulse">Analizando Escalafón...</p>
        </div>
    )

    if (error || !data) return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6"
            >
                <AlertCircle className="w-10 h-10 text-red-500" />
            </motion.div>
            <h1 className="text-2xl font-black text-white mb-2 uppercase">Ups, algo salió mal</h1>
            <p className="text-slate-400 max-w-xs font-medium mb-8">{error || 'No se encontró información para esta matrícula.'}</p>
            <Button onClick={() => router.push('/bolsa-de-trabajo/consulta')} variant="outline" className="rounded-2xl border-white/10 text-white font-black px-8 h-14 hover:bg-white/5">
                <ArrowLeft className="mr-3 w-5 h-5" /> REINTENTAR
            </Button>
        </div>
    )

    const isNuevoIngreso = data.tipoDocumento === 'NUEVO_INGRESO'
    const isAmpliacion = data.tipoDocumento === 'AMPLIACIONES_JORNADA'
    const isCambioCTA = data.tipoDocumento === 'CAMBIOS_TURNO_ADSCRIPCION'

    return (
        <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 relative overflow-x-hidden">
            {/* Background Decor */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-30">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[140px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[140px]" />
            </div>

            <div className="max-w-6xl mx-auto z-10 relative">
                {/* TOP NAV */}
                <nav className="flex items-center justify-between mb-12">
                    <Button
                        onClick={() => router.push('/bolsa-de-trabajo/consulta')}
                        variant="ghost"
                        className="rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-black uppercase text-xs p-0 px-4 h-10"
                    >
                        <ArrowLeft className="mr-2 w-4 h-4" /> Volver a Consulta
                    </Button>
                    <div className="flex items-center gap-2">
                        <div className="text-right hidden md:block">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{periodo?.quincena}° Qna {periodo?.mes}/{periodo?.anio}</p>
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">Sincronización Oficial</p>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
                            <Share2 className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                        </div>
                    </div>
                </nav>

                {/* HERO SECTION */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-8 space-y-6"
                    >
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="w-24 h-24 bg-gradient-to-br from-primary to-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/30 relative">
                                <User className="w-12 h-12 text-white" />
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-xl border-4 border-[#020617] flex items-center justify-center">
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-4xl md:text-5xl font-black tracking-tight">{data.nombre}</h2>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-slate-400 font-bold uppercase text-[11px] tracking-widest">
                                    <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                        <Briefcase className="w-3.5 h-3.5 text-primary" /> {data.categoria}
                                    </span>
                                    <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                        <MapPin className="w-3.5 h-3.5 text-primary" /> {data.zona}
                                    </span>
                                    <span className="text-primary font-black">Matrícula: {data.matricula}</span>
                                </div>
                            </div>
                        </div>

                        {/* STATUS BADGE / TYPE INFO */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className={cn(
                                "inline-flex items-center gap-3 px-6 py-4 rounded-[2rem] border-2 shadow-lg",
                                isAmpliacion ? "border-blue-500/20 bg-blue-500/5 text-blue-500" :
                                    isCambioCTA ? "border-violet-500/20 bg-violet-500/5 text-violet-500 shadow-violet-500/5" :
                                        data.tipoContratacion === '8'
                                            ? "border-amber-500/20 bg-amber-500/5 text-amber-500"
                                            : "border-emerald-500/20 bg-emerald-500/5 text-emerald-500"
                            )}
                        >
                            <div className={cn("w-3 h-3 rounded-full animate-pulse",
                                isAmpliacion ? "bg-blue-500" :
                                    isCambioCTA ? "bg-violet-500" :
                                        data.tipoContratacion === '8' ? "bg-amber-500" : "bg-emerald-500"
                            )} />
                            <span className="font-black text-xl tracking-tighter uppercase italic">
                                {isCambioCTA ? `Trámite: ${data.registro === 'CAT' ? 'Cambio de Turno' : 'Cambio de Adscripción'}` :
                                    isAmpliacion ? `Trámite: Ampliación de Jornada` :
                                        isNuevoIngreso ? `Estatus: ${data.tipoContratacion === '8' ? 'Eventual (8)' : 'Interinato (2)'}` :
                                            `Trámite: ${data.tipoDocumento.replace('_', ' ')}`}
                            </span>
                            <Sparkles className="w-5 h-5 ml-2" />
                        </motion.div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-4 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl flex flex-col justify-center text-center space-y-4"
                    >
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Tu nivel de progreso</p>
                        <div className="text-7xl font-black text-primary leading-none tabular-nums">
                            {isCambioCTA || isAmpliacion ? Math.round((1 - data.posicionBase / data.totalEnCategoria) * 100) :
                                isNuevoIngreso && data.tipoContratacion === '8' ? Math.round((1 - data.posicionInterinato! / (data.totalEventualesEnCategoria || 1)) * 100) : 100}%
                        </div>
                        <p className="text-xs font-bold text-slate-400">
                            {isCambioCTA ? 'Basado en tu lugar en la unidad/turno solicitado' :
                                isAmpliacion ? 'Basado en tu lugar en la adscripción solicitada' :
                                    'Calculado en base a la antigüedad en la categoría'}
                        </p>
                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                    width: (isCambioCTA || isAmpliacion) ? `${(1 - data.posicionBase / data.totalEnCategoria) * 100}%` :
                                        isNuevoIngreso && data.tipoContratacion === '8' ? `${(1 - data.posicionInterinato! / (data.totalEventualesEnCategoria || 1)) * 100}%` : '100%'
                                }}
                                className="h-full bg-gradient-to-r from-primary to-emerald-500"
                            />
                        </div>
                    </motion.div>
                </section>

                {/* STATS BEYOND DASHBOARD */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {isNuevoIngreso ? (
                        <>
                            {/* INTERINATO CARD */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className={cn(
                                    "relative p-10 rounded-[3rem] border-2 transition-all hover:scale-[1.01]",
                                    data.tipoContratacion === '8'
                                        ? "bg-gradient-to-br from-primary/20 to-transparent border-primary/20 shadow-2xl shadow-primary/10"
                                        : "bg-white/5 border-white/10 grayscale opacity-60"
                                )}
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Posición para Interinato</h3>
                                    <TrendingUp className="w-6 h-6 text-primary" />
                                </div>

                                <div className="flex items-baseline gap-4 mb-4">
                                    <span className="text-9xl font-black tracking-tight leading-none text-white">{data.posicionInterinato || '--'}</span>
                                    <p className="text-xl font-bold text-slate-400">de {data.totalEventualesEnCategoria}</p>
                                </div>

                                {data.tipoContratacion === '8' ? (
                                    <div className="space-y-4">
                                        <p className="text-slate-300 font-medium">Eres el número <span className="text-white font-black">{data.posicionInterinato}</span> de todos los eventuales en tu categoría para pasar a interinato.</p>
                                        <div className="flex items-center gap-4 pt-4">
                                            <div className="flex -space-x-3">
                                                {[1, 2, 3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-[#020617] bg-slate-800" />)}
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hay {data.posicionInterinato! - 1} personas delante de ti</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 py-2">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                        <p className="font-black text-xl italic uppercase text-emerald-500">Ya cuentas con Interinato</p>
                                    </div>
                                )}
                            </motion.div>

                            {/* BASE CARD */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="relative p-10 rounded-[3rem] bg-gradient-to-br from-emerald-500/10 to-transparent border-2 border-emerald-500/20 shadow-2xl shadow-emerald-500/5 transition-all hover:scale-[1.01]"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500">Posición para Base</h3>
                                    <Award className="w-6 h-6 text-emerald-500" />
                                </div>

                                <div className="flex items-baseline gap-4 mb-4">
                                    <span className="text-9xl font-black tracking-tight leading-none text-white">{data.posicionBase}</span>
                                    <p className="text-xl font-bold text-slate-400">de {data.totalEnCategoria}</p>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-slate-300 font-medium">Lugar absoluto en el escalafón de <span className="text-white font-black">{data.categoria}</span> de la zona <span className="text-white font-black">{data.zona}</span>.</p>
                                    <div className="flex items-center gap-4 pt-4">
                                        <Clock className="w-5 h-5 text-slate-500" />
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Calculado por número progresivo oficial</p>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    ) : (isAmpliacion || isCambioCTA) ? (
                        <>
                            {/* ADSCRIPCION / SOLICITUD CARD */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className={cn(
                                    "relative p-10 rounded-[3rem] border-2 shadow-2xl transition-all hover:scale-[1.01]",
                                    isCambioCTA ? "bg-gradient-to-br from-violet-500/10 to-transparent border-violet-500/20 shadow-violet-500/5" :
                                        "bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20 shadow-blue-500/5"
                                )}
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className={cn("text-xs font-black uppercase tracking-[0.3em]", isCambioCTA ? "text-violet-500" : "text-blue-500")}>
                                        {isCambioCTA ? 'Lugar en Solicitud' : 'Lugar en Adscripción'}
                                    </h3>
                                    {isCambioCTA ? <Repeat className="w-6 h-6 text-violet-500" /> : <Building2 className="w-6 h-6 text-blue-500" />}
                                </div>

                                <div className="flex items-baseline gap-4 mb-4">
                                    <span className="text-9xl font-black tracking-tight leading-none text-white">{data.posicionBase}</span>
                                    <p className="text-xl font-bold text-slate-400">de {data.totalEnCategoria}</p>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-slate-300 font-medium">
                                        Tu posición entre todos los aspirantes que solicitaron {isCambioCTA && data.registro === 'CAT' ? 'el cambio de turno para' : 'la adscripción'} <span className="text-white font-black">{data.adscripcionNueva}</span>
                                        {isCambioCTA && data.turnoNuevo && <span> en el turno <span className="text-white font-black uppercase">{data.turnoNuevo}</span></span>}.
                                    </p>
                                    <div className="flex items-center gap-4 pt-4">
                                        <ClipboardList className="w-5 h-5 text-slate-500" />
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ordenado por número progresivo oficial</p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* CATEGORIA INFO CARD */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="relative p-10 rounded-[3rem] bg-white/5 border-2 border-white/10 transition-all hover:scale-[1.01] flex flex-col justify-center"
                            >
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                            <Briefcase className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Categoría</p>
                                            <p className="text-lg font-black text-white leading-none">{data.categoria}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                                            <MapPin className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Zona</p>
                                            <p className="text-lg font-black text-white leading-none">{data.zona}</p>
                                        </div>
                                    </div>
                                    {isCambioCTA && data.turnoNuevo && (
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                                                <Clock className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Turno Solicitado</p>
                                                <p className="text-lg font-black text-white leading-none uppercase">{data.turnoNuevo}</p>
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-xs font-bold text-slate-400 pt-4 border-t border-white/5">
                                        Se han encontrado un total de <span className="text-white">{data.totalEnCategoria}</span> solicitudes {isCambioCTA ? 'similares' : 'para esta adscripción'} en tu zona.
                                    </p>
                                </div>
                            </motion.div>
                        </>
                    ) : null}
                </section>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="p-8 bg-white/5 rounded-[2rem] border border-white/5 flex flex-col md:flex-row items-center gap-6"
                >
                    <div className="w-12 h-12 bg-amber-400 text-amber-900 rounded-2xl flex items-center justify-center shrink-0">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-widest text-white">Importante</p>
                        <p className="text-[11px] font-medium text-slate-400">Estos números son informativos y basados en el último corte oficial. Para aclaraciones legales, acude a tu delegación sindical más cercana.</p>
                    </div>
                    <Button variant="link" className="text-primary font-black uppercase text-[10px] tracking-widest ml-auto">Manual de Escalafón <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </motion.div>
            </div>
        </div>
    )
}

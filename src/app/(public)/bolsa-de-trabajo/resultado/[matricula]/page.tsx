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
import { NOMBRES_TIPOS, type TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

interface PosicionData {
    matricula: string
    nombre: string
    categoria: string
    zona: string
    tipoDocumento: TipoBolsaDeTrabajo
    tipoContratacion?: string
    adscripcionNueva?: string
    turnoNuevo?: string
    registro?: string // CAT/CAD
    posicionBase: number
    posicionInterinato?: number
    totalEnCategoria: number
    totalEventualesEnCategoria?: number
    grupoComparable?: Record<string, string | undefined>
}

interface Periodo {
    anio: number
    mes: number
    quincena: number
}

const GROUP_LABELS: Record<string, string> = {
    zona: 'Zona',
    categoria: 'Categoría',
    registro: 'Tipo de trámite',
    adscripcionNueva: 'Adscripción solicitada',
    turnoNuevo: 'Turno solicitado',
    jornadaNueva: 'Jornada solicitada',
}

function getProgressPercentage(data: PosicionData) {
    if (data.tipoDocumento === 'NUEVO_INGRESO' && data.tipoContratacion === '8') {
        const total = data.totalEventualesEnCategoria || 1
        const posicion = data.posicionInterinato || total
        return Math.max(0, Math.round((1 - posicion / total) * 100))
    }

    const total = data.totalEnCategoria || 1
    return Math.max(0, Math.round((1 - data.posicionBase / total) * 100))
}

function getPrimaryDescription(data: PosicionData) {
    switch (data.tipoDocumento) {
        case 'CAMBIOS_TURNO_ADSCRIPCION':
            return `Tu posición entre quienes solicitaron ${data.registro === 'CAT' ? 'el cambio de turno para' : 'la adscripción'} ${data.adscripcionNueva || 'la adscripción'}${data.registro === 'CAT' && data.turnoNuevo ? ` en turno ${data.turnoNuevo}` : ''}.`
        case 'AMPLIACIONES_JORNADA':
            return `Tu posición entre quienes solicitaron la adscripción ${data.adscripcionNueva || 'correspondiente'}${data.turnoNuevo ? ` en turno ${data.turnoNuevo}` : ''}.`
        case 'CAMBIOS_AREA':
            return `Tu posición para cambios de área dentro de ${data.categoria} en la zona ${data.zona}.`
        case 'CAMBIOS_RAMA':
            return `Tu posición para cambios de rama dentro de ${data.categoria} en la zona ${data.zona}.`
        case 'CAMBIOS_RESIDENCIA_ORIGEN':
            return `Tu posición para cambios de residencia origen en la zona ${data.zona}${data.turnoNuevo ? ` y turno ${data.turnoNuevo}` : ''}.`
        case 'CAMBIOS_RESIDENCIA_DESTINO':
            return `Tu posición para cambios de residencia destino en la zona ${data.zona}${data.turnoNuevo ? ` y turno ${data.turnoNuevo}` : ''}.`
        case 'CAMBIOS_TIPO_PLAZA':
            return `Tu posición para cambios de tipo de plaza dentro de ${data.categoria} en la zona ${data.zona}.`
        default:
            return `Tu posición actual dentro del listado oficial de ${NOMBRES_TIPOS[data.tipoDocumento] || 'bolsa de trabajo'}.`
    }
}

function getSummaryNote(data: PosicionData) {
    switch (data.tipoDocumento) {
        case 'CAMBIOS_AREA':
        case 'CAMBIOS_RAMA':
        case 'CAMBIOS_TIPO_PLAZA':
            return `Se encontraron ${data.totalEnCategoria} registros comparables en tu categoría y zona.`
        case 'CAMBIOS_RESIDENCIA_ORIGEN':
        case 'CAMBIOS_RESIDENCIA_DESTINO':
            return `Se encontraron ${data.totalEnCategoria} registros comparables para tu zona${data.turnoNuevo ? ` y turno ${data.turnoNuevo}` : ''}.`
        case 'AMPLIACIONES_JORNADA':
            return `Se encontraron ${data.totalEnCategoria} solicitudes comparables para la jornada${data.turnoNuevo ? `, turno ${data.turnoNuevo}` : ''} y adscripción solicitadas.`
        case 'CAMBIOS_TURNO_ADSCRIPCION':
            return `Se encontraron ${data.totalEnCategoria} solicitudes similares en tu grupo comparable.`
        default:
            return `Se encontraron ${data.totalEnCategoria} registros comparables en el corte oficial actual.`
    }
}

function getDetailEntries(data: PosicionData) {
    const entries = Object.entries(data.grupoComparable || {})
        .filter(([, value]) => Boolean(value))
        .filter(([key, value]) => {
            if (key === 'categoria' && value === data.categoria) return false
            if (key === 'zona' && value === data.zona) return false
            return true
        })

    return entries
}

export default function ResultadoTrabajadorPage() {
    const { matricula } = useParams()
    const router = useRouter()
    const [data, setData] = useState<PosicionData | null>(null)
    const [periodo, setPeriodo] = useState<Periodo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const normalizedMatricula = String(matricula || '').toUpperCase()
    const notFound = error?.includes('No se encontraron registros') || error?.includes('No se encontró información')

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)
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
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-6 z-10",
                    notFound ? "bg-amber-500/10" : "bg-red-500/10"
                )}
            >
                <AlertCircle className={cn("w-10 h-10", notFound ? "text-amber-400" : "text-red-500")} />
            </motion.div>
            <div className="max-w-md z-10">
                <h1 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase">
                    {notFound ? 'Matrícula no localizada' : 'Ups, algo salió mal'}
                </h1>
                <p className="text-slate-400 font-medium mb-3">
                    {notFound
                        ? `No encontramos un registro vigente para la matrícula ${normalizedMatricula || 'consultada'} en el corte oficial actual.`
                        : (error || 'No se encontró información para esta matrícula.')}
                </p>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-8">
                    {notFound ? 'Verifica la matrícula o intenta nuevamente más tarde' : 'Si el problema continúa, consulta con administración'}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => router.push('/bolsa-de-trabajo/consulta')} variant="outline" className="rounded-2xl border-white/10 text-white font-black px-8 h-14 hover:bg-white/5">
                        <ArrowLeft className="mr-3 w-5 h-5" /> Volver a consulta
                    </Button>
                    {notFound && (
                        <Button onClick={() => router.push('/bolsa-de-trabajo/consulta')} className="rounded-2xl font-black px-8 h-14">
                            Intentar otra matrícula
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )

    const isNuevoIngreso = data.tipoDocumento === 'NUEVO_INGRESO'
    const isAmpliacion = data.tipoDocumento === 'AMPLIACIONES_JORNADA'
    const isCambioCTA = data.tipoDocumento === 'CAMBIOS_TURNO_ADSCRIPCION'
    const progressPercentage = getProgressPercentage(data)
    const detailEntries = getDetailEntries(data)

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
                            <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-primary to-blue-600 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/30 relative">
                                <User className="w-12 h-12 text-white" />
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-xl border-4 border-[#020617] flex items-center justify-center">
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-3xl md:text-5xl font-black tracking-tight break-words">{data.nombre}</h2>
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
                                "inline-flex items-center gap-3 px-4 md:px-6 py-4 rounded-[2rem] border-2 shadow-lg max-w-full",
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
                            <span className="font-black text-base md:text-xl tracking-tighter uppercase italic break-words">
                                {isCambioCTA ? `Trámite: ${data.registro === 'CAT' ? 'Cambio de Turno' : 'Cambio de Adscripción'}` :
                                    isAmpliacion ? `Trámite: Ampliación de Jornada` :
                                        isNuevoIngreso ? `Estatus: ${data.tipoContratacion === '8' ? 'Eventual (8)' : 'Interinato (2)'}` :
                                            `Trámite: ${NOMBRES_TIPOS[data.tipoDocumento]}`}
                            </span>
                            <Sparkles className="w-5 h-5 ml-2" />
                        </motion.div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-4 bg-white/5 border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 backdrop-blur-xl flex flex-col justify-center text-center space-y-4"
                    >
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Tu nivel de progreso</p>
                        <div className="text-5xl md:text-7xl font-black text-primary leading-none tabular-nums">
                            {progressPercentage}%
                        </div>
                        <p className="text-xs font-bold text-slate-400">
                            {isCambioCTA ? 'Basado en tu lugar en la unidad/turno solicitado' :
                                isAmpliacion ? 'Basado en tu lugar en la adscripción solicitada' :
                                    isNuevoIngreso ? 'Calculado en base a la antigüedad en la categoría' : 'Basado en tu lugar actual dentro del grupo comparable'}
                        </p>
                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercentage}%` }}
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
                                    "relative p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 transition-all hover:scale-[1.01]",
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
                                    <span className="text-6xl md:text-9xl font-black tracking-tight leading-none text-white">{data.posicionInterinato || '--'}</span>
                                    <p className="text-lg md:text-xl font-bold text-slate-400">de {data.totalEventualesEnCategoria}</p>
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
                                className="relative p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-gradient-to-br from-emerald-500/10 to-transparent border-2 border-emerald-500/20 shadow-2xl shadow-emerald-500/5 transition-all hover:scale-[1.01]"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500">Posición para Base</h3>
                                    <Award className="w-6 h-6 text-emerald-500" />
                                </div>

                                <div className="flex items-baseline gap-4 mb-4">
                                    <span className="text-6xl md:text-9xl font-black tracking-tight leading-none text-white">{data.posicionBase}</span>
                                    <p className="text-lg md:text-xl font-bold text-slate-400">de {data.totalEnCategoria}</p>
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
                    ) : (
                        <>
                            {/* ADSCRIPCION / SOLICITUD CARD */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className={cn(
                                    "relative p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 shadow-2xl transition-all hover:scale-[1.01]",
                                    isCambioCTA ? "bg-gradient-to-br from-violet-500/10 to-transparent border-violet-500/20 shadow-violet-500/5" :
                                        isAmpliacion ? "bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20 shadow-blue-500/5" :
                                            "bg-gradient-to-br from-sky-500/10 to-transparent border-sky-500/20 shadow-sky-500/5"
                                )}
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className={cn(
                                        "text-xs font-black uppercase tracking-[0.3em]",
                                        isCambioCTA ? "text-violet-500" : isAmpliacion ? "text-blue-500" : "text-sky-500"
                                    )}>
                                        {isCambioCTA ? 'Lugar en Solicitud' : isAmpliacion ? 'Lugar en Adscripción' : 'Posición Actual'}
                                    </h3>
                                    {isCambioCTA ? <Repeat className="w-6 h-6 text-violet-500" /> : isAmpliacion ? <Building2 className="w-6 h-6 text-blue-500" /> : <ClipboardList className="w-6 h-6 text-sky-500" />}
                                </div>

                                <div className="flex items-baseline gap-4 mb-4">
                                    <span className="text-6xl md:text-9xl font-black tracking-tight leading-none text-white">{data.posicionBase}</span>
                                    <p className="text-lg md:text-xl font-bold text-slate-400">de {data.totalEnCategoria}</p>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-slate-300 font-medium">{getPrimaryDescription(data)}</p>
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
                                className="relative p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-white/5 border-2 border-white/10 transition-all hover:scale-[1.01] flex flex-col justify-center"
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
                                    {detailEntries.map(([key, value]) => (
                                        <div key={key} className="flex items-center gap-4">
                                            <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-500">
                                                <ClipboardList className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">
                                                    {GROUP_LABELS[key] || key}
                                                </p>
                                                <p className="text-base md:text-lg font-black text-white leading-none uppercase break-words">{value}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <p className="text-xs font-bold text-slate-400 pt-4 border-t border-white/5">
                                        {getSummaryNote(data)}
                                    </p>
                                </div>
                            </motion.div>
                        </>
                    )}
                </section>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="p-6 md:p-8 bg-white/5 rounded-[2rem] border border-white/5 flex flex-col md:flex-row items-center gap-6"
                >
                    <div className="w-12 h-12 bg-amber-400 text-amber-900 rounded-2xl flex items-center justify-center shrink-0">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-widest text-white">Importante</p>
                        <p className="text-[11px] font-medium text-slate-400">Estos números son informativos y basados en el último corte oficial. Para aclaraciones legales, acude a tu delegación sindical más cercana.</p>
                    </div>
                    <Button variant="link" className="text-primary font-black uppercase text-[10px] tracking-widest md:ml-auto">Manual de Escalafón <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </motion.div>
            </div>
        </div>
    )
}

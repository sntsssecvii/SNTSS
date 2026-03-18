'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getMisTramitesCliente } from '@/lib/firebase/trabajador-portal'
import { NOMBRES_TIPOS, type TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Loader2,
  MapPin,
  ShieldCheck,
  UserRound,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TramiteData {
  documentoId: string
  recordId?: string
  matricula: string
  nombre: string
  categoria: string
  zona: string
  tipoDocumento: TipoBolsaDeTrabajo
  tipoContratacion?: string
  adscripcionNueva?: string
  turnoNuevo?: string
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

function getTurnoLabel(turno?: string) {
  switch ((turno || '').toUpperCase()) {
    case 'MAT':
      return 'Turno matutino'
    case 'VES':
      return 'Turno vespertino'
    case 'NOC':
      return 'Turno nocturno'
    default:
      return turno || ''
  }
}

function getTramiteSubtitle(item: TramiteData) {
  switch (item.tipoDocumento) {
    case 'CAMBIOS_TURNO_ADSCRIPCION':
      return item.adscripcionNueva
        ? `${item.adscripcionNueva}${item.turnoNuevo ? ` • ${getTurnoLabel(item.turnoNuevo)}` : ''}`
        : 'Trámite vigente'
    case 'AMPLIACIONES_JORNADA':
      return item.adscripcionNueva
        ? `${item.adscripcionNueva}${item.turnoNuevo ? ` • ${getTurnoLabel(item.turnoNuevo)}` : ''}`
        : 'Solicitud vigente'
    default:
      return `${item.categoria} • ${item.zona}`
  }
}

function getPrimaryMetric(item: TramiteData) {
  if (item.tipoDocumento === 'NUEVO_INGRESO' && item.tipoContratacion === '8' && item.posicionInterinato) {
    return {
      label: 'Posición para interinato',
      value: item.posicionInterinato,
      total: item.totalEventualesEnCategoria || item.totalEnCategoria,
    }
  }

  return {
    label: 'Posición actual',
    value: item.posicionBase,
    total: item.totalEnCategoria,
  }
}

export default function DashboardPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()
  const [tramites, setTramites] = useState<TramiteData[]>([])
  const [periodo, setPeriodo] = useState<Periodo | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [greetingInfo, setGreetingInfo] = useState({ greeting: 'Hola', dayMessage: '' })

  useEffect(() => {
    const userRole = userData?.role?.toUpperCase()
    if (!loading && (!user || userRole !== 'USER')) {
      router.push('/login')
    }
  }, [user, userData, loading, router])

  useEffect(() => {
    // Generar saludo dinámico
    const hour = new Date().getHours()
    let newGreeting = 'Buenas noches'
    if (hour >= 5 && hour < 12) newGreeting = 'Buenos días'
    else if (hour >= 12 && hour < 19) newGreeting = 'Buenas tardes'

    const days = [
      '¡Feliz Domingo! ☀️',
      '¡Excelente Lunes! 🚀',
      '¡Gran Martes! ⚡️',
      '¡Feliz Miércoles! 🐪',
      '¡Casi Viernes! Jueves 💪',
      '¡Por fin es Viernes! 🎉',
      '¡Gran Sábado! 🍻',
    ]
    const dayIndex = new Date().getDay()
    
    setGreetingInfo({
      greeting: newGreeting,
      dayMessage: days[dayIndex]
    })
  }, [])

  useEffect(() => {
    const fetchTramites = async () => {
      if (!user || userData?.role?.toUpperCase() !== 'USER') return

      try {
        setPageLoading(true)
        setError(null)
        setErrorStatus(null)

        if (!userData?.matricula?.trim()) {
          throw new Error('El usuario autenticado no tiene matrícula vinculada.')
        }

        const result = await getMisTramitesCliente()
        setTramites(result.data || [])
        setPeriodo(result.periodo || null)
      } catch (err: any) {
        let nextErrorStatus: number | null = null
        if (err?.message?.includes('matrícula vinculada')) nextErrorStatus = 400
        else if (err?.message?.includes('No se pudo validar la sesión')) nextErrorStatus = 401
        else if (err?.message?.includes('No hay información oficial activa')) nextErrorStatus = 404
        if (nextErrorStatus !== null) setErrorStatus(nextErrorStatus)
        setError(err.message || 'Error al cargar tus trámites.')
      } finally {
        setPageLoading(false)
      }
    }

    fetchTramites()
  }, [user, userData])

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-widest">Personalizando tu espacio...</span>
        </div>
      </div>
    )
  }

  if (!user || userData?.role?.toUpperCase() !== 'USER') {
    return null
  }

  return (
    <main className="container mx-auto p-4 md:p-8 min-h-[calc(100vh-4rem)] flex flex-col justify-start">
      <div className="max-w-7xl w-full mx-auto my-4 md:my-8 space-y-10">
        
        {/* HERO HEADER PREMIUM */}
        <motion.section 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center relative"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-black mb-6 shadow-sm border border-primary/20 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            SNTSS SECCIÓN VII • {greetingInfo.dayMessage}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent mb-4 tracking-tighter leading-none">
            {greetingInfo.greeting}, <span className="text-primary">{userData?.nombre?.split(' ')[0]}</span>
          </h1>
          <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-bold mb-10 leading-relaxed uppercase tracking-tight">
            Consulta tus posiciones vigentes y el estado oficial de tus trámites sindicales.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-xl mx-auto">
            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
              <Card className="border-border/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shadow-sm rounded-3xl overflow-hidden group border">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">Matrícula vinculada</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none mt-1">{userData.matricula}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
              <Card className="border-border/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shadow-sm rounded-3xl overflow-hidden group border">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 transition-colors">Corte oficial activo</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none mt-1 uppercase tracking-tight">
                      {periodo ? `${periodo.quincena}° Q ${periodo.mes}/${periodo.anio}` : 'S/D'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.section>

        {/* ERROR / EMPTY STATE */}
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="border-amber-500/20 bg-amber-500/5 backdrop-blur-sm rounded-[2rem] border-2">
                <CardContent className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none mb-2">
                        {errorStatus === 400 ? 'Matrícula no vinculada' :
                          errorStatus === 401 ? 'Sesión expirada' :
                            errorStatus === 403 ? 'Acceso restringido' :
                              errorStatus === 404 ? 'Sin trámites vigentes' :
                                'Algo salió mal'}
                      </p>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{error}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {errorStatus === 401 ? (
                      <Button onClick={() => router.push('/login')} className="rounded-2xl font-black bg-amber-600 hover:bg-amber-700 px-8 h-12">Iniciar sesión</Button>
                    ) : (
                      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-2xl font-black border-amber-200 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40 px-8 h-12">Reintentar</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : tramites.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 rounded-[2rem] border shadow-xl">
                <CardContent className="flex flex-col items-center text-center gap-6 p-12">
                  <div className="w-20 h-20 rounded-[2rem] bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                    <ClipboardList className="h-10 w-10 text-slate-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">No tienes trámites vigentes</h2>
                    <p className="text-sm font-bold text-slate-500 max-w-sm mx-auto uppercase tracking-tight leading-relaxed">
                      Si esperabas ver información aquí, valida con tu representación sindical que tu matrícula aparezca en la sincronización publicada.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border">
                    <ShieldCheck className="h-3.5 w-3.5" />
                   Solo se muestran datos oficiales vinculados
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
                    Mis Posiciones Actuales
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-white text-base font-black shadow-lg shadow-primary/20">
                      {tramites.length}
                    </span>
                  </h2>
                </div>
              </div>

              <div className={cn(
                "grid gap-6",
                tramites.length === 1 ? "grid-cols-1 max-w-3xl mx-auto" : "xl:grid-cols-2"
              )}>
                {tramites.map((item, index) => {
                  const metric = getPrimaryMetric(item)

                  return (
                    <motion.div
                      key={`${item.documentoId}-${item.recordId || item.tipoDocumento}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      whileHover={{ y: -5 }}
                      className="group"
                    >
                      <Card className="overflow-hidden border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 border relative">
                        {/* Indicador de posición alta */}
                        {metric.value <= 10 && (
                          <div className="absolute top-0 right-10 transform -translate-y-1/2 ">
                            <div className="bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-primary/30 uppercase tracking-widest flex items-center gap-1.5 border-2 border-white dark:border-slate-900">
                              <TrendingUp className="h-3 w-3" />
                              Prioridad Alta
                            </div>
                          </div>
                        )}

                        <div className="p-8 lg:p-10 space-y-8">
                          {/* Header de la tarjeta */}
                          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-3">
                              <div className="inline-block px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">
                                {NOMBRES_TIPOS[item.tipoDocumento]}
                              </div>
                              <h3 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                                {getTramiteSubtitle(item)}
                              </h3>
                            </div>
                            
                            <div className="rounded-[2.5rem] bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/10 p-6 lg:p-8 text-center min-w-[140px] shadow-inner relative group-hover:from-primary group-hover:to-primary/90 transition-all duration-500">
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary group-hover:text-white/80 transition-colors mb-2">
                                {metric.label}
                              </p>
                              <div className="flex items-baseline justify-center gap-1">
                                <span className="text-5xl lg:text-6xl font-black text-slate-900 dark:text-white group-hover:text-white transition-colors">
                                  {metric.value}
                                </span>
                              </div>
                              <p className="text-xs font-black text-slate-400 group-hover:text-white/60 transition-colors mt-2 uppercase tracking-widest">
                                de {metric.total} total
                              </p>
                            </div>
                          </div>

                          {/* Info Grid */}
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="relative overflow-hidden rounded-3xl bg-slate-50 dark:bg-slate-800/40 p-5 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors group/item">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Categoría</p>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center group-hover/item:scale-110 transition-transform">
                                  <Briefcase className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate">
                                  {item.categoria}
                                </span>
                              </div>
                            </div>

                            <div className="relative overflow-hidden rounded-3xl bg-slate-50 dark:bg-slate-800/40 p-5 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors group/item">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Zona Operativa</p>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center group-hover/item:scale-110 transition-transform">
                                  <MapPin className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate">
                                  {item.zona}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Footer de la tarjeta */}
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                             <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                               Matrícula verificada: <span className="text-slate-900 dark:text-white font-black">{item.matricula}</span>
                             </p>
                            </div>
                            <Button
                              onClick={() => router.push(`/dashboard/tramites/${item.documentoId}${item.recordId ? `?recordId=${encodeURIComponent(item.recordId)}` : ''}`)}
                              className="w-full sm:w-auto rounded-2xl h-12 px-8 font-black bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white transition-all group/btn shadow-lg hover:shadow-primary/20"
                            >
                              VER DETALLES COMPLETOS
                              <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

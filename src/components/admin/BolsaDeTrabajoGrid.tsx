'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  FileText, 
  Files, 
  Briefcase, 
  ArrowRightLeft, 
  MapPin, 
  Clock
} from 'lucide-react'
import { auth } from '@/lib/firebase/firebase-client'

interface GridStats {
  AMPLIACIONES_JORNADA: number
  CAMBIOS_AREA: number
  CAMBIOS_RAMA: number
  CAMBIOS_RESIDENCIA_DESTINO: number
  CAMBIOS_RESIDENCIA_ORIGEN: number
  CAMBIOS_TIPO_PLAZA: number
  CAMBIOS_TURNO_ADSCRIPCION: number
  NUEVO_INGRESO: number
  quincenaLabel: string
  isLoading: boolean
}

interface BolsaGridResponse {
  success: boolean
  data?: {
    quincenaLabel: string
    totals: Omit<GridStats, 'quincenaLabel' | 'isLoading'>
  }
  error?: string
}

export default function BolsaDeTrabajoGrid() {
  const [stats, setStats] = useState<GridStats>({
    AMPLIACIONES_JORNADA: 0,
    CAMBIOS_AREA: 0,
    CAMBIOS_RAMA: 0,
    CAMBIOS_RESIDENCIA_DESTINO: 0,
    CAMBIOS_RESIDENCIA_ORIGEN: 0,
    CAMBIOS_TIPO_PLAZA: 0,
    CAMBIOS_TURNO_ADSCRIPCION: 0,
    NUEVO_INGRESO: 0,
    quincenaLabel: 'Cargando...',
    isLoading: true
  })

  useEffect(() => {
    let mounted = true

    const loadStats = async () => {
      try {
        const currentUser = auth.currentUser
        if (!currentUser) {
          throw new Error('No se pudo validar la sesión del administrador.')
        }

        const idToken = await currentUser.getIdToken()
        const response = await fetch('/api/admin/bolsa/grid-resumen', {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
        })
        const payload = await response.json() as BolsaGridResponse

        if (!response.ok || !payload.data) {
          throw new Error(payload.error || 'No se pudo cargar el resumen de bolsa.')
        }

        if (!mounted) return

        setStats({
          ...payload.data.totals,
          quincenaLabel: payload.data.quincenaLabel,
          isLoading: false
        })
      } catch (error) {
        console.error('Error fetching bolsa grid stats:', error)
        if (mounted) {
          setStats(prev => ({ ...prev, isLoading: false }))
        }
      }
    }

    loadStats()

    return () => {
      mounted = false
    }
  }, [])

  if (stats.isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-40 lg:h-48 bg-slate-200/50 dark:bg-slate-800/50 rounded-[2rem] animate-pulse" />
        ))}
      </div>
    )
  }

  const gridItems = [
    {
      title: 'Nuevo Ingreso',
      value: stats.NUEVO_INGRESO,
      icon: Briefcase,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-50 dark:bg-emerald-900/10 hover:border-emerald-200 dark:hover:border-emerald-800'
    },
    {
      title: 'Amp. Jornada',
      value: stats.AMPLIACIONES_JORNADA,
      icon: Clock,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgClass: 'bg-cyan-50 dark:bg-cyan-900/10 hover:border-cyan-200 dark:hover:border-cyan-800'
    },
    {
      title: 'C/Turno Adsc',
      value: stats.CAMBIOS_TURNO_ADSCRIPCION,
      icon: ArrowRightLeft,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgClass: 'bg-indigo-50 dark:bg-indigo-900/10 hover:border-indigo-200 dark:hover:border-indigo-800'
    },
    {
      title: 'Cambio Área',
      value: stats.CAMBIOS_AREA,
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-50 dark:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800'
    },
    {
      title: 'Cambio Rama',
      value: stats.CAMBIOS_RAMA,
      icon: FileText,
      color: 'text-violet-600 dark:text-violet-400',
      bgClass: 'bg-violet-50 dark:bg-violet-900/10 hover:border-violet-200 dark:hover:border-violet-800'
    },
    {
      title: 'Resid. Destino',
      value: stats.CAMBIOS_RESIDENCIA_DESTINO,
      icon: MapPin,
      color: 'text-rose-600 dark:text-rose-400',
      bgClass: 'bg-rose-50 dark:bg-rose-900/10 hover:border-rose-200 dark:hover:border-rose-800'
    },
    {
      title: 'Resid. Origen',
      value: stats.CAMBIOS_RESIDENCIA_ORIGEN,
      icon: MapPin,
      color: 'text-orange-600 dark:text-orange-400',
      bgClass: 'bg-orange-50 dark:bg-orange-900/10 hover:border-orange-200 dark:hover:border-orange-800'
    },
    {
      title: 'Tipo de Plaza',
      value: stats.CAMBIOS_TIPO_PLAZA,
      icon: FileText,
      color: 'text-fuchsia-600 dark:text-fuchsia-400',
      bgClass: 'bg-fuchsia-50 dark:bg-fuchsia-900/10 hover:border-fuchsia-200 dark:hover:border-fuchsia-800'
    }
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 lg:mb-8 px-2 h-8 sm:h-10">
        <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
          Estadísticas de Trámites
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            Bolsa de Trabajo
          </span>
          <span className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-wider bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            {stats.quincenaLabel}
          </span>
        </div>
      </div>
      
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6"
      >
        {gridItems.map((item, idx) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.title}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={`relative overflow-hidden group rounded-[2rem] border border-slate-200/60 dark:border-slate-800 p-6 xl:p-8 transition-all duration-300 ${item.bgClass}`}
            >
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500">
                <Icon className="w-32 h-32 lg:w-40 lg:h-40" />
              </div>
              
              <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                <div>
                  <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center mb-4 lg:mb-6 ${item.color}`}>
                    <Icon className="h-6 w-6 lg:h-7 lg:w-7" />
                  </div>
                  
                  <p className="text-[11px] lg:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-tight mb-2 h-8 overflow-hidden text-ellipsis line-clamp-2">
                    {item.title}
                  </p>
                </div>
                <div className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  {item.value.toLocaleString()}
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

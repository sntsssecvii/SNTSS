'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase/firebase-client'
import { Users, FileText, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'

interface AppStats {
  usuariosActivos: number
  validacionesPendientes: number
  documentosProcesados: number
  loading: boolean
}

interface DashboardChipsResponse {
  success: boolean
  data: {
    usuariosActivos: number
    validacionesPendientes: number
    documentosProcesados: number
  }
}

export default function DashboardChips() {
  const [stats, setStats] = useState<AppStats>({
    usuariosActivos: 0,
    validacionesPendientes: 0,
    documentosProcesados: 0,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    const fetchStats = async () => {
      try {
        const currentUser = auth.currentUser
        if (!currentUser) {
          throw new Error('No se pudo validar la sesión del administrador.')
        }

        const idToken = await currentUser.getIdToken()
        const response = await fetch('/api/admin/dashboard-chips', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        })

        const payload = await response.json() as DashboardChipsResponse & { error?: string }

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error || 'No se pudieron cargar las métricas del dashboard.')
        }

        if (mounted) {
          setStats({
            usuariosActivos: payload.data.usuariosActivos,
            validacionesPendientes: payload.data.validacionesPendientes,
            documentosProcesados: payload.data.documentosProcesados,
            loading: false,
          })
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        if (mounted) {
          setStats(prev => ({ ...prev, loading: false }))
        }
      }
    }

    fetchStats()

    return () => {
      mounted = false
    }
  }, [])

  if (stats.loading) {
    return (
      <div className="flex flex-wrap justify-center gap-4 mb-10">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-32 bg-slate-200/50 dark:bg-slate-800/50 rounded-full animate-pulse" />
        ))}
      </div>
    )
  }

  const chips = [
    {
      label: 'Usuarios Activos',
      value: stats.usuariosActivos,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bgBase: 'bg-white dark:bg-slate-800',
      bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
      border: 'border-slate-200/60 dark:border-slate-700',
    },
    {
      label: 'Validaciones Pendientes',
      value: stats.validacionesPendientes,
      icon: ShieldAlert,
      color: stats.validacionesPendientes > 0 ? 'text-amber-500' : 'text-slate-400',
      bgBase: stats.validacionesPendientes > 0 ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-white dark:bg-slate-800',
      bgHover: 'hover:bg-amber-100/50 dark:hover:bg-amber-900/30',
      border: stats.validacionesPendientes > 0 ? 'border-amber-200 dark:border-amber-800' : 'border-slate-200/60 dark:border-slate-700',
      pulse: stats.validacionesPendientes > 0
    },
    {
      label: 'Documentos en Bolsa',
      value: stats.documentosProcesados,
      icon: FileText,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgBase: 'bg-white dark:bg-slate-800',
      bgHover: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
      border: 'border-slate-200/60 dark:border-slate-700',
    }
  ]

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-10"
    >
      {chips.map((chip, idx) => {
        const Icon = chip.icon
        return (
          <motion.div
            key={chip.label}
            whileHover={{ scale: 1.05, y: -2 }}
            className={`flex items-center gap-3 px-4 py-2 ${chip.bgBase} ${chip.bgHover} border ${chip.border} rounded-full shadow-sm cursor-default transition-all duration-300`}
          >
            <div className={`relative flex items-center justify-center ${chip.color}`}>
              {chip.pulse && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-20 animate-ping"></span>
              )}
              <Icon className="h-4 w-4 relative z-10" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-0.5">
                {chip.label}
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white leading-none">
                {chip.value.toLocaleString()}
              </span>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

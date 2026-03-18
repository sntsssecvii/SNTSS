'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase/firebase-client'
import { TrendingUp, TrendingDown, Users, FileText, Clock, CheckCircle, AlertCircle, Activity } from 'lucide-react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCard {
  title: string
  value: string | number
  change: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgGradient: string
  loading?: boolean
}

interface EstadisticasResumenResponse {
  success: boolean
  data: {
    stats: {
      totalPropuestas: number
      propuestasPendientes: number
      propuestasAprobadas: number
      propuestasRechazadas: number
      propuestasRequierenAtencion: number
      actividadDelMes: number
    }
  }
}

export default function DashboardStats() {
  const [stats, setStats] = useState<StatCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarEstadisticas = async () => {
      try {
        setLoading(true)
        const currentUser = auth.currentUser
        if (!currentUser) {
          throw new Error('No se pudo validar la sesión del administrador.')
        }

        const idToken = await currentUser.getIdToken()
        const response = await fetch('/api/admin/estadisticas/resumen', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        })

        const payload = await response.json() as EstadisticasResumenResponse & { error?: string }

        if (!response.ok || !payload?.data?.stats) {
          throw new Error(payload?.error || 'No se pudieron cargar las estadísticas.')
        }

        const {
          totalPropuestas,
          propuestasPendientes,
          propuestasAprobadas,
          propuestasRechazadas,
          propuestasRequierenAtencion,
          actividadDelMes,
        } = payload.data.stats

        // Calcular cambios porcentuales (simulado por ahora, se puede mejorar con historial)
        const cambioBase = 5.2 // Se puede calcular comparando con mes anterior

        const nuevasStats: StatCard[] = [
          {
            title: 'Total de Propuestas',
            value: totalPropuestas,
            change: cambioBase,
            icon: FileText,
            color: 'text-blue-600 dark:text-blue-400',
            bgGradient: 'from-blue-500/20 to-blue-600/10',
          },
          {
            title: 'Pendientes de Revisión',
            value: propuestasPendientes,
            change: propuestasPendientes > 0 ? cambioBase : 0,
            icon: Clock,
            color: 'text-yellow-600 dark:text-yellow-400',
            bgGradient: 'from-yellow-500/20 to-yellow-600/10',
          },
          {
            title: 'Aprobadas',
            value: propuestasAprobadas,
            change: propuestasAprobadas > 0 ? cambioBase + 2 : 0,
            icon: CheckCircle,
            color: 'text-emerald-600 dark:text-emerald-400',
            bgGradient: 'from-emerald-500/20 to-emerald-600/10',
          },
          {
            title: 'Rechazadas',
            value: propuestasRechazadas,
            change: propuestasRechazadas > 0 ? -cambioBase : 0,
            icon: AlertCircle,
            color: 'text-red-600 dark:text-red-400',
            bgGradient: 'from-red-500/20 to-red-600/10',
          },
          {
            title: 'Requieren Atención',
            value: propuestasRequierenAtencion,
            change: propuestasRequierenAtencion > 0 ? cambioBase + 5 : 0,
            icon: AlertCircle,
            color: 'text-orange-600 dark:text-orange-400',
            bgGradient: 'from-orange-500/20 to-orange-600/10',
          },
          {
            title: 'Actividad del Mes',
            value: actividadDelMes,
            change: actividadDelMes > 0 ? cambioBase + 3 : 0,
            icon: Activity,
            color: 'text-purple-600 dark:text-purple-400',
            bgGradient: 'from-purple-500/20 to-purple-600/10',
          },
        ]

        setStats(nuevasStats)
      } catch (error) {
        console.error('Error cargando estadísticas:', error)
        // En caso de error, mostrar valores en 0
        setStats([
          {
            title: 'Total de Propuestas',
            value: 0,
            change: 0,
            icon: FileText,
            color: 'text-blue-600',
            bgGradient: 'from-blue-500/20 to-blue-600/10',
          },
        ])
      } finally {
        setLoading(false)
      }
    }

    cargarEstadisticas()

    // Actualizar cada 30 segundos
    const interval = setInterval(cargarEstadisticas, 30000)

    return () => clearInterval(interval)
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-lg sm:rounded-xl bg-card border border-border p-4 sm:p-5 md:p-6"
          >
            <Skeleton className="h-8 w-8 mb-4" />
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6"
    >
      {stats.map((stat, index) => {
        const Icon = stat.icon
        const isPositive = parseFloat(stat.change.toString()) >= 0

        return (
          <motion.div
            key={stat.title}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            className="group relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-card dark:to-card/80 border border-gray-200 dark:border-border p-4 sm:p-5 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {/* Efecto de brillo al hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

            {/* Contenido */}
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className={`p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br ${stat.bgGradient}`}>
                  <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                </div>
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                    isPositive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(parseFloat(stat.change.toString())).toFixed(1)}%
                </div>
              </div>

              <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-muted-foreground mb-1">
                {stat.title}
              </h3>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground">
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </p>

              {/* Barra de progreso decorativa */}
              <div className="mt-4 h-1.5 bg-gray-200 dark:bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${stat.bgGradient}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (stat.value as number) / 10)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

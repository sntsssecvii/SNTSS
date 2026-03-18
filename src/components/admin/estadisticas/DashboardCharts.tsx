'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase/firebase-client'
import { motion } from 'framer-motion'
import { BarChart3, PieChart, TrendingUp, Calendar } from 'lucide-react'
import { EstadoPropuesta } from '@/types/workflow'
import { Skeleton } from '@/components/ui/skeleton'

interface ChartData {
  name: string
  value: number
  color: string
}

interface BarChartItem {
  month: string
  cantidad: number
}

interface EstadisticasResumenChartsResponse {
  success: boolean
  data: {
    charts: {
      propuestasPorMes: Array<{ mes: string; cantidad: number }>
      distribucionPorEstado: Record<string, number>
    }
  }
}

const ESTADO_COLORS: Record<EstadoPropuesta, string> = {
  [EstadoPropuesta.BORRADOR]: '#6b7280', // gray
  [EstadoPropuesta.EN_REVISION]: '#3b82f6', // blue
  [EstadoPropuesta.APROBADA]: '#10b981', // green
  [EstadoPropuesta.RECHAZADA]: '#ef4444', // red
  [EstadoPropuesta.ENVIADA_IMSS]: '#8b5cf6', // purple
  [EstadoPropuesta.COMPLETADA]: '#06b6d4', // cyan
}

const ESTADO_LABELS: Record<EstadoPropuesta, string> = {
  [EstadoPropuesta.BORRADOR]: 'Borrador',
  [EstadoPropuesta.EN_REVISION]: 'En Revisión',
  [EstadoPropuesta.APROBADA]: 'Aprobadas',
  [EstadoPropuesta.RECHAZADA]: 'Rechazadas',
  [EstadoPropuesta.ENVIADA_IMSS]: 'Enviadas al IMSS',
  [EstadoPropuesta.COMPLETADA]: 'Completadas',
}

export default function DashboardCharts() {
  const [barData, setBarData] = useState<BarChartItem[]>([])
  const [pieData, setPieData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarDatos = async () => {
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

        const payload = await response.json() as EstadisticasResumenChartsResponse & { error?: string }

        if (!response.ok || !payload?.data?.charts) {
          throw new Error(payload?.error || 'No se pudieron cargar los gráficos.')
        }

        const mesData = payload.data.charts.propuestasPorMes
        const distribucion = payload.data.charts.distribucionPorEstado

        // Formatear datos de barras
        setBarData(mesData.map(item => ({ month: item.mes, cantidad: item.cantidad })))

        // Formatear datos de pastel
        const pieDataFormatted: ChartData[] = Object.entries(distribucion)
          .filter(([_, value]) => value > 0)
          .map(([estado, value]) => ({
            name: ESTADO_LABELS[estado as EstadoPropuesta],
            value,
            color: ESTADO_COLORS[estado as EstadoPropuesta],
          }))
        
        setPieData(pieDataFormatted)
      } catch (error) {
        console.error('Error cargando datos de gráficos:', error)
        // Datos por defecto en caso de error
        setBarData([])
        setPieData([
          { name: 'Aprobadas', value: 0, color: '#10b981' },
          { name: 'Pendientes', value: 0, color: '#f59e0b' },
        ])
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()

    // Actualizar cada 60 segundos
    const interval = setInterval(cargarDatos, 60000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  const maxBarValue = Math.max(...(barData.length > 0 ? barData.map((d) => d.cantidad) : [1]))

  // Calcular porcentajes para el gráfico de pastel
  const totalPie = pieData.reduce((sum, item) => sum + item.value, 0)
  const piePercentages = pieData.map((item) => ({
    ...item,
    percentage: totalPie > 0 ? (item.value / totalPie) * 100 : 0,
  }))

  // Calcular el perímetro de la circunferencia para el gráfico de pastel
  const radius = 80
  const circumference = 2 * Math.PI * radius

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
      {/* Gráfico de Barras */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 md:p-6 shadow-lg"
      >
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Propuestas por Mes
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Últimos 12 meses</p>
            </div>
          </div>
        </div>

        <div className="h-48 sm:h-56 md:h-64 flex items-end justify-between gap-1 sm:gap-2">
          {barData.length > 0 ? (
            barData.map((item, index) => (
              <motion.div
                key={item.month}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(5, (item.cantidad / maxBarValue) * 100)}%` }}
                transition={{ duration: 0.8, delay: index * 0.05 }}
                className="flex-1 group relative"
              >
                <div className="relative h-full w-full flex flex-col items-center">
                  <motion.div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg hover:from-blue-700 hover:to-blue-500 transition-all duration-300 cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {item.cantidad}
                    </div>
                  </motion.div>
                  <span className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium">
                    {item.month}
                  </span>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <p>No hay datos disponibles</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Gráfico de Pastel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 md:p-6 shadow-lg"
      >
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <PieChart className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Estado de Propuestas
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Distribución actual</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-8">
          {/* SVG del gráfico de pastel */}
          <div className="relative">
            <svg width="160" height="160" className="transform -rotate-90 sm:w-[180px] sm:h-[180px] md:w-[200px] md:h-[200px]">
              {(() => {
                let currentOffset = 0
                return piePercentages.map((item, index) => {
                  const segmentLength = (item.percentage / 100) * circumference
                  const startOffset = (currentOffset / 100) * circumference
                  const finalOffset = circumference - startOffset
                  currentOffset += item.percentage

                  return (
                    <motion.circle
                      key={`${item.name}-${index}`}
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="40"
                      strokeDasharray={`${segmentLength} ${circumference}`}
                      strokeDashoffset={circumference}
                      strokeLinecap="round"
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: finalOffset }}
                      transition={{ duration: 1, delay: index * 0.2 }}
                      className="hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  )
                })
              })()}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{totalPie}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Total</p>
              </div>
            </div>
          </div>

          {/* Leyenda */}
          <div className="space-y-2 sm:space-y-3 w-full sm:w-auto">
            {piePercentages.map((item) => (
              <div key={item.name} className="flex items-center gap-2 sm:gap-3">
                <div
                  className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    {item.value} ({item.percentage.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Gráfico de Tendencia - Usando datos de barras para mostrar tendencia mensual */}
      {barData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-2 bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-6 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Tendencia Mensual
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Últimos 12 meses</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Actualizado recientemente</span>
            </div>
          </div>

          <div className="h-48 sm:h-56 md:h-64 relative">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
              <defs>
                <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.polyline
                points={barData
                  .map(
                    (d, i) => {
                      const x = (i / Math.max(1, barData.length - 1)) * 100
                      const y = 100 - (d.cantidad / Math.max(1, maxBarValue)) * 100
                      return `${x},${y}`
                    }
                  )
                  .join(' ')}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2 }}
              />
              <motion.polygon
                points={`0,100 ${barData
                  .map(
                    (d, i) => {
                      const x = (i / Math.max(1, barData.length - 1)) * 100
                      const y = 100 - (d.cantidad / Math.max(1, maxBarValue)) * 100
                      return `${x},${y}`
                    }
                  )
                  .join(' ')} 100,100`}
                fill="url(#trendGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1 }}
              />
            </svg>
          </div>
        </motion.div>
      )}
    </div>
  )
}

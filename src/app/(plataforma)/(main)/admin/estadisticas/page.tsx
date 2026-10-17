'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase/firebase-client'
import DashboardStats, { DashboardStatsData } from '@/components/admin/estadisticas/DashboardStats'
import DashboardCharts, { DashboardChartsData } from '@/components/admin/estadisticas/DashboardCharts'
import RegistrationOpsPanel, {
  RegistrationOpsEvent,
  RegistrationOpsOverview,
} from '@/components/admin/estadisticas/RegistrationOpsPanel'
import { isAdminRole } from '@/lib/auth/roles'

interface EstadisticasResumenResponse {
  success: boolean
  data?: {
    stats?: DashboardStatsData
    charts?: DashboardChartsData
  }
  error?: string
}

interface ObservabilidadRegistroResponse {
  success: boolean
  data?: {
    overview?: RegistrationOpsOverview
    recentEvents?: RegistrationOpsEvent[]
  }
  error?: string
}

export default function EstadisticasPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()
  const [statsData, setStatsData] = useState<DashboardStatsData | undefined>()
  const [chartsData, setChartsData] = useState<DashboardChartsData | undefined>()
  const [opsOverview, setOpsOverview] = useState<RegistrationOpsOverview | undefined>()
  const [opsEvents, setOpsEvents] = useState<RegistrationOpsEvent[]>([])
  const [loadingResumen, setLoadingResumen] = useState(true)

  useEffect(() => {
    if (!loading && (!user || !isAdminRole(userData?.role))) {
      router.push('/login')
    }
  }, [user, userData, loading, router])

  useEffect(() => {
    if (!user || !isAdminRole(userData?.role)) return

    let cancelled = false

    const loadResumen = async () => {
      try {
        if (!cancelled) setLoadingResumen(true)

        const currentUser = auth.currentUser
        if (!currentUser) {
          throw new Error('No se pudo validar la sesión del administrador.')
        }

        const idToken = await currentUser.getIdToken()
        const [resumenResponse, observabilidadResponse] = await Promise.all([
          fetch('/api/admin/estadisticas/resumen', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
            cache: 'no-store',
          }),
          fetch('/api/admin/observabilidad/registro', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
            cache: 'no-store',
          }),
        ])

        const [payload, observabilityPayload] = await Promise.all([
          resumenResponse.json() as Promise<EstadisticasResumenResponse>,
          observabilidadResponse.json() as Promise<ObservabilidadRegistroResponse>,
        ])

        if (!resumenResponse.ok || !payload?.data?.stats || !payload?.data?.charts) {
          throw new Error(payload?.error || 'No se pudieron cargar las estadísticas.')
        }

        if (!observabilidadResponse.ok || !observabilityPayload?.data?.overview) {
          throw new Error(observabilityPayload?.error || 'No se pudo cargar la observabilidad operativa.')
        }

        if (!cancelled) {
          setStatsData(payload.data.stats)
          setChartsData(payload.data.charts)
          setOpsOverview(observabilityPayload.data.overview)
          setOpsEvents(observabilityPayload.data.recentEvents || [])
          setLoadingResumen(false)
        }
      } catch (error) {
        console.error('Error cargando resumen de estadísticas:', error)
        if (!cancelled) {
          setStatsData(undefined)
          setChartsData(undefined)
          setOpsOverview(undefined)
          setOpsEvents([])
          setLoadingResumen(false)
        }
      }
    }

    loadResumen()
    const intervalId = window.setInterval(loadResumen, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [user, userData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user || !isAdminRole(userData?.role)) {
    return null
  }

  return (
    <main className="container mx-auto py-3 sm:py-4 md:py-6 px-2 sm:px-4 space-y-4 sm:space-y-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-red-600 bg-clip-text text-transparent mb-1 sm:mb-2">
          Dashboard de Estadísticas
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Visualización de datos y métricas en tiempo real
        </p>
      </div>

      {/* Tarjetas de estadísticas principales */}
      <DashboardStats data={statsData} loading={loadingResumen} />

      {/* Gráficos y visualizaciones */}
      <DashboardCharts data={chartsData} loading={loadingResumen} />

      <RegistrationOpsPanel overview={opsOverview} recentEvents={opsEvents} loading={loadingResumen} />
    </main>
  )
}

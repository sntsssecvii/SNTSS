'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import DashboardStats from '@/components/admin/estadisticas/DashboardStats'
import DashboardCharts from '@/components/admin/estadisticas/DashboardCharts'
import NotificationsPanel from '@/components/admin/estadisticas/NotificationsPanel'

export default function AdminPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Normalizamos el rol a mayúsculas para la comparación
    const userRole = userData?.role?.toUpperCase()

    if (!loading && (!user || userRole !== 'ADMIN')) {
      router.push('/login')
    }
  }, [user, userData, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user || userData?.role?.toUpperCase() !== 'ADMIN') {
    return null
  }

  return (
    <main className="container mx-auto py-3 sm:py-4 md:py-6 px-2 sm:px-4 space-y-4 sm:space-y-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-red-600 bg-clip-text text-transparent mb-1 sm:mb-2">
          Dashboard de Estadísticas
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Bienvenido, {userData?.nombre} {userData?.apellidoPaterno} • Visualización de datos y métricas en tiempo real
        </p>
      </div>

      {/* Tarjetas de estadísticas principales */}
      <DashboardStats />

      {/* Gráficos y visualizaciones */}
      <DashboardCharts />

      {/* Panel de notificaciones */}
      <NotificationsPanel />
    </main>
  )
}

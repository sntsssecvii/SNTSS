'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const userRole = userData?.role?.toUpperCase()
    if (!loading && (!user || userRole !== 'USER')) {
      router.push('/login')
    }
  }, [user, userData, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user || userData?.role?.toUpperCase() !== 'USER') {
    return null
  }

  return (
    <main className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-muted-foreground">
        Bienvenido, {userData?.nombre} {userData?.apellidoPaterno}
      </p>
      <p className="mt-4">Esta es la página del dashboard. Puedes comenzar a desarrollar aquí.</p>
    </main>
  )
}

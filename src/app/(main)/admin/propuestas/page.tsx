'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { PropuestasTable } from '@/components/PropuestasTable'

export default function PropuestasPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const userRole = userData?.role?.toUpperCase()
    if (!loading && (!user || userRole !== 'ADMIN')) {
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

  if (!user || userData?.role?.toUpperCase() !== 'ADMIN') {
    return null
  }

  return (
    <main className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestión de Propuestas</h1>
        <p className="text-muted-foreground">
          Administra las propuestas sindicales para ingreso al IMSS
        </p>
      </div>

      <PropuestasTable />
    </main>
  )
}

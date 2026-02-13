'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { PropuestaForm } from '@/components/PropuestaForm'

export default function NuevaPropuestaPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || userData?.rol !== 'ADMIN')) {
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

  if (!user || userData?.rol !== 'ADMIN') {
    return null
  }

  return (
    <main className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Nueva Propuesta</h1>
        <p className="text-muted-foreground">
          Completa el formulario para crear una nueva propuesta sindical
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <PropuestaForm />
      </div>
    </main>
  )
}

'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Mail, Shield } from 'lucide-react'

export default function PerfilPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user || !userData) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground mt-1">
          Información de tu cuenta y datos personales
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información Personal
            </CardTitle>
            <CardDescription>Datos personales de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nombre</label>
              <p className="text-lg font-semibold">
                {userData.nombre} {userData.apellidoPaterno} {userData.apellidoMaterno}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-lg">{userData.email}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Información de Cuenta
            </CardTitle>
            <CardDescription>Detalles de tu cuenta y permisos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Rol</label>
              <p className="text-lg font-semibold">
                <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-md">
                  {userData.role?.toUpperCase()}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">ID de Usuario</label>
              <p className="text-sm font-mono text-muted-foreground break-all">{user.uid}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, Bell, Globe, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'

export default function ConfiguracionPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

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

  const handleSave = () => {
    toast({
      title: 'Configuración guardada',
      description: 'Tus preferencias se han guardado correctamente',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona las preferencias de tu cuenta
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <CardDescription>Configura cómo y cuándo recibes notificaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificaciones por email</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones importantes por correo electrónico
                </p>
              </div>
              <Input type="checkbox" className="w-4 h-4" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificaciones de propuestas</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe alertas cuando se crean nuevas propuestas
                </p>
              </div>
              <Input type="checkbox" className="w-4 h-4" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Preferencias Generales
            </CardTitle>
            <CardDescription>Configuración general del sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Idioma</Label>
              <select className="w-full mt-2 h-10 rounded-md border border-input bg-background px-3 py-2">
                <option>Español</option>
                <option>English</option>
              </select>
            </div>
            <div>
              <Label>Zona horaria</Label>
              <select className="w-full mt-2 h-10 rounded-md border border-input bg-background px-3 py-2">
                <option>America/Mexico_City (GMT-6)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave}>Guardar Cambios</Button>
        </div>
      </div>
    </div>
  )
}

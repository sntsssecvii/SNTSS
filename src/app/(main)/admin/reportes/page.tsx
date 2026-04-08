'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FileDown, Calendar, Filter } from 'lucide-react'
import { getPropuestasPorMes, getDistribucionPorEstado, getTotalPropuestas } from '@/lib/firebase/analytics'
import { EstadoPropuesta } from '@/types/workflow'
import { Skeleton } from '@/components/ui/skeleton'
import { isAdminRole } from '@/lib/auth/roles'

export default function ReportesPage() {
  const { user, userData, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tipoReporte, setTipoReporte] = useState('mensual')
  const [periodo, setPeriodo] = useState('ultimo-mes')

  useEffect(() => {
    if (!authLoading && (!user || !isAdminRole(userData?.role))) {
      router.push('/login')
    }
  }, [user, userData, authLoading, router])

  const generarReporte = async () => {
    try {
      setLoading(true)
      // Aquí se implementaría la lógica de generación de reportes
      // Por ahora solo mostramos un mensaje
      alert('Funcionalidad de generación de reportes en desarrollo')
    } catch (error) {
      console.error('Error generando reporte:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportarExcel = () => {
    // Implementar exportación a Excel
    alert('Funcionalidad de exportación a Excel en desarrollo')
  }

  const exportarPDF = () => {
    // Implementar exportación a PDF
    alert('Funcionalidad de exportación a PDF en desarrollo')
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!user || !isAdminRole(userData?.role)) {
    return null
  }

  return (
    <main className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generador de Reportes</h1>
        <p className="text-muted-foreground">
          Genera reportes personalizados de propuestas y estadísticas
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Configuración del Reporte</CardTitle>
            <CardDescription>Selecciona el tipo de reporte y período</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tipoReporte">Tipo de Reporte</Label>
              <Select
                id="tipoReporte"
                value={tipoReporte}
                onChange={(e) => setTipoReporte(e.target.value)}
              >
                <option value="mensual">Reporte Mensual</option>
                <option value="anual">Reporte Anual</option>
                <option value="por-categoria">Por Categoría</option>
                <option value="por-trabajador">Por Trabajador</option>
                <option value="eficiencia">Eficiencia de Procesamiento</option>
                <option value="personalizado">Personalizado</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodo">Período</Label>
              <Select
                id="periodo"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              >
                <option value="ultimo-mes">Último Mes</option>
                <option value="ultimos-3-meses">Últimos 3 Meses</option>
                <option value="ultimos-6-meses">Últimos 6 Meses</option>
                <option value="ultimo-ano">Último Año</option>
                <option value="personalizado">Personalizado</option>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button onClick={generarReporte} disabled={loading}>
                <Filter className="h-4 w-4 mr-2" />
                Generar Reporte
              </Button>
              <Button variant="outline" onClick={exportarExcel}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <Button variant="outline" onClick={exportarPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vista Previa</CardTitle>
            <CardDescription>Resumen rápido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total de Propuestas</p>
                <p className="text-2xl font-bold">-</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Período Seleccionado</p>
                <p className="text-lg font-semibold">{periodo}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

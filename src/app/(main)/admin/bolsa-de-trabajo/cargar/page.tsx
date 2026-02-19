'use client'

import { useRouter } from 'next/navigation'
import { FileUpload } from '@/components/bolsa-de-trabajo/FileUpload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CargarBolsaDeTrabajoPage() {
  const router = useRouter()

  const handleUploadSuccess = (documentoId: string) => {
    // Redirigir a la página de detalles después de cargar
    router.push(`/admin/bolsa-de-trabajo/${documentoId}`)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Cargar Documento de Bolsa de Trabajo</h1>
        <p className="text-muted-foreground mt-2">
          Sube un archivo PDF para procesar y extraer información de bolsa de trabajo
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subir PDF</CardTitle>
          <CardDescription>
            Selecciona el tipo de documento y sube el archivo PDF correspondiente.
            El sistema procesará automáticamente la información contenida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tipos de Documentos Soportados</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Ampliaciones de Jornada</li>
            <li>Cambios de Área</li>
            <li>Cambios de Rama</li>
            <li>Cambios de Residencia Destino</li>
            <li>Cambios de Residencia Origen</li>
            <li>Cambios de Tipo de Plaza</li>
            <li>Cambios de Turno y/o Adscripción</li>
            <li>Nuevo Ingreso</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

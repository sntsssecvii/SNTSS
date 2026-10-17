'use client'

import { useRouter } from 'next/navigation'
import { BulkFileUpload } from '@/components/bolsa-de-trabajo/BulkFileUpload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NOMBRES_TIPOS } from '@/types/bolsa-de-trabajo'

export default function CargarBolsaDeTrabajoPage() {
  const router = useRouter()

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-10 space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al dashboard
        </Button>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Layers className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Nueva Sincronización</h1>
            <p className="text-slate-500 font-medium">
              Carga masiva de documentos quincenales para la Bolsa de Trabajo.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <BulkFileUpload />

        <Card className="rounded-3xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50">
            <CardTitle className="text-lg font-black uppercase tracking-widest text-slate-400">Guía de Sincronización</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-black text-slate-900 dark:text-white">1. Carga de Archivos</h4>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Sube los 8 archivos PDF o Excel correspondientes a la quincena. El sistema detectará automáticamente el tipo de documento por su nombre.
                </p>
              </div>
              <div className="space-y-4">
                <h4 className="font-black text-slate-900 dark:text-white">2. Procesamiento</h4>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Cada archivo se procesará individualmente para extraer sus registros. Podrás ver el progreso en tiempo real.
                </p>
              </div>
              <div className="space-y-4">
                <h4 className="font-black text-slate-900 dark:text-white">3. Punto de Verdad</h4>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Una vez terminada la carga, publica la sincronización para que se convierta en la referencia actual para todo el sistema y futuros trabajadores.
                </p>
              </div>
              <div className="space-y-4">
                <h4 className="font-black text-slate-900 dark:text-white">Tipos Requeridos</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.values(NOMBRES_TIPOS).map(n => (
                    <div key={n} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, CircleAlert, CircleCheckBig, FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { getSincronizacionById } from '@/lib/firebase/sincronizaciones'
import { getBolsaDeTrabajoDocumentosBySyncId } from '@/lib/firebase/bolsa-de-trabajo'
import { NOMBRES_TIPOS, type BolsaDeTrabajoDocumento, type Sincronizacion, type TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'

const TIPOS: TipoBolsaDeTrabajo[] = [
  'NUEVO_INGRESO',
  'AMPLIACIONES_JORNADA',
  'CAMBIOS_AREA',
  'CAMBIOS_RAMA',
  'CAMBIOS_RESIDENCIA_DESTINO',
  'CAMBIOS_RESIDENCIA_ORIGEN',
  'CAMBIOS_TIPO_PLAZA',
  'CAMBIOS_TURNO_ADSCRIPCION',
]

type TipoChecklistStatus = 'PENDIENTE' | 'ERROR' | 'LISTO' | 'PROCESANDO'

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function formatPeriodo(sync: Sincronizacion) {
  const mesNombre = NOMBRES_MESES[sync.mes - 1] || sync.mes
  return `${sync.quincena}ª quincena / ${mesNombre} ${sync.anio}`
}

function formatFecha(value?: Date | { toDate?: () => Date }) {
  if (!value) return 'Sin fecha'
  const dateValue = value instanceof Date ? value : value.toDate?.()
  return dateValue ? dateValue.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha'
}

export default function DetalleQuincenaPage() {
  const params = useParams<{ syncId: string }>()
  const syncId = String(params.syncId || '')
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState<Sincronizacion | null>(null)
  const [documentos, setDocumentos] = useState<BolsaDeTrabajoDocumento[]>([])

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true)
      const [syncData, docsData] = await Promise.all([
        getSincronizacionById(syncId),
        getBolsaDeTrabajoDocumentosBySyncId(syncId),
      ])

      if (!syncData) {
        toast({
          title: 'No encontrada',
          description: 'La quincena solicitada no existe.',
          variant: 'destructive',
        })
        router.push('/admin/bolsa-de-trabajo')
        return
      }

      setSync(syncData)
      setDocumentos(docsData)
    } catch (error) {
      console.error(error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar el detalle de la quincena.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [router, syncId, toast])

  useEffect(() => {
    if (syncId) cargarDatos()
  }, [syncId, cargarDatos])

  const faltantes = useMemo(
    () => TIPOS.filter((tipo) => !documentos.some((doc) => doc.tipo === tipo)),
    [documentos]
  )

  const checklistTipos = useMemo(() => TIPOS.map((tipo) => {
    const docs = documentos.filter((doc) => doc.tipo === tipo)
    const doc = docs[0]
    const status: TipoChecklistStatus = !doc
      ? 'PENDIENTE'
      : doc.estado === 'ERROR'
        ? 'ERROR'
        : doc.estado === 'COMPLETADO'
          ? 'LISTO'
          : 'PROCESANDO'
    return {
      tipo,
      doc,
      status,
    }
  }), [documentos])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#020617]">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Cargando quincena...</p>
      </div>
    )
  }

  if (!sync) return null

  return (
    <div className="h-screen bg-[#F8FAFC] dark:bg-[#020617] overflow-hidden flex flex-col p-4 sm:p-6 lg:p-8 gap-6">
      <div className="mx-auto w-full max-w-7xl flex flex-col h-full gap-6">
        {/* Header Ultra-Compacto */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/admin/bolsa-de-trabajo')}
              className="h-10 w-10 rounded-xl text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-0.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                {formatPeriodo(sync)}
              </h1>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-primary/70">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                   Corte Administrativo
                </div>
                {sync.esFuenteVerdad && (
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">Oficial Vigente</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto sm:ml-0">
             <div className="hidden lg:flex items-center gap-6 px-4 py-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 mr-2">
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Categorías</p>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5">{new Set(documentos.map((doc) => doc.tipo)).size}/8 Listas</p>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Activo desde</p>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5">{formatFecha(sync.fechaFinalizacion || sync.fechaInicio)}</p>
                </div>
             </div>
             <Button
                size="lg"
                onClick={() => router.push(`/admin/bolsa-de-trabajo/cargar?anio=${sync.anio}&mes=${sync.mes}&quincena=${sync.quincena}`)}
                className="h-12 rounded-2xl px-6 font-black bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:shadow-[0_0_20px_-5px_rgba(225,29,72,0.4)] transition-all"
              >
                <Plus className="mr-2 h-5 w-5" />
                Cargar
              </Button>
          </div>
        </div>



        <section className="flex-1 min-h-0 flex flex-col justify-center">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {checklistTipos.map(({ tipo, doc, status }) => (
                <Card 
                  key={tipo}
                  onClick={() => router.push(doc ? `/admin/bolsa-de-trabajo/${doc.id}` : `/admin/bolsa-de-trabajo/cargar?anio=${sync.anio}&mes=${sync.mes}&quincena=${sync.quincena}&tipo=${tipo}`)}
                  className={cn(
                    "group rounded-[2rem] transition-all duration-500 ease-out border-none relative overflow-hidden cursor-pointer flex flex-col shadow-sm",
                    doc 
                      ? "bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 hover:shadow-2xl hover:ring-primary/20"
                      : "bg-slate-50/40 dark:bg-slate-950/20 ring-1 ring-dashed ring-slate-300 dark:ring-slate-800 hover:bg-white/50 hover:ring-primary/30"
                  )}
                >
                  <CardContent className="p-6 flex flex-col space-y-4">
                    <div className="flex items-start justify-between min-h-[4.5rem]">
                       <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-[1.1] line-clamp-3">
                         {NOMBRES_TIPOS[tipo]}
                       </h3>
                       {status === 'LISTO' && (
                         <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 animate-in fade-in zoom-in duration-500">
                           <Check className="h-4 w-4 stroke-[3px]" />
                         </div>
                       )}
                    </div>

                    <div className="space-y-4 mt-auto">
                      {doc ? (
                        <>
                          <div className="flex items-end justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                             <div className="flex flex-col">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Registros</span>
                               <span className="text-2xl font-black text-primary tracking-tighter mt-1">
                                 {doc.totalRegistros?.toLocaleString()}
                               </span>
                             </div>
                             <div className="text-right flex flex-col items-end">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Estatus</span>
                               <div className="mt-1">
                                 <TipoEstadoBadge status={status} />
                               </div>
                             </div>
                          </div>
                          <p className="text-[11px] font-bold text-slate-500 line-clamp-1 italic px-1">
                            {doc.nombreArchivo}
                          </p>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 gap-2 opacity-60">
                           <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Información necesaria</p>
                           <p className="text-[10px] font-bold text-slate-400/60">Clic para cargar</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 mt-auto">
                       <div className={cn(
                         "w-full h-12 flex items-center justify-between px-6 rounded-2xl transition-all duration-300",
                         doc 
                          ? "bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white group-hover:shadow-[0_10px_20px_-5px_rgba(225,29,72,0.3)]" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-900 dark:group-hover:bg-primary group-hover:text-white"
                       )}>
                         <span className="text-xs font-black uppercase tracking-[0.2em]">{doc ? 'Revisar' : 'Subir'}</span>
                         <ArrowRight className="h-4 w-4" />
                       </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
      </div>
    </div>
  )
}



function TipoEstadoBadge({ status }: { status: TipoChecklistStatus }) {
  if (status === 'LISTO') {
    return <Badge variant="success" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">Listo</Badge>
  }

  if (status === 'ERROR') {
    return <Badge variant="destructive" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">Error</Badge>
  }

  if (status === 'PROCESANDO') {
    return <Badge variant="warning" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">Procesando</Badge>
  }

  return <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">Pendiente</Badge>
}

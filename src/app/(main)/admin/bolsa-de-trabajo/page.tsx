'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarClock, Clock3, Plus, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { getSincronizaciones } from '@/lib/firebase/sincronizaciones'
import { getBolsaDeTrabajoDocumentosBySyncIds } from '@/lib/firebase/bolsa-de-trabajo'
import type { BolsaDeTrabajoDocumento, Sincronizacion } from '@/types/bolsa-de-trabajo'

interface QuincenaResumen {
  sync: Sincronizacion
  documentos: BolsaDeTrabajoDocumento[]
  tiposCargados: number
  completados: number
  errores: number
  procesando: number
  totalRegistros: number
  estadoUI: 'PUBLICADA' | 'LISTA' | 'INCOMPLETA' | 'CON_ERROR' | 'BORRADOR'
}

const TIPOS_REQUERIDOS = 8
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

function getEstadoUI(sync: Sincronizacion, documentos: BolsaDeTrabajoDocumento[]): QuincenaResumen['estadoUI'] {
  if (sync.esFuenteVerdad) return 'PUBLICADA'
  if (documentos.some((doc) => doc.estado === 'ERROR')) return 'CON_ERROR'
  if (documentos.length === 0) return 'BORRADOR'
  if (documentos.length < TIPOS_REQUERIDOS) return 'INCOMPLETA'
  return 'LISTA'
}

function getPeriodoKey(sync: Sincronizacion) {
  return `${sync.anio}-${sync.mes}-${sync.quincena}`
}

function getResumenScore(item: QuincenaResumen) {
  const baseDate = item.sync.fechaFinalizacion || item.sync.fechaInicio
  const timestamp = baseDate instanceof Date ? baseDate.getTime() : baseDate?.toDate?.().getTime?.() || 0
  const estadoScore = item.estadoUI === 'PUBLICADA'
    ? 4
    : item.estadoUI === 'LISTA'
      ? 3
      : item.estadoUI === 'INCOMPLETA'
        ? 2
        : item.estadoUI === 'CON_ERROR'
          ? 1
          : 0

  return (estadoScore * 1_000_000_000_000) + (item.tiposCargados * 1_000_000_000) + timestamp
}

function consolidarResumenesPorPeriodo(items: QuincenaResumen[]) {
  const grouped = new Map<string, QuincenaResumen[]>()

  items.forEach((item) => {
    const key = getPeriodoKey(item.sync)
    const bucket = grouped.get(key) || []
    bucket.push(item)
    grouped.set(key, bucket)
  })

  return Array.from(grouped.values())
    .map((bucket) => bucket.sort((a, b) => getResumenScore(b) - getResumenScore(a))[0])
    .sort((a, b) => getResumenScore(b) - getResumenScore(a))
}

export default function BolsaDeTrabajoPage() {
  const [resumenes, setResumenes] = useState<QuincenaResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true)
        const sincronizaciones = await getSincronizaciones(30)
        
        // Fetch ALL documents for ALL these syncs in bulk (3 requests instead of 30)
        const syncIds = sincronizaciones.map(s => s.id)
        const allDocs = await getBolsaDeTrabajoDocumentosBySyncIds(syncIds)
        
        // Group docs by syncId for easy access
        const docsMap = allDocs.reduce((acc, doc) => {
          if (!doc.syncId) return acc
          const list = acc.get(doc.syncId) || []
          list.push(doc)
          acc.set(doc.syncId, list)
          return acc
        }, new Map<string, BolsaDeTrabajoDocumento[]>())

        const items = sincronizaciones.map((sync) => {
          const documentos = docsMap.get(sync.id) || []
          return {
            sync,
            documentos,
            totalRegistros: documentos.reduce((sum, doc) => sum + (doc.totalRegistros || 0), 0),
            tiposCargados: new Set(documentos.map((doc) => doc.tipo)).size,
            completados: documentos.filter((doc) => doc.estado === 'COMPLETADO').length,
            errores: documentos.filter((doc) => doc.estado === 'ERROR').length,
            procesando: documentos.filter((doc) => doc.estado === 'PROCESANDO' || doc.estado === 'VALIDANDO').length,
            estadoUI: getEstadoUI(sync, documentos),
          }
        })

        setResumenes(consolidarResumenesPorPeriodo(items))
      } catch (error) {
        console.error(error)
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las quincenas de bolsa de trabajo.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [toast])

  const resumenesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return resumenes

    return resumenes.filter(({ sync, estadoUI }) => {
      const values = [
        formatPeriodo(sync),
        sync.subidoPorEmail || '',
        estadoUI,
        sync.esFuenteVerdad ? 'oficial' : 'borrador',
      ]
      return values.some((value) => value.toLowerCase().includes(q))
    })
  }, [busqueda, resumenes])

  const resumenGeneral = useMemo(() => {
    return {
      total: resumenes.length,
      oficiales: resumenes.filter((item) => item.sync.esFuenteVerdad).length,
      listas: resumenes.filter((item) => item.estadoUI === 'LISTA').length,
      conError: resumenes.filter((item) => item.estadoUI === 'CON_ERROR').length,
    }
  }, [resumenes])

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 dark:bg-[#020617] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 border border-slate-900 p-8 sm:p-12 mb-8 isolate shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-60"></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary border border-primary/20 backdrop-blur-md">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Control de Quincenas
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:leading-[1.1]">
                Bolsa de <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-500">Trabajo</span>
              </h1>
              <p className="max-w-xl text-sm font-medium text-slate-400 sm:text-base leading-relaxed">
                Plataforma de gestión y publicación de cortes quincenales. 
                Sincronización centralizada para el ecosistema SNTSS.
              </p>
            </div>

            <Button
              size="lg"
              onClick={() => router.push('/admin/bolsa-de-trabajo/cargar')}
              className="h-14 rounded-2xl px-8 text-sm font-black sm:text-base bg-primary hover:bg-primary/90 text-white shadow-[0_0_40px_-10px_rgba(225,29,72,0.4)] transition-all"
            >
              <Plus className="mr-2 h-5 w-5" />
              Nueva Quincena
            </Button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 mb-8">
          <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-all">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <CalendarClock className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Quincenas Importadas</p>
              <p className="text-4xl font-black text-slate-900 dark:text-white">{resumenGeneral.total}</p>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-all">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Publicadas Vigentes</p>
              <p className="text-4xl font-black text-slate-900 dark:text-white">{resumenGeneral.oficiales}</p>
            </div>
          </div>
        </section>

        <div className="group rounded-[2rem] border border-slate-200/50 bg-white/40 p-1.5 shadow-sm backdrop-blur-xl transition-all hover:border-primary/20 hover:shadow-md dark:border-slate-800/50 dark:bg-slate-900/40">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-primary" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por periodo, estado o correo de carga..."
              className="h-14 rounded-2xl border-none bg-transparent pl-11 text-sm font-bold tracking-tight text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Cargando quincenas...</p>
          </div>
        ) : resumenesFiltrados.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-900/50">
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
              <CalendarClock className="h-10 w-10 text-slate-300" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white">No hay quincenas para mostrar</h2>
              <p className="max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
                Crea una nueva quincena o ajusta la búsqueda para encontrar un corte existente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resumenesFiltrados.map((item) => (
              <button
                key={item.sync.id}
                onClick={() => router.push(`/admin/bolsa-de-trabajo/quincenas/${item.sync.id}`)}
                className="text-left"
              >
                <Card className={cn(
                  "group h-full rounded-[2.5rem] transition-all duration-500 ease-out border-none relative overflow-hidden",
                  item.sync.esFuenteVerdad 
                    ? "bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent ring-[1.5px] ring-primary/30 shadow-[0_20px_50px_-12px_rgba(225,29,72,0.15)]"
                    : "bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-primary/5 hover:ring-primary/20"
                )}>
                  {item.sync.esFuenteVerdad && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary/20 transition-colors" />
                  )}
                  
                  <CardContent className="flex flex-col h-full p-8 sm:p-10 space-y-8 relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "text-[10px] font-black uppercase tracking-[0.2em]",
                            item.sync.esFuenteVerdad ? "text-primary" : "text-slate-400"
                          )}>
                            Periodo {item.sync.esFuenteVerdad && "• Activa"}
                          </p>
                          {item.sync.esFuenteVerdad && (
                            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                          {formatPeriodo(item.sync)}
                        </h2>
                      </div>
                      <EstadoBadge estado={item.estadoUI} oficial={item.sync.esFuenteVerdad} />
                    </div>

                    <div className={cn(
                      "rounded-[2rem] p-6 flex flex-col gap-1 transition-all duration-300",
                      item.sync.esFuenteVerdad
                        ? "bg-white/50 dark:bg-slate-950/40 shadow-inner-white border border-primary/10"
                        : "bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100/50 dark:border-slate-800/50 group-hover:bg-white/80 group-hover:border-primary/10"
                    )}>
                      <div className="flex items-center justify-between">
                         <span className={cn(
                           "text-[10px] font-bold uppercase tracking-[0.2em]", 
                           item.sync.esFuenteVerdad ? "text-primary/70" : "text-slate-500"
                         )}>Registros Extraídos</span>
                         <span className={cn(
                           "text-3xl font-black tracking-tighter",
                           item.sync.esFuenteVerdad ? "text-primary" : "text-slate-900 dark:text-white"
                         )}>
                           {item.totalRegistros.toLocaleString()}
                         </span>
                      </div>
                      <p className={cn(
                        "text-[12px] font-medium leading-relaxed mt-4 opacity-70", 
                        item.sync.esFuenteVerdad ? "text-primary/80" : "text-slate-600 dark:text-slate-400"
                      )}>
                        {item.documentos.length === 0
                          ? 'Esperando la carga de los documentos para este periodo.'
                          : item.estadoUI === 'CON_ERROR'
                            ? 'Se detectaron detalles que requieren revisión antes de continuar.'
                            : item.sync.esFuenteVerdad
                              ? 'Esta es la información oficial que los trabajadores pueden consultar actualmente.'
                              : 'Toda la información ha sido procesada y está lista para ser revisada.'}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actualizado</p>
                        <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">
                          {formatFecha(item.sync.fechaFinalizacion || item.sync.fechaInicio)}
                        </p>
                      </div>
                      <div className={cn(
                        "inline-flex shrink-0 w-12 h-12 items-center justify-center rounded-2xl transition-all duration-300 transform group-hover:-rotate-12",
                        item.sync.esFuenteVerdad 
                          ? "bg-primary text-white shadow-[0_10px_20px_-5px_rgba(225,29,72,0.4)]" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg"
                      )}>
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}





function EstadoBadge({ estado, oficial }: { estado: QuincenaResumen['estadoUI']; oficial: boolean }) {
  return (
    <Badge
      variant={oficial ? 'success' : estado === 'CON_ERROR' ? 'destructive' : estado === 'INCOMPLETA' ? 'warning' : 'secondary'}
      className={cn('rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest', !oficial && estado === 'LISTA' && 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300')}
    >
      {estado}
    </Badge>
  )
}

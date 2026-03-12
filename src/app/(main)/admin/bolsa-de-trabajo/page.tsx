'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarClock, CircleAlert, CircleCheckBig, Clock3, Plus, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { getSincronizaciones } from '@/lib/firebase/sincronizaciones'
import { getBolsaDeTrabajoDocumentosBySyncId } from '@/lib/firebase/bolsa-de-trabajo'
import type { BolsaDeTrabajoDocumento, Sincronizacion } from '@/types/bolsa-de-trabajo'

interface QuincenaResumen {
  sync: Sincronizacion
  documentos: BolsaDeTrabajoDocumento[]
  tiposCargados: number
  completados: number
  errores: number
  procesando: number
  estadoUI: 'PUBLICADA' | 'LISTA' | 'INCOMPLETA' | 'CON_ERROR' | 'BORRADOR'
}

const TIPOS_REQUERIDOS = 8

function formatPeriodo(sync: Sincronizacion) {
  return `${sync.quincena}ª quincena / ${sync.mes}/${sync.anio}`
}

function formatFecha(value?: Date | { toDate?: () => Date }) {
  if (!value) return 'Sin fecha'
  const dateValue = value instanceof Date ? value : value.toDate?.()
  return dateValue ? dateValue.toLocaleDateString() : 'Sin fecha'
}

function getEstadoUI(sync: Sincronizacion, documentos: BolsaDeTrabajoDocumento[]): QuincenaResumen['estadoUI'] {
  if (sync.esFuenteVerdad) return 'PUBLICADA'
  if (documentos.some((doc) => doc.estado === 'ERROR')) return 'CON_ERROR'
  if (documentos.length === 0) return 'BORRADOR'
  if (documentos.length < TIPOS_REQUERIDOS) return 'INCOMPLETA'
  return 'LISTA'
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
        const docsPorSync = await Promise.all(
          sincronizaciones.map(async (sync) => ({
            sync,
            documentos: await getBolsaDeTrabajoDocumentosBySyncId(sync.id),
          }))
        )

        setResumenes(docsPorSync.map(({ sync, documentos }) => ({
          sync,
          documentos,
          tiposCargados: new Set(documentos.map((doc) => doc.tipo)).size,
          completados: documentos.filter((doc) => doc.estado === 'COMPLETADO').length,
          errores: documentos.filter((doc) => doc.estado === 'ERROR').length,
          procesando: documentos.filter((doc) => doc.estado === 'PROCESANDO' || doc.estado === 'VALIDANDO').length,
          estadoUI: getEstadoUI(sync, documentos),
        })))
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
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
              <CalendarClock className="h-4 w-4" />
              Administración por quincenas
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Bolsa de Trabajo
            </h1>
            <p className="max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400 sm:text-base">
              Primero eliges una quincena. Después revisas sus 8 tipos oficiales. La publicación ocurre a nivel corte, no archivo por archivo.
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => router.push('/admin/bolsa-de-trabajo/cargar')}
            className="h-12 rounded-2xl px-6 text-sm font-black sm:text-base"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nueva quincena
          </Button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ResumenCard
            icon={<CalendarClock className="h-5 w-5" />}
            title="Quincenas"
            value={String(resumenGeneral.total)}
            description="Cortes cargados en el sistema."
          />
          <ResumenCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Oficial"
            value={String(resumenGeneral.oficiales)}
            description="Quincenas publicadas como fuente vigente."
          />
          <ResumenCard
            icon={<CircleCheckBig className="h-5 w-5" />}
            title="Listas"
            value={String(resumenGeneral.listas)}
            description="Cortes completos listos para publicar."
          />
          <ResumenCard
            icon={<CircleAlert className="h-5 w-5" />}
            title="Con error"
            value={String(resumenGeneral.conError)}
            description="Quincenas que requieren corrección."
          />
        </section>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por periodo, estado o correo de carga..."
              className="h-12 rounded-2xl border-none bg-slate-50 pl-11 text-sm font-medium dark:bg-slate-950/60"
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
                <Card className="h-full rounded-3xl border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/50">
                  <CardContent className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Periodo</p>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">{formatPeriodo(item.sync)}</h2>
                      </div>
                      <EstadoBadge estado={item.estadoUI} oficial={item.sync.esFuenteVerdad} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MiniDato label="Tipos" value={`${item.tiposCargados}/8`} />
                      <MiniDato label="Listos" value={String(item.completados)} />
                      <MiniDato label="Errores" value={String(item.errores)} />
                      <MiniDato label="Pend." value={String(item.procesando)} />
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">
                      {item.tiposCargados === 0
                        ? 'Quincena creada sin documentos cargados todavía.'
                        : item.estadoUI === 'CON_ERROR'
                          ? 'Hay documentos con error. Corrige antes de publicar.'
                          : item.estadoUI === 'INCOMPLETA'
                            ? `Faltan ${TIPOS_REQUERIDOS - item.tiposCargados} tipo(s) para completar el corte.`
                            : item.sync.esFuenteVerdad
                              ? 'Esta es la quincena oficial vigente para consulta del trabajador.'
                              : 'El corte está completo y listo para revisión o publicación.'}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Última actualización</p>
                        <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">
                          {formatFecha(item.sync.fechaFinalizacion || item.sync.fechaInicio)}
                        </p>
                        <p className="truncate text-xs font-medium text-slate-500">{item.sync.subidoPorEmail || 'Sin correo'}</p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 text-sm font-black text-primary">
                        Abrir
                        <ArrowRight className="h-4 w-4" />
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

function ResumenCard({
  icon,
  title,
  value,
  description,
}: {
  icon: ReactNode
  title: string
  value: string
  description: string
}) {
  return (
    <Card className="rounded-3xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
      <CardContent className="space-y-3 p-5">
        <div className="inline-flex rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{value}</p>
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{description}</p>
      </CardContent>
    </Card>
  )
}

function MiniDato({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-lg font-black text-slate-900 dark:text-white">{value}</p>
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

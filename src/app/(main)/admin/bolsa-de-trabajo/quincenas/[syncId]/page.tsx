'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CalendarClock, CircleAlert, CircleCheckBig, FileText, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
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

function formatPeriodo(sync: Sincronizacion) {
  return `${sync.quincena}ª quincena / ${sync.mes}/${sync.anio}`
}

function formatFecha(value?: Date | { toDate?: () => Date }) {
  if (!value) return 'Sin fecha'
  const dateValue = value instanceof Date ? value : value.toDate?.()
  return dateValue ? dateValue.toLocaleDateString() : 'Sin fecha'
}

export default function DetalleQuincenaPage() {
  const params = useParams<{ syncId: string }>()
  const syncId = String(params.syncId || '')
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState<Sincronizacion | null>(null)
  const [documentos, setDocumentos] = useState<BolsaDeTrabajoDocumento[]>([])

  useEffect(() => {
    const cargar = async () => {
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
    }

    if (syncId) cargar()
  }, [router, syncId, toast])

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
    <div className="min-h-screen bg-[#F8FAFC] p-4 dark:bg-[#020617] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Button
              variant="ghost"
              onClick={() => router.push('/admin/bolsa-de-trabajo')}
              className="h-10 rounded-xl px-3 font-bold"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a quincenas
            </Button>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                <CalendarClock className="h-4 w-4" />
                Detalle de quincena
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                {formatPeriodo(sync)}
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Aquí ya no cambias de periodo. Completa, revisa o reemplaza documentos dentro de este corte.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sync.esFuenteVerdad && (
              <Badge variant="success" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                Oficial vigente
              </Badge>
            )}
            <Button
              onClick={() => router.push(`/admin/bolsa-de-trabajo/cargar?anio=${sync.anio}&mes=${sync.mes}&quincena=${sync.quincena}`)}
              className="h-11 rounded-2xl px-5 font-black"
            >
              <Plus className="mr-2 h-4 w-4" />
              Cargar o reemplazar
            </Button>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            icon={<CircleCheckBig className="h-5 w-5" />}
            title="Tipos cargados"
            value={`${new Set(documentos.map((doc) => doc.tipo)).size}/8`}
            description="Tipos que ya tienen documento dentro de esta quincena."
          />
          <InfoCard
            icon={<CircleAlert className="h-5 w-5" />}
            title="Faltantes"
            value={String(faltantes.length)}
            description="Tipos que aún faltan por cargar o reemplazar."
          />
          <InfoCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Estado"
            value={sync.esFuenteVerdad ? 'Oficial' : sync.estado}
            description="Estado actual del corte quincenal."
          />
          <InfoCard
            icon={<FileText className="h-5 w-5" />}
            title="Actualizado"
            value={formatFecha(sync.fechaFinalizacion || sync.fechaInicio)}
            description={sync.subidoPorEmail || 'Sin correo registrado'}
          />
        </section>

        {faltantes.length > 0 && (
          <Card className="rounded-3xl border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                Tipos faltantes en esta quincena
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {faltantes.map((tipo) => (
                  <span
                    key={tipo}
                    className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-black text-amber-700 dark:border-amber-900/50 dark:bg-slate-900 dark:text-amber-300"
                  >
                    {NOMBRES_TIPOS[tipo]}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Checklist del corte</p>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Tipos oficiales de la quincena</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Cada fila representa un tipo. Si ya existe documento, al tocar la fila entras directo a su tabla. Si falta, el flujo te lleva a cargarlo.
              </p>
            </div>

            <div className="space-y-3">
              {checklistTipos.map(({ tipo, doc, status }) => (
                <div
                  key={tipo}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(doc ? `/admin/bolsa-de-trabajo/${doc.id}` : `/admin/bolsa-de-trabajo/cargar?anio=${sync.anio}&mes=${sync.mes}&quincena=${sync.quincena}&tipo=${tipo}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      router.push(doc ? `/admin/bolsa-de-trabajo/${doc.id}` : `/admin/bolsa-de-trabajo/cargar?anio=${sync.anio}&mes=${sync.mes}&quincena=${sync.quincena}&tipo=${tipo}`)
                    }
                  }}
                  className="w-full text-left"
                >
                <Card className="rounded-3xl border-slate-200 bg-white transition-all hover:border-primary hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/50">
                  <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black text-slate-900 dark:text-white">{NOMBRES_TIPOS[tipo]}</p>
                        <TipoEstadoBadge status={status} />
                      </div>

                      <div className="grid gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 md:grid-cols-3">
                        <span>
                          Documento:
                          <span className="ml-1 font-bold text-slate-700 dark:text-slate-200">
                            {doc?.nombreArchivo || 'No cargado'}
                          </span>
                        </span>
                        <span>
                          Registros:
                          <span className="ml-1 font-bold text-slate-700 dark:text-slate-200">
                            {doc?.totalRegistros || 0}
                          </span>
                        </span>
                        <span>
                          Actualizado:
                          <span className="ml-1 font-bold text-slate-700 dark:text-slate-200">
                            {doc ? formatFecha(doc.fechaCarga as Date) : 'Sin fecha'}
                          </span>
                        </span>
                      </div>

                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {!doc
                          ? 'Este tipo todavía no tiene documento dentro de la quincena.'
                          : status === 'ERROR'
                            ? 'El documento existe pero requiere corrección antes de considerarlo listo.'
                            : status === 'PROCESANDO'
                              ? 'El documento aún está procesándose o validándose.'
                              : 'El documento vigente está listo para consulta y revisión.'}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          router.push(`/admin/bolsa-de-trabajo/cargar?anio=${sync.anio}&mes=${sync.mes}&quincena=${sync.quincena}&tipo=${tipo}`)
                        }}
                        className="rounded-2xl font-black"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {doc ? 'Reemplazar' : 'Cargar'}
                      </Button>
                      {doc && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(`/admin/bolsa-de-trabajo/${doc.id}`)
                          }}
                          className="rounded-2xl font-black"
                        >
                          Abrir tabla
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                </div>
              ))}
            </div>
          </section>
      </div>
    </div>
  )
}

function InfoCard({
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
          <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{description}</p>
      </CardContent>
    </Card>
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

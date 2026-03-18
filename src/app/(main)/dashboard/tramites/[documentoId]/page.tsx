'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getMiTramiteDetalleCliente } from '@/lib/firebase/trabajador-portal'
import { NOMBRES_TIPOS, type TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Loader2,
  MapPin,
  Repeat,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TramiteDetail {
  documentoId: string
  recordId?: string
  matricula: string
  nombre: string
  categoria: string
  zona: string
  tipoDocumento: TipoBolsaDeTrabajo
  tipoContratacion?: string
  adscripcionNueva?: string
  turnoNuevo?: string
  registro?: string
  posicionBase: number
  posicionInterinato?: number
  totalEnCategoria: number
  totalEventualesEnCategoria?: number
}

interface Periodo {
  anio: number
  mes: number
  quincena: number
}

function getTurnoLabel(turno?: string) {
  switch ((turno || '').toUpperCase()) {
    case 'MAT':
      return 'Turno matutino'
    case 'VES':
      return 'Turno vespertino'
    case 'NOC':
      return 'Turno nocturno'
    default:
      return turno || ''
  }
}

function getMainMetric(data: TramiteDetail) {
  if (data.tipoDocumento === 'NUEVO_INGRESO' && data.tipoContratacion === '8' && data.posicionInterinato) {
    return {
      title: 'Posición para interinato',
      value: data.posicionInterinato,
      total: data.totalEventualesEnCategoria || data.totalEnCategoria,
    }
  }

  return {
    title: 'Posición actual',
    value: data.posicionBase,
    total: data.totalEnCategoria,
  }
}

function getDescription(data: TramiteDetail) {
  switch (data.tipoDocumento) {
    case 'CAMBIOS_TURNO_ADSCRIPCION':
      return `Tu posición en el grupo que solicitó ${data.registro === 'CAT' ? 'cambio de turno' : 'cambio de adscripción'}${data.adscripcionNueva ? ` para ${data.adscripcionNueva}` : ''}${data.turnoNuevo ? ` en ${getTurnoLabel(data.turnoNuevo)}` : ''}.`
    case 'AMPLIACIONES_JORNADA':
      return `Tu posición en la solicitud de ampliación de jornada${data.adscripcionNueva ? ` para ${data.adscripcionNueva}` : ''}${data.turnoNuevo ? ` en ${getTurnoLabel(data.turnoNuevo)}` : ''}.`
    case 'CAMBIOS_AREA':
      return `Tu posición vigente dentro del listado de cambios de área para tu categoría y zona.`
    case 'CAMBIOS_RAMA':
      return `Tu posición vigente dentro del listado de cambios de rama para tu categoría y zona.`
    case 'CAMBIOS_RESIDENCIA_ORIGEN':
      return `Tu posición vigente dentro del listado de cambios de residencia origen.`
    case 'CAMBIOS_RESIDENCIA_DESTINO':
      return `Tu posición vigente dentro del listado de cambios de residencia destino.`
    case 'CAMBIOS_TIPO_PLAZA':
      return `Tu posición vigente dentro del listado de cambios de tipo de plaza.`
    default:
      return `Tu posición vigente dentro del listado oficial actual.`
  }
}

export default function TramiteDetailPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const documentoId = String(params.documentoId || '')
  const recordId = searchParams.get('recordId')?.trim() || undefined
  const [data, setData] = useState<TramiteDetail | null>(null)
  const [periodo, setPeriodo] = useState<Periodo | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)

  useEffect(() => {
    const userRole = userData?.role?.toUpperCase()
    if (!loading && (!user || userRole !== 'USER')) {
      router.push('/login')
    }
  }, [user, userData, loading, router])

  useEffect(() => {
    const fetchDetail = async () => {
      if (!user || userData?.role?.toUpperCase() !== 'USER' || !documentoId) return

      try {
        setPageLoading(true)
        setError(null)
        setErrorStatus(null)

        if (!userData?.matricula?.trim()) {
          throw new Error('El usuario autenticado no tiene matrícula vinculada.')
        }

        const result = await getMiTramiteDetalleCliente(documentoId, recordId)
        setData(result.data)
        setPeriodo(result.periodo || null)
      } catch (err: any) {
        let nextErrorStatus: number | null = null
        if (err?.message?.includes('matrícula vinculada')) nextErrorStatus = 400
        else if (err?.message?.includes('No se pudo validar la sesión')) nextErrorStatus = 401
        else if (err?.message?.includes('no pertenece')) nextErrorStatus = 403
        else if (err?.message?.includes('no pertenece al corte') || err?.message?.includes('Trámite no encontrado')) nextErrorStatus = 404
        if (nextErrorStatus !== null) setErrorStatus(nextErrorStatus)
        setError(err.message || 'Error al cargar el detalle del trámite.')
      } finally {
        setPageLoading(false)
      }
    }

    fetchDetail()
  }, [user, userData, documentoId, recordId])

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Cargando detalle del trámite...</span>
        </div>
      </div>
    )
  }

  if (!user || userData?.role?.toUpperCase() !== 'USER') {
    return null
  }

  if (error || !data) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
              <div>
              <p className="font-semibold text-foreground">
                {errorStatus === 401 ? 'La sesión ya no es válida' :
                  errorStatus === 403 ? 'No tienes permiso para ver este trámite' :
                    errorStatus === 404 ? 'El trámite ya no está disponible en el corte vigente' :
                      'No fue posible cargar el detalle'}
              </p>
              <p className="text-sm text-muted-foreground">{error || 'No se encontró el trámite solicitado.'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            {errorStatus === 401 ? (
              <Button onClick={() => router.push('/login')}>Iniciar sesión otra vez</Button>
            ) : (
              <Button onClick={() => window.location.reload()}>Reintentar</Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const metric = getMainMetric(data)

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border bg-gradient-to-br from-background via-background to-muted/30 p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Button variant="ghost" className="px-0" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a mis trámites
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
              Detalle Privado Del Trámite
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">{NOMBRES_TIPOS[data.tipoDocumento]}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{getDescription(data)}</p>
            </div>
          </div>

          <Card className="border-border/60 shadow-none">
            <CardContent className="flex items-center gap-3 p-4">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Corte oficial</p>
                <p className="text-sm font-semibold">
                  {periodo ? `${periodo.quincena}° quincena ${periodo.mes}/${periodo.anio}` : 'No disponible'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-xl font-black tracking-tight">Tu posición</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-3xl bg-primary/10 p-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{metric.title}</p>
              <p className="mt-3 text-6xl font-black leading-none">{metric.value}</p>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">de {metric.total} registros comparables</p>
            </div>

            {data.tipoDocumento === 'NUEVO_INGRESO' && (
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Posición base</p>
                <p className="mt-2 text-2xl font-black">{data.posicionBase}</p>
                <p className="text-sm text-muted-foreground">Total en categoría: {data.totalEnCategoria}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-xl font-black tracking-tight">Datos del trámite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-muted/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Trabajador</p>
              <p className="mt-2 text-lg font-bold">{data.nombre}</p>
              <p className="text-sm text-muted-foreground">Matrícula: {data.matricula}</p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Categoría</p>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                  <Briefcase className="h-4 w-4 text-primary" />
                  {data.categoria}
                </div>
              </div>

              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Zona</p>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  {data.zona}
                </div>
              </div>

              {data.adscripcionNueva && (
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Adscripción</p>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-primary" />
                    {data.adscripcionNueva}
                  </div>
                </div>
              )}

              {(data.turnoNuevo || data.registro) && (
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Detalle de tu solicitud</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold">
                    {data.registro && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1">
                        <Repeat className="h-4 w-4 text-primary" />
                        {data.registro === 'CAT' ? 'Cambio de turno' : data.registro === 'CAD' ? 'Cambio de adscripción' : data.registro}
                      </span>
                    )}
                    {data.turnoNuevo && (
                      <span className="rounded-full bg-background px-3 py-1">{getTurnoLabel(data.turnoNuevo)}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Nota</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Esta información corresponde al corte oficial vigente y muestra únicamente datos asociados a tu cuenta autenticada.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

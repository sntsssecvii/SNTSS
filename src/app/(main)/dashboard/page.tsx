'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getMisTramitesCliente } from '@/lib/firebase/trabajador-portal'
import { NOMBRES_TIPOS, type TipoBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Loader2,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TramiteData {
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

function getTramiteSubtitle(item: TramiteData) {
  switch (item.tipoDocumento) {
    case 'CAMBIOS_TURNO_ADSCRIPCION':
      return item.adscripcionNueva
        ? `${item.adscripcionNueva}${item.turnoNuevo ? ` • ${getTurnoLabel(item.turnoNuevo)}` : ''}`
        : 'Trámite vigente'
    case 'AMPLIACIONES_JORNADA':
      return item.adscripcionNueva
        ? `${item.adscripcionNueva}${item.turnoNuevo ? ` • ${getTurnoLabel(item.turnoNuevo)}` : ''}`
        : 'Solicitud vigente'
    default:
      return `${item.categoria} • ${item.zona}`
  }
}

function getPrimaryMetric(item: TramiteData) {
  if (item.tipoDocumento === 'NUEVO_INGRESO' && item.tipoContratacion === '8' && item.posicionInterinato) {
    return {
      label: 'Posición para interinato',
      value: item.posicionInterinato,
      total: item.totalEventualesEnCategoria || item.totalEnCategoria,
    }
  }

  return {
    label: 'Posición actual',
    value: item.posicionBase,
    total: item.totalEnCategoria,
  }
}

export default function DashboardPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()
  const [tramites, setTramites] = useState<TramiteData[]>([])
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
    const fetchTramites = async () => {
      if (!user || userData?.role?.toUpperCase() !== 'USER') return

      try {
        setPageLoading(true)
        setError(null)
        setErrorStatus(null)

        if (!userData?.matricula?.trim()) {
          throw new Error('El usuario autenticado no tiene matrícula vinculada.')
        }

        const result = await getMisTramitesCliente()
        setTramites(result.data || [])
        setPeriodo(result.periodo || null)
      } catch (err: any) {
        let nextErrorStatus: number | null = null
        if (err?.message?.includes('matrícula vinculada')) nextErrorStatus = 400
        else if (err?.message?.includes('No se pudo validar la sesión')) nextErrorStatus = 401
        else if (err?.message?.includes('No hay información oficial activa')) nextErrorStatus = 404
        if (nextErrorStatus !== null) setErrorStatus(nextErrorStatus)
        setError(err.message || 'Error al cargar tus trámites.')
      } finally {
        setPageLoading(false)
      }
    }

    fetchTramites()
  }, [user, userData])

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Cargando tu información...</span>
        </div>
      </div>
    )
  }

  if (!user || userData?.role?.toUpperCase() !== 'USER') {
    return null
  }

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border bg-gradient-to-br from-background via-background to-muted/30 p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
              Portal Privado Del Trabajador
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Bienvenido, {userData.nombre} {userData.apellidoPaterno}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                Esta vista usa tu sesión y tu matrícula vinculada para mostrar únicamente tus trámites vigentes del corte oficial actual.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="border-border/60 shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <UserRound className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Matrícula</p>
                  <p className="text-sm font-semibold">{userData.matricula}</p>
                </div>
              </CardContent>
            </Card>

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
        </div>
      </section>

      {error ? (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
              <div>
                <p className="font-semibold text-foreground">
                  {errorStatus === 400 ? 'Tu cuenta no tiene matrícula vinculada' :
                    errorStatus === 401 ? 'Tu sesión ya no es válida' :
                      errorStatus === 403 ? 'Tu cuenta no tiene acceso habilitado' :
                        errorStatus === 404 ? 'No hay trámites disponibles para mostrar' :
                          'No fue posible cargar tus trámites'}
                </p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <div className="flex gap-3">
              {errorStatus === 401 ? (
                <Button onClick={() => router.push('/login')}>Iniciar sesión otra vez</Button>
              ) : (
                <Button onClick={() => window.location.reload()}>Reintentar</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : tramites.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">No tienes trámites vigentes en el corte actual</p>
                <p className="text-sm text-muted-foreground">
                  Si esperabas ver información aquí, valida con tu representación sindical que tu matrícula aparezca en la sincronización publicada.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 p-4 text-sm text-muted-foreground">
              Este portal sólo muestra trámites asociados a tu matrícula autenticada y al corte oficial vigente.
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Mis trámites</h2>
              <p className="text-sm text-muted-foreground">
                Se encontraron {tramites.length} trámite{tramites.length === 1 ? '' : 's'} vigente{tramites.length === 1 ? '' : 's'} asociados a tu matrícula.
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {tramites.map((item) => {
              const metric = getPrimaryMetric(item)

              return (
                <Card key={`${item.documentoId}-${item.recordId || item.tipoDocumento}`} className="overflow-hidden border-border/60">
                  <CardHeader className="space-y-4 pb-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-black tracking-tight">
                          {NOMBRES_TIPOS[item.tipoDocumento]}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">{getTramiteSubtitle(item)}</p>
                      </div>
                      <div className="rounded-2xl bg-primary/10 px-4 py-3 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                          {metric.label}
                        </p>
                        <p className="text-3xl font-black leading-none text-foreground">{metric.value}</p>
                        <p className="text-xs font-semibold text-muted-foreground">de {metric.total}</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-muted/50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Categoría</p>
                        <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                          <Briefcase className="h-4 w-4 text-primary" />
                          {item.categoria}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-muted/50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Zona</p>
                        <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                          <MapPin className="h-4 w-4 text-primary" />
                          {item.zona}
                        </div>
                      </div>
                    </div>

                    {(item.adscripcionNueva || item.turnoNuevo) && (
                      <div className="rounded-2xl border border-border/60 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Detalle de tu solicitud</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold">
                          {item.adscripcionNueva && (
                            <span className="rounded-full bg-muted px-3 py-1">Adscripción: {item.adscripcionNueva}</span>
                          )}
                          {item.turnoNuevo && (
                            <span className="rounded-full bg-muted px-3 py-1">{getTurnoLabel(item.turnoNuevo)}</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t pt-4">
                      <p className="text-sm text-muted-foreground">
                        Matrícula vinculada: <span className="font-semibold text-foreground">{item.matricula}</span>
                      </p>
                      <Button
                        variant="ghost"
                        className="px-0 text-primary"
                        onClick={() => router.push(`/dashboard/tramites/${item.documentoId}${item.recordId ? `?recordId=${encodeURIComponent(item.recordId)}` : ''}`)}
                      >
                        Detalle del trámite <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}

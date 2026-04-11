'use client'

import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck, UserCheck, UserX } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export interface RegistrationOpsOverview {
  pendingValidations: number
  activeUsers: number
  registrationsLastHour: number
  registrationErrorsLastHour: number
  registrationWarningsLastHour: number
  approvalsLastHour: number
  rejectionsLastHour: number
}

export interface RegistrationOpsEvent {
  id: string
  source: 'registration' | 'admin'
  status: 'success' | 'warning' | 'error'
  title: string
  message: string
  createdAt: string | null
}

interface RegistrationOpsPanelProps {
  overview?: RegistrationOpsOverview
  recentEvents?: RegistrationOpsEvent[]
  loading?: boolean
}

function formatRelativeDate(value: string | null) {
  if (!value) return 'Sin fecha'

  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000))

  if (diffMinutes < 1) return 'Ahora'
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `Hace ${diffHours} h`

  return date.toLocaleString('es-MX')
}

function buildOperationalState(overview?: RegistrationOpsOverview) {
  if (!overview) {
    return {
      level: 'healthy' as const,
      title: 'Operación estable',
      message: 'Sin señales de fricción visibles en el último corte.',
      actions: [
        'Mantener monitoreo normal en estadísticas y validaciones.',
        'Seguir aprobando solicitudes al ritmo esperado.',
      ],
      classes: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20',
      accent: 'text-emerald-700 dark:text-emerald-300',
    }
  }

  if (
    overview.registrationErrorsLastHour >= 4 ||
    overview.registrationWarningsLastHour >= 6 ||
    overview.pendingValidations >= 150
  ) {
    return {
      level: 'critical' as const,
      title: 'Atención inmediata requerida',
      message: 'El panel detecta una señal crítica de registro o validación en la última hora.',
      actions: [
        'Revisar eventos recientes y auditorías antes de seguir escalando operación.',
        'Confirmar si el fallo es de correo, backend o saturación operativa.',
      ],
      classes: 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20',
      accent: 'text-red-700 dark:text-red-300',
    }
  }

  if (
    overview.registrationErrorsLastHour >= 1 ||
    overview.registrationWarningsLastHour >= 3 ||
    overview.pendingValidations >= 50
  ) {
    return {
      level: 'attention' as const,
      title: 'Operación con fricción',
      message: 'Hay señales que ameritan seguimiento cercano en esta ventana.',
      actions: [
        'Revisar si los pendientes están creciendo más rápido que las aprobaciones.',
        'Confirmar si las advertencias vienen de correo o de errores técnicos repetidos.',
      ],
      classes: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20',
      accent: 'text-amber-700 dark:text-amber-300',
    }
  }

  return {
    level: 'healthy' as const,
    title: 'Operación estable',
    message: 'Sin señales de fricción visibles en el último corte.',
    actions: [
      'Mantener monitoreo normal en estadísticas y validaciones.',
      'Seguir aprobando solicitudes al ritmo esperado.',
    ],
    classes: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20',
    accent: 'text-emerald-700 dark:text-emerald-300',
  }
}

export default function RegistrationOpsPanel({
  overview,
  recentEvents = [],
  loading = false,
}: RegistrationOpsPanelProps) {
  const operationalState = buildOperationalState(overview)
  const cards = [
    {
      title: 'Pendientes por validar',
      value: overview?.pendingValidations ?? 0,
      icon: Clock3,
      accent: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      title: 'Usuarios activos',
      value: overview?.activeUsers ?? 0,
      icon: ShieldCheck,
      accent: 'text-sky-600',
      bg: 'bg-sky-50 dark:bg-sky-950/30',
    },
    {
      title: 'Registros última hora',
      value: overview?.registrationsLastHour ?? 0,
      icon: CheckCircle2,
      accent: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      title: 'Errores última hora',
      value: overview?.registrationErrorsLastHour ?? 0,
      icon: AlertTriangle,
      accent: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
    {
      title: 'Aprobaciones última hora',
      value: overview?.approvalsLastHour ?? 0,
      icon: UserCheck,
      accent: 'text-indigo-600',
      bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    },
    {
      title: 'Rechazos última hora',
      value: overview?.rejectionsLastHour ?? 0,
      icon: UserX,
      accent: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/30',
    },
  ]

  if (loading) {
    return (
      <section className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-card p-5">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-9 w-16 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Pulso Operativo de Registro</h2>
        <p className="text-sm text-muted-foreground">
          Señales en vivo para operar la ventana de altas y validaciones sin salir del panel.
        </p>
      </div>

      <div className={`rounded-xl border p-5 shadow-sm ${operationalState.classes}`}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-5 w-5 ${operationalState.accent}`} />
              <h3 className={`text-lg font-semibold ${operationalState.accent}`}>{operationalState.title}</h3>
            </div>
            <p className="text-sm text-foreground">{operationalState.message}</p>
          </div>
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            Playbook: <span className="font-mono">docs/specs/registro-16000-playbook-operativo.md</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
          {operationalState.actions.map((action) => (
            <div key={action} className="rounded-lg bg-background/70 dark:bg-background/20 px-3 py-2 text-sm text-muted-foreground">
              {action}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <div key={card.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{card.value.toLocaleString()}</p>
                </div>
                <div className={`rounded-xl p-3 ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.accent}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Eventos recientes</h3>
            <p className="text-sm text-muted-foreground">
              Registros y validaciones más recientes para detectar fricción operativa rápido.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            Advertencias de correo última hora: {(overview?.registrationWarningsLastHour ?? 0).toLocaleString()}
          </div>
        </div>

        {recentEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Aún no hay eventos recientes para mostrar.
          </div>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event) => {
              const colorClass =
                event.status === 'error'
                  ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
                  : event.status === 'warning'
                    ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
                    : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'

              const badgeClass =
                event.source === 'registration'
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'

              return (
                <div key={event.id} className={`rounded-lg border p-4 ${colorClass}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                          {event.source === 'registration' ? 'Registro' : 'Validación'}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{event.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground break-words">{event.message}</p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeDate(event.createdAt)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

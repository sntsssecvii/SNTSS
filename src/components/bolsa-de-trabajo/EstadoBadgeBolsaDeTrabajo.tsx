'use client'

import { Badge } from '@/components/ui/badge'
import type { EstadoProcesamiento } from '@/types/bolsa-de-trabajo'
import { cn } from '@/lib/utils'

interface EstadoBadgeBolsaDeTrabajoProps {
  estado: EstadoProcesamiento | undefined | null | unknown
  className?: string
}

const ESTADOS_INFO: Record<EstadoProcesamiento, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PROCESANDO: { label: 'Procesando', variant: 'secondary' },
  COMPLETADO: { label: 'Completado', variant: 'default' },
  ERROR: { label: 'Error', variant: 'destructive' },
  VALIDANDO: { label: 'Validando', variant: 'outline' },
}

export function EstadoBadgeBolsaDeTrabajo({ estado, className }: EstadoBadgeBolsaDeTrabajoProps) {
  // Asegurar que estado sea siempre un string válido (nunca un objeto)
  const estadoStr = typeof estado === 'string' ? estado : undefined

  // Manejar casos donde el estado no está definido o es inválido (objeto, etc.)
  if (!estadoStr) {
    return (
      <Badge variant="secondary" className={cn('font-medium', className)}>
        Desconocido
      </Badge>
    )
  }

  const estadoInfo = ESTADOS_INFO[estadoStr as EstadoProcesamiento] || { label: estadoStr, variant: 'secondary' as const }

  return (
    <Badge
      variant={estadoInfo.variant}
      className={cn('font-medium', className)}
    >
      {estadoInfo.label}
    </Badge>
  )
}

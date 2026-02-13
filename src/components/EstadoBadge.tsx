'use client'

import { Badge } from './ui/badge'
import { EstadoPropuesta, ESTADOS_INFO } from '@/types/workflow'
import { cn } from '@/lib/utils'

interface EstadoBadgeProps {
  estado: EstadoPropuesta
  className?: string
}

export function EstadoBadge({ estado, className }: EstadoBadgeProps) {
  const estadoInfo = ESTADOS_INFO[estado]
  
  const variantMap: Record<EstadoPropuesta, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
    [EstadoPropuesta.BORRADOR]: 'secondary',
    [EstadoPropuesta.EN_REVISION]: 'warning',
    [EstadoPropuesta.APROBADA]: 'success',
    [EstadoPropuesta.RECHAZADA]: 'destructive',
    [EstadoPropuesta.ENVIADA_IMSS]: 'info',
    [EstadoPropuesta.COMPLETADA]: 'success',
  }

  return (
    <Badge
      variant={variantMap[estado]}
      className={cn('font-medium', className)}
      title={estadoInfo.descripcion}
    >
      {estadoInfo.label}
    </Badge>
  )
}

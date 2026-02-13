'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { EstadoPropuesta, TRANSICIONES_VALIDAS, ESTADOS_INFO } from '@/types/workflow'
import { cambiarEstadoPropuesta } from '@/lib/firebase/propuestas'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from './ui/use-toast'
import { Loader2 } from 'lucide-react'

interface CambiarEstadoDialogProps {
  propuestaId: string
  estadoActual: EstadoPropuesta
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CambiarEstadoDialog({
  propuestaId,
  estadoActual,
  open,
  onOpenChange,
  onSuccess,
}: CambiarEstadoDialogProps) {
  const { user, userData } = useAuth()
  const { toast } = useToast()
  const [nuevoEstado, setNuevoEstado] = useState<EstadoPropuesta | ''>('')
  const [comentario, setComentario] = useState('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  const transicionesValidas = TRANSICIONES_VALIDAS[estadoActual] || []

  const handleSubmit = async () => {
    if (!nuevoEstado || !user) return

    try {
      setLoading(true)
      await cambiarEstadoPropuesta(
        propuestaId,
        nuevoEstado,
        user.uid,
        user.email || undefined,
        userData?.nombre ? `${userData.nombre} ${userData.apellidoPaterno}` : undefined,
        comentario || undefined,
        motivo || undefined
      )

      toast({
        title: 'Estado actualizado',
        description: `La propuesta ha sido cambiada a ${ESTADOS_INFO[nuevoEstado].label}`,
      })

      setNuevoEstado('')
      setComentario('')
      setMotivo('')
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error('Error cambiando estado:', error)
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cambiar el estado de la propuesta',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar Estado de Propuesta</DialogTitle>
          <DialogDescription>
            Estado actual: <strong>{ESTADOS_INFO[estadoActual].label}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nuevoEstado">Nuevo Estado</Label>
            <Select
              id="nuevoEstado"
              value={nuevoEstado}
              onChange={(e) => setNuevoEstado(e.target.value as EstadoPropuesta)}
            >
              <option value="">Selecciona un estado</option>
              {transicionesValidas.map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADOS_INFO[estado].label} - {ESTADOS_INFO[estado].descripcion}
                </option>
              ))}
            </Select>
            {transicionesValidas.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay transiciones disponibles desde este estado.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="comentario">Comentario (opcional)</Label>
            <Textarea
              id="comentario"
              placeholder="Agrega un comentario sobre este cambio de estado..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Textarea
              id="motivo"
              placeholder="Explica el motivo del cambio..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!nuevoEstado || loading || transicionesValidas.length === 0}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cambiar Estado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

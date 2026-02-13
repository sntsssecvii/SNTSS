'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './ui/dialog'
import { Button } from './ui/button'
import type { DuplicadoDetectado } from '@/types/propuestas'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

interface DuplicadoAlertProps {
  open: boolean
  duplicados: DuplicadoDetectado[]
  onConfirm: () => void
  onCancel: () => void
}

export function DuplicadoAlert({
  open,
  duplicados,
  onConfirm,
  onCancel,
}: DuplicadoAlertProps) {
  if (duplicados.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogClose onClose={onCancel} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Propuestas Duplicadas Detectadas
          </DialogTitle>
          <DialogDescription>
            Se encontraron {duplicados.length} propuesta{duplicados.length > 1 ? 's' : ''} que
            coinciden con los datos ingresados. Por favor, revisa la información antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {duplicados.map((duplicado, index) => (
            <div
              key={duplicado.propuesta.id}
              className="border rounded-lg p-4 bg-muted/50"
            >
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-sm">
                  Propuesta #{index + 1} - ID: {duplicado.propuesta.id?.substring(0, 8)}...
                </h4>
                <span className="text-xs text-muted-foreground">
                  {duplicado.propuesta.fechaCreacion &&
                    format(
                      duplicado.propuesta.fechaCreacion instanceof Date
                        ? duplicado.propuesta.fechaCreacion
                        : new Date(duplicado.propuesta.fechaCreacion),
                      'dd/MM/yyyy'
                    )}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium text-xs text-muted-foreground mb-1">
                    Campos que coinciden:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {duplicado.camposCoincidentes.map((campo, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium"
                      >
                        {campo}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Trabajador:
                    </p>
                    <p className="text-sm">
                      {duplicado.propuesta.trabajadorActivo.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Matrícula: {duplicado.propuesta.trabajadorActivo.matricula}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Aspirante:
                    </p>
                    <p className="text-sm">{duplicado.propuesta.aspirante.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {duplicado.propuesta.aspirante.curp && `CURP: ${duplicado.propuesta.aspirante.curp}`}
                      {duplicado.propuesta.aspirante.rfc && `RFC: ${duplicado.propuesta.aspirante.rfc}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button variant="default" onClick={onConfirm}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Continuar de todas formas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

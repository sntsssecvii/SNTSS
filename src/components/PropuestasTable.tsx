"use client";

// TODO(feat/propuestas-admision): reemplazar con tabla del nuevo módulo de admisión sindical

import { AlertCircle } from "lucide-react";

interface PropuestasTableProps {
  onNuevaPropuesta?: () => void;
}

export function PropuestasTable({ onNuevaPropuesta: _ }: PropuestasTableProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
      <AlertCircle className="h-10 w-10 opacity-40" />
      <p className="text-sm">Módulo de propuestas en construcción</p>
    </div>
  );
}

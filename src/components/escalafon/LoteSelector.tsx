"use client";

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EscalafonLote } from "@/types/escalafon";

const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function generarNombreLote(fecha: Date = new Date()): string {
  const dia = fecha.getDate();
  const mes = MESES_CORTOS[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `${dia} ${mes} ${anio}`;
}

interface LoteSelectorProps {
  loteAbierto?: EscalafonLote | null;
  cargando?: boolean;
}

export function LoteSelector({ loteAbierto, cargando }: LoteSelectorProps) {
  const nombreHoy = generarNombreLote();

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary mb-3">
        <Calendar className="h-4 w-4" />
        Lote de carga
      </div>

      <div
        className={cn(
          "rounded-2xl border px-4 py-3 text-sm font-medium",
          cargando
            ? "border-slate-200 bg-slate-50 text-slate-400"
            : loteAbierto
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300",
        )}
      >
        {cargando
          ? "Revisando lotes activos..."
          : loteAbierto
            ? `Lote abierto — "${loteAbierto.nombre}" tiene ${loteAbierto.totalListados} listados. Los nuevos PDFs se añadirán aquí.`
            : `Se creará un nuevo lote "${nombreHoy}" al procesar el primer PDF.`}
      </div>
    </div>
  );
}

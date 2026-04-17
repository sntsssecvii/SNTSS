"use client";

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EscalafonLote } from "@/types/escalafon";

export interface LotePeriodo {
  anio: number;
  mes: number;
  quincena: 1 | 2;
}

interface LoteSelectorProps {
  periodo: LotePeriodo;
  onChange: (periodo: LotePeriodo) => void;
  loteExistente?: EscalafonLote | null; // lote con ese nombre si existe
  cargando?: boolean;
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function generarNombreLote(periodo: LotePeriodo): string {
  return `${MESES[periodo.mes - 1]} ${periodo.anio} · Q${periodo.quincena}`;
}

export function LoteSelector({
  periodo,
  onChange,
  loteExistente,
  cargando,
}: LoteSelectorProps) {
  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - 2 + i,
  );

  const nombreGenerado = generarNombreLote(periodo);

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            <Calendar className="h-4 w-4" />
            Periodo de trabajo
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Selecciona la quincena antes de cargar listados.
          </p>
        </div>

        <div className="grid w-full gap-4 xl:grid-cols-[minmax(260px,1.4fr)_180px]">
          <div className="grid gap-4 md:grid-cols-[minmax(240px,1fr)_160px]">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Mes
              </span>
              <select
                value={periodo.mes}
                onChange={(e) =>
                  onChange({ ...periodo, mes: Number(e.target.value) })
                }
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-primary dark:border-slate-800 dark:bg-slate-950/60"
              >
                {MESES.map((nombreMes, index) => (
                  <option key={nombreMes} value={index + 1}>
                    {nombreMes}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Año
              </span>
              <select
                value={periodo.anio}
                onChange={(e) =>
                  onChange({ ...periodo, anio: Number(e.target.value) })
                }
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-primary dark:border-slate-800 dark:bg-slate-950/60"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Quincena
            </span>
            <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/60">
              {([1, 2] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ ...periodo, quincena: value })}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm font-black transition-all",
                    periodo.quincena === value
                      ? "bg-white text-primary shadow-sm dark:bg-slate-800"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  {value}ª Qna
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Estado del lote para el periodo seleccionado */}
      <div
        className={cn(
          "mt-4 rounded-2xl border px-4 py-3 text-sm font-medium",
          cargando
            ? "border-slate-200 bg-slate-50 text-slate-400"
            : loteExistente?.estado === "ABIERTO"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : loteExistente?.estado === "CERRADO"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300",
        )}
      >
        {cargando
          ? "Revisando si este lote ya existe..."
          : loteExistente?.estado === "ABIERTO"
            ? `Lote abierto — "${nombreGenerado}" ya existe y tiene ${loteExistente.totalListados} listados. Los nuevos PDFs se añadirán aquí.`
            : loteExistente?.estado === "CERRADO"
              ? `Este lote ya está cerrado ("${nombreGenerado}"). Se creará uno nuevo al procesar.`
              : `No existe un lote para "${nombreGenerado}". Se creará automáticamente al procesar el primer PDF.`}
      </div>
    </div>
  );
}

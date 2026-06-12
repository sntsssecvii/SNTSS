"use client";

import { useState, useCallback } from "react";
import {
  Check,
  ChevronRight,
  AlertTriangle,
  FileText,
  BarChart3,
  Eye,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NOMBRES_TIPOS } from "@/types/bolsa-de-trabajo";
import type {
  RegressionAnalysis,
  CasoRepresentativo,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";

interface DocumentoMeta {
  id: string;
  tipo: TipoBolsaDeTrabajo;
  totalRegistros: number;
  nombreArchivo?: string;
}

interface PrePublicarData {
  regresion: RegressionAnalysis;
  muestras: Record<string, CasoRepresentativo[]>;
  documentos: DocumentoMeta[];
  syncAnteriorId: string | null;
}

interface PublicacionWizardProps {
  syncId: string;
  idToken: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PASOS = [
  { id: 1, label: "Documentos", icon: FileText },
  { id: 2, label: "Movimientos", icon: BarChart3 },
  { id: 3, label: "Muestras", icon: Eye },
  { id: 4, label: "Confirmar", icon: Rocket },
];

export function PublicacionWizard({
  syncId,
  idToken,
  onSuccess,
  onCancel,
}: PublicacionWizardProps) {
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PrePublicarData | null>(null);
  const [checkDoc, setCheckDoc] = useState(false);
  const [checkConfirm, setCheckConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [publicando, setPublicando] = useState(false);

  const cargarAnalisis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bolsa-de-trabajo/pre-publicar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syncId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Error al analizar");
      setData(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [syncId, idToken]);

  // Cargar al montar
  useState(() => {
    cargarAnalisis();
  });

  const handlePublicar = async () => {
    if (!data) return;
    setPublicando(true);
    try {
      const res = await fetch("/api/bolsa-de-trabajo/publicar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syncId, regresion: data.regresion }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Error al publicar");
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setPublicando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
          Analizando quincena...
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive font-bold">{error}</p>
        <Button variant="outline" onClick={cargarAnalisis}>
          Reintentar
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const canPublish = data.regresion.alertaDisparada
    ? confirmText === "CONFIRMAR" && checkConfirm
    : checkConfirm;

  return (
    <div className="flex flex-col gap-8">
      {/* Barra de progreso */}
      <div className="flex items-center gap-0">
        {PASOS.map((p, idx) => {
          const Icon = p.icon;
          const done = paso > p.id;
          const active = paso === p.id;
          return (
            <div key={p.id} className="flex items-center flex-1">
              <div
                className={cn(
                  "flex items-center gap-2 py-2 px-3 rounded-xl transition-all",
                  active && "bg-primary/10",
                  done && "opacity-60",
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all",
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-primary text-white"
                        : "bg-slate-200 text-slate-500",
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5 stroke-[3px]" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-black uppercase tracking-widest hidden sm:block",
                    active ? "text-primary" : "text-slate-400",
                  )}
                >
                  {p.label}
                </span>
              </div>
              {idx < PASOS.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 mx-1 transition-all",
                    paso > p.id ? "bg-emerald-400" : "bg-slate-200",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Paso 1 — Documentos */}
      {paso === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Documentos incluidos
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Verifica que estos son los listados correctos para esta quincena.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {data.documentos.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 ring-1 ring-slate-200/50 dark:ring-slate-800/50"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {NOMBRES_TIPOS[doc.tipo]}
                  </span>
                  {doc.nombreArchivo && (
                    <span className="text-xs text-slate-400 italic">
                      {doc.nombreArchivo}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Registros
                  </span>
                  <p className="text-lg font-black text-primary">
                    {doc.totalRegistros.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checkDoc}
              onChange={(e) => setCheckDoc(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              He verificado que estos son los listados correctos para esta
              quincena.
            </span>
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button disabled={!checkDoc} onClick={() => setPaso(2)}>
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 2 — Analisis de movimiento */}
      {paso === 2 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Analisis de movimiento
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Comparacion con la quincena anterior.
            </p>
          </div>

          {data.regresion.sinComparacion ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 ring-1 ring-slate-200">
              <p className="text-sm font-bold text-slate-500">
                Primera publicacion &mdash; sin datos de comparacion
                disponibles.
              </p>
            </div>
          ) : (
            <>
              {data.regresion.alertaDisparada && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">
                    Detectamos movimiento inusual en uno o mas listados (&gt;10%
                    de trabajadores retroceden). Revisa las muestras antes de
                    continuar.
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Tipo
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Total
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        Avanzaron
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-red-500">
                        Retrocedieron
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Sin cambio
                      </th>
                      <th className="text-right py-2 pl-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        % Retroceso
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      Object.entries(data.regresion.porTipo) as [
                        TipoBolsaDeTrabajo,
                        {
                          total: number;
                          avanzaron: number;
                          retrocedieron: number;
                          sinCambio: number;
                          porcentajeRetroceso: number;
                        },
                      ][]
                    ).map(([tipo, stats]) => (
                      <tr
                        key={tipo}
                        className="border-b border-slate-100 dark:border-slate-800/50"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                stats.porcentajeRetroceso > 10
                                  ? "bg-red-500"
                                  : "bg-emerald-500",
                              )}
                            />
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {NOMBRES_TIPOS[tipo]}
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-slate-600">
                          {stats.total}
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-emerald-600">
                          {stats.avanzaron}
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-red-500">
                          {stats.retrocedieron}
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-slate-400">
                          {stats.sinCambio}
                        </td>
                        <td className="text-right py-3 pl-2">
                          <Badge
                            variant={
                              stats.porcentajeRetroceso > 10
                                ? "destructive"
                                : "success"
                            }
                            className="text-[10px] font-black"
                          >
                            {stats.porcentajeRetroceso}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setPaso(1)}>
              Atras
            </Button>
            <Button onClick={() => setPaso(3)}>
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3 — Muestras */}
      {paso === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Revision de muestras
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Casos representativos por listado para verificar que las
              posiciones se ven correctas.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {data.documentos.map((doc) => {
              const casos = data.muestras[doc.id] ?? [];
              return (
                <details
                  key={doc.id}
                  className="group rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 bg-white/40 dark:bg-slate-900/40 overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-4 cursor-pointer select-none">
                    <span className="font-black text-slate-800 dark:text-white text-sm">
                      {NOMBRES_TIPOS[doc.tipo]}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900">
                          <th className="text-left p-3 font-black uppercase tracking-widest text-slate-400">
                            Matricula
                          </th>
                          <th className="text-left p-3 font-black uppercase tracking-widest text-slate-400">
                            Nombre
                          </th>
                          <th className="text-left p-3 font-black uppercase tracking-widest text-slate-400">
                            Zona
                          </th>
                          <th className="text-right p-3 font-black uppercase tracking-widest text-slate-400">
                            Pos. ant.
                          </th>
                          <th className="text-right p-3 font-black uppercase tracking-widest text-slate-400">
                            Pos. nueva
                          </th>
                          <th className="text-right p-3 font-black uppercase tracking-widest text-slate-400">
                            Delta
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {casos.map((c) => (
                          <tr
                            key={c.matricula}
                            className="border-t border-slate-100 dark:border-slate-800"
                          >
                            <td className="p-3 font-bold text-slate-600">
                              {c.matricula}
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300">
                              {c.nombre}
                            </td>
                            <td className="p-3 text-slate-500">{c.zona}</td>
                            <td className="p-3 text-right text-slate-400">
                              {c.posAnterior ?? "—"}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800 dark:text-white">
                              {c.posNueva}
                            </td>
                            <td className="p-3 text-right font-black">
                              {c.delta === null ? (
                                <span className="text-slate-400">—</span>
                              ) : c.delta < 0 ? (
                                <span className="text-emerald-600">
                                  &uarr;{Math.abs(c.delta)}
                                </span>
                              ) : c.delta > 0 ? (
                                <span className="text-red-500">
                                  &darr;{c.delta}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {casos.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-4 text-center text-slate-400 text-xs"
                            >
                              Sin muestras disponibles.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setPaso(2)}>
              Atras
            </Button>
            <Button onClick={() => setPaso(4)}>
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 4 — Confirmacion final */}
      {paso === 4 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Confirmacion final
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Revisa el resumen y autoriza la publicacion.
            </p>
          </div>

          {/* Resumen compacto */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 ring-1 ring-slate-200/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Listados
              </p>
              <p className="text-2xl font-black text-primary">
                {data.documentos.length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 ring-1 ring-slate-200/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Trabajadores
              </p>
              <p className="text-2xl font-black text-primary">
                {Object.values(data.regresion.porTipo)
                  .reduce((a, s) => a + s.total, 0)
                  .toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/40 ring-1 ring-slate-200/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Alerta
              </p>
              <p
                className={cn(
                  "text-sm font-black mt-1",
                  data.regresion.alertaDisparada
                    ? "text-red-500"
                    : "text-emerald-600",
                )}
              >
                {data.regresion.alertaDisparada
                  ? "Si — confirmar"
                  : "Sin alertas"}
              </p>
            </div>
          </div>

          {data.regresion.alertaDisparada && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                Hay movimiento inusual detectado. Escribe{" "}
                <code className="bg-red-100 dark:bg-red-950 px-1 rounded">
                  CONFIRMAR
                </code>{" "}
                para continuar:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Escribe CONFIRMAR"
                className="h-10 px-4 rounded-xl border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 text-sm font-bold text-red-700 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checkConfirm}
              onChange={(e) => setCheckConfirm(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-primary"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Confirmo que he revisado los datos y autorizo la publicacion de
              esta quincena.
            </span>
          </label>

          {error && (
            <p className="text-sm text-destructive font-bold">{error}</p>
          )}

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setPaso(3)}
              disabled={publicando}
            >
              Atras
            </Button>
            <Button
              disabled={!canPublish || publicando}
              onClick={handlePublicar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black"
            >
              {publicando ? "Publicando..." : "Publicar quincena"}
              {!publicando && <Rocket className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Download,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOMBRES_TIPOS } from "@/types/bolsa-de-trabajo";
import type {
  BolsaPosicionMaterializada,
  TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";
import { cn } from "@/lib/utils";

interface MovimientoRow {
  matricula: string;
  nombre: string;
  tipo: TipoBolsaDeTrabajo;
  grupo: string;
  posAnterior: number | null;
  posNueva: number;
  delta: number | null;
}

interface TipoStats {
  total: number;
  avanzaron: number;
  retrocedieron: number;
  sinCambio: number;
  nuevos: number;
}

const NOMBRES_CORTOS: Record<TipoBolsaDeTrabajo, string> = {
  AMPLIACIONES_JORNADA: "Ampliaciones",
  CAMBIOS_AREA: "Área",
  CAMBIOS_RAMA: "Rama",
  CAMBIOS_RESIDENCIA_DESTINO: "Res. Destino",
  CAMBIOS_RESIDENCIA_ORIGEN: "Res. Origen",
  CAMBIOS_TIPO_PLAZA: "Tipo Plaza",
  CAMBIOS_TURNO_ADSCRIPCION: "Turno/Adsc.",
  NUEVO_INGRESO: "Nuevo Ingreso",
};

interface MovimientosTabProps {
  syncId: string;
  syncAnteriorId: string | null;
  idToken: string;
}

export function MovimientosTab({
  syncId,
  syncAnteriorId: syncAnteriorIdProp,
  idToken,
}: MovimientosTabProps) {
  const [rows, setRows] = useState<MovimientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoActivo, setTipoActivo] = useState<TipoBolsaDeTrabajo | "TODOS">(
    "TODOS",
  );
  const [filtroMovimiento, setFiltroMovimiento] = useState<
    "TODOS" | "RETROCESO" | "AVANCE" | "NUEVO"
  >("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [sinComparacion, setSinComparacion] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const resActual = await fetch(
        `/api/admin/bolsa/posiciones?syncId=${syncId}`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      const dataActual = await resActual.json();
      const posActuales: BolsaPosicionMaterializada[] = dataActual.data ?? [];

      const posKey = (p: BolsaPosicionMaterializada) => {
        const grupo = p.grupoComparable ?? {};
        const grupoKey = Object.keys(grupo)
          .sort()
          .map((k) => grupo[k] ?? "")
          .join("|");
        return `${p.tipoDocumento}::${p.matricula}::${grupoKey}`;
      };

      // Buscar sync anterior: usar prop o buscar esFuenteVerdad
      let prevLookup = new Map<string, number>();
      let syncAnteriorId = syncAnteriorIdProp;

      if (!syncAnteriorId) {
        const resSyncs = await fetch(`/api/admin/bolsa/quincenas?limit=10`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const dataSyncs = await resSyncs.json();
        const syncs = dataSyncs.data ?? [];
        const anterior = syncs.find(
          (s: any) => s.id !== syncId && s.esFuenteVerdad,
        );
        syncAnteriorId = anterior?.id ?? null;
      }

      if (syncAnteriorId) {
        const resAnterior = await fetch(
          `/api/admin/bolsa/posiciones?syncId=${syncAnteriorId}`,
          { headers: { Authorization: `Bearer ${idToken}` } },
        );
        const dataAnterior = await resAnterior.json();
        const posAnteriores: BolsaPosicionMaterializada[] =
          dataAnterior.data ?? [];
        for (const p of posAnteriores) {
          prevLookup.set(posKey(p), p.posicionBase);
        }
      }

      setSinComparacion(prevLookup.size === 0);

      const movimientos: MovimientoRow[] = posActuales.map((p) => {
        const posAnterior = prevLookup.get(posKey(p)) ?? null;
        const grupo = [p.grupoComparable?.zona, p.grupoComparable?.categoria]
          .filter(Boolean)
          .join(" / ");
        return {
          matricula: p.matricula,
          nombre: p.nombre,
          tipo: p.tipoDocumento,
          grupo,
          posAnterior,
          posNueva: p.posicionBase,
          delta: posAnterior !== null ? p.posicionBase - posAnterior : null,
        };
      });

      movimientos.sort((a, b) => {
        // Retrocesos primero (delta positivo = retroceso)
        const da = a.delta ?? -Infinity;
        const db = b.delta ?? -Infinity;
        return db - da;
      });
      setRows(movimientos);
    } catch (err) {
      console.error("Error cargando movimientos:", err);
    } finally {
      setLoading(false);
    }
  }, [syncId, syncAnteriorIdProp, idToken]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const tipos = useMemo(
    () => [...new Set(rows.map((r) => r.tipo))] as TipoBolsaDeTrabajo[],
    [rows],
  );

  const statsPorTipo = useMemo(() => {
    const stats: Partial<Record<TipoBolsaDeTrabajo, TipoStats>> = {};
    for (const tipo of tipos) {
      const tipoRows = rows.filter((r) => r.tipo === tipo);
      stats[tipo] = {
        total: tipoRows.length,
        avanzaron: tipoRows.filter((r) => r.delta !== null && r.delta < 0)
          .length,
        retrocedieron: tipoRows.filter((r) => r.delta !== null && r.delta > 0)
          .length,
        sinCambio: tipoRows.filter((r) => r.delta === 0).length,
        nuevos: tipoRows.filter((r) => r.delta === null).length,
      };
    }
    return stats;
  }, [rows, tipos]);

  const totalRetrocesos = useMemo(
    () =>
      Object.values(statsPorTipo).reduce(
        (sum, s) => sum + (s?.retrocedieron ?? 0),
        0,
      ),
    [statsPorTipo],
  );

  const totalAvances = useMemo(
    () =>
      Object.values(statsPorTipo).reduce(
        (sum, s) => sum + (s?.avanzaron ?? 0),
        0,
      ),
    [statsPorTipo],
  );

  const rowsFiltradas = useMemo(
    () =>
      rows.filter((r) => {
        if (tipoActivo !== "TODOS" && r.tipo !== tipoActivo) return false;
        if (
          filtroMovimiento === "RETROCESO" &&
          (r.delta === null || r.delta <= 0)
        )
          return false;
        if (filtroMovimiento === "AVANCE" && (r.delta === null || r.delta >= 0))
          return false;
        if (filtroMovimiento === "NUEVO" && r.delta !== null) return false;
        if (
          busqueda &&
          !r.matricula.includes(busqueda.toUpperCase()) &&
          !r.nombre.toLowerCase().includes(busqueda.toLowerCase())
        )
          return false;
        return true;
      }),
    [rows, tipoActivo, filtroMovimiento, busqueda],
  );

  const exportCSV = () => {
    const header = "Matricula,Nombre,Tipo,Grupo,Pos.Anterior,Pos.Nueva,Delta";
    const lines = rowsFiltradas.map(
      (r) =>
        `${r.matricula},"${r.nombre}","${NOMBRES_TIPOS[r.tipo]}","${r.grupo}",${r.posAnterior ?? ""},${r.posNueva},${r.delta ?? ""}`,
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos-${syncId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Alerta global de retrocesos */}
      {!sinComparacion && totalRetrocesos > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700 dark:text-red-400">
              {totalRetrocesos} trabajador{totalRetrocesos !== 1 ? "es" : ""}{" "}
              retrocedieron en posición
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">
              Revisa los detalles por listado antes de publicar.
            </p>
          </div>
        </div>
      )}

      {!sinComparacion && totalRetrocesos === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Sin retrocesos —{" "}
            {totalAvances > 0
              ? `${totalAvances} avanzaron`
              : "posiciones estables"}
          </p>
        </div>
      )}

      {sinComparacion && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Sin quincena anterior para comparar — no se puede calcular
            movimiento.
          </p>
        </div>
      )}

      {/* Pestañas por tipo */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setTipoActivo("TODOS");
            setFiltroMovimiento("TODOS");
          }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
            tipoActivo === "TODOS"
              ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400",
          )}
        >
          Todos ({rows.length})
        </button>
        {tipos.map((tipo) => {
          const stats = statsPorTipo[tipo];
          const tieneRetrocesos = (stats?.retrocedieron ?? 0) > 0;
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setTipoActivo(tipo);
                setFiltroMovimiento("TODOS");
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                tipoActivo === tipo
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                  : tieneRetrocesos && !sinComparacion
                    ? "bg-red-50 text-red-700 border-red-200 hover:border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400",
              )}
            >
              {NOMBRES_CORTOS[tipo]}
              <span className="text-[10px] opacity-70">
                {stats?.total ?? 0}
              </span>
              {tieneRetrocesos && !sinComparacion && (
                <span className="flex items-center text-[10px] text-red-500">
                  <TrendingDown className="h-3 w-3" />
                  {stats?.retrocedieron}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats del tipo activo */}
      {tipoActivo !== "TODOS" &&
        statsPorTipo[tipoActivo] &&
        !sinComparacion && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Total"
              value={statsPorTipo[tipoActivo]!.total}
              color="slate"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Avanzaron"
              value={statsPorTipo[tipoActivo]!.avanzaron}
              color="emerald"
              onClick={() =>
                setFiltroMovimiento(
                  filtroMovimiento === "AVANCE" ? "TODOS" : "AVANCE",
                )
              }
              active={filtroMovimiento === "AVANCE"}
            />
            <StatCard
              icon={<TrendingDown className="h-4 w-4" />}
              label="Retrocedieron"
              value={statsPorTipo[tipoActivo]!.retrocedieron}
              color="red"
              onClick={() =>
                setFiltroMovimiento(
                  filtroMovimiento === "RETROCESO" ? "TODOS" : "RETROCESO",
                )
              }
              active={filtroMovimiento === "RETROCESO"}
            />
            <StatCard
              icon={<Minus className="h-4 w-4" />}
              label="Sin cambio / Nuevos"
              value={
                statsPorTipo[tipoActivo]!.sinCambio +
                statsPorTipo[tipoActivo]!.nuevos
              }
              color="slate"
            />
          </div>
        )}

      {/* Filtros y búsqueda */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar matrícula o nombre..."
            className="h-9 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {tipoActivo === "TODOS" && !sinComparacion && (
          <select
            value={filtroMovimiento}
            onChange={(e) =>
              setFiltroMovimiento(
                e.target.value as "TODOS" | "RETROCESO" | "AVANCE" | "NUEVO",
              )
            }
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
          >
            <option value="TODOS">Todos</option>
            <option value="RETROCESO">Solo retrocesos</option>
            <option value="AVANCE">Solo avances</option>
            <option value="NUEVO">Solo nuevos</option>
          </select>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          className="ml-auto"
        >
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <p className="text-xs text-slate-400 font-bold">
        {rowsFiltradas.length.toLocaleString()} registros
        {filtroMovimiento !== "TODOS" && (
          <button
            type="button"
            onClick={() => setFiltroMovimiento("TODOS")}
            className="ml-2 text-primary underline"
          >
            limpiar filtro
          </button>
        )}
      </p>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Matrícula
              </th>
              <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nombre
              </th>
              {tipoActivo === "TODOS" && (
                <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Tipo
                </th>
              )}
              <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Grupo
              </th>
              <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pos. ant.
              </th>
              <th className="text-center p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {" "}
              </th>
              <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pos. nueva
              </th>
              <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Delta
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsFiltradas.slice(0, 200).map((r, i) => {
              const isRetroceso = r.delta !== null && r.delta > 0;
              const isAvance = r.delta !== null && r.delta < 0;
              return (
                <tr
                  key={`${r.tipo}-${r.matricula}-${i}`}
                  className={cn(
                    "border-t border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50",
                    isRetroceso &&
                      "bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20",
                  )}
                >
                  <td className="p-3 font-bold text-slate-600">
                    {r.matricula}
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">
                    {r.nombre}
                  </td>
                  {tipoActivo === "TODOS" && (
                    <td className="p-3 text-slate-500 text-xs">
                      {NOMBRES_CORTOS[r.tipo]}
                    </td>
                  )}
                  <td className="p-3 text-slate-400 text-xs">{r.grupo}</td>
                  <td className="p-3 text-right text-slate-400 tabular-nums">
                    {r.posAnterior ?? "—"}
                  </td>
                  <td className="p-3 text-center text-slate-300">
                    {r.delta !== null ? "→" : ""}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-800 dark:text-white tabular-nums">
                    {r.posNueva}
                  </td>
                  <td className="p-3 text-right font-black tabular-nums">
                    {r.delta === null ? (
                      <span className="text-slate-300 text-xs">nuevo</span>
                    ) : r.delta < 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600">
                        <TrendingUp className="h-3 w-3" />
                        {Math.abs(r.delta)}
                      </span>
                    ) : r.delta > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-red-500">
                        <TrendingDown className="h-3 w-3" />
                        {r.delta}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rowsFiltradas.length === 0 && (
              <tr>
                <td
                  colSpan={tipoActivo === "TODOS" ? 8 : 7}
                  className="p-8 text-center text-slate-400 text-sm"
                >
                  No hay registros con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rowsFiltradas.length > 200 && (
          <p className="p-3 text-center text-xs text-slate-400">
            Mostrando 200 de {rowsFiltradas.length.toLocaleString()} — usa los
            filtros o búsqueda para acotar.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "slate" | "emerald" | "red";
  onClick?: () => void;
  active?: boolean;
}) {
  const colorMap = {
    slate: "text-slate-600 dark:text-slate-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
  };
  const bgMap = {
    slate: "",
    emerald: active ? "ring-2 ring-emerald-400" : "",
    red: active ? "ring-2 ring-red-400" : "",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-left transition-all",
        onClick &&
          "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700",
        !onClick && "cursor-default",
        bgMap[color],
      )}
    >
      <div className={cn("shrink-0", colorMap[color])}>{icon}</div>
      <div>
        <p className={cn("text-lg font-black tabular-nums", colorMap[color])}>
          {value}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {label}
        </p>
      </div>
    </button>
  );
}

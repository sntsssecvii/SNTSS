"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Search } from "lucide-react";
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

interface MovimientosTabProps {
  syncId: string;
  syncAnteriorId: string | null;
  idToken: string;
}

export function MovimientosTab({
  syncId,
  syncAnteriorId,
  idToken,
}: MovimientosTabProps) {
  const [rows, setRows] = useState<MovimientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoBolsaDeTrabajo | "TODOS">(
    "TODOS",
  );
  const [filtroMovimiento, setFiltroMovimiento] = useState<
    "TODOS" | "RETROCESO" | "AVANCE"
  >("TODOS");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar posiciones de la sync actual
      const resActual = await fetch(
        `/api/admin/bolsa/posiciones?syncId=${syncId}`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
        },
      );
      const dataActual = await resActual.json();
      const posActuales: BolsaPosicionMaterializada[] = dataActual.data ?? [];

      // Cargar posiciones de la sync anterior (si existe)
      let prevLookup = new Map<string, number>();
      if (syncAnteriorId) {
        const resAnterior = await fetch(
          `/api/admin/bolsa/posiciones?syncId=${syncAnteriorId}`,
          {
            headers: { Authorization: `Bearer ${idToken}` },
          },
        );
        const dataAnterior = await resAnterior.json();
        const posAnteriores: BolsaPosicionMaterializada[] =
          dataAnterior.data ?? [];
        for (const p of posAnteriores) {
          prevLookup.set(`${p.tipoDocumento}::${p.matricula}`, p.posicionBase);
        }
      }

      const movimientos: MovimientoRow[] = posActuales.map((p) => {
        const posAnterior =
          prevLookup.get(`${p.tipoDocumento}::${p.matricula}`) ?? null;
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

      movimientos.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
      setRows(movimientos);
    } catch (err) {
      console.error("Error cargando movimientos:", err);
    } finally {
      setLoading(false);
    }
  }, [syncId, syncAnteriorId, idToken]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const rowsFiltradas = rows.filter((r) => {
    if (filtroTipo !== "TODOS" && r.tipo !== filtroTipo) return false;
    if (filtroMovimiento === "RETROCESO" && (r.delta === null || r.delta <= 0))
      return false;
    if (filtroMovimiento === "AVANCE" && (r.delta === null || r.delta >= 0))
      return false;
    if (
      busqueda &&
      !r.matricula.includes(busqueda.toUpperCase()) &&
      !r.nombre.toLowerCase().includes(busqueda.toLowerCase())
    )
      return false;
    return true;
  });

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

  const tipos = [...new Set(rows.map((r) => r.tipo))] as TipoBolsaDeTrabajo[];

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
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
        <select
          value={filtroTipo}
          onChange={(e) =>
            setFiltroTipo(e.target.value as TipoBolsaDeTrabajo | "TODOS")
          }
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
        >
          <option value="TODOS">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {NOMBRES_TIPOS[t]}
            </option>
          ))}
        </select>
        <select
          value={filtroMovimiento}
          onChange={(e) =>
            setFiltroMovimiento(
              e.target.value as "TODOS" | "RETROCESO" | "AVANCE",
            )
          }
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
        >
          <option value="TODOS">Todos</option>
          <option value="RETROCESO">Solo retrocesos</option>
          <option value="AVANCE">Solo avances</option>
        </select>
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
              <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Tipo
              </th>
              <th className="text-right p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pos. ant.
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
            {rowsFiltradas.slice(0, 200).map((r, i) => (
              <tr
                key={`${r.tipo}-${r.matricula}-${i}`}
                className="border-t border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
              >
                <td className="p-3 font-bold text-slate-600">{r.matricula}</td>
                <td className="p-3 text-slate-700 dark:text-slate-300">
                  {r.nombre}
                </td>
                <td className="p-3 text-slate-500 text-xs">
                  {NOMBRES_TIPOS[r.tipo]}
                </td>
                <td className="p-3 text-right text-slate-400">
                  {r.posAnterior ?? "—"}
                </td>
                <td className="p-3 text-right font-bold text-slate-800 dark:text-white">
                  {r.posNueva}
                </td>
                <td className="p-3 text-right font-black">
                  {r.delta === null ? (
                    <span className="text-slate-400">—</span>
                  ) : r.delta < 0 ? (
                    <span className="text-emerald-600">
                      ↑{Math.abs(r.delta)}
                    </span>
                  ) : r.delta > 0 ? (
                    <span className="text-red-500">↓{r.delta}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rowsFiltradas.length === 0 && (
              <tr>
                <td
                  colSpan={6}
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
            filtros para acotar.
          </p>
        )}
      </div>
    </div>
  );
}

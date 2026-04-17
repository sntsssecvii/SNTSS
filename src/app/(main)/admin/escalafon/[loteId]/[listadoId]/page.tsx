"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Search,
  XCircle,
} from "lucide-react";
import { auth } from "@/lib/firebase/firebase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  EscalafonAspirante,
  EscalafonListado,
  EscalafonLote,
} from "@/types/escalafon";

const PAGE_SIZE = 50;

type PageState = "loading" | "success" | "error";

async function fetchConAuth<T>(url: string): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sesión no válida");
  const idToken = await user.getIdToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data as T;
}

export default function DetalleListadoPage() {
  const params = useParams<{ loteId: string; listadoId: string }>();
  const loteId = String(params.loteId ?? "");
  const listadoId = String(params.listadoId ?? "");
  const router = useRouter();

  // ── Datos del servidor ──
  const [listado, setListado] = useState<EscalafonListado | null>(null);
  const [aspirantes, setAspirantes] = useState<EscalafonAspirante[]>([]);
  const [lote, setLote] = useState<EscalafonLote | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Filtros sidebar ──
  const [filtroZona, setFiltroZona] = useState("all");
  const [filtroEstatus, setFiltroEstatus] = useState<"all" | "Activo" | "PEI">(
    "all",
  );
  const [busquedaZona, setBusquedaZona] = useState("");
  const busquedaZonaDeferred = useDeferredValue(busquedaZona);

  // ── Búsqueda toolbar ──
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");

  // ── Paginación ──
  const [paginaActual, setPaginaActual] = useState(1);

  // ── Modal detalle ──
  const [aspiranteModal, setAspiranteModal] =
    useState<EscalafonAspirante | null>(null);

  // Debounce búsqueda 300ms
  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Reset página al cambiar filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [filtroZona, filtroEstatus, busquedaDebounced]);

  // Carga inicial: listado+aspirantes y lote en paralelo
  useEffect(() => {
    if (!listadoId || !loteId) return;
    setPageState("loading");

    Promise.all([
      fetchConAuth<{
        listado: EscalafonListado;
        aspirantes: EscalafonAspirante[];
      }>(`/api/escalafon/${listadoId}`),
      fetchConAuth<{ lote: EscalafonLote }>(`/api/escalafon/lotes/${loteId}`),
    ])
      .then(([listadoData, loteData]) => {
        setListado(listadoData.listado);
        setAspirantes(listadoData.aspirantes ?? []);
        setLote(loteData.lote);
        setPageState("success");
      })
      .catch((e) => {
        setErrorMsg(e.message);
        setPageState("error");
      });
  }, [listadoId, loteId]);

  // ── Conteos para sidebar ──
  const conteosPorZona = useMemo(() => {
    const m: Record<string, number> = {};
    aspirantes.forEach((a) => {
      Object.keys(a.posicionesPorZona ?? {}).forEach((z) => {
        m[z] = (m[z] ?? 0) + 1;
      });
    });
    return m;
  }, [aspirantes]);

  const conteosEstatus = useMemo(() => {
    return aspirantes.reduce(
      (acc, a) => {
        acc[a.estatus] = (acc[a.estatus] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [aspirantes]);

  // ── Filtrado + orden ──
  const aspirantesFiltrados = useMemo(() => {
    let list = [...aspirantes];
    if (filtroEstatus !== "all")
      list = list.filter((a) => a.estatus === filtroEstatus);
    if (filtroZona !== "all")
      list = list.filter(
        (a) => a.posicionesPorZona?.[filtroZona] !== undefined,
      );
    if (busquedaDebounced) {
      const q = busquedaDebounced.toLowerCase();
      list = list.filter(
        (a) =>
          a.nombre.toLowerCase().includes(q) ||
          a.matricula.toLowerCase().includes(q),
      );
    }
    if (filtroZona !== "all") {
      list.sort(
        (a, b) =>
          (a.posicionesPorZona?.[filtroZona] ?? 9999) -
          (b.posicionesPorZona?.[filtroZona] ?? 9999),
      );
    } else {
      list.sort((a, b) => a.lugar - b.lugar);
    }
    return list;
  }, [aspirantes, filtroEstatus, filtroZona, busquedaDebounced]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(aspirantesFiltrados.length / PAGE_SIZE),
  );
  const filasPagina = aspirantesFiltrados.slice(
    (paginaActual - 1) * PAGE_SIZE,
    paginaActual * PAGE_SIZE,
  );

  // ── Zonas sidebar (con búsqueda) ──
  const zonasDelListado = useMemo(() => listado?.zonas ?? [], [listado]);
  const zonasFiltradas = useMemo(() => {
    if (!busquedaZonaDeferred) return zonasDelListado;
    const q = busquedaZonaDeferred.toLowerCase();
    return zonasDelListado.filter((z) => z.toLowerCase().includes(q));
  }, [zonasDelListado, busquedaZonaDeferred]);

  // ── CSV export ──
  const exportarCSV = useCallback(() => {
    if (!listado) return;
    function csvCell(v: unknown): string {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[,"\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s}"` : s;
    }
    const headers = [
      "Lugar",
      "Estatus",
      "Matrícula",
      "Nombre",
      "Delegación",
      "Fecha Registro",
      "Preferencias",
    ];
    const rows = aspirantesFiltrados.map((a) => [
      csvCell(a.lugar),
      csvCell(a.estatus),
      csvCell(a.matricula),
      csvCell(a.nombre),
      csvCell(a.delegacion),
      csvCell(a.fechaRegistro),
      csvCell(
        a.preferencias
          .map((p) => `${p.delegacionSolicitada}/${p.zonaSolicitada}`)
          .join(" | "),
      ),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escalafon-${listado.categoriaCode}-${listado.periodoDecierre}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [aspirantesFiltrados, listado]);

  // ── Estados de carga / error ──
  if (pageState === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-[#020617]">
        <XCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-black">{errorMsg ?? "Error al cargar"}</h2>
        <Button
          onClick={() => router.push(`/admin/escalafon/${loteId}`)}
          className="mt-4 rounded-xl"
        >
          Volver al lote
        </Button>
      </div>
    );
  }

  if (pageState === "loading" || !listado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-[#020617] space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-xs font-black uppercase text-slate-500 tracking-widest">
          Cargando listado...
        </p>
      </div>
    );
  }

  const loteAbierto = lote?.estado === "ABIERTO";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 lg:left-64 top-14 bg-[#F8FAFC] dark:bg-[#020617] flex flex-col overflow-hidden z-20"
    >
      {/* ══ HEADER ══ */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shrink-0">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {/* Izquierda: back + título */}
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/admin/escalafon/${loteId}`)}
                className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-full">
                    Listado Escalafonario
                  </span>
                  <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                    {lote?.nombre}
                  </span>
                </div>
                <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {listado.categoriaDesc}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Área {listado.areaCode} · {listado.areaDesc} · Sector:{" "}
                  {listado.sector} · Periodo: {listado.periodoDecierre}
                </p>
                {/* Stats inline */}
                <div className="flex items-center gap-4 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>{listado.aspirantesParsed} aspirantes</span>
                  <span>·</span>
                  <span>{listado.zonas?.length ?? 0} zonas</span>
                  {filtroZona !== "all" && (
                    <>
                      <span>·</span>
                      <span className="text-primary">Zona: {filtroZona}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Derecha: acciones */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={exportarCSV}
                className="rounded-xl h-9 font-black text-[10px] uppercase tracking-widest gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
              {loteAbierto && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/admin/escalafon/cargar?reemplazar=${listadoId}`,
                    )
                  }
                  className="rounded-xl h-9 font-black text-[10px] uppercase tracking-widest"
                >
                  Reemplazar
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ══ BODY ══ */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ── SIDEBAR ── */}
        <aside className="hidden lg:flex w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col">
          <Tabs defaultValue="zonas" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-4 pb-0 shrink-0">
              <TabsList className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <TabsTrigger
                  value="zonas"
                  className="flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700"
                >
                  Zonas
                </TabsTrigger>
                <TabsTrigger
                  value="estatus"
                  className="flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700"
                >
                  Estatus
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Zonas */}
            <TabsContent
              value="zonas"
              className="flex-1 overflow-hidden flex flex-col m-0 p-4 pt-3 data-[state=inactive]:hidden focus-visible:outline-none focus-visible:ring-0"
            >
              <div className="relative mb-3 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar zonas..."
                  value={busquedaZona}
                  onChange={(e) => setBusquedaZona(e.target.value)}
                  className="pl-9 h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-bold shadow-sm"
                />
              </div>
              <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)]">
                  <div className="p-3 space-y-1">
                    {/* Todas */}
                    <button
                      onClick={() => setFiltroZona("all")}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between",
                        filtroZona === "all"
                          ? "bg-primary text-white font-black shadow-md shadow-primary/20"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold",
                      )}
                    >
                      <span className="text-[11px]">Todas las Zonas</span>
                      <span
                        className={cn(
                          "text-[9px] px-2 py-0.5 rounded-full",
                          filtroZona === "all"
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500",
                        )}
                      >
                        {aspirantes.length}
                      </span>
                    </button>
                    <div className="py-2 px-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Lista de Zonas
                      </p>
                    </div>
                    {zonasFiltradas.map((zona) => {
                      const active = filtroZona === zona;
                      const count = conteosPorZona[zona] ?? 0;
                      return (
                        <button
                          key={zona}
                          onClick={() => setFiltroZona(zona)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between",
                            active
                              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-sm"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-bold",
                          )}
                        >
                          <span className="truncate text-[10px] leading-tight pr-2">
                            {zona}
                          </span>
                          <span
                            className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded-md flex-shrink-0",
                              active
                                ? "bg-white/20 dark:bg-slate-900/10"
                                : "bg-slate-100 dark:bg-slate-800",
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Estatus */}
            <TabsContent
              value="estatus"
              className="flex-1 overflow-hidden flex flex-col m-0 p-4 pt-3 data-[state=inactive]:hidden focus-visible:outline-none focus-visible:ring-0"
            >
              <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)]">
                  <div className="p-3 space-y-1">
                    {(["all", "Activo", "PEI"] as const).map((est) => {
                      const active = filtroEstatus === est;
                      const count =
                        est === "all"
                          ? aspirantes.length
                          : (conteosEstatus[est] ?? 0);
                      const label = est === "all" ? "Todos" : est;
                      return (
                        <button
                          key={est}
                          onClick={() => setFiltroEstatus(est)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between",
                            active
                              ? est === "all"
                                ? "bg-primary text-white font-black shadow-md shadow-primary/20"
                                : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold",
                          )}
                        >
                          <span className="text-[11px]">{label}</span>
                          <span
                            className={cn(
                              "text-[9px] px-2 py-0.5 rounded-full",
                              active
                                ? "bg-white/20"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500",
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* ── MAIN ── se completa en Task 3 */}
        <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#020617] h-full overflow-hidden">
          <div className="p-8 text-slate-400 text-sm">
            Tabla en construcción...
          </div>
        </main>
      </div>

      {/* Modal — se completa en Task 3 */}
    </motion.div>
  );
}

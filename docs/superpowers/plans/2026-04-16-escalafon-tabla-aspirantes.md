# Escalafón — Tabla de Aspirantes (Rewrite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la tabla HTML básica de `/admin/escalafon/[loteId]/[listadoId]` con la misma UX premium de bolsa de trabajo: layout fijo con sidebar de filtros, toolbar con búsqueda y paginación, tabla con ojo de detalle, y exportación CSV.

**Architecture:** Una sola página client component reemplaza el page.tsx actual. Carga paralela de listado+aspirantes y lote al montar. Todo el filtrado/paginación es client-side via `useMemo` (máx ~200 aspirantes). No hay cambios de API ni de tipos.

**Tech Stack:** Next.js 14 App Router, React 18 (`useMemo`, `useCallback`, `useDeferredValue`), Framer Motion, shadcn/ui (`Table`, `Dialog`, `Tabs`, `Badge`, `Button`, `Input`), Tailwind CSS, lucide-react.

---

## Archivos

| Operación | Ruta                                                           |
| --------- | -------------------------------------------------------------- |
| Rewrite   | `src/app/(main)/admin/escalafon/[loteId]/[listadoId]/page.tsx` |

Sin cambios en APIs, tipos ni componentes adicionales.

---

## Referencia de tipos (ya existen en `src/types/escalafon.ts`)

```ts
interface EscalafonPreferencia {
  delegacionSolicitada: string;
  zonaSolicitada: string;
  localidadSolicitada: string;
  adscripcionCode: string;
  adscripcionDesc: string;
  turnoNum: number | null;
  turnoDesc: string;
}
interface EscalafonAspirante {
  id?: string;
  listadoId: string;
  lugar: number;
  estatus: "Activo" | "PEI";
  matricula: string;
  nombre: string;
  delegacion: string;
  fechaRegistro: string;
  preferencias: EscalafonPreferencia[];
  posicionesPorZona?: Record<string, number>;
}
interface EscalafonListado {
  id?: string;
  loteId?: string;
  categoriaCode: string;
  categoriaDesc: string;
  areaCode: string;
  areaDesc: string;
  sector: string;
  periodoDecierre: string;
  aspirantesParsed: number;
  zonas: string[];
  numeroListado: string;
  convocatoria: string;
  vigenciaInicio: string;
  vigenciaFin: string;
  delegacion: string;
}
interface EscalafonLote {
  id?: string;
  nombre: string;
  estado: "ABIERTO" | "CERRADO";
  totalListados: number;
}
```

---

### Task 1: Datos, estado y estados de carga

**Files:**

- Modify: `src/app/(main)/admin/escalafon/[loteId]/[listadoId]/page.tsx`

- [ ] **Step 1: Reemplazar el archivo completo con la base: imports + estado + carga de datos**

```tsx
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
      a.lugar,
      a.estatus,
      a.matricula,
      `"${a.nombre}"`,
      `"${a.delegacion}"`,
      a.fechaRegistro,
      `"${a.preferencias.map((p) => `${p.delegacionSolicitada}/${p.zonaSolicitada}`).join(" | ")}"`,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escalafon-${listado.categoriaCode}-${listado.periodoDecierre}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {/* PLACEHOLDER — se completa en Task 2 */}
      <div className="p-8 text-slate-500">Layout en construcción...</div>

      {/* Modal detalle — se completa en Task 3 */}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/admin/escalafon/\[loteId\]/\[listadoId\]/page.tsx
git commit -m "feat(escalafon/listado): base estado+datos+filtrado — layout pendiente"
```

---

### Task 2: Header + Sidebar

**Files:**

- Modify: `src/app/(main)/admin/escalafon/[loteId]/[listadoId]/page.tsx`

- [ ] **Step 1: Reemplazar el `return` completo con layout + header + sidebar**

Sustituye todo desde `return (` hasta el final del archivo con:

```tsx
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
                  router.push(`/admin/escalafon/cargar?reemplazar=${listadoId}`)
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
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

Esperado: sin errores. Si hay error con `Tabs`, verifica que el import incluye `TabsContent`.

- [ ] **Step 3: Abrir en navegador y verificar**

Navega a cualquier listado: `/admin/escalafon/[loteId]/[listadoId]`

Verificar:

- Spinner de carga aparece brevemente
- Header muestra título del listado, lote, stats
- Sidebar izquierdo visible con tabs "Zonas" y "Estatus"
- Tab Zonas lista las zonas con conteos correctos
- Tab Estatus lista Todos/Activo/PEI con conteos
- Botón "Exportar CSV" y (si lote ABIERTO) "Reemplazar" en header

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/admin/escalafon/\[loteId\]/\[listadoId\]/page.tsx
git commit -m "feat(escalafon/listado): header + sidebar con tabs zonas y estatus"
```

---

### Task 3: Toolbar + Tabla

**Files:**

- Modify: `src/app/(main)/admin/escalafon/[loteId]/[listadoId]/page.tsx`

- [ ] **Step 1: Reemplazar el `<main>` placeholder con toolbar + tabla completa**

Localiza `{/* ── MAIN ── se completa en Task 3 */}` y reemplaza el `<main>` entero:

```tsx
<main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#020617] h-full overflow-hidden">
  {/* ── Toolbar ── */}
  <motion.div
    initial={{ y: -10, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.1 }}
    className="px-4 lg:px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 shrink-0"
  >
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
      {/* Búsqueda */}
      <div className="w-full xl:max-w-md relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Busca por nombre o matrícula..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-10 h-10 border-none bg-transparent shadow-none focus-visible:ring-0 rounded-xl font-bold text-xs"
        />
      </div>

      <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 xl:block" />

      {/* Paginación + total */}
      <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2 xl:px-0 xl:pb-0">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3">
          {aspirantesFiltrados.length} resultado
          {aspirantesFiltrados.length !== 1 ? "s" : ""}
        </span>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            disabled={paginaActual === 1}
            onClick={() => setPaginaActual((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-[10px] font-black text-slate-500 uppercase">
            {paginaActual}{" "}
            <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>{" "}
            {totalPaginas}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            disabled={paginaActual >= totalPaginas}
            onClick={() => setPaginaActual((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </motion.div>

  {/* ── Tabla ── */}
  <motion.div
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.2 }}
    className="flex-1 p-4 lg:p-6 bg-slate-50/50 dark:bg-[#020617]/50 relative min-h-0"
  >
    <div className="absolute inset-4 lg:inset-6 overflow-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)]">
      <Table className="border-separate border-spacing-0 min-w-[900px]">
        <TableHeader className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <TableRow className="hover:bg-transparent">
            <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
              Lugar
            </TableHead>
            {filtroZona !== "all" && (
              <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 text-center">
                Pos. en Zona
              </TableHead>
            )}
            <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
              Estatus
            </TableHead>
            <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
              Matrícula
            </TableHead>
            <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
              Nombre / Delegación
            </TableHead>
            <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
              Fecha Registro
            </TableHead>
            <TableHead className="w-16 border-b border-slate-200 dark:border-slate-800" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {filasPagina.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-32 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 shadow-inner dark:bg-slate-800">
                    <Search className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      No se encontraron aspirantes
                    </p>
                    <p className="text-sm font-bold text-slate-500 max-w-sm uppercase tracking-tight">
                      Intenta con otros filtros o términos de búsqueda.
                    </p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filasPagina.map((a, i) => (
              <TableRow
                key={a.id ?? `${a.matricula}-${i}`}
                className={cn(
                  "group border-b border-slate-100 dark:border-slate-800",
                  i % 2 === 0
                    ? "bg-white dark:bg-[#020617]"
                    : "bg-slate-50/30 dark:bg-slate-950/20",
                )}
              >
                {/* Lugar global */}
                <TableCell className="py-4 px-6">
                  <span className="font-mono text-sm font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                    {a.lugar}
                  </span>
                </TableCell>

                {/* Posición en zona (solo si filtro zona activo) */}
                {filtroZona !== "all" && (
                  <TableCell className="py-4 px-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50 min-w-[32px] text-center shadow-sm">
                        {a.posicionesPorZona?.[filtroZona] ?? "—"}
                      </span>
                      <span className="text-[8px] font-bold text-emerald-500 mt-1 uppercase tracking-widest">
                        Zona
                      </span>
                    </div>
                  </TableCell>
                )}

                {/* Estatus */}
                <TableCell className="py-4 px-6">
                  <Badge
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border-0",
                      a.estatus === "Activo"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
                    )}
                  >
                    {a.estatus}
                  </Badge>
                </TableCell>

                {/* Matrícula */}
                <TableCell className="py-4 px-6 font-mono font-bold text-xs text-slate-600 dark:text-slate-300">
                  {a.matricula}
                </TableCell>

                {/* Nombre / Delegación */}
                <TableCell className="py-4 px-6">
                  <p className="font-extrabold text-sm text-slate-900 dark:text-slate-200 group-hover:text-primary transition-colors leading-none">
                    {a.nombre}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight truncate max-w-[240px]">
                    {a.delegacion}
                  </p>
                </TableCell>

                {/* Fecha Registro */}
                <TableCell className="py-4 px-6 text-xs font-bold text-slate-500">
                  {a.fechaRegistro}
                </TableCell>

                {/* Ojo */}
                <TableCell className="py-4 px-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
                    onClick={() => setAspiranteModal(a)}
                  >
                    <Eye className="h-4 w-4 text-primary" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  </motion.div>
</main>
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Verificar en navegador**

- Toolbar con buscador y paginación visibles
- Tabla con filas, zebra striping, hover resalta nombre en primary
- Columna "Pos. en Zona" aparece al seleccionar una zona en sidebar (y desaparece al volver a "Todas las Zonas")
- Paginación correcta (50 por página)
- Botón ojo aparece en hover (click no hace nada aún — modal en Task 4)
- Empty state con ícono `Search` cuando no hay resultados

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/admin/escalafon/\[loteId\]/\[listadoId\]/page.tsx
git commit -m "feat(escalafon/listado): toolbar + tabla con filtros y paginación"
```

---

### Task 4: Modal de detalle + commit final

**Files:**

- Modify: `src/app/(main)/admin/escalafon/[loteId]/[listadoId]/page.tsx`

- [ ] **Step 1: Agregar el modal de detalle antes del cierre de `</motion.div>`**

Localiza `{/* Modal — se completa en Task 3 */}` al final del return y reemplázalo con:

```tsx
{
  /* ══ MODAL DETALLE ══ */
}
<Dialog
  open={aspiranteModal !== null}
  onOpenChange={(open) => {
    if (!open) setAspiranteModal(null);
  }}
>
  <DialogContent className="max-w-2xl rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 overflow-hidden">
    {aspiranteModal && (
      <>
        {/* Header del modal */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                {aspiranteModal.nombre}
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-widest">
                {aspiranteModal.matricula} · {aspiranteModal.delegacion}
              </p>
            </div>
            <Badge
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border-0 shrink-0",
                aspiranteModal.estatus === "Activo"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700",
              )}
            >
              {aspiranteModal.estatus}
            </Badge>
          </div>
        </DialogHeader>

        {/* Cuerpo */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Grid de datos generales */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Lugar Global
              </p>
              <p className="text-3xl font-black text-primary">
                {aspiranteModal.lugar}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Fecha Registro
              </p>
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                {aspiranteModal.fechaRegistro}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Posiciones por Zona
              </p>
              {Object.keys(aspiranteModal.posicionesPorZona ?? {}).length ===
              0 ? (
                <p className="text-xs text-slate-400 font-bold">Sin zonas</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(aspiranteModal.posicionesPorZona ?? {}).map(
                    ([zona, pos]) => (
                      <span
                        key={zona}
                        className="inline-flex items-center gap-1 text-[9px] font-black bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-lg"
                      >
                        {zona}:{" "}
                        <span className="text-emerald-900 dark:text-emerald-300">
                          {pos}
                        </span>
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preferencias */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              Preferencias ({aspiranteModal.preferencias.length})
            </p>
            {aspiranteModal.preferencias.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-6 text-center">
                <p className="text-sm text-slate-400 font-bold">
                  Sin preferencias registradas
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      {[
                        "#",
                        "Delegación",
                        "Zona",
                        "Localidad",
                        "Adscripción",
                        "Turno",
                      ].map((h) => (
                        <th
                          key={h}
                          className="py-2.5 px-3 text-left font-black text-[9px] uppercase tracking-widest text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aspiranteModal.preferencias.map((p, idx) => (
                      <tr
                        key={idx}
                        className={cn(
                          "border-t border-slate-100 dark:border-slate-800",
                          idx % 2 === 0
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50/50 dark:bg-slate-800/30",
                        )}
                      >
                        <td className="py-2.5 px-3 font-mono font-black text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                          {p.delegacionSolicitada || "—"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                          {p.zonaSolicitada || "—"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                          {p.localidadSolicitada || "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-700 dark:text-slate-300">
                            {p.adscripcionCode}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold truncate max-w-[140px]">
                            {p.adscripcionDesc}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-600 dark:text-slate-300">
                          {p.turnoNum != null ? `T${p.turnoNum}` : "—"}
                          {p.turnoDesc && (
                            <span className="block text-[9px] text-slate-400">
                              {p.turnoDesc}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </>
    )}
  </DialogContent>
</Dialog>;
```

- [ ] **Step 2: Verificar typecheck**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 3: Verificar en navegador**

- Hover sobre cualquier fila → ícono ojo aparece
- Click en ojo → modal abre con datos del aspirante
- Modal muestra: nombre, matrícula, delegación, badge estatus
- Grid de datos: lugar global, fecha registro, chips de posición por zona
- Tabla de preferencias con todas las columnas
- Cerrar modal con X o click fuera
- Botón "Exportar CSV" en header descarga archivo con los aspirantes filtrados actualmente

- [ ] **Step 4: Verificar suite de tests**

```bash
npm run check
```

Esperado: typecheck + lint sin errores.

- [ ] **Step 5: Commit final**

```bash
git add src/app/\(main\)/admin/escalafon/\[loteId\]/\[listadoId\]/page.tsx
git commit -m "feat(escalafon/listado): modal detalle aspirante + export CSV — tabla completa"
```

---

## Self-Review

**Cobertura spec:**

- ✅ Layout fijo (sidebar + main) idéntico a bolsa
- ✅ Header: back, título, breadcrumb, stats, Reemplazar, Exportar
- ✅ Sidebar Tab Zonas con búsqueda y conteos
- ✅ Sidebar Tab Estatus con conteos
- ✅ Toolbar: búsqueda debounced + paginación 50/página
- ✅ Columnas: Lugar, Pos.Zona (condicional), Estatus, Matrícula, Nombre/Delegación, Fecha Registro, Ojo
- ✅ Orden: zona activa → posicionesPorZona; sin zona → lugar global
- ✅ Empty state
- ✅ Modal: nombre, matrícula, estatus, delegación, fecha, posiciones por zona, tabla preferencias
- ✅ Export CSV client-side de aspirantes filtrados
- ✅ Framer Motion animations
- ✅ Sidebar hidden en mobile
- ✅ Carga paralela: listado+aspirantes + lote (para saber si ABIERTO)
- ✅ Reset página al cambiar filtros

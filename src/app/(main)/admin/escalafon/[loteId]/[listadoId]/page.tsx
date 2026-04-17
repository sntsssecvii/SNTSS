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
      {/* PLACEHOLDER — se completa en Task 2 */}
      <div className="p-8 text-slate-500">Layout en construcción...</div>

      {/* Modal detalle — se completa en Task 3 */}
    </motion.div>
  );
}

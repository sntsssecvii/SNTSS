"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  calcularPosicionesCambios,
  claveRegistro,
  type CambiosPosicion,
} from "@/lib/cambios-escalafon/position-engine";
import type {
  CambiosListado,
  CambiosLote,
  CambiosRegistro,
} from "@/types/cambios-escalafon";

const PAGE_SIZE = 50;

type PageState = "loading" | "success" | "error";

// El GET adjunta el lugar calculado al vuelo (cada listado es independiente).
type RegistroConLugar = CambiosRegistro & {
  lugar?: number | null;
  totalEnGrupo?: number | null;
  grupoUnidad?: string | null;
  grupoTurno?: string | null;
};

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

function CeldaTexto({
  value,
  mono = false,
}: {
  value?: string | number | null;
  mono?: boolean;
}) {
  const texto = value != null && value !== "" ? String(value) : "—";
  return (
    <span
      className={cn(
        "text-sm text-slate-700 dark:text-slate-200",
        mono && "font-mono font-bold",
        !mono && "font-medium",
      )}
    >
      {texto}
    </span>
  );
}

export default function DetalleListadoCambiosPage() {
  const params = useParams<{ loteId: string; listadoId: string }>();
  const loteId = String(params.loteId ?? "");
  const listadoId = String(params.listadoId ?? "");
  const router = useRouter();

  const [listado, setListado] = useState<CambiosListado | null>(null);
  const [registros, setRegistros] = useState<RegistroConLugar[]>([]);
  const [lote, setLote] = useState<CambiosLote | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [registroModal, setRegistroModal] = useState<RegistroConLugar | null>(
    null,
  );

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busquedaDebounced]);

  useEffect(() => {
    if (!listadoId || !loteId) return;
    setPageState("loading");

    Promise.all([
      fetchConAuth<{ listado: CambiosListado; registros: RegistroConLugar[] }>(
        `/api/cambios-escalafon/${listadoId}`,
      ),
      fetchConAuth<{ lote: CambiosLote }>(
        `/api/cambios-escalafon/lotes/${loteId}`,
      ),
    ])
      .then(([listadoData, loteData]) => {
        setListado(listadoData.listado);
        setRegistros(listadoData.registros ?? []);
        setLote(loteData.lote);
        setPageState("success");
      })
      .catch((e) => {
        setErrorMsg(e.message);
        setPageState("error");
      });
  }, [listadoId, loteId]);

  const registrosFiltrados = useMemo(() => {
    if (!busquedaDebounced) return registros;
    const q = busquedaDebounced.toLowerCase();
    return registros.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        r.matricula.toLowerCase().includes(q) ||
        r.noSolicitud.toLowerCase().includes(q),
    );
  }, [registros, busquedaDebounced]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(registrosFiltrados.length / PAGE_SIZE),
  );
  const filasPagina = registrosFiltrados.slice(
    (paginaActual - 1) * PAGE_SIZE,
    paginaActual * PAGE_SIZE,
  );

  // Posiciones (mismo motor) para la sección "quiénes están arriba" del modal.
  const claveGrupo = (p: CambiosPosicion) =>
    `${p.zona}:::${p.unidad}:::${p.turno}`;

  const posicionesPorGrupo = useMemo(() => {
    const posiciones = calcularPosicionesCambios(registros);
    const mapa = new Map<string, CambiosPosicion[]>();
    for (const p of posiciones) {
      const k = claveGrupo(p);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(p);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.lugar - b.lugar);
    return mapa;
  }, [registros]);

  // Grupos en los que compite el registro abierto en el modal (1 normal, varios si incondicional).
  const gruposDelModal = useMemo(() => {
    if (!registroModal) return [];
    const clave = claveRegistro(registroModal);
    const grupos: CambiosPosicion[] = [];
    for (const lista of posicionesPorGrupo.values()) {
      const propia = lista.find((p) => claveRegistro(p.registro) === clave);
      if (propia) grupos.push(propia);
    }
    return grupos.sort(
      (a, b) => a.unidad.localeCompare(b.unidad) || a.turno.localeCompare(b.turno),
    );
  }, [registroModal, posicionesPorGrupo]);

  const exportarCSV = () => {
    if (!listado) return;
    function csvCell(v: unknown): string {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[,"\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s}"` : s;
    }
    const headers = [
      "Fecha",
      "Hora",
      "No. Solicitud",
      "Matrícula",
      "Nombre",
      "Adscripción Origen",
      "Percibe Concepto",
      "Zona",
      "Adscripción Solicitada",
      "Especialidad/Área",
      "Tipo",
      "Turno",
      "Con Conceptos",
    ];
    const rows = registrosFiltrados.map((r) => [
      csvCell(r.fechaRegistro),
      csvCell(r.horaRegistro),
      csvCell(r.noSolicitud),
      csvCell(r.matricula),
      csvCell(r.nombre),
      csvCell(r.adscripcionOrigen),
      csvCell(r.percibeConcepto),
      csvCell(r.zona),
      csvCell(r.adscripcionSolicitada),
      csvCell(r.especialidadArea),
      csvCell(r.tipo),
      csvCell(r.turnoSolicitado),
      csvCell(r.conConceptos),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cambios-${listado.categoriaCode}-${listado.concepto || "sc"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  if (pageState === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-[#020617]">
        <XCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-black">{errorMsg ?? "Error al cargar"}</h2>
        <Button
          onClick={() => router.push(`/admin/escalafon/cambios/${loteId}`)}
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 lg:left-64 top-14 bg-[#F8FAFC] dark:bg-[#020617] flex flex-col overflow-hidden z-20"
    >
      {/* HEADER */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shrink-0">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  router.push(`/admin/escalafon/cambios/${loteId}`)
                }
                className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-full">
                    Cambios de Escalafón
                  </span>
                  <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                    {lote?.nombre}
                  </span>
                </div>
                <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {listado.categoriaDesc}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {listado.concepto
                    ? `Concepto ${listado.concepto} · `
                    : "Sin concepto · "}
                  Sector: {listado.sectorCode} · Delegación:{" "}
                  {listado.delegacion}
                </p>
                <div className="flex items-center gap-4 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>{listado.registrosParsed} registros</span>
                  <span>·</span>
                  <span>Emitido: {listado.fechaEmision || "Sin fecha"}</span>
                </div>
              </div>
            </div>

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
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#020617] h-full overflow-hidden">
        {/* Toolbar */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="px-4 lg:px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 shrink-0"
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <div className="w-full xl:max-w-md relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Busca por nombre, matrícula o no. solicitud..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 h-10 border-none bg-transparent shadow-none focus-visible:ring-0 rounded-xl font-bold text-xs"
              />
            </div>

            <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 xl:block" />

            <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2 xl:px-0 xl:pb-0">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3">
                {registrosFiltrados.length} resultado
                {registrosFiltrados.length !== 1 ? "s" : ""}
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
                  <span className="text-slate-300 dark:text-slate-600 mx-1">
                    /
                  </span>{" "}
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

        {/* Tabla */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 p-4 lg:p-6 bg-slate-50/50 dark:bg-[#020617]/50 relative min-h-0"
        >
          <div className="absolute inset-4 lg:inset-6 overflow-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)]">
            <Table className="border-separate border-spacing-0 min-w-[1100px]">
              <TableHeader className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <TableRow className="hover:bg-transparent">
                  {[
                    "Lugar",
                    "Fecha",
                    "No. Solicitud",
                    "Matrícula",
                    "Nombre / Adscripción Origen",
                    "Percibe",
                    "Zona",
                    "Adscripción Solicitada",
                    "Esp./Área",
                    "Tipo",
                    "Turno",
                    "C.C.",
                    "",
                  ].map((h) => (
                    <TableHead
                      key={h}
                      className="py-5 px-4 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 whitespace-nowrap"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {filasPagina.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-32 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 shadow-inner dark:bg-slate-800">
                          <Search className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            No se encontraron registros
                          </p>
                          <p className="text-sm font-bold text-slate-500 max-w-sm uppercase tracking-tight">
                            Intenta con otros términos de búsqueda.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filasPagina.map((r, i) => (
                    <TableRow
                      key={r.id ?? `${r.noSolicitud}-${i}`}
                      className={cn(
                        "group border-b border-slate-100 dark:border-slate-800",
                        i % 2 === 0
                          ? "bg-white dark:bg-[#020617]"
                          : "bg-slate-50/30 dark:bg-slate-950/20",
                      )}
                    >
                      <TableCell className="py-4 px-4 whitespace-nowrap">
                        {r.lugar != null ? (
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-base font-black text-primary leading-none">
                              #{r.lugar}
                            </span>
                            {r.totalEnGrupo != null && (
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                                de {r.totalEnGrupo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            {r.fechaRegistro}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {r.horaRegistro}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {r.noSolicitud}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-4 font-mono font-bold text-xs text-slate-600 dark:text-slate-300">
                        {r.matricula}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <p className="font-extrabold text-sm text-slate-900 dark:text-slate-200 group-hover:text-primary transition-colors leading-none">
                          {r.nombre}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight truncate max-w-[200px]">
                          {r.adscripcionOrigen}
                        </p>
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        {r.percibeConcepto ? (
                          <Badge className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-0 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                            {r.percibeConcepto}
                          </Badge>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {r.zona || "—"}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                          {r.adscripcionSolicitada || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-center">
                        <CeldaTexto value={r.especialidadArea} mono />
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {r.tipo || "—"}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {r.turnoSolicitado || "—"}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        {r.conConceptos ? (
                          <Badge className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                            {r.conConceptos}
                          </Badge>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
                          onClick={() => setRegistroModal(r)}
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

      {/* Modal detalle registro */}
      <Dialog
        open={registroModal !== null}
        onOpenChange={(open) => {
          if (!open) setRegistroModal(null);
        }}
      >
        <DialogContent className="max-w-2xl rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 overflow-hidden">
          <DialogTitle className="sr-only">{registroModal?.nombre}</DialogTitle>
          {registroModal && (
            <>
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Solicitud #{registroModal.noSolicitud}
                    </p>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">
                      {registroModal.nombre}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-bold">
                      Mat.{" "}
                      <span className="font-mono">
                        {registroModal.matricula}
                      </span>{" "}
                      · {registroModal.fechaRegistro}{" "}
                      {registroModal.horaRegistro}
                    </p>
                  </div>
                  <Badge className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-0 shrink-0 mt-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {registroModal.tipo || "Sin tipo"}
                  </Badge>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[72vh]">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: "Lugar (en su grupo)",
                      value:
                        registroModal.lugar != null
                          ? `#${registroModal.lugar} de ${registroModal.totalEnGrupo} · ${registroModal.grupoUnidad ?? ""} / ${registroModal.grupoTurno ?? ""}`
                          : "—",
                    },
                    {
                      label: "Adscripción Origen",
                      value: registroModal.adscripcionOrigen,
                    },
                    {
                      label: "Adscripción Solicitada",
                      value: registroModal.adscripcionSolicitada,
                    },
                    { label: "Zona", value: registroModal.zona },
                    {
                      label: "Turno Solicitado",
                      value: registroModal.turnoSolicitado,
                    },
                    {
                      label: "Especialidad/Área",
                      value: registroModal.especialidadArea,
                    },
                    {
                      label: "Percibe Concepto",
                      value: registroModal.percibeConcepto || "—",
                    },
                    {
                      label: "Con Conceptos",
                      value: registroModal.conConceptos || "—",
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4"
                    >
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {label}
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white break-words">
                        {value || "—"}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Quiénes están arriba — prelación dentro del grupo */}
                {gruposDelModal.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                      Quiénes están arriba
                    </p>
                    <div className="space-y-4">
                      {gruposDelModal.map((g) => {
                        const todos =
                          posicionesPorGrupo.get(claveGrupo(g)) ?? [];
                        const arriba = todos.filter((p) => p.lugar < g.lugar);
                        return (
                          <div key={claveGrupo(g)}>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                                {g.unidad} · {g.turno}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400">
                                — {arriba.length} antes · tú eres #{g.lugar} de{" "}
                                {g.totalEnGrupo}
                              </span>
                            </div>
                            {arriba.length === 0 ? (
                              <p className="text-xs text-slate-400 font-bold italic">
                                Nadie antes en este grupo
                              </p>
                            ) : (
                              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="max-h-52 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                      <tr>
                                        {[
                                          "Pos.",
                                          "Matrícula",
                                          "Nombre",
                                          "Tipo",
                                          "Registro",
                                        ].map((h) => (
                                          <th
                                            key={h}
                                            className="py-2 px-3 text-left font-black text-[9px] uppercase tracking-widest text-slate-400"
                                          >
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {arriba.map((p, idx) => (
                                        <tr
                                          key={claveRegistro(p.registro)}
                                          className={cn(
                                            "border-t border-slate-100 dark:border-slate-800",
                                            idx % 2 === 0
                                              ? "bg-white dark:bg-slate-900"
                                              : "bg-slate-50/50 dark:bg-slate-800/30",
                                          )}
                                        >
                                          <td className="py-2 px-3 font-mono font-black text-slate-600 dark:text-slate-300">
                                            #{p.lugar}
                                          </td>
                                          <td className="py-2 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">
                                            {p.registro.matricula}
                                          </td>
                                          <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-200">
                                            {p.registro.nombre}
                                          </td>
                                          <td className="py-2 px-3 font-bold text-slate-500">
                                            {p.registro.tipo}
                                          </td>
                                          <td className="py-2 px-3 text-slate-500 font-medium whitespace-nowrap">
                                            {p.registro.fechaRegistro}{" "}
                                            <span className="text-slate-400">
                                              {p.registro.horaRegistro}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

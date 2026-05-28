"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import {
  Plus,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Propuesta } from "@/types/propuestas";
import type { Requerimiento } from "@/types/requerimientos";
import type { Asignacion } from "@/types/asignaciones";
import type { EstadoPropuesta } from "@/types/workflow";

type Tab = "solicitudes" | "requerimientos" | "asignaciones";

function formatTimestamp(value: unknown): string {
  if (!value) return "—";
  const ts = value as { seconds?: number };
  if (ts.seconds) {
    return new Date(ts.seconds * 1000).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return "—";
}

export default function PropuestasDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("solicitudes");
  const [propuestas, setPropuestas] = useState<(Propuesta & { id: string })[]>(
    [],
  );
  const [requerimientos, setRequerimientos] = useState<
    (Requerimiento & { id: string })[]
  >([]);
  const [asignaciones, setAsignaciones] = useState<
    (Asignacion & { id: string })[]
  >([]);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPropuesta | "">("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [modalRequerimiento, setModalRequerimiento] = useState(false);

  async function getToken() {
    return (await getAuth().currentUser?.getIdToken()) ?? "";
  }

  async function cargarPropuestas() {
    setCargando(true);
    try {
      const token = await getToken();
      const url = filtroEstado
        ? `/api/propuestas?estado=${filtroEstado}`
        : "/api/propuestas";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPropuestas(data.propuestas ?? []);
    } finally {
      setCargando(false);
    }
  }

  async function cargarRequerimientos() {
    try {
      const token = await getToken();
      const res = await fetch("/api/requerimientos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRequerimientos(data.requerimientos ?? []);
    } catch {
      // Error silencioso
    }
  }

  async function cargarAsignaciones() {
    try {
      const token = await getToken();
      const [resAsig, resProp] = await Promise.all([
        fetch("/api/asignaciones", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/propuestas?estado=APROBADA", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const asigData = await resAsig.json();
      const propData = await resProp.json();
      setAsignaciones(asigData.asignaciones ?? []);
      setPropuestas(propData.propuestas ?? []);
    } catch {
      // Error silencioso
    }
  }

  useEffect(() => {
    if (tab === "solicitudes") cargarPropuestas();
    if (tab === "requerimientos") cargarRequerimientos();
    if (tab === "asignaciones") cargarAsignaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filtroEstado]);

  const stats = useMemo(() => {
    const all = propuestas;
    return {
      pendientes: all.filter((p) => p.estado === "PENDIENTE").length,
      aprobadas: all.filter((p) => p.estado === "APROBADA").length,
      rechazadas: all.filter((p) => p.estado === "RECHAZADA").length,
    };
  }, [propuestas]);

  const propuestasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return propuestas;
    const q = busqueda.trim().toLowerCase();
    return propuestas.filter(
      (p) =>
        p.numeroCaso?.toLowerCase().includes(q) ||
        p.matricula?.toLowerCase().includes(q) ||
        p.aspirante?.nombreCompleto?.toLowerCase().includes(q),
    );
  }, [propuestas, busqueda]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "solicitudes", label: "Solicitudes" },
    { key: "requerimientos", label: "Requerimientos" },
    { key: "asignaciones", label: "Asignaciones" },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 dark:bg-[#020617] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Hero header */}
        <header className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 border border-slate-900 p-8 sm:p-12 mb-2 isolate shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-60" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary border border-primary/20 backdrop-blur-md">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Admisión y Cambios
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:leading-[1.1]">
                Propuestas{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-500">
                  Sindicales
                </span>
              </h1>
              <p className="max-w-xl text-sm font-medium text-slate-400 sm:text-base leading-relaxed">
                Gestión de solicitudes de ingreso de familiares al sindicato.
                Revisión, aprobación y asignación a circulares.
              </p>
            </div>
          </div>
        </header>

        {/* Stat cards — solo en tab solicitudes */}
        {tab === "solicitudes" && (
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<Clock className="h-7 w-7" />}
              label="Pendientes"
              value={stats.pendientes}
              color="amber"
            />
            <StatCard
              icon={<CheckCircle2 className="h-7 w-7" />}
              label="Aprobadas"
              value={stats.aprobadas}
              color="emerald"
            />
            <StatCard
              icon={<XCircle className="h-7 w-7" />}
              label="Rechazadas"
              value={stats.rechazadas}
              color="rose"
            />
          </section>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-5 py-3 text-sm font-black tracking-tight border-b-2 transition-colors",
                tab === key
                  ? "border-primary text-slate-900 dark:text-white"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Solicitudes */}
        {tab === "solicitudes" && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                {(
                  [
                    ["", "Todos"],
                    ["PENDIENTE", "Pendientes"],
                    ["APROBADA", "Aprobadas"],
                    ["RECHAZADA", "Rechazadas"],
                  ] as const
                ).map(([e, label]) => (
                  <button
                    key={e}
                    onClick={() => setFiltroEstado(e as EstadoPropuesta | "")}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-black border transition-colors",
                      filtroEstado === e
                        ? "bg-primary text-white border-primary"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Buscador */}
            <div className="group rounded-[2rem] border border-slate-200/50 bg-white/40 p-1.5 shadow-sm backdrop-blur-xl transition-all hover:border-primary/20 hover:shadow-md dark:border-slate-800/50 dark:bg-slate-900/40">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-primary" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por # caso, matrícula o nombre del aspirante..."
                  className="h-12 rounded-2xl border-none bg-transparent pl-11 text-sm font-bold tracking-tight text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-200"
                />
              </div>
            </div>

            {cargando ? (
              <EmptyState
                icon={<FileText />}
                mensaje="Cargando solicitudes..."
              />
            ) : propuestasFiltradas.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                mensaje="No hay solicitudes para mostrar"
              />
            ) : (
              <div className="rounded-[2rem] border border-slate-200/50 bg-white/60 backdrop-blur-xl overflow-hidden dark:border-slate-800/50 dark:bg-slate-900/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        # Caso
                      </th>
                      <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Matrícula
                      </th>
                      <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Aspirante
                      </th>
                      <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Fecha
                      </th>
                      <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Alertas
                      </th>
                      <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {propuestasFiltradas.map((p) => {
                      const tieneWarnings = Object.values(p.warnings).some(
                        Boolean,
                      );
                      return (
                        <tr
                          key={p.id}
                          onClick={() =>
                            router.push(`/admin/propuestas/${p.id}`)
                          }
                          className="hover:bg-primary/5 cursor-pointer transition-colors group"
                        >
                          <td className="px-5 py-4 font-mono text-xs text-slate-500 font-bold">
                            {p.numeroCaso}
                          </td>
                          <td className="px-5 py-4 font-black text-slate-900 dark:text-white">
                            {p.matricula}
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                            {p.sinFamiliar ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-black"
                              >
                                Sin familiar
                              </Badge>
                            ) : (
                              (p.aspirante?.nombreCompleto ?? "—")
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-400">
                            {formatTimestamp(p.creadoEn)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {tieneWarnings && (
                              <AlertTriangle className="inline h-4 w-4 text-amber-500" />
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <EstadoBadge estado={p.estado} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Requerimientos */}
        {tab === "requerimientos" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => setModalRequerimiento(true)}
                className="h-11 rounded-2xl px-6 text-sm font-black bg-primary hover:bg-primary/90 text-white shadow-[0_0_30px_-8px_rgba(225,29,72,0.35)]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Subir circular
              </Button>
            </div>

            {requerimientos.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                mensaje="Sin circulares registrados"
              />
            ) : (
              <div className="rounded-[2rem] border border-slate-200/50 bg-white/60 backdrop-blur-xl overflow-hidden dark:border-slate-800/50 dark:bg-slate-900/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      {["Oficio", "Fecha circular", "Partidas", "Estado"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {requerimientos.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-primary/5 transition-colors"
                      >
                        <td className="px-5 py-4 font-black text-slate-900 dark:text-white">
                          {r.numeroOficio}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {formatTimestamp(r.fechaCircular)}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {r.partidas.length} partida
                          {r.partidas.length !== 1 ? "s" : ""} —{" "}
                          <span className="font-bold text-slate-700">
                            {r.partidas.reduce(
                              (acc, p) => acc + p.cantidadDisponible,
                              0,
                            )}{" "}
                            disponibles
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant={
                              r.estado === "ACTIVO" ? "success" : "secondary"
                            }
                            className="text-[10px] font-black rounded-full"
                          >
                            {r.estado}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {modalRequerimiento && (
              <ModalRequerimiento
                onClose={() => setModalRequerimiento(false)}
                onCreado={() => {
                  setModalRequerimiento(false);
                  cargarRequerimientos();
                }}
                getToken={getToken}
              />
            )}
          </div>
        )}

        {/* Tab: Asignaciones */}
        {tab === "asignaciones" && (
          <div>
            {asignaciones.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 />}
                mensaje="Sin asignaciones registradas"
              />
            ) : (
              <div className="rounded-[2rem] border border-slate-200/50 bg-white/60 backdrop-blur-xl overflow-hidden dark:border-slate-800/50 dark:bg-slate-900/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      {[
                        "Folio",
                        "Aspirante",
                        "Categoría",
                        "Requerimiento",
                        "Estado",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {asignaciones.map((a) => {
                      const prop = propuestas.find(
                        (p) => p.id === a.propuestaId,
                      );
                      return (
                        <tr
                          key={a.id}
                          className="hover:bg-primary/5 transition-colors"
                        >
                          <td className="px-5 py-4 font-mono text-xs font-black text-emerald-700">
                            {prop?.folio ?? "—"}
                          </td>
                          <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                            {prop?.sinFamiliar ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-black"
                              >
                                Sin familiar
                              </Badge>
                            ) : (
                              (prop?.aspirante?.nombreCompleto ?? "—")
                            )}
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                            {a.categoria}
                          </td>
                          <td className="px-5 py-4 text-xs font-mono text-slate-500">
                            {a.requerimientoId.slice(0, 8)}…
                          </td>
                          <td className="px-5 py-4">
                            <Badge
                              variant={
                                a.estado === "ACTIVA" ? "success" : "secondary"
                              }
                              className="text-[10px] font-black rounded-full"
                            >
                              {a.estado}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "amber" | "emerald" | "rose";
}) {
  const colors = {
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
  };
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-all">
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform",
          colors[color],
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <p className="text-4xl font-black text-slate-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const variants: Record<
    string,
    { variant: "warning" | "success" | "destructive"; label: string }
  > = {
    PENDIENTE: { variant: "warning", label: "Pendiente" },
    APROBADA: { variant: "success", label: "Aprobada" },
    RECHAZADA: { variant: "destructive", label: "Rechazada" },
  };
  const { variant, label } = variants[estado] ?? {
    variant: "secondary" as const,
    label: estado,
  };
  return (
    <Badge
      variant={variant}
      className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
    >
      {label}
    </Badge>
  );
}

function EmptyState({
  icon,
  mensaje,
}: {
  icon: React.ReactNode;
  mensaje: string;
}) {
  return (
    <Card className="rounded-3xl border-dashed border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-900/50">
      <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
        <div className="text-slate-300 w-10 h-10">{icon}</div>
        <p className="text-sm font-black text-slate-500">{mensaje}</p>
      </CardContent>
    </Card>
  );
}

function ModalRequerimiento({
  onClose,
  onCreado,
  getToken,
}: {
  onClose: () => void;
  onCreado: () => void;
  getToken: () => Promise<string>;
}) {
  const [numeroOficio, setNumeroOficio] = useState("");
  const [fechaCircular, setFechaCircular] = useState("");
  const [partidas, setPartidas] = useState([
    { zona: "", categoria: "", cantidadTotal: 1 },
  ]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  function agregarPartida() {
    setPartidas([...partidas, { zona: "", categoria: "", cantidadTotal: 1 }]);
  }

  function quitarPartida(idx: number) {
    if (partidas.length > 1) {
      setPartidas(partidas.filter((_, i) => i !== idx));
    }
  }

  function actualizarPartida(
    idx: number,
    campo: string,
    valor: string | number,
  ) {
    const copia = [...partidas];
    copia[idx] = { ...copia[idx], [campo]: valor };
    setPartidas(copia);
  }

  async function enviar() {
    if (!numeroOficio.trim()) {
      setError("El número de oficio es requerido.");
      return;
    }
    if (!fechaCircular) {
      setError("La fecha del circular es requerida.");
      return;
    }
    if (
      partidas.some(
        (p) => !p.zona.trim() || !p.categoria.trim() || p.cantidadTotal < 1,
      )
    ) {
      setError(
        "Todas las partidas deben tener zona, categoría y cantidad válida.",
      );
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/requerimientos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          numeroOficio,
          fechaCircular: new Date(fechaCircular).toISOString(),
          partidas: partidas.map((p) => ({
            ...p,
            cantidadTotal: Number(p.cantidadTotal),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear");
        return;
      }
      onCreado();
    } catch {
      setError("Error de conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800">
        {/* Header modal */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              Nuevo circular
            </p>
            <h3 className="font-black text-slate-900 dark:text-white tracking-tight">
              Subir requerimiento
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body modal */}
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Número de oficio
            </label>
            <Input
              value={numeroOficio}
              onChange={(e) => setNumeroOficio(e.target.value)}
              placeholder="Ej. SNTSS/NA-I-254/2026"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Fecha del circular
            </label>
            <Input
              type="date"
              value={fechaCircular}
              onChange={(e) => setFechaCircular(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Partidas
              </label>
              <button
                onClick={agregarPartida}
                className="text-xs font-black text-primary hover:text-primary/80 transition-colors"
              >
                + Agregar fila
              </button>
            </div>
            <div className="space-y-2">
              {partidas.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_72px_32px] gap-2 items-center"
                >
                  <Input
                    placeholder="Zona"
                    value={p.zona}
                    onChange={(e) =>
                      actualizarPartida(i, "zona", e.target.value)
                    }
                    className="rounded-xl text-sm h-9"
                  />
                  <Input
                    placeholder="Categoría"
                    value={p.categoria}
                    onChange={(e) =>
                      actualizarPartida(i, "categoria", e.target.value)
                    }
                    className="rounded-xl text-sm h-9"
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder="Cant."
                    value={p.cantidadTotal}
                    onChange={(e) =>
                      actualizarPartida(i, "cantidadTotal", e.target.value)
                    }
                    className="rounded-xl text-sm h-9"
                  />
                  <button
                    onClick={() => quitarPartida(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <Button
            onClick={enviar}
            disabled={enviando}
            className="w-full h-11 rounded-xl font-black text-sm bg-primary hover:bg-primary/90 text-white"
          >
            {enviando ? "Guardando..." : "Guardar circular"}
          </Button>
        </div>
      </div>
    </div>
  );
}

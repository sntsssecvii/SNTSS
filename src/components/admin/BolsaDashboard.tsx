"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, ChevronRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { auth } from "@/lib/firebase/firebase-client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { type TipoBolsaDeTrabajo } from "@/types/bolsa-de-trabajo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BolsaDeTrabajoGrid from "@/components/admin/BolsaDeTrabajoGrid";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ResultadoBolsa {
  nombre: string;
  matricula: string;
  tipoDocumento: TipoBolsaDeTrabajo;
  tipoLabel: string;
  posicionBase: number;
  posicionInterinato: number | null;
  categoria: string;
  zona: string;
  adscripcionNueva: string | null;
  turnoNuevo: string | null;
}

interface TrabajadorSugerencia {
  nombre: string;
  matricula: string;
  listas: ResultadoBolsa[];
}

// ─── Paleta de colores ────────────────────────────────────────────────────────

const COLORES: Record<
  TipoBolsaDeTrabajo,
  { bg: string; text: string; border: string; pos: string; badge: string }
> = {
  NUEVO_INGRESO: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    pos: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  AMPLIACIONES_JORNADA: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    pos: "text-cyan-600",
    badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
  },
  CAMBIOS_TURNO_ADSCRIPCION: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    pos: "text-violet-600",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
  },
  CAMBIOS_AREA: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    pos: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  CAMBIOS_RAMA: {
    bg: "bg-fuchsia-50",
    text: "text-fuchsia-700",
    border: "border-fuchsia-200",
    pos: "text-fuchsia-600",
    badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  },
  CAMBIOS_RESIDENCIA_DESTINO: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    pos: "text-rose-600",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
  },
  CAMBIOS_RESIDENCIA_ORIGEN: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    pos: "text-orange-600",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
  CAMBIOS_TIPO_PLAZA: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    pos: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
};

const BADGE_SHORT: Record<TipoBolsaDeTrabajo, string> = {
  NUEVO_INGRESO: "Nuevo Ingreso",
  AMPLIACIONES_JORNADA: "Amp. Jornada",
  CAMBIOS_TURNO_ADSCRIPCION: "Turno / Ads.",
  CAMBIOS_AREA: "Cambios Área",
  CAMBIOS_RAMA: "Cambios Rama",
  CAMBIOS_RESIDENCIA_DESTINO: "Res. Destino",
  CAMBIOS_RESIDENCIA_ORIGEN: "Res. Origen",
  CAMBIOS_TIPO_PLAZA: "Tipo Plaza",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreetingInfo() {
  const hour = new Date().getHours();
  let greeting = "Buenas noches";
  if (hour >= 5 && hour < 12) greeting = "Buenos días";
  else if (hour >= 12 && hour < 19) greeting = "Buenas tardes";

  const days = [
    "¡Feliz Domingo! ☀️",
    "¡Excelente Lunes! 🚀",
    "¡Gran Martes! ⚡️",
    "¡Feliz Miércoles! 🐪",
    "¡Casi Viernes! Jueves 💪",
    "¡Por fin es Viernes! 🎉",
    "¡Gran Sábado! 🍻",
  ];

  return { greeting, dayMessage: days[new Date().getDay()] };
}

async function getToken(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  return u.getIdToken();
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BolsaDashboard() {
  const { userData } = useAuth();
  const [greetingInfo] = useState(getGreetingInfo);

  // Search
  const [query, setQuery] = useState("");
  const [sugerencias, setSugerencias] = useState<TrabajadorSugerencia[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<TrabajadorSugerencia | null>(
    null,
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Búsqueda live ───────────────────────────────────────────────────────────
  const buscar = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSugerencias([]);
      setAbierto(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setBuscando(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch(
        `/api/admin/bolsa/buscar?q=${encodeURIComponent(trimmed)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        },
      );
      const payload = await res.json();

      if (res.ok && payload.data) {
        const grouped: Record<string, TrabajadorSugerencia> = {};
        for (const r of payload.data.resultados as ResultadoBolsa[]) {
          if (!grouped[r.matricula]) {
            grouped[r.matricula] = {
              nombre: r.nombre,
              matricula: r.matricula,
              listas: [],
            };
          }
          grouped[r.matricula].listas.push(r);
        }
        setSugerencias(Object.values(grouped));
        setAbierto(true);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    } finally {
      setBuscando(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(value), 300);
  };

  const limpiar = () => {
    setQuery("");
    setSugerencias([]);
    setAbierto(false);
    inputRef.current?.focus();
  };

  const abrirDetalle = (t: TrabajadorSugerencia) => {
    setSeleccionado(t);
    setAbierto(false);
  };

  // Cerrar dropdown al clic fuera
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const nombre = userData?.nombre?.split(" ")[0] || "Operador";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="container mx-auto p-4 md:p-8 min-h-[calc(100vh-4rem)] flex flex-col justify-center">
      <div className="max-w-7xl w-full mx-auto my-8 md:my-12">
        {/* HERO HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 shadow-sm">
            <Sparkles className="h-4 w-4" />
            SNTSS Sección VII • {greetingInfo.dayMessage}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent mb-4 tracking-tight">
            {greetingInfo.greeting},{" "}
            <span className="text-primary">{nombre}</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium mb-8">
            Bienvenido al módulo de Bolsa de Trabajo. Consulta la posición de
            cualquier trabajador en la quincena activa.
          </p>

          {/* ── Buscador live centrado ────────────────────────────────────── */}
          <div ref={wrapperRef} className="relative max-w-2xl mx-auto">
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 bg-white dark:bg-slate-900 px-5 shadow-lg transition-all duration-200",
                buscando
                  ? "border-primary/60 shadow-[0_0_0_5px_rgba(225,29,72,0.08)]"
                  : query
                    ? "border-slate-300 dark:border-slate-600 shadow-xl"
                    : "border-slate-200/80 dark:border-slate-700",
              )}
            >
              <Search
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  buscando ? "text-primary animate-pulse" : "text-slate-400",
                )}
              />
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => sugerencias.length > 0 && setAbierto(true)}
                placeholder="Busca por matrícula del trabajador..."
                className="flex-1 py-4 bg-transparent text-lg font-black text-slate-900 dark:text-white placeholder:font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none tracking-wide"
                autoComplete="off"
              />
              {query && (
                <button
                  onClick={limpiar}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Dropdown glassmorphism */}
            {abierto && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border border-white/40 dark:border-white/10 bg-white/75 dark:bg-slate-900/80 backdrop-blur-2xl shadow-[0_24px_64px_-8px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_24px_64px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                {/* Brillo interior superior */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20" />

                {sugerencias.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                      Sin resultados para{" "}
                      <span className="font-black text-slate-800 dark:text-white">
                        {query.toUpperCase()}
                      </span>
                    </p>
                  </div>
                ) : (
                  sugerencias.map((t, idx) => (
                    <button
                      key={t.matricula}
                      onClick={() => abrirDetalle(t)}
                      className={cn(
                        "group w-full px-5 py-4 text-left transition-all duration-150",
                        "hover:bg-white/60 dark:hover:bg-white/5",
                        idx < sugerencias.length - 1 &&
                          "border-b border-black/5 dark:border-white/5",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white font-black text-sm shadow-md ring-2 ring-white/40 dark:ring-white/10">
                          {(t.nombre || "?").charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-black text-slate-900 dark:text-white truncate leading-tight text-sm">
                            {t.nombre || "SIN NOMBRE"}
                          </p>
                          <p className="text-xs font-bold text-slate-400 mt-0.5 tracking-wider">
                            {t.matricula}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[48%]">
                          {t.listas.map((l, i) => (
                            <span
                              key={i}
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide backdrop-blur-sm",
                                COLORES[l.tipoDocumento]?.badge ??
                                  "bg-slate-100/80 text-slate-600 border-slate-200",
                              )}
                            >
                              {BADGE_SHORT[l.tipoDocumento]}
                            </span>
                          ))}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary transition-colors" />
                      </div>
                    </button>
                  ))
                )}

                {/* Brillo inferior */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/5 to-transparent dark:via-white/5" />
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* STATS GRID */}
        <BolsaDeTrabajoGrid />
      </div>

      {/* ── Modal de detalle del trabajador ───────────────────────────────── */}
      <Dialog
        open={!!seleccionado}
        onOpenChange={(open) => !open && setSeleccionado(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {seleccionado && (
            <>
              <DialogHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white font-black text-lg shadow-md">
                    {seleccionado.nombre.charAt(0)}
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black leading-tight">
                      {seleccionado.nombre || "SIN NOMBRE"}
                    </DialogTitle>
                    <p className="text-sm font-bold text-slate-500 mt-0.5">
                      Matrícula:{" "}
                      <span className="font-black text-slate-800 dark:text-slate-200">
                        {seleccionado.matricula}
                      </span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 pt-1">
                  Aparece en{" "}
                  <span className="font-black">
                    {seleccionado.listas.length}
                  </span>{" "}
                  {seleccionado.listas.length === 1 ? "listado" : "listados"}
                </p>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {seleccionado.listas.map((r, i) => {
                  const c = COLORES[r.tipoDocumento] ?? {
                    bg: "bg-slate-50",
                    text: "text-slate-700",
                    border: "border-slate-200",
                    pos: "text-slate-600",
                    badge: "bg-slate-100 text-slate-600 border-slate-200",
                  };

                  return (
                    <div
                      key={`${r.tipoDocumento}-${i}`}
                      className={cn(
                        "rounded-2xl border p-5 space-y-4",
                        c.bg,
                        c.border,
                        "dark:bg-slate-900 dark:border-slate-800",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide bg-white/60 dark:bg-slate-800/60",
                          c.text,
                          c.border,
                        )}
                      >
                        {r.tipoLabel}
                      </span>

                      <div className="flex items-end gap-6">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            Posición en fila
                          </p>
                          <p
                            className={cn(
                              "text-6xl font-black leading-none tracking-tighter",
                              c.pos,
                            )}
                          >
                            #{r.posicionBase}
                          </p>
                        </div>
                        {r.posicionInterinato && (
                          <div className="pb-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                              Interinato
                            </p>
                            <p className="text-3xl font-black leading-none tracking-tighter text-amber-500">
                              #{r.posicionInterinato}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/5 dark:border-white/5">
                        {r.categoria && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Categoría
                            </p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 leading-tight">
                              {r.categoria}
                            </p>
                          </div>
                        )}
                        {r.zona && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Zona
                            </p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 leading-tight">
                              {r.zona}
                            </p>
                          </div>
                        )}
                        {r.adscripcionNueva && (
                          <div className="col-span-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Adscripción solicitada
                            </p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 leading-tight">
                              {r.adscripcionNueva}
                            </p>
                          </div>
                        )}
                        {r.turnoNuevo && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Turno solicitado
                            </p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                              {r.turnoNuevo}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

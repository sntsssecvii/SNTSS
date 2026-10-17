"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import { Search, X, Users, CalendarDays, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type TipoBolsaDeTrabajo } from "@/types/bolsa-de-trabajo";
import { useAuth } from "@/contexts/AuthContext";

interface ResultadoBusqueda {
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

interface BusquedaResponse {
  data?: {
    resultados: ResultadoBusqueda[];
    periodo: string | null;
    sinQuincenaActiva?: boolean;
  };
  error?: string;
}

const COLORES_TIPO: Record<
  TipoBolsaDeTrabajo,
  { bg: string; text: string; border: string; pos: string }
> = {
  NUEVO_INGRESO: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    pos: "text-emerald-600",
  },
  AMPLIACIONES_JORNADA: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    pos: "text-cyan-600",
  },
  CAMBIOS_TURNO_ADSCRIPCION: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    pos: "text-violet-600",
  },
  CAMBIOS_AREA: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    pos: "text-blue-600",
  },
  CAMBIOS_RAMA: {
    bg: "bg-fuchsia-50",
    text: "text-fuchsia-700",
    border: "border-fuchsia-200",
    pos: "text-fuchsia-600",
  },
  CAMBIOS_RESIDENCIA_DESTINO: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    pos: "text-rose-600",
  },
  CAMBIOS_RESIDENCIA_ORIGEN: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    pos: "text-orange-600",
  },
  CAMBIOS_TIPO_PLAZA: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    pos: "text-indigo-600",
  },
};

export default function ConsultarBolsaPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [estado, setEstado] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [sinQuincena, setSinQuincena] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isBolsa = userData?.role?.toUpperCase() === "BOLSA";
  const esAdmin =
    userData?.role != null &&
    ["SUPER_ADMIN", "ADMIN", "REVISOR", "CAPTURISTA"].includes(userData.role);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const buscar = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResultados([]);
      setEstado("idle");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setEstado("loading");
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Sin sesión");

      const idToken = await currentUser.getIdToken();
      const res = await fetch(
        `/api/admin/bolsa/buscar?q=${encodeURIComponent(trimmed)}`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        },
      );
      const payload = (await res.json()) as BusquedaResponse;

      if (!res.ok || !payload.data) {
        throw new Error(payload.error || "Error al buscar");
      }

      setSinQuincena(payload.data.sinQuincenaActiva ?? false);
      setPeriodo(payload.data.periodo);
      setResultados(payload.data.resultados);
      setEstado("done");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setErrorMsg(err.message || "Error desconocido");
      setEstado("error");
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(value), 350);
  };

  const limpiar = () => {
    setQuery("");
    setResultados([]);
    setEstado("idle");
    setSinQuincena(false);
    inputRef.current?.focus();
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-6 px-4">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/70 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(127,29,29,0.12),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(239,68,68,0.06),_transparent_35%)]" />

        <div className="relative z-10 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <Users className="h-3.5 w-3.5" />
                Bolsa de Trabajo
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Consulta de Posición
              </h1>
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Ingresa la matrícula para ver la posición en todos los listados
                de la quincena activa.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {periodo && (
                <div className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {periodo}
                </div>
              )}
              {esAdmin && (
                <button
                  onClick={() => router.push("/admin/bolsa-de-trabajo")}
                  className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                  title="Ir a gestión de quincenas"
                >
                  <Settings2 className="h-4 w-4" />
                  Gestión
                </button>
              )}
            </div>
          </div>

          {/* Search integrado */}
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 bg-slate-50 dark:bg-slate-900 px-4 transition-all duration-200",
              estado === "loading"
                ? "border-primary/60 shadow-[0_0_0_4px_rgba(225,29,72,0.08)]"
                : query
                  ? "border-slate-300 dark:border-slate-600 shadow-md"
                  : "border-slate-200 dark:border-slate-700",
            )}
          >
            <Search
              className={cn(
                "h-5 w-5 shrink-0 transition-colors",
                estado === "loading"
                  ? "text-primary animate-pulse"
                  : "text-slate-400",
              )}
            />
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Matrícula del trabajador..."
              className="flex-1 py-4 bg-transparent text-xl font-black text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none tracking-wide"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={limpiar}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!query && !sinQuincena && (
            <p className="text-xs font-medium text-slate-400 text-center -mt-2">
              Escribe mínimo 2 caracteres — busca por prefijo de matrícula
            </p>
          )}
        </div>
      </section>

      {/* Resultados */}
      <div className="space-y-3">
        {/* Sin quincena activa */}
        {sinQuincena && (
          <div className="text-center py-16 space-y-2">
            <p className="text-4xl">📋</p>
            <p className="font-black text-slate-900 dark:text-white">
              Sin quincena activa
            </p>
            <p className="text-sm text-slate-500">
              No hay una quincena publicada en este momento.
            </p>
          </div>
        )}

        {/* Error */}
        {estado === "error" && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-4 text-center">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">
              {errorMsg}
            </p>
          </div>
        )}

        {/* Sin resultados */}
        {estado === "done" &&
          resultados.length === 0 &&
          query.trim().length >= 2 &&
          !sinQuincena && (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
                <Search className="h-7 w-7 text-slate-300 dark:text-slate-600" />
              </div>
              <div>
                <p className="font-black text-slate-900 dark:text-white text-lg">
                  No encontrado
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Ninguna matrícula que empiece con{" "}
                  <span className="font-black text-slate-700 dark:text-slate-300">
                    {query.trim().toUpperCase()}
                  </span>{" "}
                  aparece en la quincena activa.
                </p>
              </div>
            </div>
          )}

        {/* Resultados */}
        {resultados.length > 0 && (
          <div className="space-y-3">
            {resultados.map((r, i) => {
              const color = COLORES_TIPO[r.tipoDocumento] ?? {
                bg: "bg-slate-50",
                text: "text-slate-700",
                border: "border-slate-200",
                pos: "text-slate-600",
              };

              return (
                <div
                  key={`${r.tipoDocumento}-${i}`}
                  className={cn(
                    "rounded-3xl border p-5 space-y-4 shadow-sm",
                    color.bg,
                    color.border,
                    "dark:bg-slate-900 dark:border-slate-800",
                  )}
                >
                  {/* Nombre y matrícula */}
                  <div>
                    <p className="text-xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                      {r.nombre || "SIN NOMBRE"}
                    </p>
                    <p className="text-sm font-bold text-slate-500 mt-0.5">
                      Matrícula:{" "}
                      <span className="text-slate-700 dark:text-slate-300 font-black">
                        {r.matricula}
                      </span>
                    </p>
                  </div>

                  {/* Tipo de trámite */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide border",
                        color.text,
                        color.border,
                        "bg-white/60 dark:bg-slate-800/60",
                      )}
                    >
                      {r.tipoLabel}
                    </span>
                  </div>

                  {/* Posición */}
                  <div className="flex items-end gap-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        Posición en fila
                      </p>
                      <p
                        className={cn(
                          "text-6xl font-black leading-none tracking-tighter",
                          color.pos,
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

                  {/* Detalles adicionales */}
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
        )}

        {/* Estado idle */}
        {estado === "idle" && !sinQuincena && (
          <div className="text-center py-16 space-y-3">
            <div className="w-20 h-20 rounded-full bg-primary/5 border-2 border-primary/10 flex items-center justify-center mx-auto">
              <Search className="h-9 w-9 text-primary/30" />
            </div>
            <p className="text-sm font-bold text-slate-400">
              Escribe la matrícula para consultar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

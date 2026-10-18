"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, ShieldHalf } from "lucide-react";
import { auth } from "@/lib/firebase/firebase-client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Control del kill-switch de mantenimiento desde el dashboard: abierto, solo
 * consulta (trabajadores entran; admin, carga de listados y registro en pausa)
 * o suspensión total. Visible solo para developer; el endpoint lo respalda con
 * requireDeveloperRequest. Al montarse siembra la cookie de bypass vía GET.
 */
type Modo = "abierto" | "consulta" | "total";

const MODOS: { valor: Modo; titulo: string; detalle: string }[] = [
  {
    valor: "abierto",
    titulo: "Operativa",
    detalle: "Todo funciona con normalidad.",
  },
  {
    valor: "consulta",
    titulo: "Solo consulta",
    detalle:
      "Los trabajadores entran y consultan. Admin, carga de listados y registro en pausa.",
  },
  {
    valor: "total",
    titulo: "Suspendida",
    detalle: "Todo el portal en mantenimiento. La landing sigue visible.",
  },
];

const ESTILO: Record<Modo, { caja: string; texto: string; boton: string }> = {
  abierto: {
    caja: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20",
    texto: "text-emerald-600",
    boton: "bg-emerald-600 hover:bg-emerald-700",
  },
  consulta: {
    caja: "bg-amber-50 text-amber-600 dark:bg-amber-900/20",
    texto: "text-amber-600",
    boton: "bg-amber-600 hover:bg-amber-700",
  },
  total: {
    caja: "bg-red-50 text-red-600 dark:bg-red-900/20",
    texto: "text-red-600",
    boton: "bg-red-600 hover:bg-red-700",
  },
};

export function MantenimientoToggle() {
  const { userData } = useAuth();
  const esDeveloper = userData?.isDeveloper === true;

  const [modo, setModo] = useState<Modo | null>(null);
  const [destino, setDestino] = useState<Modo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) throw new Error("Sesión no disponible");
    return u.getIdToken();
  }, []);

  useEffect(() => {
    if (!esDeveloper) return;
    let cancelado = false;
    (async () => {
      try {
        const idToken = await getToken();
        const res = await fetch("/api/admin/mantenimiento", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) throw new Error("No se pudo leer el estado");
        const data = await res.json();
        if (!cancelado) setModo((data.modo as Modo) ?? "abierto");
      } catch (e) {
        if (!cancelado)
          setError(e instanceof Error ? e.message : "Error al cargar");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [esDeveloper, getToken]);

  const cambiar = async (nuevo: Modo) => {
    setEnviando(true);
    setError(null);
    try {
      const idToken = await getToken();
      const res = await fetch("/api/admin/mantenimiento", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ modo: nuevo }),
      });
      if (!res.ok) throw new Error("No se pudo cambiar el estado");
      const data = await res.json();
      setModo((data.modo as Modo) ?? "abierto");
      setDestino(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar");
    } finally {
      setEnviando(false);
    }
  };

  if (!esDeveloper) return null;

  const actual = MODOS.find((m) => m.valor === modo);
  const Icono =
    modo === "total"
      ? ShieldAlert
      : modo === "consulta"
        ? ShieldHalf
        : ShieldCheck;

  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            modo ? ESTILO[modo].caja : "bg-slate-50 text-slate-400"
          }`}
        >
          {modo === null ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Icono className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Estado de la plataforma
          </p>
          <p
            className={`text-xs font-medium ${
              modo ? ESTILO[modo].texto : "text-slate-400"
            }`}
          >
            {actual ? actual.titulo : "Cargando…"}
          </p>
        </div>
      </div>

      {modo !== null && (
        <div className="mt-4 space-y-2">
          {destino === null ? (
            <div
              role="radiogroup"
              aria-label="Modo de la plataforma"
              className="grid gap-2"
            >
              {MODOS.map((m) => {
                const sel = m.valor === modo;
                return (
                  <button
                    key={m.valor}
                    role="radio"
                    aria-checked={sel}
                    disabled={sel}
                    onClick={() => setDestino(m.valor)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      sel
                        ? "border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 cursor-default"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {m.titulo}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {m.detalle}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center">
                ¿Cambiar la plataforma a{" "}
                <strong>
                  {MODOS.find((m) => m.valor === destino)?.titulo}
                </strong>
                ?
              </p>
              <div className="flex gap-2">
                <button
                  disabled={enviando}
                  onClick={() => cambiar(destino)}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${ESTILO[destino].boton}`}
                >
                  {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sí, confirmar
                </button>
                <button
                  disabled={enviando}
                  onClick={() => setDestino(null)}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}

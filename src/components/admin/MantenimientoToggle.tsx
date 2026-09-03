"use client";

import { useCallback, useEffect, useState } from "react";
import { Power, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { auth } from "@/lib/firebase/firebase-client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Control del kill-switch de mantenimiento desde el dashboard.
 * Visible solo para developer; el endpoint lo respalda con requireDeveloperRequest.
 * Al montarse siembra la cookie de bypass (anti-lockout) vía GET.
 */
export function MantenimientoToggle() {
  const { userData } = useAuth();
  const esDeveloper = userData?.isDeveloper === true;

  const [activo, setActivo] = useState<boolean | null>(null);
  const [confirmando, setConfirmando] = useState(false);
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
        if (!cancelado) setActivo(Boolean(data.activo));
      } catch (e) {
        if (!cancelado)
          setError(e instanceof Error ? e.message : "Error al cargar");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [esDeveloper, getToken]);

  const cambiar = async (activar: boolean) => {
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
        body: JSON.stringify({ activar }),
      });
      if (!res.ok) throw new Error("No se pudo cambiar el estado");
      const data = await res.json();
      setActivo(Boolean(data.activo));
      setConfirmando(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar");
    } finally {
      setEnviando(false);
    }
  };

  if (!esDeveloper) return null;

  const suspendida = activo === true;

  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            suspendida
              ? "bg-red-50 text-red-600 dark:bg-red-900/20"
              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"
          }`}
        >
          {activo === null ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : suspendida ? (
            <ShieldAlert className="h-5 w-5" />
          ) : (
            <ShieldCheck className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Estado de la plataforma
          </p>
          <p
            className={`text-xs font-medium ${
              activo === null
                ? "text-slate-400"
                : suspendida
                  ? "text-red-600"
                  : "text-emerald-600"
            }`}
          >
            {activo === null
              ? "Cargando…"
              : suspendida
                ? "Suspendida (en mantenimiento)"
                : "Operativa"}
          </p>
        </div>
      </div>

      {activo !== null && (
        <div className="mt-4">
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
                suspendida
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              <Power className="h-4 w-4" />
              {suspendida ? "Reactivar plataforma" : "Suspender plataforma"}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center">
                {suspendida
                  ? "¿Reactivar el servicio para todos?"
                  : "¿Suspender el servicio para todos los usuarios?"}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={enviando}
                  onClick={() => cambiar(!suspendida)}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
                    suspendida
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sí, confirmar
                </button>
                <button
                  disabled={enviando}
                  onClick={() => setConfirmando(false)}
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

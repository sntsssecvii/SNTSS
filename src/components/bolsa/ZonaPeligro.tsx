"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ZonaPeligroProps {
  syncId: string;
  idToken: string;
  oculto: boolean;
  syncAnteriorId?: string | null;
  periodoAnteriorLabel?: string;
  onOcultarChange: (oculto: boolean) => void;
  onRevertir: () => void;
}

export function ZonaPeligro({
  syncId,
  idToken,
  oculto,
  syncAnteriorId,
  periodoAnteriorLabel,
  onOcultarChange,
  onRevertir,
}: ZonaPeligroProps) {
  const [open, setOpen] = useState(false);
  const [revertirText, setRevertirText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callRevertir = async (accion: "OCULTAR" | "MOSTRAR" | "REVERTIR") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bolsa-de-trabajo/revertir", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syncId, accion }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Error");
      if (accion === "OCULTAR") onOcultarChange(true);
      if (accion === "MOSTRAR") onOcultarChange(false);
      if (accion === "REVERTIR") onRevertir();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl ring-1 ring-red-200 dark:ring-red-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-widest">
            Acciones de emergencia
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-red-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="p-6 flex flex-col gap-6 bg-white/60 dark:bg-slate-950/40">
          {/* Ocultar / Mostrar */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">
              Portal del trabajador
            </h3>
            {oculto ? (
              <>
                <p className="text-xs text-slate-500">
                  El portal está{" "}
                  <strong className="text-red-500">oculto</strong>. Los
                  trabajadores ven &ldquo;El listado está en proceso de
                  actualización&rdquo;.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => callRevertir("MOSTRAR")}
                  className="w-fit"
                >
                  Reactivar portal
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Oculta temporalmente el portal mientras investigas. Los
                  trabajadores verán un mensaje de mantenimiento.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => callRevertir("OCULTAR")}
                  className="w-fit border-red-300 text-red-600 hover:bg-red-50"
                >
                  Ocultar portal temporalmente
                </Button>
              </>
            )}
          </div>

          {/* Revertir */}
          {syncAnteriorId && (
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                Revertir a quincena anterior
              </h3>
              <p className="text-xs text-slate-500">
                Desactiva esta quincena y reactiva{" "}
                <strong>
                  {periodoAnteriorLabel ?? "la quincena anterior"}
                </strong>
                . Los trabajadores volverán a ver las posiciones anteriores.
              </p>
              <input
                type="text"
                value={revertirText}
                onChange={(e) => setRevertirText(e.target.value)}
                placeholder="Escribe REVERTIR para confirmar"
                className="h-10 px-4 rounded-xl border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 text-sm font-bold text-red-700 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <Button
                size="sm"
                disabled={revertirText !== "REVERTIR" || loading}
                onClick={() => callRevertir("REVERTIR")}
                className="w-fit bg-red-600 hover:bg-red-700 text-white font-black"
              >
                Revertir quincena
              </Button>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive font-bold">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

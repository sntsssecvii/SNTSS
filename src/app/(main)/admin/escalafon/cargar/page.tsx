"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import {
  ArrowLeft,
  CheckCircle2,
  FileUp,
  FolderOpen,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LoteSelector,
  generarNombreLote,
  type LotePeriodo,
} from "@/components/escalafon/LoteSelector";
import type { EscalafonLote, EscalafonListado } from "@/types/escalafon";

interface FileItem {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  advertencias?: string[];
}

async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

function ahora(): LotePeriodo {
  const d = new Date();
  return {
    anio: d.getFullYear(),
    mes: d.getMonth() + 1,
    quincena: d.getDate() <= 15 ? 1 : 2,
  };
}

function CargarEscalafonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reemplazarId = searchParams.get("reemplazar");

  const inputRef = useRef<HTMLInputElement>(null);

  // Periodo seleccionado (solo en modo normal)
  const [periodo, setPeriodo] = useState<LotePeriodo>(ahora);
  const [todosLotes, setTodosLotes] = useState<EscalafonLote[]>([]);
  const [cargandoMeta, setCargandoMeta] = useState(true);

  // Modo reemplazo
  const [listadoAReemplazar, setListadoAReemplazar] =
    useState<EscalafonListado | null>(null);

  // Archivos
  const [items, setItems] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [loteIdUsado, setLoteIdUsado] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Cerrar lote
  const [cerrando, setCerrando] = useState(false);

  // Carga inicial
  useEffect(() => {
    const cargar = async () => {
      setCargandoMeta(true);
      try {
        const idToken = await getIdToken();
        const headers: Record<string, string> = idToken
          ? { Authorization: `Bearer ${idToken}` }
          : {};

        if (reemplazarId) {
          const res = await fetch(`/api/escalafon/${reemplazarId}`, {
            headers,
          });
          const data = (await res.json()) as { listado?: EscalafonListado };
          setListadoAReemplazar(data.listado ?? null);
        } else {
          const res = await fetch("/api/escalafon/lotes", {
            headers,
            cache: "no-store",
          });
          const data = (await res.json()) as { lotes?: EscalafonLote[] };
          setTodosLotes(data.lotes ?? []);
        }
      } catch {
        // No crítico
      } finally {
        setCargandoMeta(false);
      }
    };
    cargar();
  }, [reemplazarId]);

  // Lote que corresponde al periodo seleccionado
  const nombreBuscado = generarNombreLote(periodo);
  const loteDelPeriodo =
    todosLotes.find((l) => l.nombre === nombreBuscado) ?? null;

  // Lote abierto actual (puede ser del periodo u otro)
  const loteAbierto = todosLotes.find((l) => l.estado === "ABIERTO") ?? null;

  function addFiles(newFiles: File[]) {
    const pdfs = newFiles.filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (reemplazarId) {
      const f = pdfs[0];
      if (!f) return;
      setItems([{ id: crypto.randomUUID(), file: f, status: "pending" }]);
    } else {
      setItems((prev) => [
        ...prev,
        ...pdfs.map((f) => ({
          id: crypto.randomUUID(),
          file: f,
          status: "pending" as const,
        })),
      ]);
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || processing) return;

    setProcessing(true);
    setGlobalError(null);

    const user = auth.currentUser;
    if (!user) {
      setGlobalError("Sesión no válida. Por favor recarga la página.");
      setProcessing(false);
      return;
    }

    // Determinar loteId de partida:
    // - Si el periodo ya tiene lote ABIERTO → usarlo
    // - Si el lote del periodo está CERRADO → no pasar loteId (procesar creará uno nuevo)
    // - Si no hay lote → no pasar loteId (procesar creará uno con el nombre del periodo)
    let loteIdFinal: string | null =
      loteDelPeriodo?.estado === "ABIERTO" ? (loteDelPeriodo.id ?? null) : null;

    // Si no hay lote abierto para el periodo pero sí hay otro lote abierto global,
    // el admin eligió un periodo diferente al activo — le pasamos el nombre para que
    // procesar lo cree con ese nombre.
    const nombreParaCrear =
      loteIdFinal === null ? generarNombreLote(periodo) : null;

    for (const item of items) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "processing" } : it,
        ),
      );

      try {
        const idToken = await user.getIdToken();
        const formData = new FormData();
        formData.append("file", item.file);
        if (reemplazarId) formData.append("reemplazarId", reemplazarId);
        if (loteIdFinal) formData.append("loteId", loteIdFinal);
        if (nombreParaCrear && !loteIdFinal)
          formData.append("nombreLote", nombreParaCrear);

        const res = await fetch("/api/escalafon/procesar", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: formData,
        });

        const text = await res.text();
        let data: {
          error?: string;
          errores?: string[];
          listadoId?: string;
          loteId?: string;
        };
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Error del servidor (${res.status})`);
        }

        if (!res.ok) throw new Error(data.error ?? "Error al procesar");

        // A partir del primer archivo exitoso, fijamos el loteId para el resto
        if (data.loteId && !loteIdFinal) loteIdFinal = data.loteId;

        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: "done", advertencias: data.errores ?? [] }
              : it,
          ),
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "error",
                  error:
                    err instanceof Error ? err.message : "Error desconocido",
                }
              : it,
          ),
        );
      }
    }

    setLoteIdUsado(loteIdFinal);
    setProcessing(false);
    setAllDone(true);
  };

  async function handleCerrarLote() {
    if (!loteIdUsado) return;
    setCerrando(true);
    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("Sesión no válida");
      const res = await fetch(`/api/escalafon/lotes/${loteIdUsado}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ estado: "CERRADO" }),
      });
      if (!res.ok) throw new Error("Error al cerrar el lote");
      router.push(`/admin/escalafon/${loteIdUsado}`);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Error al cerrar");
    } finally {
      setCerrando(false);
    }
  }

  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;
  const canSubmit = items.length > 0 && !processing;
  const allSuccess = allDone && errorCount === 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-1 text-slate-500 hover:text-primary px-0 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>

          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                {reemplazarId ? "Reemplazar Listado" : "Cargar Listados"}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {reemplazarId
                  ? "Sube el PDF que reemplazará al listado existente."
                  : "Selecciona la quincena y sube uno o varios PDFs escalafonarios."}
              </p>
            </div>
          </div>
        </div>

        {/* ── Modo reemplazo: banner ── */}
        {reemplazarId && !cargandoMeta && (
          <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 flex items-center gap-3">
            <FolderOpen className="text-orange-600 shrink-0" />
            <div>
              <p className="font-black text-orange-900">
                Reemplazando:{" "}
                {listadoAReemplazar?.categoriaDesc ?? reemplazarId}
              </p>
              <p className="text-xs text-orange-700">
                El listado anterior será eliminado al confirmar.
              </p>
            </div>
          </div>
        )}

        {/* ── Paso 1: Selector de quincena/lote (solo modo normal) ── */}
        {!reemplazarId && !allDone && (
          <LoteSelector
            periodo={periodo}
            onChange={setPeriodo}
            loteExistente={loteDelPeriodo}
            cargando={cargandoMeta}
          />
        )}

        {/* ── Paso 2: Archivos ── */}
        {!allDone && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                {reemplazarId ? "Archivo" : "Paso 2"}
              </p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {reemplazarId ? "Nuevo PDF" : "Archivos PDF"}
              </h3>
            </div>

            {/* Drop zone */}
            {!processing && (
              <div
                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(Array.from(e.dataTransfer.files));
                }}
              >
                <FileUp className="h-10 w-10 text-slate-300 mx-auto mb-3 group-hover:text-primary transition-colors" />
                <p className="text-slate-500 font-medium">
                  {reemplazarId
                    ? "Haz clic o arrastra el PDF de reemplazo"
                    : "Haz clic o arrastra uno o varios PDFs"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Máx. 25 MB por archivo · Solo PDF
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  multiple={!reemplazarId}
                  className="hidden"
                  onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                />
              </div>
            )}

            {/* Lista de archivos */}
            {items.length > 0 && (
              <div className="space-y-2">
                {processing && (
                  <p className="text-xs font-semibold text-slate-500 text-center">
                    Procesando {doneCount + errorCount}/{items.length}...
                  </p>
                )}
                {items.map((it) => (
                  <div
                    key={it.id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                      it.status === "done"
                        ? "border-green-200 bg-green-50"
                        : it.status === "error"
                          ? "border-red-200 bg-red-50"
                          : it.status === "processing"
                            ? "border-primary/30 bg-primary/5"
                            : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {it.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : it.status === "error" ? (
                      <span className="text-red-500 shrink-0 font-black text-xs">
                        ✕
                      </span>
                    ) : it.status === "processing" ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                    ) : (
                      <FileUp className="h-4 w-4 text-slate-400 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {it.file.name}
                      </p>
                      {it.status === "error" && it.error && (
                        <p className="text-xs text-red-600 mt-0.5">
                          {it.error}
                        </p>
                      )}
                      {it.status === "done" && it.advertencias?.length ? (
                        <p className="text-xs text-amber-600 mt-0.5">
                          {it.advertencias[0]}
                        </p>
                      ) : null}
                    </div>

                    {it.status === "pending" && !processing && (
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="text-slate-400 hover:text-slate-700 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {globalError && !allDone && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {globalError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-12 rounded-2xl font-black text-base bg-primary hover:bg-primary/90 text-white"
              >
                {processing
                  ? `Procesando ${doneCount + errorCount + 1}/${items.length}...`
                  : items.length === 0
                    ? reemplazarId
                      ? "Selecciona un PDF primero"
                      : "Selecciona PDFs primero"
                    : items.length === 1
                      ? "Procesar PDF"
                      : `Procesar ${items.length} PDFs`}
              </Button>
            </form>
          </div>
        )}

        {/* Aviso si hay otro lote abierto para un periodo diferente */}
        {!reemplazarId &&
          !allDone &&
          loteAbierto &&
          loteAbierto.nombre !== nombreBuscado && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
              Hay un lote abierto de otro periodo:{" "}
              <span className="font-black">{loteAbierto.nombre}</span>. Al
              procesar, se creará un nuevo lote para{" "}
              <span className="font-black">{nombreBuscado}</span>.
            </div>
          )}

        {/* ── Resultado ── */}
        {allDone && (
          <div
            className={`rounded-3xl border p-8 space-y-6 ${
              allSuccess
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div
              className={`flex items-center gap-4 ${allSuccess ? "text-emerald-700" : "text-amber-700"}`}
            >
              <div
                className={`p-3 rounded-2xl ${allSuccess ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}
              >
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h4 className="font-black text-2xl tracking-tight">
                  {allSuccess
                    ? "¡Procesamiento completo!"
                    : "Procesamiento con errores"}
                </h4>
                <p className="font-medium opacity-80">
                  {doneCount} procesados · {errorCount} con error
                </p>
              </div>
            </div>

            {globalError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {globalError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {allSuccess && loteIdUsado && (
                <Button
                  onClick={handleCerrarLote}
                  disabled={cerrando}
                  className="w-full h-14 rounded-2xl font-black text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                >
                  {cerrando ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : null}
                  {cerrando
                    ? "Cerrando lote..."
                    : "Cerrar Lote — Quincena Oficial"}
                </Button>
              )}
              {loteIdUsado && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/admin/escalafon/${loteIdUsado}`)}
                  className="w-full h-12 rounded-2xl font-black"
                >
                  Ver lote sin cerrar
                </Button>
              )}
              {errorCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setItems((prev) =>
                      prev
                        .filter((it) => it.status === "error")
                        .map((it) => ({
                          ...it,
                          status: "pending" as const,
                          error: undefined,
                        })),
                    );
                    setAllDone(false);
                  }}
                  className="w-full h-12 rounded-2xl font-black text-red-600"
                >
                  Reintentar {errorCount} archivo(s) con error
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CargarEscalafonPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Cargando...</div>}>
      <CargarEscalafonContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import { ArrowLeft, CheckCircle2, FileUp, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EscalafonLote, EscalafonListado } from "@/types/escalafon";

interface FileItem {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  advertencias?: string[];
}

function CargarEscalafonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reemplazarId = searchParams.get("reemplazar");
  const loteIdParam = searchParams.get("loteId");

  const inputRef = useRef<HTMLInputElement>(null);
  // Modo reemplazo: un solo archivo; modo normal: múltiples
  const [items, setItems] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [loteAbierto, setLoteAbierto] = useState<EscalafonLote | null>(null);
  const [listadoAReemplazar, setListadoAReemplazar] =
    useState<EscalafonListado | null>(null);
  const [cargandoMeta, setCargandoMeta] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      setCargandoMeta(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
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
          setLoteAbierto(
            data.lotes?.find((l) => l.estado === "ABIERTO") ?? null,
          );
        }
      } catch {
        // No crítico
      } finally {
        setCargandoMeta(false);
      }
    };
    cargar();
  }, [reemplazarId]);

  function addFiles(newFiles: File[]) {
    const pdfs = newFiles.filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (reemplazarId) {
      // Modo reemplazo: solo un archivo
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

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setGlobalError("Sesión no válida. Por favor recarga la página.");
      setProcessing(false);
      return;
    }

    let loteIdFinal: string | null = null;

    for (const item of items) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "processing" } : it,
        ),
      );

      try {
        const idToken = await currentUser.getIdToken();
        const formData = new FormData();
        formData.append("file", item.file);
        if (reemplazarId) formData.append("reemplazarId", reemplazarId);
        if (loteIdParam) formData.append("loteId", loteIdParam);
        // Si ya procesamos el primer archivo y sabemos el loteId, lo pasamos
        if (loteIdFinal) formData.append("loteId", loteIdFinal);

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

        if (!res.ok) {
          throw new Error(data.error ?? "Error al procesar el archivo");
        }

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

    setProcessing(false);
    setDone(true);

    // Redirigir solo si no hay errores
    const hayErrores = items.some((it) => it.status === "error");
    if (!hayErrores) {
      if (loteIdFinal) {
        router.push(`/admin/escalafon/${loteIdFinal}`);
      } else {
        router.push("/admin/escalafon");
      }
    }
  };

  const pendingCount = items.filter((it) => it.status === "pending").length;
  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;
  const canSubmit = items.length > 0 && !processing;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
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
                  : "Selecciona uno o varios PDFs escalafonarios."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Banner de modo */}
          {!cargandoMeta && (
            <>
              {reemplazarId ? (
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
              ) : loteAbierto ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                  <FolderOpen className="text-amber-600 shrink-0" />
                  <div>
                    <p className="font-black text-amber-900">
                      Subiendo al lote: {loteAbierto.nombre}
                    </p>
                    <p className="text-xs text-amber-700">
                      Los listados se añadirán al lote activo.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <p className="font-black text-slate-700">
                    Se creará un lote nuevo automáticamente.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Drop zone */}
          {!processing && !done && (
            <div
              className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <p className="text-gray-500">
                {reemplazarId
                  ? "Haz clic para seleccionar un PDF"
                  : "Haz clic o arrastra uno o varios PDFs"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Máx. 25 MB por archivo
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
              {done && errorCount > 0 && (
                <p className="text-xs font-semibold text-red-600 text-center">
                  {doneCount} procesados · {errorCount} con error
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
                          : "border-slate-200 bg-white"
                  }`}
                >
                  {it.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  ) : it.status === "error" ? (
                    <span className="text-red-500 shrink-0 font-black text-xs">
                      ✕
                    </span>
                  ) : it.status === "processing" ? (
                    <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <FileUp className="h-4 w-4 text-slate-400 shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {it.file.name}
                    </p>
                    {it.status === "error" && it.error && (
                      <p className="text-xs text-red-600 mt-0.5">{it.error}</p>
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

          {globalError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {globalError}
            </div>
          )}

          {/* Botón de acción */}
          {!done ? (
            <form onSubmit={handleSubmit}>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-12 rounded-2xl font-black text-base bg-primary hover:bg-primary/90 text-white"
              >
                {processing
                  ? `Procesando ${doneCount + errorCount + 1}/${items.length}...`
                  : items.length === 0
                    ? "Selecciona PDFs primero"
                    : items.length === 1
                      ? "Procesar PDF"
                      : `Procesar ${items.length} PDFs`}
              </Button>
            </form>
          ) : errorCount > 0 ? (
            <div className="space-y-2">
              <Button
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
                  setDone(false);
                }}
                className="w-full h-12 rounded-2xl font-black text-base"
                variant="outline"
              >
                Reintentar archivos con error
              </Button>
              <Button
                onClick={() => router.push("/admin/escalafon")}
                className="w-full h-12 rounded-2xl font-black text-base bg-primary hover:bg-primary/90 text-white"
              >
                Ir a escalafón
              </Button>
            </div>
          ) : null}
        </div>
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

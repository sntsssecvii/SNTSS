"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import { ArrowLeft, CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CambiosLote } from "@/types/cambios-escalafon";

interface FileItem {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  advertencias?: string[];
  registrosParsed?: number;
}

async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

function CargarCambiosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loteIdParam = searchParams.get("loteId");

  const inputRef = useRef<HTMLInputElement>(null);
  const [loteAbierto, setLoteAbierto] = useState<CambiosLote | null>(null);
  const [cargandoMeta, setCargandoMeta] = useState(true);
  const [items, setItems] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [loteIdUsado, setLoteIdUsado] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      setCargandoMeta(true);
      try {
        const idToken = await getIdToken();
        const headers: Record<string, string> = idToken
          ? { Authorization: `Bearer ${idToken}` }
          : {};
        const res = await fetch("/api/cambios-escalafon/lotes", {
          headers,
          cache: "no-store",
        });
        const data = (await res.json()) as { lotes?: CambiosLote[] };
        const abierto =
          (data.lotes ?? []).find((l) => l.estado === "ABIERTO") ?? null;
        setLoteAbierto(abierto);
      } catch {
        // no crítico
      } finally {
        setCargandoMeta(false);
      }
    };
    cargar();
  }, []);

  function addFiles(newFiles: File[]) {
    const pdfs = newFiles.filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setItems((prev) => [
      ...prev,
      ...pdfs.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "pending" as const,
      })),
    ]);
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

    let loteIdFinal: string | null = loteIdParam ?? loteAbierto?.id ?? null;

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
        if (loteIdFinal) formData.append("loteId", loteIdFinal);

        const res = await fetch("/api/cambios-escalafon/procesar", {
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
          registrosParsed?: number;
        };
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Error del servidor (${res.status})`);
        }

        if (!res.ok) throw new Error(data.error ?? "Error al procesar");
        if (data.loteId && !loteIdFinal) loteIdFinal = data.loteId;

        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "done",
                  advertencias: data.errores ?? [],
                  registrosParsed: data.registrosParsed,
                }
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
      const res = await fetch(`/api/cambios-escalafon/lotes/${loteIdUsado}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ estado: "CERRADO" }),
      });
      if (!res.ok) throw new Error("Error al cerrar el lote");
      router.push(`/admin/escalafon/cambios/${loteIdUsado}`);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Error al cerrar");
    } finally {
      setCerrando(false);
    }
  }

  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;
  const allSuccess = allDone && errorCount === 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
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
                Cargar Cambios
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Sube los PDFs de solicitudes de cambio del SIAP.
              </p>
            </div>
          </div>
        </div>

        {/* Lote activo */}
        {!allDone && (
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">
              Lote de carga
            </p>
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                cargandoMeta
                  ? "border-slate-200 bg-slate-50 text-slate-400"
                  : loteAbierto
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300"
              }`}
            >
              {cargandoMeta
                ? "Revisando lotes activos..."
                : loteAbierto
                  ? `Lote abierto — "${loteAbierto.nombre}" tiene ${loteAbierto.totalListados} listados. Los nuevos PDFs se añadirán aquí.`
                  : `Se creará un nuevo lote al procesar el primer PDF.`}
            </div>
          </div>
        )}

        {/* Archivos */}
        {!allDone && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Archivos PDF
            </h3>

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
                  Haz clic o arrastra uno o varios PDFs
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Máx. 25 MB por archivo · Solo PDF
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                />
              </div>
            )}

            {items.length > 0 && (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-900"
                  >
                    {item.status === "processing" && (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    )}
                    {item.status === "done" && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    )}
                    {item.status === "error" && (
                      <X className="h-4 w-4 shrink-0 text-red-500" />
                    )}
                    {item.status === "pending" && (
                      <div className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">
                        {item.file.name}
                      </p>
                      {item.status === "done" &&
                        item.registrosParsed !== undefined && (
                          <p className="text-xs text-emerald-600">
                            {item.registrosParsed} registros procesados
                          </p>
                        )}
                      {item.status === "error" && (
                        <p className="text-xs text-red-500">{item.error}</p>
                      )}
                    </div>
                    {item.status === "pending" && (
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) =>
                            prev.filter((it) => it.id !== item.id),
                          )
                        }
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {globalError && (
              <p className="text-sm text-red-600 font-medium">{globalError}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={items.length === 0 || processing}
              className="w-full h-12 rounded-2xl font-black bg-primary hover:bg-primary/90 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                `Procesar ${items.length > 0 ? `${items.length} archivo${items.length > 1 ? "s" : ""}` : ""}`
              )}
            </Button>
          </div>
        )}

        {/* Resultado final */}
        {allDone && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                {allSuccess ? "¡Listo!" : "Procesado con errores"}
              </h2>
              <p className="text-slate-500 mt-1">
                {doneCount} de {items.length} archivos procesados correctamente.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {loteIdUsado && (
                <>
                  <Button
                    onClick={() =>
                      router.push(`/admin/escalafon/cambios/${loteIdUsado}`)
                    }
                    variant="outline"
                    className="rounded-2xl font-black"
                  >
                    Ver lote
                  </Button>
                  <Button
                    onClick={handleCerrarLote}
                    disabled={cerrando}
                    className="rounded-2xl font-black bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    {cerrando ? "Cerrando..." : "Cerrar lote"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CargarCambiosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            Cargando...
          </p>
        </div>
      }
    >
      <CargarCambiosContent />
    </Suspense>
  );
}

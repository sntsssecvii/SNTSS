"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import { ArrowLeft, FileUp, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EscalafonLote, EscalafonListado } from "@/types/escalafon";

export default function CargarEscalafonPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reemplazarId = searchParams.get("reemplazar");
  const loteIdParam = searchParams.get("loteId");

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertencias, setAdvertencias] = useState<string[]>([]);

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
          // Obtener info del listado a reemplazar
          const res = await fetch(`/api/escalafon/${reemplazarId}`, {
            headers,
          });
          const data = (await res.json()) as { listado?: EscalafonListado };
          setListadoAReemplazar(data.listado ?? null);
        } else {
          // Obtener lote abierto actual
          const res = await fetch("/api/escalafon/lotes", {
            headers,
            cache: "no-store",
          });
          const data = (await res.json()) as { lotes?: EscalafonLote[] };
          const abierto =
            data.lotes?.find((l) => l.estado === "ABIERTO") ?? null;
          setLoteAbierto(abierto);
        }
      } catch {
        // No crítico — el API de procesar maneja la lógica
      } finally {
        setCargandoMeta(false);
      }
    };
    cargar();
  }, [reemplazarId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setAdvertencias([]);

    const formData = new FormData();
    formData.append("file", file);
    if (reemplazarId) formData.append("reemplazarId", reemplazarId);
    if (loteIdParam) formData.append("loteId", loteIdParam);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/escalafon/procesar", {
        method: "POST",
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
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
        console.error("[cargar] respuesta no-JSON:", text);
        setError(`Error del servidor (${res.status}): respuesta inesperada`);
        return;
      }

      if (!res.ok) {
        setError((data.error as string) ?? "Error al procesar el archivo");
        return;
      }

      if (data.errores?.length) {
        setAdvertencias(data.errores);
      }

      // Redirigir al lote si hay loteId, si no a la lista
      if (data.loteId) {
        router.push(`/admin/escalafon/${data.loteId}`);
      } else {
        router.push("/admin/escalafon");
      }
    } catch {
      setError("Error de red al subir el archivo");
    } finally {
      setLoading(false);
    }
  };

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
                Cargar Listado
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Carga el PDF del listado escalafonario de condicionalidad.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                      Este listado se añadirá al lote activo.
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

          {/* File input */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <div>
                <p className="font-medium text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500">
                  Haz clic para seleccionar un PDF
                </p>
                <p className="text-xs text-gray-400 mt-1">Máx. 25 MB</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {advertencias.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800 space-y-1">
              {advertencias.map((a, i) => (
                <p key={i}>{a}</p>
              ))}
            </div>
          )}

          <Button
            type="submit"
            disabled={!file || loading}
            className="w-full h-12 rounded-2xl font-black text-base bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? "Procesando..." : "Procesar PDF"}
          </Button>
        </form>
      </div>
    </div>
  );
}

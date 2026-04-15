"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CargarEscalafonPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertencias, setAdvertencias] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setAdvertencias([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/escalafon/procesar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al procesar el archivo");
        return;
      }

      if (data.errores?.length) {
        setAdvertencias(data.errores);
      }

      router.push(`/admin/escalafon/${data.listadoId}`);
    } catch {
      setError("Error de red al subir el archivo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/escalafon"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Escalafón
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          Cargar listado
        </h1>
        <p className="text-sm text-gray-500">
          Sube el PDF del listado escalafonario de condicionalidad generado por
          el SIAP.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
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
              <p className="text-gray-500">Haz clic para seleccionar un PDF</p>
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

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Procesando..." : "Procesar PDF"}
        </button>
      </form>
    </div>
  );
}

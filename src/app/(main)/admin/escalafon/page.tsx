"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EscalafonListado } from "@/types/escalafon";

export default function EscalafonPage() {
  const [listados, setListados] = useState<EscalafonListado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/escalafon")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setListados(data.listados);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Agrupar por periodoDecierre
  const grupos = listados.reduce<Record<string, EscalafonListado[]>>(
    (acc, l) => {
      const key = l.periodoDecierre || "Sin periodo";
      if (!acc[key]) acc[key] = [];
      acc[key].push(l);
      return acc;
    },
    {},
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escalafón</h1>
          <p className="text-sm text-gray-500 mt-1">
            Listados escalafonarios de condicionalidad
          </p>
        </div>
        <Link
          href="/admin/escalafon/cargar"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          + Cargar listado
        </Link>
      </div>

      {loading && <p className="text-gray-500">Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && Object.keys(grupos).length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No hay listados cargados.</p>
          <p className="text-sm mt-1">
            Usa &ldquo;Cargar listado&rdquo; para subir el primer PDF.
          </p>
        </div>
      )}

      {Object.entries(grupos).map(([periodo, items]) => (
        <div key={periodo}>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Periodo {periodo}
          </h2>
          <div className="border rounded-lg divide-y overflow-hidden">
            {items.map((listado) => (
              <Link
                key={listado.id}
                href={`/admin/escalafon/${listado.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {listado.categoriaDesc}
                  </p>
                  <p className="text-xs text-gray-500">
                    Área: {listado.areaDesc} · {listado.sector} · Conv.{" "}
                    {listado.convocatoria}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">
                    {listado.aspirantesParsed} aspirantes
                  </p>
                  <p className="text-xs text-gray-400">
                    Listado {listado.numeroListado}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

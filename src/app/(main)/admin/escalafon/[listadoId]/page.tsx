"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import React from "react";
import type { EscalafonListado, EscalafonAspirante } from "@/types/escalafon";

export default function DetalleListadoPage() {
  const { listadoId } = useParams<{ listadoId: string }>();
  const [listado, setListado] = useState<EscalafonListado | null>(null);
  const [aspirantes, setAspirantes] = useState<EscalafonAspirante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [zonaActiva, setZonaActiva] = useState<string>("");

  useEffect(() => {
    fetch(`/api/escalafon/${listadoId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setListado(data.listado);
        setAspirantes(data.aspirantes);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [listadoId]);

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!listado) return null;

  // Filtrar y ordenar según zona activa
  const aspirantesFiltrados = zonaActiva
    ? aspirantes
        .filter((a) => a.posicionesPorZona?.[zonaActiva] !== undefined)
        .sort(
          (a, b) =>
            (a.posicionesPorZona?.[zonaActiva] ?? 9999) -
            (b.posicionesPorZona?.[zonaActiva] ?? 9999),
        )
    : [...aspirantes].sort((a, b) => a.lugar - b.lugar);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/escalafon"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Escalafón
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          {listado.categoriaDesc}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
          <span>
            Área: <strong>{listado.areaDesc}</strong>
          </span>
          <span>
            Sector: <strong>{listado.sector}</strong>
          </span>
          <span>
            Listado: <strong>{listado.numeroListado}</strong>
          </span>
          <span>
            Conv: <strong>{listado.convocatoria}</strong>
          </span>
          <span>
            Vigencia:{" "}
            <strong>
              {listado.vigenciaInicio} — {listado.vigenciaFin}
            </strong>
          </span>
          <span>
            Aspirantes: <strong>{listado.aspirantesParsed}</strong>
          </span>
        </div>
      </div>

      {/* Filtro de zona */}
      {listado.zonas?.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Filtrar por zona:
          </label>
          <select
            value={zonaActiva}
            onChange={(e) => {
              setZonaActiva(e.target.value);
              setExpandido(null);
            }}
            className="text-sm border rounded-md px-3 py-1.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas ({aspirantes.length})</option>
            {listado.zonas.map((z) => {
              const count = aspirantes.filter(
                (a) => a.posicionesPorZona?.[z] !== undefined,
              ).length;
              return (
                <option key={z} value={z}>
                  {z} ({count})
                </option>
              );
            })}
          </select>
          {zonaActiva && (
            <span className="text-xs text-gray-400">
              {aspirantesFiltrados.length} aspirantes califican
            </span>
          )}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left w-12">
                {zonaActiva ? "Pos." : "Lugar"}
              </th>
              <th className="px-3 py-2 text-left w-16">Est.</th>
              <th className="px-3 py-2 text-left w-28">Matrícula</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left w-24">Fecha Reg.</th>
              <th className="px-3 py-2 text-left w-28">Preferencias</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {aspirantesFiltrados.map((a) => (
              <React.Fragment key={a.matricula}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setExpandido(expandido === a.matricula ? null : a.matricula)
                  }
                >
                  <td className="px-3 py-2 font-mono font-semibold">
                    {zonaActiva
                      ? (a.posicionesPorZona?.[zonaActiva] ?? "—")
                      : a.lugar}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                        a.estatus === "PEI"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {a.estatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-600">
                    {a.matricula}
                  </td>
                  <td className="px-3 py-2 font-medium">{a.nombre}</td>
                  <td className="px-3 py-2 text-gray-500">{a.fechaRegistro}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">
                    {a.preferencias.length === 1 &&
                    a.preferencias[0].zonaSolicitada
                      .replace(/\s/g, "")
                      .toUpperCase() === "INCONDICIONAL"
                      ? "Incondicional"
                      : `${a.preferencias.length} pref.`}
                  </td>
                </tr>
                {expandido === a.matricula && (
                  <tr className="bg-blue-50">
                    <td colSpan={6} className="px-6 py-3">
                      <div className="space-y-1">
                        {a.preferencias.map((p, i) => (
                          <div
                            key={i}
                            className="text-xs text-gray-600 flex gap-4"
                          >
                            <span>{p.zonaSolicitada}</span>
                            <span>{p.localidadSolicitada}</span>
                            <span>{p.adscripcionDesc}</span>
                            <span>{p.turnoDesc}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

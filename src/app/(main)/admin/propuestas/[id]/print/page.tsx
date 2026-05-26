"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Propuesta } from "@/types/propuestas";

export default function PrintPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [propuesta, setPropuesta] = useState<
    (Propuesta & { id: string }) | null
  >(null);

  useEffect(() => {
    async function cargar() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const token = user ? await (user as any).getIdToken() : "";
      const res = await fetch(`/api/propuestas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const p =
        data.propuestas?.find(
          (p: Propuesta & { id: string }) => p.id === params.id,
        ) ?? null;
      setPropuesta(p);
    }
    if (user) cargar();
  }, [user, params.id]);

  if (!propuesta)
    return <div className="p-8 text-gray-400 text-sm">Cargando...</div>;

  const fecha = propuesta.creadoEn
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new Date((propuesta.creadoEn as any).seconds * 1000).toLocaleDateString(
        "es-MX",
        { day: "2-digit", month: "long", year: "numeric" },
      )
    : "";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-family: Arial, sans-serif; font-size: 12pt; }
        }
      `}</style>

      <div className="no-print p-4 bg-gray-100 flex justify-between items-center print:hidden">
        <span className="text-sm text-gray-600">Vista previa de impresión</span>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-8 bg-white min-h-screen">
        {/* Encabezado */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <p className="font-bold text-lg">
            SINDICATO NACIONAL DE TRABAJADORES DEL SEGURO SOCIAL
          </p>
          <p className="text-sm">SECCIÓN VII — BAJA CALIFORNIA</p>
          <p className="text-sm mt-1">OFICINA DE ADMISIÓN Y CAMBIOS</p>
        </div>

        <div className="text-center mb-6">
          <p className="text-sm">PROPUESTA SINDICAL</p>
          {propuesta.folio && (
            <p className="font-bold text-lg mt-1">FOLIO: {propuesta.folio}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            # Caso: {propuesta.numeroCaso}
          </p>
        </div>

        {/* Datos trabajador */}
        <div className="border border-gray-300 rounded p-4 mb-4">
          <p className="font-bold text-sm mb-2">DATOS DEL TRABAJADOR</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Matrícula:</span>{" "}
              <span className="font-medium">{propuesta.matricula}</span>
            </div>
            <div>
              <span className="text-gray-500">Fecha:</span> <span>{fecha}</span>
            </div>
          </div>
        </div>

        {/* Datos aspirante */}
        {!propuesta.sinFamiliar && propuesta.aspirante && (
          <div className="border border-gray-300 rounded p-4 mb-4">
            <p className="font-bold text-sm mb-2">DATOS DEL ASPIRANTE</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="col-span-2">
                <span className="text-gray-500">Nombre:</span>{" "}
                <span className="font-medium">
                  {propuesta.aspirante.nombreCompleto}
                </span>
              </div>
              <div>
                <span className="text-gray-500">CURP:</span>{" "}
                <span>{propuesta.aspirante.curp}</span>
              </div>
              <div>
                <span className="text-gray-500">Parentesco:</span>{" "}
                <span>{propuesta.aspirante.parentesco}</span>
              </div>
              <div>
                <span className="text-gray-500">Teléfono:</span>{" "}
                <span>{propuesta.aspirante.telefono}</span>
              </div>
            </div>
          </div>
        )}

        {propuesta.sinFamiliar && (
          <div className="border border-gray-300 rounded p-4 mb-4 text-sm">
            <p className="font-bold mb-1">CASO SIN FAMILIAR</p>
            <p className="text-gray-500">
              Contratación directa (caso excepcional)
            </p>
          </div>
        )}

        {/* Estado */}
        <div className="border border-gray-300 rounded p-4 mb-8">
          <p className="font-bold text-sm mb-2">ESTADO DE LA SOLICITUD</p>
          <p className="text-sm font-medium">{propuesta.estado}</p>
          {propuesta.motivoRechazo && (
            <p className="text-sm text-gray-600 mt-1">
              Motivo: {propuesta.motivoRechazo}
            </p>
          )}
        </div>

        {/* Firmas */}
        <div className="grid grid-cols-2 gap-8 mt-12">
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="text-sm">Firma del Trabajador</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="text-sm">Firma y Sello — Oficina de Admisión</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { Propuesta } from "@/types/propuestas";
import type { Requerimiento } from "@/types/requerimientos";

const WARNING_LABELS: Record<string, string> = {
  propuestaActivaExistente: "El trabajador ya tiene una propuesta activa",
  sinRequerimientoDisponible:
    "No hay requerimiento disponible para esta categoría/zona",
  curpDuplicado: "El CURP del aspirante ya existe en otra propuesta activa",
  categoriaIncompatible: "Categoría posiblemente incompatible con la zona",
  documentoFaltante: "INE no subida",
};

export default function CasoDetalle({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [propuesta, setPropuesta] = useState<
    (Propuesta & { id: string }) | null
  >(null);
  const [requerimientos, setRequerimientos] = useState<
    (Requerimiento & { id: string })[]
  >([]);
  const [cargando, setCargando] = useState(true);
  const [modalRechazo, setModalRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [modalAsignar, setModalAsignar] = useState(false);
  const [asignacion, setAsignacion] = useState({
    requerimientoId: "",
    zona: "",
    categoria: "",
  });
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function getToken() {
    return user ? await (user as any).getIdToken() : "";
  }

  async function cargar() {
    setCargando(true);
    try {
      const token = await getToken();
      const [resProp, resReq] = await Promise.all([
        fetch(`/api/propuestas`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/requerimientos", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const propData = await resProp.json();
      const propEncontrada =
        propData.propuestas?.find(
          (p: Propuesta & { id: string }) => p.id === id,
        ) ?? null;
      setPropuesta(propEncontrada);
      const reqData = await resReq.json();
      setRequerimientos(reqData.requerimientos ?? []);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [id]);

  async function aprobar() {
    setProcesando(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/propuestas/${id}/aprobar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      await cargar();
    } finally {
      setProcesando(false);
    }
  }

  async function rechazar() {
    if (motivoRechazo.trim().length < 10) {
      setError("El motivo debe tener al menos 10 caracteres.");
      return;
    }
    setProcesando(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/propuestas/${id}/rechazar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ motivo: motivoRechazo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setModalRechazo(false);
      await cargar();
    } finally {
      setProcesando(false);
    }
  }

  async function asignar() {
    if (
      !asignacion.requerimientoId ||
      !asignacion.zona ||
      !asignacion.categoria
    ) {
      setError("Completa todos los campos de asignación.");
      return;
    }
    setProcesando(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/asignaciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propuestaId: id, ...asignacion }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setModalAsignar(false);
      await cargar();
    } finally {
      setProcesando(false);
    }
  }

  if (cargando)
    return <div className="p-6 text-sm text-gray-400">Cargando...</div>;
  if (!propuesta)
    return <div className="p-6 text-sm text-red-500">Caso no encontrado.</div>;

  const warnings = propuesta.warnings;
  const warningsActivos = Object.entries(warnings).filter(
    ([, v]) => v === true,
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => router.push("/admin/propuestas")}
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
      >
        ← Volver
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {propuesta.numeroCaso}
        </h1>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${propuesta.estado === "APROBADA" ? "bg-green-100 text-green-800" : propuesta.estado === "RECHAZADA" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
        >
          {propuesta.estado}
        </span>
        {propuesta.sinFamiliar && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
            Sin familiar
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna izquierda */}
        <div className="space-y-4">
          <Card title="Datos del trabajador">
            <Field label="Matrícula">{propuesta.matricula}</Field>
          </Card>

          {!propuesta.sinFamiliar && propuesta.aspirante && (
            <Card title="Datos del aspirante">
              <Field label="Nombre">{propuesta.aspirante.nombreCompleto}</Field>
              <Field label="CURP">{propuesta.aspirante.curp}</Field>
              <Field label="Parentesco">
                {propuesta.aspirante.parentesco ?? "—"}
              </Field>
              <Field label="Teléfono">{propuesta.aspirante.telefono}</Field>
            </Card>
          )}

          {propuesta.documentos.ineUrl && (
            <Card title="INE">
              <a
                href={propuesta.documentos.ineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Ver / Descargar INE
              </a>
            </Card>
          )}

          {warningsActivos.length > 0 && (
            <details className="rounded-xl border border-orange-200 bg-orange-50">
              <summary className="px-4 py-3 text-sm font-medium text-orange-800 cursor-pointer">
                ⚠ {warningsActivos.length} alerta
                {warningsActivos.length !== 1 ? "s" : ""}
              </summary>
              <ul className="px-4 pb-3 space-y-1">
                {warningsActivos.map(([key]) => (
                  <li key={key} className="text-sm text-orange-700">
                    • {WARNING_LABELS[key] ?? key}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          <Card title="Acciones">
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            {propuesta.estado === "PENDIENTE" && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={aprobar}
                    disabled={procesando}
                    className="flex-1 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => {
                      setError("");
                      setModalRechazo(true);
                    }}
                    disabled={procesando}
                    className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
                <a
                  href={`/admin/propuestas/${id}/print`}
                  target="_blank"
                  className="block text-center text-sm text-blue-600 hover:underline"
                >
                  Generar PDF
                </a>
              </div>
            )}

            {propuesta.estado === "APROBADA" && (
              <div className="space-y-3">
                <Field label="Folio oficial">
                  <span className="font-mono font-bold text-green-700">
                    {propuesta.folio}
                  </span>
                </Field>
                {propuesta.estadoFase2 === "SIN_ASIGNAR" && (
                  <button
                    onClick={() => {
                      setError("");
                      setModalAsignar(true);
                    }}
                    className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
                  >
                    Asignar requerimiento
                  </button>
                )}
                {propuesta.estadoFase2 === "ASIGNADA" && (
                  <p className="text-sm text-green-700 font-medium">
                    ✓ Requerimiento asignado
                  </p>
                )}
                <a
                  href={`/admin/propuestas/${id}/print`}
                  target="_blank"
                  className="block text-center text-sm text-blue-600 hover:underline"
                >
                  Generar PDF
                </a>
              </div>
            )}

            {propuesta.estado === "RECHAZADA" && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Motivo de rechazo:
                </p>
                <p className="text-sm text-gray-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {propuesta.motivoRechazo}
                </p>
                <a
                  href={`/admin/propuestas/${id}/print`}
                  target="_blank"
                  className="block text-center text-sm text-blue-600 hover:underline"
                >
                  Generar PDF
                </a>
              </div>
            )}
          </Card>

          <Card title="Historial">
            <ol className="space-y-3">
              {[...(propuesta.historial ?? [])].reverse().map((evento, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-800">{evento.tipo}</p>
                    {evento.nota && (
                      <p className="text-gray-500 text-xs">{evento.nota}</p>
                    )}
                    <p className="text-gray-400 text-xs">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {evento.fecha
                        ? new Date(
                            (evento.fecha as any).seconds * 1000,
                          ).toLocaleString("es-MX")
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* Modal rechazo */}
      {modalRechazo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Motivo de rechazo</h3>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={4}
              placeholder="Describe el motivo del rechazo (mínimo 10 caracteres)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setModalRechazo(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={rechazar}
                disabled={procesando}
                className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {procesando ? "Procesando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignación */}
      {modalAsignar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">
              Asignar requerimiento
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requerimiento
              </label>
              <select
                value={asignacion.requerimientoId}
                onChange={(e) =>
                  setAsignacion({
                    ...asignacion,
                    requerimientoId: e.target.value,
                    zona: "",
                    categoria: "",
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                {requerimientos
                  .filter((r) => r.estado === "ACTIVO")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.numeroOficio}
                    </option>
                  ))}
              </select>
            </div>
            {asignacion.requerimientoId &&
              (() => {
                const req = requerimientos.find(
                  (r) => r.id === asignacion.requerimientoId,
                );
                const partidasDisponibles =
                  req?.partidas.filter((p) => p.cantidadDisponible > 0) ?? [];
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Partida disponible
                    </label>
                    <select
                      value={`${asignacion.zona}|||${asignacion.categoria}`}
                      onChange={(e) => {
                        const [zona, categoria] = e.target.value.split("|||");
                        setAsignacion({ ...asignacion, zona, categoria });
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Seleccionar partida...</option>
                      {partidasDisponibles.map((p, i) => (
                        <option key={i} value={`${p.zona}|||${p.categoria}`}>
                          {p.zona} — {p.categoria} ({p.cantidadDisponible}{" "}
                          disponibles)
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setModalAsignar(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={asignar}
                disabled={procesando}
                className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {procesando ? "Asignando..." : "Confirmar asignación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 text-sm py-1">
      <span className="text-gray-400 w-24 shrink-0">{label}</span>
      <span className="text-gray-900">{children}</span>
    </div>
  );
}

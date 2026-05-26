"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import type { Propuesta } from "@/types/propuestas";
import type { Requerimiento } from "@/types/requerimientos";
import type { Asignacion } from "@/types/asignaciones";
import type { EstadoPropuesta } from "@/types/workflow";

type Tab = "solicitudes" | "requerimientos" | "asignaciones";

const ESTADO_LABELS: Record<EstadoPropuesta, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

const ESTADO_COLORS: Record<EstadoPropuesta, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  APROBADA: "bg-green-100 text-green-800",
  RECHAZADA: "bg-red-100 text-red-800",
};

export default function PropuestasDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("solicitudes");
  const [propuestas, setPropuestas] = useState<(Propuesta & { id: string })[]>(
    [],
  );
  const [requerimientos, setRequerimientos] = useState<
    (Requerimiento & { id: string })[]
  >([]);
  const [asignaciones, setAsignaciones] = useState<
    (Asignacion & { id: string })[]
  >([]);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPropuesta | "">("");
  const [cargando, setCargando] = useState(false);
  const [modalRequerimiento, setModalRequerimiento] = useState(false);

  async function getToken() {
    return (await getAuth().currentUser?.getIdToken()) ?? "";
  }

  async function cargarPropuestas() {
    setCargando(true);
    try {
      const token = await getToken();
      const url = filtroEstado
        ? `/api/propuestas?estado=${filtroEstado}`
        : "/api/propuestas";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPropuestas(data.propuestas ?? []);
    } finally {
      setCargando(false);
    }
  }

  async function cargarRequerimientos() {
    try {
      const token = await getToken();
      const res = await fetch("/api/requerimientos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRequerimientos(data.requerimientos ?? []);
    } catch {
      // Error silencioso — tabla queda vacía
    }
  }

  async function cargarAsignaciones() {
    try {
      const token = await getToken();
      const [resAsig, resProp] = await Promise.all([
        fetch("/api/asignaciones", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/propuestas?estado=APROBADA", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const asigData = await resAsig.json();
      const propData = await resProp.json();
      setAsignaciones(asigData.asignaciones ?? []);
      setPropuestas(propData.propuestas ?? []);
    } catch {
      // Error silencioso — tablas quedan vacías
    }
  }

  useEffect(() => {
    if (tab === "solicitudes") cargarPropuestas();
    if (tab === "requerimientos") cargarRequerimientos();
    if (tab === "asignaciones") cargarAsignaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filtroEstado]);

  const tieneWarnings = (p: Propuesta) =>
    Object.values(p.warnings).some(Boolean);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Propuestas Sindicales
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Oficina de Admisión y Cambios
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(
          [
            ["solicitudes", "Solicitudes"],
            ["requerimientos", "Requerimientos"],
            ["asignaciones", "Asignaciones"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Solicitudes */}
      {tab === "solicitudes" && (
        <div>
          <div className="flex gap-2 mb-4">
            {(["", "PENDIENTE", "APROBADA", "RECHAZADA"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e as EstadoPropuesta | "")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filtroEstado === e
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {e === "" ? "Todos" : ESTADO_LABELS[e as EstadoPropuesta]}
              </button>
            ))}
          </div>

          {cargando ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Cargando...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left"># Caso</th>
                    <th className="px-4 py-3 text-left">Matrícula</th>
                    <th className="px-4 py-3 text-left">Aspirante</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-center">Warnings</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {propuestas.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        Sin solicitudes
                      </td>
                    </tr>
                  )}
                  {propuestas.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/admin/propuestas/${p.id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {p.numeroCaso}
                      </td>
                      <td className="px-4 py-3 font-medium">{p.matricula}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.sinFamiliar ? (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            Sin familiar
                          </span>
                        ) : (
                          (p.aspirante?.nombreCompleto ?? "—")
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {p.creadoEn
                          ? new Date(
                              (p.creadoEn as any).seconds * 1000,
                            ).toLocaleDateString("es-MX")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tieneWarnings(p) && (
                          <span
                            className="inline-block w-2 h-2 bg-orange-400 rounded-full"
                            title="Tiene alertas"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[p.estado]}`}
                        >
                          {ESTADO_LABELS[p.estado]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Requerimientos */}
      {tab === "requerimientos" && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setModalRequerimiento(true)}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Subir circular
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Oficio</th>
                  <th className="px-4 py-3 text-left">Fecha circular</th>
                  <th className="px-4 py-3 text-left">Partidas</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requerimientos.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      Sin requerimientos
                    </td>
                  </tr>
                )}
                {requerimientos.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.numeroOficio}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {r.fechaCircular
                        ? new Date(
                            (r.fechaCircular as any).seconds * 1000,
                          ).toLocaleDateString("es-MX")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.partidas.length} partida
                      {r.partidas.length !== 1 ? "s" : ""} —{" "}
                      {r.partidas.reduce(
                        (acc, p) => acc + p.cantidadDisponible,
                        0,
                      )}{" "}
                      disponibles
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.estado === "ACTIVO" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                      >
                        {r.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {modalRequerimiento && (
            <ModalRequerimiento
              onClose={() => setModalRequerimiento(false)}
              onCreado={() => {
                setModalRequerimiento(false);
                cargarRequerimientos();
              }}
              getToken={getToken}
            />
          )}
        </div>
      )}

      {/* Tab: Asignaciones */}
      {tab === "asignaciones" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Folio</th>
                <th className="px-4 py-3 text-left">Aspirante</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Requerimiento</th>
                <th className="px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {asignaciones.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    Sin asignaciones
                  </td>
                </tr>
              )}
              {asignaciones.map((a) => {
                const prop = propuestas.find((p) => p.id === a.propuestaId);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-mono text-xs text-green-700 font-medium">
                      {prop?.folio ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {prop?.sinFamiliar ? (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          Sin familiar
                        </span>
                      ) : (
                        (prop?.aspirante?.nombreCompleto ?? "—")
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.categoria}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {a.requerimientoId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.estado === "ACTIVA" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}
                      >
                        {a.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ModalRequerimiento({
  onClose,
  onCreado,
  getToken,
}: {
  onClose: () => void;
  onCreado: () => void;
  getToken: () => Promise<string>;
}) {
  const [numeroOficio, setNumeroOficio] = useState("");
  const [fechaCircular, setFechaCircular] = useState("");
  const [partidas, setPartidas] = useState([
    { zona: "", categoria: "", cantidadTotal: 1 },
  ]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  function agregarPartida() {
    setPartidas([...partidas, { zona: "", categoria: "", cantidadTotal: 1 }]);
  }

  function quitarPartida(idx: number) {
    if (partidas.length > 1) {
      setPartidas(partidas.filter((_, i) => i !== idx));
    }
  }

  function actualizarPartida(
    idx: number,
    campo: string,
    valor: string | number,
  ) {
    const copia = [...partidas];
    copia[idx] = { ...copia[idx], [campo]: valor };
    setPartidas(copia);
  }

  async function enviar() {
    if (!numeroOficio.trim()) {
      setError("El número de oficio es requerido.");
      return;
    }
    if (!fechaCircular) {
      setError("La fecha del circular es requerida.");
      return;
    }
    if (
      partidas.some(
        (p) => !p.zona.trim() || !p.categoria.trim() || p.cantidadTotal < 1,
      )
    ) {
      setError(
        "Todas las partidas deben tener zona, categoría y cantidad válida.",
      );
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/requerimientos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          numeroOficio,
          fechaCircular: new Date(fechaCircular).toISOString(),
          partidas: partidas.map((p) => ({
            ...p,
            cantidadTotal: Number(p.cantidadTotal),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear");
        return;
      }
      onCreado();
    } catch {
      setError("Error de conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Subir circular</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de oficio
            </label>
            <input
              value={numeroOficio}
              onChange={(e) => setNumeroOficio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha del circular
            </label>
            <input
              type="date"
              value={fechaCircular}
              onChange={(e) => setFechaCircular(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Partidas
              </label>
              <button
                onClick={agregarPartida}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                + Agregar
              </button>
            </div>
            {partidas.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_80px_24px] gap-2 mb-2 items-center"
              >
                <input
                  placeholder="Zona"
                  value={p.zona}
                  onChange={(e) => actualizarPartida(i, "zona", e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                />
                <input
                  placeholder="Categoría"
                  value={p.categoria}
                  onChange={(e) =>
                    actualizarPartida(i, "categoria", e.target.value)
                  }
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Cant."
                  value={p.cantidadTotal}
                  onChange={(e) =>
                    actualizarPartida(i, "cantidadTotal", e.target.value)
                  }
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                />
                <button
                  onClick={() => quitarPartida(i)}
                  className="text-gray-400 hover:text-red-500 text-sm"
                  title="Quitar fila"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={enviar}
            disabled={enviando}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? "Guardando..." : "Guardar circular"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

function formatTimestamp(value: unknown): string {
  if (!value) return "—";
  const ts = value as { seconds?: number };
  if (ts.seconds) {
    return new Date(ts.seconds * 1000).toLocaleString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "—";
}

export default function CasoDetalle({ id }: { id: string }) {
  const router = useRouter();
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

  async function getToken() {
    return (await getAuth().currentUser?.getIdToken()) ?? "";
  }

  async function cargar() {
    setCargando(true);
    try {
      const token = await getToken();
      const [resProp, resReq] = await Promise.all([
        fetch(`/api/propuestas/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/requerimientos", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const propData = await resProp.json();
      setPropuesta(propData.propuesta ?? null);
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

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          Cargando caso...
        </p>
      </div>
    );
  }

  if (!propuesta) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-sm font-black text-red-500">Caso no encontrado.</p>
      </div>
    );
  }

  const warningsActivos = Object.entries(propuesta.warnings).filter(
    ([, v]) => v === true,
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 dark:bg-[#020617] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Back */}
        <button
          onClick={() => router.push("/admin/propuestas")}
          className="inline-flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Propuestas
        </button>

        {/* Hero */}
        <header className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 border border-slate-900 p-8 isolate shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-60" />
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary border border-primary/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Admisión y Cambios
                </span>
                <EstadoBadge estado={propuesta.estado} />
                {propuesta.sinFamiliar && (
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[10px] font-black"
                  >
                    Sin familiar
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                {propuesta.numeroCaso}
              </h1>
              {propuesta.folio && (
                <p className="text-sm font-bold text-emerald-400">
                  Folio:{" "}
                  <span className="font-mono text-emerald-300">
                    {propuesta.folio}
                  </span>
                </p>
              )}
            </div>
            <a
              href={`/admin/propuestas/${id}/print`}
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-black border border-white/10 transition-colors shrink-0"
            >
              <Printer className="h-4 w-4" />
              Generar PDF
            </a>
          </div>
        </header>

        {/* Cuerpo 2 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna izquierda */}
          <div className="space-y-4">
            {/* Datos trabajador */}
            <InfoCard title="Trabajador solicitante">
              <DataRow label="Matrícula">{propuesta.matricula}</DataRow>
              {propuesta.solicitante && (
                <>
                  <DataRow label="Nombre">
                    {propuesta.solicitante.nombreCompleto}
                  </DataRow>
                  <DataRow label="RFC">
                    <span className="font-mono text-xs uppercase">
                      {propuesta.solicitante.rfc}
                    </span>
                  </DataRow>
                  <DataRow label="Correo">
                    {propuesta.solicitante.correo}
                  </DataRow>
                  <DataRow label="Teléfono">
                    {propuesta.solicitante.telefono}
                  </DataRow>
                  <DataRow label="Domicilio">
                    {propuesta.solicitante.domicilioCalle}{" "}
                    {propuesta.solicitante.domicilioNumero},{" "}
                    {propuesta.solicitante.domicilioColonia},{" "}
                    {propuesta.solicitante.domicilioMunicipio},{" "}
                    {propuesta.solicitante.domicilioEstado} C.P.{" "}
                    {propuesta.solicitante.codigoPostal}
                  </DataRow>
                  <DataRow label="Escolaridad">
                    {propuesta.solicitante.escolaridad}
                  </DataRow>
                  <DataRow label="Nacimiento">
                    {propuesta.solicitante.fechaNacimiento} (
                    {propuesta.solicitante.edad} años)
                  </DataRow>
                  <DataRow label="Edo. nac.">
                    {propuesta.solicitante.estadoNacimiento}
                  </DataRow>
                </>
              )}
            </InfoCard>

            {/* Datos aspirante */}
            {!propuesta.sinFamiliar && propuesta.aspirante && (
              <InfoCard title="Datos del aspirante">
                <DataRow label="Nombre">
                  {propuesta.aspirante.nombreCompleto}
                </DataRow>
                <DataRow label="Parentesco">
                  {propuesta.aspirante.parentesco ?? "—"}
                </DataRow>
                <DataRow label="Matrícula">
                  {propuesta.aspirante.matriculaFamiliar}
                </DataRow>
                <DataRow label="Teléfono">
                  {propuesta.aspirante.telefono}
                </DataRow>
                <DataRow label="Contratación">
                  {propuesta.aspirante.tipoContratacion}
                </DataRow>
                <DataRow label="Correo">{propuesta.aspirante.correo}</DataRow>
                <DataRow label="Antigüedad">
                  {propuesta.aspirante.antiguedad}
                </DataRow>
                <DataRow label="Ingreso">
                  {propuesta.aspirante.fechaIngreso}
                </DataRow>
                <DataRow label="Unidad">
                  {propuesta.aspirante.unidadAdscripcion}
                </DataRow>
              </InfoCard>
            )}

            {/* INE */}
            {propuesta.documentos.ineUrl && (
              <InfoCard title="Documento INE">
                <a
                  href={propuesta.documentos.ineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-black text-primary hover:text-primary/80 transition-colors"
                >
                  Ver / Descargar INE →
                </a>
              </InfoCard>
            )}

            {/* Warnings */}
            {warningsActivos.length > 0 && (
              <details className="rounded-3xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 overflow-hidden">
                <summary className="px-5 py-4 text-sm font-black text-amber-800 dark:text-amber-400 cursor-pointer flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {warningsActivos.length} alerta
                  {warningsActivos.length !== 1 ? "s" : ""}
                </summary>
                <ul className="px-5 pb-4 space-y-1.5">
                  {warningsActivos.map(([key]) => (
                    <li
                      key={key}
                      className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2"
                    >
                      <span className="mt-1 shrink-0">·</span>
                      {WARNING_LABELS[key] ?? key}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* Columna derecha */}
          <div className="space-y-4">
            {/* Acciones */}
            <InfoCard title="Acciones">
              {error && (
                <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                  {error}
                </p>
              )}

              {propuesta.estado === "PENDIENTE" && (
                <div className="flex gap-3">
                  <Button
                    onClick={aprobar}
                    disabled={procesando}
                    className="flex-1 h-11 rounded-2xl font-black text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aprobar
                  </Button>
                  <Button
                    onClick={() => {
                      setError("");
                      setModalRechazo(true);
                    }}
                    disabled={procesando}
                    className="flex-1 h-11 rounded-2xl font-black text-sm bg-red-600 hover:bg-red-700 text-white"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rechazar
                  </Button>
                </div>
              )}

              {propuesta.estado === "APROBADA" && (
                <div className="space-y-3">
                  {propuesta.estadoFase2 === "SIN_ASIGNAR" && (
                    <Button
                      onClick={() => {
                        setError("");
                        setModalAsignar(true);
                      }}
                      className="w-full h-11 rounded-2xl font-black text-sm bg-primary hover:bg-primary/90 text-white"
                    >
                      Asignar requerimiento
                    </Button>
                  )}
                  {propuesta.estadoFase2 === "ASIGNADA" && (
                    <div className="flex items-center gap-2 text-sm font-black text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Requerimiento asignado
                    </div>
                  )}
                </div>
              )}

              {propuesta.estado === "RECHAZADA" && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Motivo de rechazo
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl px-4 py-3 leading-relaxed">
                    {propuesta.motivoRechazo}
                  </p>
                </div>
              )}
            </InfoCard>

            {/* Historial */}
            <InfoCard title="Historial">
              <ol className="space-y-4">
                {[...(propuesta.historial ?? [])].reverse().map((evento, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <HistorialIcon tipo={evento.tipo} />
                      {i < (propuesta.historial?.length ?? 0) - 1 && (
                        <div className="w-px flex-1 bg-slate-100 dark:bg-slate-800 min-h-[16px]" />
                      )}
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {evento.tipo}
                      </p>
                      {evento.nota && (
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {evento.nota}
                        </p>
                      )}
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                        {formatTimestamp(evento.fecha)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </InfoCard>
          </div>
        </div>
      </div>

      {/* Modal rechazo */}
      {modalRechazo && (
        <Modal title="Motivo de rechazo" onClose={() => setModalRechazo(false)}>
          <textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            rows={4}
            placeholder="Describe el motivo del rechazo (mínimo 10 caracteres)"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:text-white"
          />
          {error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button
              onClick={() => setModalRechazo(false)}
              variant="outline"
              className="flex-1 h-11 rounded-2xl font-black text-sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={rechazar}
              disabled={procesando}
              className="flex-1 h-11 rounded-2xl font-black text-sm bg-red-600 hover:bg-red-700 text-white"
            >
              {procesando ? "Procesando..." : "Confirmar rechazo"}
            </Button>
          </div>
        </Modal>
      )}

      {/* Modal asignación */}
      {modalAsignar && (
        <Modal
          title="Asignar requerimiento"
          onClose={() => setModalAsignar(false)}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
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
              className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:text-white"
            >
              <option value="">Seleccionar circular...</option>
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
              const disponibles =
                req?.partidas.filter((p) => p.cantidadDisponible > 0) ?? [];
              return (
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Partida disponible
                  </label>
                  <select
                    value={`${asignacion.zona}|||${asignacion.categoria}`}
                    onChange={(e) => {
                      const [zona, categoria] = e.target.value.split("|||");
                      setAsignacion({ ...asignacion, zona, categoria });
                    }}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Seleccionar partida...</option>
                    {disponibles.map((p, i) => (
                      <option key={i} value={`${p.zona}|||${p.categoria}`}>
                        {p.zona} — {p.categoria} ({p.cantidadDisponible}{" "}
                        disponibles)
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

          {error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              onClick={() => setModalAsignar(false)}
              variant="outline"
              className="flex-1 h-11 rounded-2xl font-black text-sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={asignar}
              disabled={procesando}
              className="flex-1 h-11 rounded-2xl font-black text-sm bg-primary hover:bg-primary/90 text-white"
            >
              {procesando ? "Asignando..." : "Confirmar asignación"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/60 bg-white dark:bg-slate-900 dark:border-slate-800 p-6 shadow-sm space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-1 text-sm border-b border-slate-50 dark:border-slate-800 last:border-0">
      <span className="text-slate-400 w-24 shrink-0 font-bold">{label}</span>
      <span className="text-slate-900 dark:text-white font-bold">
        {children}
      </span>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<
    string,
    { variant: "warning" | "success" | "destructive"; icon: React.ReactNode }
  > = {
    PENDIENTE: { variant: "warning", icon: <Clock className="h-3 w-3" /> },
    APROBADA: {
      variant: "success",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    RECHAZADA: {
      variant: "destructive",
      icon: <XCircle className="h-3 w-3" />,
    },
  };
  const { variant, icon } = map[estado] ?? {
    variant: "secondary" as const,
    icon: null,
  };
  return (
    <Badge
      variant={variant}
      className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
    >
      {icon}
      {estado}
    </Badge>
  );
}

function HistorialIcon({ tipo }: { tipo: string }) {
  const iconClass = cn(
    "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
    tipo === "APROBADA"
      ? "bg-emerald-100 text-emerald-600"
      : tipo === "RECHAZADA"
        ? "bg-red-100 text-red-600"
        : tipo === "ASIGNADA"
          ? "bg-blue-100 text-blue-600"
          : "bg-slate-100 text-slate-400",
  );
  return (
    <div className={iconClass}>
      {tipo === "APROBADA" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : tipo === "RECHAZADA" ? (
        <XCircle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

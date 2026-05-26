"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

type Paso = "matricula" | "datos" | "confirmado";

const AspiranteSchema = z.object({
  nombreCompleto: z.string().min(2, "Nombre requerido"),
  curp: z.string().length(18, "CURP debe tener 18 caracteres"),
  parentesco: z.enum(["Hijo", "Hija", "Cónyuge", "Otro"]),
  telefono: z.string().regex(/^\d{10}$/, "Teléfono debe tener 10 dígitos"),
});

type AspiranteForm = z.infer<typeof AspiranteSchema>;

export default function SolicitudForm() {
  const [paso, setPaso] = useState<Paso>("matricula");
  const [matricula, setMatricula] = useState("");
  const [matriculaInput, setMatriculaInput] = useState("");
  const [sinFamiliar, setSinFamiliar] = useState(false);
  const [ineFile, setIneFile] = useState<File | null>(null);
  const [numeroCaso, setNumeroCaso] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState("");

  const form = useForm<AspiranteForm>({
    resolver: zodResolver(AspiranteSchema),
  });

  async function verificarMatricula() {
    setVerificando(true);
    setErrorGeneral("");
    try {
      const res = await fetch("/api/propuestas/verificar-matricula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula: matriculaInput }),
      });
      const data = await res.json();
      if (data.valida) {
        setMatricula(matriculaInput.trim().toUpperCase());
        setPaso("datos");
      } else if (data.razon === "propuesta_activa") {
        setErrorGeneral(
          `Ya tienes una solicitud en proceso: ${data.numeroCaso}`,
        );
      } else {
        setErrorGeneral("Matrícula no encontrada en el padrón activo.");
      }
    } catch {
      setErrorGeneral("Error de conexión. Intenta de nuevo.");
    } finally {
      setVerificando(false);
    }
  }

  async function enviarSolicitud(aspiranteData: AspiranteForm | null) {
    setEnviando(true);
    setErrorGeneral("");
    try {
      const fd = new FormData();
      fd.append("matricula", matricula);
      fd.append("sinFamiliar", String(sinFamiliar));
      if (!sinFamiliar && aspiranteData) {
        fd.append("aspirante", JSON.stringify(aspiranteData));
      } else {
        fd.append("aspirante", "null");
      }
      if (ineFile) fd.append("ine", ineFile);

      const res = await fetch("/api/propuestas", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setErrorGeneral(data.error || "Error al enviar la solicitud.");
        return;
      }
      setNumeroCaso(data.numeroCaso);
      setPaso("confirmado");
    } catch {
      setErrorGeneral("Error de conexión. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (paso === "confirmado") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-green-800 mb-2">
          Solicitud registrada
        </h2>
        <p className="text-gray-600 mb-4">
          Guarda tu número de caso para seguimiento:
        </p>
        <div className="text-2xl font-mono font-bold text-green-700 bg-white border border-green-200 rounded-lg px-6 py-3 inline-block">
          {numeroCaso}
        </div>
      </div>
    );
  }

  if (paso === "matricula") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">
          Paso 1 — Verificar matrícula
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Matrícula IMSS
          </label>
          <input
            type="text"
            value={matriculaInput}
            onChange={(e) => setMatriculaInput(e.target.value.toUpperCase())}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ej. 12345678"
            onKeyDown={(e) => e.key === "Enter" && verificarMatricula()}
          />
        </div>
        {errorGeneral && <p className="text-sm text-red-600">{errorGeneral}</p>}
        <button
          onClick={verificarMatricula}
          disabled={verificando || matriculaInput.length < 4}
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {verificando ? "Verificando..." : "Verificar"}
        </button>
      </div>
    );
  }

  // Paso 'datos'
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">
          Paso 2 — Datos de la solicitud
        </h2>
        <span className="text-xs text-gray-500 font-mono">{matricula}</span>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={sinFamiliar}
          onChange={(e) => setSinFamiliar(e.target.checked)}
          className="rounded"
        />
        Sin familiar (caso excepcional)
      </label>

      {!sinFamiliar && (
        <form
          onSubmit={form.handleSubmit((d) => enviarSolicitud(d))}
          className="space-y-4"
        >
          <Field
            label="Nombre completo del aspirante"
            error={form.formState.errors.nombreCompleto?.message}
          >
            <input
              {...form.register("nombreCompleto")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Nombre completo"
            />
          </Field>

          <Field
            label="Parentesco"
            error={form.formState.errors.parentesco?.message}
          >
            <select
              {...form.register("parentesco")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {(["Hijo", "Hija", "Cónyuge", "Otro"] as const).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="CURP del aspirante"
            error={form.formState.errors.curp?.message}
          >
            <input
              {...form.register("curp")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase"
              placeholder="18 caracteres"
              maxLength={18}
            />
          </Field>

          <Field
            label="Teléfono de contacto"
            error={form.formState.errors.telefono?.message}
          >
            <input
              {...form.register("telefono")}
              type="tel"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="10 dígitos"
              maxLength={10}
            />
          </Field>

          <Field label="INE del aspirante (JPG, PNG o PDF, máx 5 MB)">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => setIneFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600"
            />
          </Field>

          {errorGeneral && (
            <p className="text-sm text-red-600">{errorGeneral}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Enviar solicitud"}
          </button>
        </form>
      )}

      {sinFamiliar && (
        <div className="space-y-4">
          {errorGeneral && (
            <p className="text-sm text-red-600">{errorGeneral}</p>
          )}
          <button
            onClick={() => enviarSolicitud(null)}
            disabled={enviando}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Enviar solicitud (sin familiar)"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CheckCircle2, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const PARENTESCO_OPTIONS = [
  "PADRE/MADRE",
  "ESPOSO/A",
  "HERMANO/A",
  "HIJO/A",
  "OTRO",
  "SIN FAMILIAR",
] as const;

const TIPO_CONTRATACION_OPTIONS = [
  "BASE",
  "EVENTUAL",
  "CONFIANZA",
  "CONTRATO",
] as const;

const FormSchema = z
  .object({
    // Datos del trabajador solicitante (sindicalizado)
    matriculaSolicitante: z.string().min(4, "Mínimo 4 caracteres").max(20),

    // Parentesco determina si hay familiar o no
    parentesco: z.enum(PARENTESCO_OPTIONS, {
      required_error: "Selecciona el parentesco",
    }),

    // Datos del familiar (solo si parentesco !== "SIN FAMILIAR")
    nombreFamiliar: z.string().max(120).optional(),
    matriculaFamiliar: z.string().max(20).optional(),
    telefono: z.string().max(10).optional(),
    tipoContratacion: z.string().optional(),
    correo: z.string().max(120).optional(),
    antiguedad: z.string().max(100).optional(),
    fechaIngreso: z.string().optional(),
    unidadAdscripcion: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.parentesco === "SIN FAMILIAR") return;

    if (!data.nombreFamiliar || data.nombreFamiliar.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nombre requerido",
        path: ["nombreFamiliar"],
      });
    }
    if (!data.matriculaFamiliar || data.matriculaFamiliar.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Matrícula requerida",
        path: ["matriculaFamiliar"],
      });
    }
    if (!data.telefono || !/^\d{10}$/.test(data.telefono)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Teléfono a 10 dígitos",
        path: ["telefono"],
      });
    }
    if (!data.tipoContratacion || data.tipoContratacion.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tipo de contratación requerido",
        path: ["tipoContratacion"],
      });
    }
    if (!data.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Correo válido requerido",
        path: ["correo"],
      });
    }
    if (!data.antiguedad || data.antiguedad.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Antigüedad requerida",
        path: ["antiguedad"],
      });
    }
    if (!data.fechaIngreso || data.fechaIngreso.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fecha de ingreso requerida",
        path: ["fechaIngreso"],
      });
    }
    if (!data.unidadAdscripcion || data.unidadAdscripcion.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unidad de adscripción requerida",
        path: ["unidadAdscripcion"],
      });
    }
  });

type FormData = z.infer<typeof FormSchema>;

export default function SolicitudForm() {
  const [enviado, setEnviado] = useState(false);
  const [numeroCaso, setNumeroCaso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [ineFile, setIneFile] = useState<File | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
  });

  const parentesco = form.watch("parentesco");
  const sinFamiliar = parentesco === "SIN FAMILIAR";

  async function onSubmit(data: FormData) {
    setEnviando(true);
    setErrorGeneral("");
    try {
      const fd = new FormData();
      fd.append("matricula", data.matriculaSolicitante.trim().toUpperCase());
      fd.append("sinFamiliar", String(sinFamiliar));

      if (!sinFamiliar) {
        const aspirante = {
          nombreCompleto: data.nombreFamiliar ?? "",
          parentesco: data.parentesco,
          matriculaFamiliar: data.matriculaFamiliar ?? "",
          telefono: data.telefono ?? "",
          tipoContratacion: data.tipoContratacion ?? "",
          correo: data.correo ?? "",
          antiguedad: data.antiguedad ?? "",
          fechaIngreso: data.fechaIngreso ?? "",
          unidadAdscripcion: data.unidadAdscripcion ?? "",
        };
        fd.append("aspirante", JSON.stringify(aspirante));
      } else {
        fd.append("aspirante", "null");
      }

      if (ineFile) fd.append("ine", ineFile);

      const res = await fetch("/api/propuestas", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setErrorGeneral(json.error || "Error al enviar la solicitud.");
        return;
      }
      setNumeroCaso(json.numeroCaso);
      setEnviado(true);
    } catch {
      setErrorGeneral("Error de conexión. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center"
      >
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
        <h2 className="text-xl font-black text-green-800 mb-2">
          Solicitud registrada
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Guarda tu número de caso. La oficina de Admisión y Cambios te
          contactará para informarte el resultado.
        </p>
        <div className="inline-block bg-white border border-green-200 rounded-xl px-8 py-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
            Número de caso
          </p>
          <p className="text-2xl font-mono font-black text-green-700">
            {numeroCaso}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-5"
    >
      {/* Datos del solicitante */}
      <FormCard label="Datos del trabajador solicitante">
        <Field
          label="Tu matrícula IMSS"
          error={form.formState.errors.matriculaSolicitante?.message}
        >
          <Input
            {...form.register("matriculaSolicitante")}
            placeholder="Ej. 12345678"
            className="uppercase"
            onChange={(e) =>
              form.setValue(
                "matriculaSolicitante",
                e.target.value.toUpperCase().trim(),
                { shouldValidate: true },
              )
            }
          />
        </Field>
      </FormCard>

      {/* Datos del familiar */}
      <FormCard label="Datos de tu familiar IMSS">
        {/* Parentesco — primero, porque determina si hay familiar */}
        <Field
          label="Parentesco"
          error={form.formState.errors.parentesco?.message}
        >
          <Select {...form.register("parentesco")} className="w-full">
            <option value="">Seleccionar parentesco...</option>
            {PARENTESCO_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>

        {!sinFamiliar && parentesco && (
          <>
            <Field
              label="Nombre completo de tu familiar IMSS"
              hint="En caso de no tener familiar, selecciona SIN FAMILIAR arriba."
              error={form.formState.errors.nombreFamiliar?.message}
            >
              <Input
                {...form.register("nombreFamiliar")}
                placeholder="Apellido Apellido Nombre"
              />
            </Field>

            <Field
              label="Matrícula de tu familiar IMSS"
              error={form.formState.errors.matriculaFamiliar?.message}
            >
              <Input
                {...form.register("matriculaFamiliar")}
                placeholder="Matrícula IMSS del familiar"
                className="uppercase"
                onChange={(e) =>
                  form.setValue(
                    "matriculaFamiliar",
                    e.target.value.toUpperCase().trim(),
                    { shouldValidate: true },
                  )
                }
              />
            </Field>

            <Field
              label="Teléfono celular de tu familiar IMSS"
              hint="Número a 10 dígitos sin espacios u otro carácter."
              error={form.formState.errors.telefono?.message}
            >
              <Input
                {...form.register("telefono")}
                type="tel"
                placeholder="10 dígitos"
                maxLength={10}
              />
            </Field>

            <Field
              label="Tipo de contratación de tu familiar IMSS"
              error={form.formState.errors.tipoContratacion?.message}
            >
              <Select {...form.register("tipoContratacion")} className="w-full">
                <option value="">Seleccionar tipo...</option>
                {TIPO_CONTRATACION_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Correo de tu familiar IMSS"
              error={form.formState.errors.correo?.message}
            >
              <Input
                {...form.register("correo")}
                type="email"
                placeholder="correo@ejemplo.com"
              />
            </Field>

            <Field
              label="Antigüedad laboral de tu familiar IMSS"
              hint="Formato: xx años xx qnas xx dias"
              error={form.formState.errors.antiguedad?.message}
            >
              <Input
                {...form.register("antiguedad")}
                placeholder="Ej. 05 años 03 qnas 12 dias"
              />
            </Field>

            <Field
              label="Fecha de ingreso de tu familiar IMSS"
              error={form.formState.errors.fechaIngreso?.message}
            >
              <Input {...form.register("fechaIngreso")} type="date" />
            </Field>

            <Field
              label="Unidad de Adscripción de tu familiar IMSS"
              error={form.formState.errors.unidadAdscripcion?.message}
            >
              <Input
                {...form.register("unidadAdscripcion")}
                placeholder="Nombre de la unidad médica o área"
              />
            </Field>

            <Field label="INE de tu familiar IMSS (JPG, PNG o PDF — máx 5 MB)">
              <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-3 hover:border-red-400 hover:bg-red-50 transition-colors">
                <Upload className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-500">
                  {ineFile ? ineFile.name : "Seleccionar archivo..."}
                </span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="sr-only"
                  onChange={(e) => setIneFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </Field>
          </>
        )}

        {sinFamiliar && parentesco && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-medium">
            Caso registrado como{" "}
            <span className="font-black">SIN FAMILIAR</span>. La oficina
            evaluará la solicitud conforme al reglamento.
          </div>
        )}
      </FormCard>

      {errorGeneral && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{errorGeneral}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={enviando}
        className="w-full h-12 rounded-xl bg-red-700 hover:bg-red-800 text-white font-black text-sm tracking-wide"
      >
        {enviando ? "Enviando solicitud..." : "Enviar solicitud"}
      </Button>

      <p className="text-center text-xs text-slate-400">
        Al enviar confirmas que los datos son verídicos. La oficina revisará tu
        solicitud y te contactará.
      </p>
    </motion.form>
  );
}

function FormCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
        {label}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-bold text-slate-700">{label}</Label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

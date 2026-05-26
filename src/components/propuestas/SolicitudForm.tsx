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

const FormSchema = z.object({
  matricula: z.string().min(4, "Mínimo 4 caracteres").max(20),
  sinFamiliar: z.boolean().default(false),
  nombreCompleto: z.string().min(2, "Nombre requerido").max(120).optional(),
  parentesco: z.enum(["Hijo", "Hija", "Cónyuge", "Otro"]).optional(),
  curp: z.string().length(18, "CURP debe tener 18 caracteres").optional(),
  telefono: z
    .string()
    .regex(/^\d{10}$/, "Teléfono debe tener 10 dígitos")
    .optional(),
});

type FormData = z.infer<typeof FormSchema>;

export default function SolicitudForm() {
  const [enviado, setEnviado] = useState(false);
  const [numeroCaso, setNumeroCaso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [ineFile, setIneFile] = useState<File | null>(null);
  const [sinFamiliar, setSinFamiliar] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: { sinFamiliar: false },
  });

  async function onSubmit(data: FormData) {
    setEnviando(true);
    setErrorGeneral("");
    try {
      const fd = new FormData();
      fd.append("matricula", data.matricula.trim().toUpperCase());
      fd.append("sinFamiliar", String(sinFamiliar));

      if (!sinFamiliar) {
        const aspirante = {
          nombreCompleto: data.nombreCompleto ?? "",
          curp: (data.curp ?? "").toUpperCase(),
          parentesco: data.parentesco ?? null,
          telefono: data.telefono ?? "",
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
      className="space-y-6"
    >
      {/* Matrícula */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">
            Datos del trabajador
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="matricula" className="font-bold text-slate-700">
              Matrícula IMSS
            </Label>
            <Input
              id="matricula"
              {...form.register("matricula")}
              placeholder="Ej. 12345678"
              className="uppercase"
              onChange={(e) =>
                form.setValue(
                  "matricula",
                  e.target.value.toUpperCase().trim(),
                  { shouldValidate: true },
                )
              }
            />
            {form.formState.errors.matricula && (
              <p className="text-xs text-red-600">
                {form.formState.errors.matricula.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Familiar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">
            Datos del aspirante
          </h3>

          <label className="flex items-center gap-3 cursor-pointer mb-5">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                sinFamiliar
                  ? "bg-red-700 border-red-700"
                  : "border-slate-300 bg-white"
              }`}
              onClick={() => setSinFamiliar((v) => !v)}
            >
              {sinFamiliar && (
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <span className="text-sm text-slate-600 font-medium">
              Sin familiar (caso excepcional — solo si aplica)
            </span>
          </label>
        </div>

        {!sinFamiliar && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="nombreCompleto"
                className="font-bold text-slate-700"
              >
                Nombre completo del aspirante
              </Label>
              <Input
                id="nombreCompleto"
                {...form.register("nombreCompleto")}
                placeholder="Apellido Apellido Nombre"
              />
              {form.formState.errors.nombreCompleto && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.nombreCompleto.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="parentesco" className="font-bold text-slate-700">
                Parentesco
              </Label>
              <Select id="parentesco" {...form.register("parentesco")}>
                <option value="">Seleccionar parentesco...</option>
                {(["Hijo", "Hija", "Cónyuge", "Otro"] as const).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
              {form.formState.errors.parentesco && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.parentesco.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="curp" className="font-bold text-slate-700">
                CURP del aspirante
              </Label>
              <Input
                id="curp"
                {...form.register("curp")}
                placeholder="18 caracteres"
                maxLength={18}
                className="uppercase"
                onChange={(e) =>
                  form.setValue("curp", e.target.value.toUpperCase(), {
                    shouldValidate: true,
                  })
                }
              />
              {form.formState.errors.curp && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.curp.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefono" className="font-bold text-slate-700">
                Teléfono de contacto
              </Label>
              <Input
                id="telefono"
                {...form.register("telefono")}
                type="tel"
                placeholder="10 dígitos"
                maxLength={10}
              />
              {form.formState.errors.telefono && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.telefono.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">
                INE del aspirante
              </Label>
              <label className="flex items-center gap-3 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-3 hover:border-red-400 hover:bg-red-50 transition-colors">
                <Upload className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-500">
                  {ineFile ? ineFile.name : "JPG, PNG o PDF — máx 5 MB"}
                </span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="sr-only"
                  onChange={(e) => setIneFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        )}
      </div>

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

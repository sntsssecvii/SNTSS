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
import { MUNICIPIOS_BC, ESCOLARIDAD_OPTIONS } from "@/types/propuestas";

const ESTADOS_MEXICO = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "México",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

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
    // -- Página 1: datos del familiar IMSS --
    matriculaSolicitante: z.string().min(4, "Mínimo 4 caracteres").max(20),
    parentesco: z.enum(PARENTESCO_OPTIONS, {
      required_error: "Selecciona el parentesco",
    }),
    nombreFamiliar: z.string().max(120).optional(),
    matriculaFamiliar: z.string().max(20).optional(),
    telefonoFamiliar: z.string().max(10).optional(),
    tipoContratacion: z.string().optional(),
    correoFamiliar: z.string().max(120).optional(),
    antiguedad: z.string().max(100).optional(),
    fechaIngreso: z.string().optional(),
    unidadAdscripcion: z.string().max(200).optional(),

    // -- Página 2: datos personales del solicitante --
    nombreSolicitante: z.string().min(2, "Nombre requerido").max(120),
    correoSolicitante: z.string().email("Correo válido requerido"),
    domicilioCalle: z.string().min(1, "Calle requerida").max(200),
    domicilioNumero: z.string().min(1, "Número requerido").max(50),
    domicilioColonia: z.string().min(1, "Colonia requerida").max(150),
    domicilioMunicipio: z.string().min(1, "Municipio requerido").max(100),
    domicilioMunicipioOtro: z.string().max(100).optional(),
    domicilioEstado: z.string().min(1, "Estado requerido").max(100),
    codigoPostal: z.string().regex(/^\d{5}$/, "Código postal a 5 dígitos"),
    telefonoCelular: z.string().regex(/^\d{10}$/, "Teléfono a 10 dígitos"),
    escolaridad: z.string().min(1, "Escolaridad requerida"),
    fechaNacimiento: z.string().min(1, "Fecha de nacimiento requerida"),
    edad: z.coerce
      .number({ invalid_type_error: "Edad requerida" })
      .min(16, "Mínimo 16 años")
      .max(100),
    estadoNacimiento: z.string().min(1, "Estado de nacimiento requerido"),
    rfc: z
      .string()
      .regex(
        /^[A-Za-z]{4}\d{6}[A-Za-z0-9]{3}$/,
        "RFC inválido — deben ser 13 caracteres (AAAA######AAA)",
      ),
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
    if (!data.telefonoFamiliar || !/^\d{10}$/.test(data.telefonoFamiliar)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Teléfono a 10 dígitos",
        path: ["telefonoFamiliar"],
      });
    }
    if (!data.tipoContratacion || data.tipoContratacion.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tipo de contratación requerido",
        path: ["tipoContratacion"],
      });
    }
    if (
      !data.correoFamiliar ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correoFamiliar)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Correo válido requerido",
        path: ["correoFamiliar"],
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
    if (data.domicilioMunicipio === "OTRO") {
      if (
        !data.domicilioMunicipioOtro ||
        data.domicilioMunicipioOtro.trim().length < 2
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Especifica el municipio",
          path: ["domicilioMunicipioOtro"],
        });
      }
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
  const municipio = form.watch("domicilioMunicipio");
  const sinFamiliar = parentesco === "SIN FAMILIAR";

  async function onSubmit(data: FormData) {
    setEnviando(true);
    setErrorGeneral("");
    try {
      const fd = new FormData();
      fd.append("matricula", data.matriculaSolicitante.trim().toUpperCase());
      fd.append("sinFamiliar", String(sinFamiliar));

      const solicitante = {
        nombreCompleto: data.nombreSolicitante,
        correo: data.correoSolicitante,
        domicilioCalle: data.domicilioCalle,
        domicilioNumero: data.domicilioNumero,
        domicilioColonia: data.domicilioColonia,
        domicilioMunicipio:
          data.domicilioMunicipio === "OTRO"
            ? `Otro: ${data.domicilioMunicipioOtro ?? ""}`
            : data.domicilioMunicipio,
        domicilioEstado: data.domicilioEstado,
        codigoPostal: data.codigoPostal,
        telefono: data.telefonoCelular,
        escolaridad: data.escolaridad,
        fechaNacimiento: data.fechaNacimiento,
        edad: data.edad,
        estadoNacimiento: data.estadoNacimiento,
        rfc: data.rfc.toUpperCase(),
      };
      fd.append("solicitante", JSON.stringify(solicitante));

      if (!sinFamiliar) {
        const aspirante = {
          nombreCompleto: data.nombreFamiliar ?? "",
          parentesco: data.parentesco,
          matriculaFamiliar: data.matriculaFamiliar ?? "",
          telefono: data.telefonoFamiliar ?? "",
          tipoContratacion: data.tipoContratacion ?? "",
          correo: data.correoFamiliar ?? "",
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
      {/* ── Sección 1: Datos del familiar IMSS ── */}
      <FormCard label="Datos de tu familiar IMSS">
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
              hint="Empieza por APELLIDOS y luego NOMBRE(S)."
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
              error={form.formState.errors.telefonoFamiliar?.message}
            >
              <Input
                {...form.register("telefonoFamiliar")}
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
              error={form.formState.errors.correoFamiliar?.message}
            >
              <Input
                {...form.register("correoFamiliar")}
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

      {/* ── Sección 2: Datos personales del solicitante ── */}
      <FormCard label="Tus datos personales">
        <p className="text-xs text-slate-500 leading-relaxed -mt-1">
          Favor de escribir correctamente tus datos, ya que a partir de aquí se
          generará tu propuesta.
        </p>

        <Field
          label="Nombre completo"
          hint="Empieza por los APELLIDOS y luego NOMBRE(S)."
          error={form.formState.errors.nombreSolicitante?.message}
        >
          <Input
            {...form.register("nombreSolicitante")}
            placeholder="Apellido Apellido Nombre"
          />
        </Field>

        <Field
          label="Correo electrónico"
          error={form.formState.errors.correoSolicitante?.message}
        >
          <Input
            {...form.register("correoSolicitante")}
            type="email"
            placeholder="correo@ejemplo.com"
          />
        </Field>

        <SectionDivider label="Domicilio" />
        <p className="text-xs text-slate-400 -mt-2">
          Debe coincidir con los datos oficiales de tu INE/IFE.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Field
              label="Calle"
              error={form.formState.errors.domicilioCalle?.message}
            >
              <Input
                {...form.register("domicilioCalle")}
                placeholder="Nombre de la calle"
              />
            </Field>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field
              label="Número"
              error={form.formState.errors.domicilioNumero?.message}
            >
              <Input
                {...form.register("domicilioNumero")}
                placeholder="Número exterior / interior"
              />
            </Field>
          </div>
        </div>

        <Field
          label="Colonia"
          error={form.formState.errors.domicilioColonia?.message}
        >
          <Input
            {...form.register("domicilioColonia")}
            placeholder="Colonia o fraccionamiento"
          />
        </Field>

        <Field
          label="Municipio"
          error={form.formState.errors.domicilioMunicipio?.message}
        >
          <Select {...form.register("domicilioMunicipio")} className="w-full">
            <option value="">Seleccionar municipio...</option>
            {MUNICIPIOS_BC.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="OTRO">Otro</option>
          </Select>
        </Field>

        {municipio === "OTRO" && (
          <Field
            label="Especifica el municipio"
            error={form.formState.errors.domicilioMunicipioOtro?.message}
          >
            <Input
              {...form.register("domicilioMunicipioOtro")}
              placeholder="Nombre del municipio"
            />
          </Field>
        )}

        <Field
          label="Estado"
          error={form.formState.errors.domicilioEstado?.message}
        >
          <Select {...form.register("domicilioEstado")} className="w-full">
            <option value="">Seleccionar estado...</option>
            {ESTADOS_MEXICO.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Código postal"
          hint="Igual que el que aparece en tu INE/IFE."
          error={form.formState.errors.codigoPostal?.message}
        >
          <Input
            {...form.register("codigoPostal")}
            placeholder="5 dígitos"
            maxLength={5}
            inputMode="numeric"
          />
        </Field>

        <SectionDivider label="Información personal" />

        <Field
          label="Teléfono celular propio"
          hint="Número a 10 dígitos."
          error={form.formState.errors.telefonoCelular?.message}
        >
          <Input
            {...form.register("telefonoCelular")}
            type="tel"
            placeholder="10 dígitos"
            maxLength={10}
          />
        </Field>

        <Field
          label="Escolaridad máxima"
          hint="Terminada y con documentación completa."
          error={form.formState.errors.escolaridad?.message}
        >
          <Select {...form.register("escolaridad")} className="w-full">
            <option value="">Seleccionar escolaridad...</option>
            {ESCOLARIDAD_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Fecha de nacimiento"
            error={form.formState.errors.fechaNacimiento?.message}
          >
            <Input
              {...form.register("fechaNacimiento")}
              type="date"
              onChange={(e) => {
                form.setValue("fechaNacimiento", e.target.value, {
                  shouldValidate: true,
                });
                // Auto-calcular edad
                if (e.target.value) {
                  const nacimiento = new Date(e.target.value);
                  const hoy = new Date();
                  const edad =
                    hoy.getFullYear() -
                    nacimiento.getFullYear() -
                    (hoy <
                    new Date(
                      hoy.getFullYear(),
                      nacimiento.getMonth(),
                      nacimiento.getDate(),
                    )
                      ? 1
                      : 0);
                  form.setValue("edad", edad, { shouldValidate: true });
                }
              }}
            />
          </Field>

          <Field label="Edad" error={form.formState.errors.edad?.message}>
            <Input
              {...form.register("edad")}
              type="number"
              placeholder="Años"
              min={16}
              max={100}
            />
          </Field>
        </div>

        <Field
          label="Estado de nacimiento"
          error={form.formState.errors.estadoNacimiento?.message}
        >
          <Select {...form.register("estadoNacimiento")} className="w-full">
            <option value="">Seleccionar estado...</option>
            {ESTADOS_MEXICO.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="RFC (13 dígitos)"
          hint="Son 13 dígitos, por ejemplo ABCD810123EFG"
          error={form.formState.errors.rfc?.message}
        >
          <Input
            {...form.register("rfc")}
            placeholder="ABCD810123EFG"
            className="uppercase font-mono"
            maxLength={13}
            onChange={(e) =>
              form.setValue("rfc", e.target.value.toUpperCase().trim(), {
                shouldValidate: true,
              })
            }
          />
        </Field>
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

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="flex-1 h-px bg-slate-100" />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-100" />
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

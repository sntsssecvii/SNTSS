"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  registroBaseSchema,
  type RegistroFormData,
} from "@/lib/schemas/registro";
import {
  evaluarFortalezaPassword,
  passwordsCoinciden,
} from "@/lib/utils/password";
import { toTitleCase } from "@/lib/utils/text";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StepInfoProps {
  onNext: (data: Partial<RegistroFormData>) => void;
  initialData?: Partial<RegistroFormData>;
}

const stepInfoSchema = registroBaseSchema
  .pick({
    nombre: true,
    apellidoPaterno: true,
    apellidoMaterno: true,
    matricula: true,
    email: true,
    password: true,
    confirmPassword: true,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

const inputCls =
  "h-12 text-base transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500";

export default function StepInfo({ onNext, initialData }: StepInfoProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof stepInfoSchema>>({
    resolver: zodResolver(stepInfoSchema),
    defaultValues: initialData,
  });

  const [sinApellidoMaterno, setSinApellidoMaterno] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showDoc, setShowDoc] = useState<"privacidad" | "terminos" | null>(
    null,
  );

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  const passwordStrength = password ? evaluarFortalezaPassword(password) : null;
  const passwordMatch =
    confirmPassword && password
      ? passwordsCoinciden(password, confirmPassword)
      : null;

  const onSubmit = (data: z.infer<typeof stepInfoSchema>) => {
    onNext(data);
  };

  return (
    <form className="px-5 py-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre(s)</Label>
          <Input
            id="nombre"
            placeholder="Ej. Juan Carlos"
            {...register("nombre", {
              onBlur: (e) => {
                if (e.target.value)
                  setValue("nombre", toTitleCase(e.target.value));
              },
            })}
            className={inputCls}
          />
          {errors.nombre && (
            <p className="text-xs text-red-500">{errors.nombre.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apellidoPaterno">Apellido Paterno</Label>
          <Input
            id="apellidoPaterno"
            placeholder="Ej. Pérez"
            {...register("apellidoPaterno", {
              onBlur: (e) => {
                if (e.target.value)
                  setValue("apellidoPaterno", toTitleCase(e.target.value));
              },
            })}
            className={inputCls}
          />
          {errors.apellidoPaterno && (
            <p className="text-xs text-red-500">
              {errors.apellidoPaterno.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
        <Input
          id="apellidoMaterno"
          placeholder="Ej. López"
          disabled={sinApellidoMaterno}
          {...register("apellidoMaterno", {
            onBlur: (e) => {
              if (!sinApellidoMaterno && e.target.value)
                setValue("apellidoMaterno", toTitleCase(e.target.value));
            },
          })}
          className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
          <input
            type="checkbox"
            checked={sinApellidoMaterno}
            onChange={(e) => {
              setSinApellidoMaterno(e.target.checked);
              if (e.target.checked) setValue("apellidoMaterno", "");
            }}
            className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm text-slate-500">
            No tengo apellido materno
          </span>
        </label>
        {errors.apellidoMaterno && (
          <p className="text-xs text-red-500">
            {errors.apellidoMaterno.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="matricula">Matrícula</Label>
        <Input
          id="matricula"
          placeholder="Máximo 10 dígitos numéricos"
          maxLength={10}
          {...register("matricula")}
          className={inputCls}
        />
        {errors.matricula && (
          <p className="text-xs text-red-500">{errors.matricula.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo Electrónico</Label>
        <Input
          id="email"
          type="email"
          placeholder="nombre@ejemplo.com"
          {...register("email")}
          className={inputCls}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Mínimo 8 caracteres"
            {...register("password")}
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
        {passwordStrength && (
          <div className="space-y-1.5 mt-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(passwordStrength.score + 1) * 25}%` }}
                  className={`h-full ${passwordStrength.color} transition-all duration-300`}
                />
              </div>
              <span className="text-xs font-medium text-slate-600 shrink-0">
                {passwordStrength.label}
              </span>
            </div>
            {passwordStrength.suggestions.length > 0 && (
              <div className="text-xs text-slate-400 space-y-0.5">
                {passwordStrength.suggestions.map((s, i) => (
                  <p key={i}>• {s}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Repite tu contraseña"
            {...register("confirmPassword")}
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showConfirmPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-red-500">
            {errors.confirmPassword.message}
          </p>
        )}
        {confirmPassword && (
          <div
            className={`text-xs flex items-center gap-1 mt-1 ${
              passwordMatch ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {passwordMatch ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Las contraseñas coinciden
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                Las contraseñas no coinciden
              </>
            )}
          </div>
        )}
      </div>

      {/* Términos y condiciones */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm text-slate-600 leading-snug">
            He leído y acepto el{" "}
            <button
              type="button"
              onClick={() => setShowDoc("privacidad")}
              className="text-red-600 font-semibold underline underline-offset-2 hover:text-red-700"
            >
              Aviso de Privacidad
            </button>{" "}
            y los{" "}
            <button
              type="button"
              onClick={() => setShowDoc("terminos")}
              className="text-red-600 font-semibold underline underline-offset-2 hover:text-red-700"
            >
              Términos de Uso
            </button>
            . Declaro bajo protesta de decir verdad que soy trabajador
            sindicalizado del IMSS.
          </span>
        </label>

        <Button
          type="submit"
          disabled={!termsAccepted}
          className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Continuar →
        </Button>
      </div>

      {/* Modal documentos legales */}
      <Dialog open={showDoc !== null} onOpenChange={() => setShowDoc(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {showDoc === "privacidad"
                ? "Aviso de Privacidad"
                : "Términos de Uso"}
            </DialogTitle>
          </DialogHeader>

          {showDoc === "privacidad" && (
            <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <p>
                <strong>Responsable:</strong> Sindicato Nacional de Trabajadores
                del Seguro Social (SNTSS), Sección VII — Baja California.
              </p>
              <p>
                <strong>Datos recabados:</strong> nombre completo, matrícula
                IMSS, correo electrónico y documentos de identificación (INE,
                tarjetón de pago y constancia de afiliación).
              </p>
              <p>
                <strong>Finalidad:</strong> Validar que eres trabajador
                sindicalizado del IMSS y gestionar tu acceso al Portal del
                Sindicalizado. Tus datos serán tratados exclusivamente para
                estos fines.
              </p>
              <p>
                <strong>Conservación de documentos:</strong> Los documentos de
                identificación que subas serán eliminados de forma permanente
                una vez que tu registro sea validado por el sindicato.
              </p>
              <p>
                <strong>Derechos ARCO:</strong> Puedes solicitar acceso,
                rectificación, cancelación u oposición al tratamiento de tus
                datos personales comunicándote con el administrador del
                sindicato a través del portal.
              </p>
              <p>
                <strong>Fundamento legal:</strong> Ley Federal de Protección de
                Datos Personales en Posesión de los Particulares (LFPDPPP).
              </p>
            </div>
          )}

          {showDoc === "terminos" && (
            <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <p>
                <strong>Acceso exclusivo para sindicalizados:</strong> El Portal
                del Sindicalizado es una herramienta de gestión interna del
                SNTSS Sección VII, exclusiva para trabajadores sindicalizados
                del IMSS.
              </p>
              <p>
                <strong>Veracidad de la información:</strong> Al registrarte,
                declaras bajo protesta de decir verdad que los datos y
                documentos que proporcionas son auténticos y verídicos. La
                falsedad en la información constituye causa suficiente para
                denegar o revocar tu acceso de forma permanente.
              </p>
              <p>
                <strong>Verificación:</strong> El sindicato se reserva el
                derecho de verificar tu información con los registros oficiales
                del IMSS y de la sección sindical.
              </p>
              <p>
                <strong>Revocación de acceso:</strong> El mal uso de la
                plataforma, el acceso no autorizado a información de terceros o
                cualquier conducta contraria a los principios sindicales
                resultará en la revocación inmediata de tu acceso, sin perjuicio
                de las acciones legales que correspondan.
              </p>
              <p>
                <strong>Responsabilidad:</strong> Eres responsable de mantener
                la confidencialidad de tu contraseña. Cualquier actividad
                realizada con tus credenciales es de tu entera responsabilidad.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}

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

interface StepInfoProps {
  onNext: (data: Partial<RegistroFormData>) => void;
  initialData?: Partial<RegistroFormData>;
}

// Separate schema for this step to validate only these fields before moving on
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

  // Estados para funcionalidades mejoradas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Watch para validaciones en tiempo real
  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  // Evaluar fortaleza de contraseña
  const passwordStrength = password ? evaluarFortalezaPassword(password) : null;

  // Validar coincidencia de contraseñas
  const passwordMatch =
    confirmPassword && password
      ? passwordsCoinciden(password, confirmPassword)
      : null;

  const onSubmit = (data: z.infer<typeof stepInfoSchema>) => {
    onNext(data);
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
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
            className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
          {errors.nombre && (
            <p className="text-sm text-red-500">{errors.nombre.message}</p>
          )}
        </div>
        <div className="space-y-2">
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
            className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
          {errors.apellidoPaterno && (
            <p className="text-sm text-red-500">
              {errors.apellidoPaterno.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
        <Input
          id="apellidoMaterno"
          placeholder="Ej. López"
          disabled={sinApellidoMaterno}
          {...register("apellidoMaterno", {
            onBlur: (e) => {
              if (!sinApellidoMaterno && e.target.value) {
                setValue("apellidoMaterno", toTitleCase(e.target.value));
              }
            },
          })}
          className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <span className="text-sm text-slate-600">
            No tengo apellido materno
          </span>
        </label>
        {errors.apellidoMaterno && (
          <p className="text-sm text-red-500">
            {errors.apellidoMaterno.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="matricula">Matrícula</Label>
        <Input
          id="matricula"
          placeholder="Máximo 10 dígitos numéricos"
          maxLength={10}
          {...register("matricula")}
          className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
        />
        {errors.matricula && (
          <p className="text-sm text-red-500">{errors.matricula.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          Correo Electrónico Institucional / Personal
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="nombre@ejemplo.com"
          {...register("email")}
          className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Contraseñas mejoradas */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              {...register("password")}
              className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500 pr-10"
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
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}

          {/* Indicador de fortaleza */}
          {passwordStrength && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(passwordStrength.score + 1) * 25}%` }}
                    className={`h-full ${passwordStrength.color} transition-all duration-300`}
                  />
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {passwordStrength.label}
                </span>
              </div>
              {passwordStrength.suggestions.length > 0 && (
                <div className="text-xs text-slate-500 space-y-1">
                  {passwordStrength.suggestions.map((suggestion, idx) => (
                    <p key={idx}>• {suggestion}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Repite tu contraseña"
              {...register("confirmPassword")}
              className="transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500 pr-10"
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
            <p className="text-sm text-red-500">
              {errors.confirmPassword.message}
            </p>
          )}

          {/* Indicador de coincidencia */}
          {confirmPassword && (
            <div
              className={`text-xs flex items-center gap-1 ${passwordMatch ? "text-green-600" : "text-red-500"}`}
            >
              {passwordMatch ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Las contraseñas coinciden
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Las contraseñas no coinciden
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button
          type="submit"
          className="w-full md:w-auto bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white shadow-lg transform active:scale-95 transition-all"
        >
          Siguiente: Documentación
        </Button>
      </div>
    </motion.form>
  );
}

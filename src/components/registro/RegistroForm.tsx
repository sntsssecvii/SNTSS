"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import StepInfo from "./StepInfo";
import StepDocs from "./StepDocs";
import StepSuccess from "./StepSuccess";
import type { RegistroFormData } from "@/lib/schemas/registro";

export default function RegistroForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<RegistroFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInfoSubmit = (data: Partial<RegistroFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(2);
  };

  const handleDocsSubmit = async (files: {
    identificacion: File;
    tarjeton: File;
    constanciaAfiliacion: File;
  }) => {
    if (!formData.email || !formData.password || !formData.matricula) {
      toast({
        title: "Error de datos",
        description: "Falta información del paso anterior.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.set("nombre", formData.nombre || "");
      payload.set("apellidoPaterno", formData.apellidoPaterno || "");
      payload.set("apellidoMaterno", formData.apellidoMaterno || "");
      payload.set("matricula", formData.matricula || "");
      payload.set("email", formData.email || "");
      payload.set("password", formData.password || "");
      payload.set("confirmPassword", formData.confirmPassword || "");
      payload.set("identificacion", files.identificacion);
      payload.set("tarjeton", files.tarjeton);
      payload.set("constanciaAfiliacion", files.constanciaAfiliacion);

      const response = await fetch("/api/registro", {
        method: "POST",
        body: payload,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Ocurrió un error inesperado.");
      }

      toast({
        title: "Registro Exitoso",
        description:
          result?.warning || "Tu solicitud ha sido enviada para validación.",
      });

      setStep(3); // Mostrar pantalla de éxito
    } catch (error: any) {
      let msg = error.message || "Ocurrió un error inesperado.";

      toast({
        title: "Error al registrar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white/95 backdrop-blur-sm dark:bg-slate-900/90 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
      {/* Progress Bar */}
      <div className="h-2 bg-slate-100 w-full relative">
        <motion.div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 to-red-800"
          initial={{ width: "0%" }}
          animate={{ width: step === 1 ? "50%" : "100%" }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="p-8 md:p-10">
        <div className="mb-8 text-center">
          <motion.h2
            key={step}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-700 to-red-900 dark:from-red-400 dark:to-red-600"
          >
            {step === 1
              ? "Información Personal"
              : step === 2
                ? "Documentación"
                : "¡Todo listo!"}
          </motion.h2>
          <p className="text-slate-500 text-sm mt-2">
            {step <= 2 ? `Paso ${step} de 2` : "Registro completado"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <StepInfo
              key="step1"
              onNext={handleInfoSubmit}
              initialData={formData}
            />
          ) : step === 2 ? (
            <StepDocs
              key="step2"
              onBack={() => setStep(1)}
              onSubmit={handleDocsSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <StepSuccess key="step3" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

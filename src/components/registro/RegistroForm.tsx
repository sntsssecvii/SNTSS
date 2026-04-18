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
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState<Partial<RegistroFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInfoSubmit = (data: Partial<RegistroFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setDirection(1);
    setStep(2);
  };

  const handleBack = () => {
    setDirection(-1);
    setStep(1);
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

      setDirection(1);
      setStep(3);
    } catch (error: any) {
      toast({
        title: "Error al registrar",
        description: error.message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const heroTitle =
    step === 1
      ? "Datos personales"
      : step === 2
        ? "Documentos requeridos"
        : "Registro completado";

  return (
    <div className="w-full bg-white overflow-hidden">
      {/* Hero compacto */}
      <div
        className="px-4 py-3 min-h-[64px] flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, #CC1B1B 0%, #7F0000 100%)",
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
            SNTSS · Sección VII
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-bold text-white"
            >
              {heroTitle}
            </motion.p>
          </AnimatePresence>
        </div>
        {step <= 2 && (
          <div className="flex gap-1 flex-shrink-0">
            {[1, 2].map((s) => (
              <motion.div
                key={s}
                className="h-0.5 w-5 rounded-full"
                animate={{
                  backgroundColor:
                    step >= s ? "#ffffff" : "rgba(255,255,255,0.3)",
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contenido del paso */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ x: direction * 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction * -40, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {step === 1 ? (
            <StepInfo onNext={handleInfoSubmit} initialData={formData} />
          ) : step === 2 ? (
            <StepDocs
              onBack={handleBack}
              onSubmit={handleDocsSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <StepSuccess />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, getStorageTools } from "@/lib/firebase/firebase-client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAdmins } from "@/lib/firebase/users";
import { createNotification } from "@/lib/firebase/notifications";
import { sendRegistrationEmail } from "@/lib/email";
import StepInfo from "./StepInfo";
import StepDocs from "./StepDocs";
import StepSuccess from "./StepSuccess";
import type { RegistroFormData } from "@/lib/schemas/registro";

export default function RegistroForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<RegistroFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { setCreatingUser } = useAuth();

  const handleInfoSubmit = (data: Partial<RegistroFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(2);
  };

  const handleDocsSubmit = async (files: {
    identificacion: File;
    tarjeton: File;
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
    setCreatingUser(true);

    try {
      // 0. Cargar herramientas de Storage dinámicamente
      const tools = await getStorageTools();
      if (!tools) {
        throw new Error(
          "El servicio de almacenamiento no está disponible actualmente.",
        );
      }
      const { storage, ref, uploadBytes, getDownloadURL } = tools;

      // 1. Crear usuario en Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email!,
        formData.password!,
      );
      const user = userCredential.user;

      // Actualizar perfil básico
      await updateProfile(user, {
        displayName: `${formData.nombre} ${formData.apellidoPaterno} ${formData.apellidoMaterno}`,
      });

      // 2. Subir Archivos a Storage
      const uploadFile = async (file: File, type: string) => {
        const ext = file.name.split(".").pop();
        const path = `uploads/${user.uid}/${type}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        return url;
      };

      const idUrl = await uploadFile(files.identificacion, "identificacion");
      const tarjetonUrl = await uploadFile(files.tarjeton, "tarjeton");

      // 3. Guardar en Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        nombre: formData.nombre,
        apellidoPaterno: formData.apellidoPaterno,
        apellidoMaterno: formData.apellidoMaterno,
        matricula: formData.matricula,
        email: formData.email,
        role: "user",
        status: "pending",
        documents: {
          identificacion: idUrl,
          tarjeton: tarjetonUrl,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3.1 Notificar a los administradores (In-App)
      try {
        const admins = await getAdmins();
        const notificationPromises = admins.map((admin) =>
          createNotification({
            userId: admin.id,
            title: "Nuevo Registro Pendiente",
            message: `El usuario ${formData.nombre} ${formData.apellidoPaterno} se ha registrado y espera validación.`,
            type: "registration",
            link: "/admin/validaciones",
          }),
        );
        await Promise.all(notificationPromises);
      } catch (notifyError) {
        console.error(
          "⚠️ [Registro] Error enviando notificación interna:",
          notifyError,
        );
      }

      // 3.2 Enviar correo de confirmación al usuario
      try {
        await sendRegistrationEmail(formData.email!, formData.nombre!);
      } catch (emailError) {
        console.error(
          "⚠️ [Registro] Error enviando correo de confirmación:",
          emailError,
        );
      }

      // 4. CERRAR SESIÓN (Best Practice)
      // Esto evita que Firebase nos autologuee y nos mande al dashboard
      // antes de que el administrador nos valide.
      await signOut(auth);

      toast({
        title: "Registro Exitoso",
        description: "Tu solicitud ha sido enviada para validación.",
      });

      setStep(3); // Mostrar pantalla de éxito
    } catch (error: any) {
      console.error("❌ [Registro] Error crítico:", error);
      let msg = error.message || "Ocurrió un error inesperado.";
      if (error.code === "auth/email-already-in-use")
        msg = "Este correo ya está registrado.";
      if (error.code === "auth/weak-password")
        msg = "La contraseña es muy debil.";

      toast({
        title: "Error al registrar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setCreatingUser(false);
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

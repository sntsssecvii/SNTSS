"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  ScanLine,
} from "lucide-react";
import { optimizeImage } from "@/lib/utils/image-optimization";
import { cn } from "@/lib/utils";
import DocumentScannerSheet from "./DocumentScannerSheet";

interface StepDocsProps {
  onBack: () => void;
  onSubmit: (files: {
    identificacion: File;
    tarjeton: File;
    constanciaAfiliacion: File;
  }) => void;
  isSubmitting: boolean;
}

// Para imágenes se comprime client-side a ~1MB, así que el límite de entrada
// puede ser mayor. El servidor igual valida a 5MB como tope de seguridad.
const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — cubre fotos de iPhone/Android
const MAX_PDF_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — PDFs no se comprimen
const ALLOWED_REGISTRATION_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export default function StepDocs({
  onBack,
  onSubmit,
  isSubmitting,
}: StepDocsProps) {
  const [identificacion, setIdentificacion] = useState<File | null>(null);
  const [tarjeton, setTarjeton] = useState<File | null>(null);
  const [constanciaAfiliacion, setConstanciaAfiliacion] = useState<File | null>(
    null,
  );
  const [errors, setErrors] = useState<{
    identificacion?: string;
    tarjeton?: string;
    constanciaAfiliacion?: string;
  }>({});
  const [processing, setProcessing] = useState<{ [key: string]: boolean }>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<{
    type: "identificacion" | "tarjeton" | "constanciaAfiliacion";
    label: string;
  } | null>(null);

  const idInputRef = useRef<HTMLInputElement>(null);
  const tarjetonInputRef = useRef<HTMLInputElement>(null);
  const constanciaInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "identificacion" | "tarjeton" | "constanciaAfiliacion",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const isHeicByExtension =
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif");
    const isAllowed =
      ALLOWED_REGISTRATION_FILE_TYPES.includes(file.type) || isHeicByExtension;
    if (!isAllowed) {
      setErrors((prev) => ({
        ...prev,
        [type]: "Solo se aceptan imágenes JPG, PNG, HEIC o archivos PDF.",
      }));
      return;
    }

    const maxSize =
      file.type === "application/pdf"
        ? MAX_PDF_FILE_SIZE_BYTES
        : MAX_IMAGE_FILE_SIZE_BYTES;

    if (file.size <= 0 || file.size > maxSize) {
      const limitLabel = file.type === "application/pdf" ? "5 MB" : "20 MB";
      setErrors((prev) => ({
        ...prev,
        [type]: `El archivo es demasiado grande. Máximo ${limitLabel}.`,
      }));
      return;
    }

    setProcessing((prev) => ({ ...prev, [type]: true }));
    setErrors((prev) => ({ ...prev, [type]: undefined }));

    try {
      let finalFile = file;
      // Optimizar si es imagen
      if (file.type.startsWith("image/")) {
        finalFile = await optimizeImage(file);
      }

      if (type === "identificacion") setIdentificacion(finalFile);
      else if (type === "tarjeton") setTarjeton(finalFile);
      else setConstanciaAfiliacion(finalFile);
    } catch (error) {
      console.error("Error optimizando", error);
      setErrors((prev) => ({
        ...prev,
        [type]: "Error al procesar el archivo",
      }));
    } finally {
      setProcessing((prev) => ({ ...prev, [type]: false }));
    }
  };

  const openScanner = (
    type: "identificacion" | "tarjeton" | "constanciaAfiliacion",
    label: string,
  ) => {
    setScannerTarget({ type, label });
    setScannerOpen(true);
  };

  const handleScanCapture = async (file: File) => {
    if (!scannerTarget) return;
    const { type } = scannerTarget;

    setProcessing((prev) => ({ ...prev, [type]: true }));
    setErrors((prev) => ({ ...prev, [type]: undefined }));

    try {
      // Las imágenes escaneadas también se comprimen/optimizan
      const optimized = await optimizeImage(file);
      if (type === "identificacion") setIdentificacion(optimized);
      else if (type === "tarjeton") setTarjeton(optimized);
      else setConstanciaAfiliacion(optimized);
    } catch {
      if (type === "identificacion") setIdentificacion(file);
      else if (type === "tarjeton") setTarjeton(file);
      else setConstanciaAfiliacion(file);
    } finally {
      setProcessing((prev) => ({ ...prev, [type]: false }));
      setScannerOpen(false);
      setScannerTarget(null);
    }
  };

  const handleSubmit = () => {
    const newErrors: {
      identificacion?: string;
      tarjeton?: string;
      constanciaAfiliacion?: string;
    } = {};
    if (!identificacion)
      newErrors.identificacion = "Debes subir tu identificación";
    if (!tarjeton) newErrors.tarjeton = "Debes subir tu tarjetón de pago";
    if (!constanciaAfiliacion)
      newErrors.constanciaAfiliacion =
        "Debes subir tu constancia de afiliación";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (identificacion && tarjeton && constanciaAfiliacion) {
      onSubmit({ identificacion, tarjeton, constanciaAfiliacion });
    }
  };

  const FileCard = ({
    file,
    type,
    label,
    inputRef,
    error,
    isProcessing,
  }: {
    file: File | null;
    type: "identificacion" | "tarjeton" | "constanciaAfiliacion";
    label: string;
    inputRef: React.RefObject<HTMLInputElement>;
    error?: string;
    isProcessing: boolean;
  }) => (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-6 transition-all duration-300 relative group",
        error
          ? "border-red-300 bg-red-50/50"
          : file
            ? "border-green-500/50 bg-green-50/30"
            : "border-slate-200 hover:border-red-400 hover:bg-slate-50",
      )}
    >
      <input
        type="file"
        ref={inputRef}
        onChange={(e) => handleFileChange(e, type)}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf"
      />

      <div className="flex flex-col items-center justify-center text-center space-y-3">
        {isProcessing ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full"
          />
        ) : file ? (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium text-slate-900 line-clamp-1 max-w-[200px]">
                {file.name}
              </p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (type === "identificacion") setIdentificacion(null);
                else if (type === "tarjeton") setTarjeton(null);
                else setConstanciaAfiliacion(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-1" /> Remover
            </Button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium text-slate-900">{label}</p>
              <p className="text-xs text-slate-500 mt-1">
                JPG, PNG, HEIC o PDF · Imágenes hasta 20MB, PDF hasta 5MB
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              <Button
                type="button"
                onClick={() => openScanner(type, label)}
                className="w-full bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                <ScanLine className="w-4 h-4" />
                Escanear con cámara
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Subir archivo
              </Button>
            </div>
          </>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-6 left-0 right-0 text-center"
        >
          <span className="text-xs text-red-500 flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" /> {error}
          </span>
        </motion.div>
      )}
    </div>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-8"
      >
        <div className="space-y-2 text-center">
          <h3 className="text-lg font-semibold text-slate-900">
            Documentación Requerida
          </h3>
          <p className="text-sm text-slate-500">
            Sube tus documentos para validar tu identidad. Los archivos serán
            optimizados automáticamente.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <FileCard
            file={identificacion}
            type="identificacion"
            label="Identificación Oficial (INE/IFE)"
            inputRef={idInputRef}
            error={errors.identificacion}
            isProcessing={processing.identificacion || false}
          />
          <FileCard
            file={tarjeton}
            type="tarjeton"
            label="Tarjetón de Pago Reciente"
            inputRef={tarjetonInputRef}
            error={errors.tarjeton}
            isProcessing={processing.tarjeton || false}
          />
        </div>

        <div className="grid gap-8 md:grid-cols-1 max-w-sm mx-auto w-full">
          <FileCard
            file={constanciaAfiliacion}
            type="constanciaAfiliacion"
            label="Constancia de Afiliación Sindical"
            inputRef={constanciaInputRef}
            error={errors.constanciaAfiliacion}
            isProcessing={processing.constanciaAfiliacion || false}
          />
        </div>

        <div className="flex flex-col-reverse md:flex-row justify-between gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
          >
            Atrás
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              processing.identificacion ||
              processing.tarjeton ||
              processing.constanciaAfiliacion
            }
            className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white shadow-lg relative overflow-hidden"
          >
            {isSubmitting ? (
              <>
                <motion.div
                  className="absolute inset-0 bg-white/20"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
                Procesando Registro...
              </>
            ) : (
              "Finalizar Registro"
            )}
          </Button>
        </div>
      </motion.div>

      {/* Scanner fullscreen */}
      {scannerOpen && (
        <DocumentScannerSheet
          open={scannerOpen}
          onClose={() => {
            setScannerOpen(false);
            setScannerTarget(null);
          }}
          onCapture={handleScanCapture}
          documentLabel={scannerTarget?.label ?? "Documento"}
        />
      )}
    </>
  );
}

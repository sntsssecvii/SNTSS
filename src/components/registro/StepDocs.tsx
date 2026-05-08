"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, ScanLine } from "lucide-react";
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

const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
// PDFs no se comprimen en cliente — límite conservador para que 3 archivos
// no superen el límite de body de Vercel (~4.5 MB total).
const MAX_PDF_FILE_SIZE_BYTES = 1.4 * 1024 * 1024;
// Límite máximo por archivo después de procesar (incluye imágenes comprimidas).
const MAX_PROCESSED_FILE_SIZE_BYTES = 1.4 * 1024 * 1024;
const ALLOWED_REGISTRATION_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

type DocType = "identificacion" | "tarjeton" | "constanciaAfiliacion";

interface DocCardProps {
  index: number;
  label: string;
  file: File | null;
  type: DocType;
  inputRef: React.RefObject<HTMLInputElement>;
  error?: string;
  isProcessing: boolean;
  onScan: () => void;
  onFileClick: () => void;
  onClear: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: DocType) => void;
}

function DocCard({
  index,
  label,
  file,
  type,
  inputRef,
  error,
  isProcessing,
  onScan,
  onFileClick,
  onClear,
  onFileChange,
}: DocCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors duration-200",
        error
          ? "border-red-300 bg-red-50/40"
          : file
            ? "border-emerald-400 bg-emerald-50/30"
            : "border-slate-200 bg-white",
      )}
    >
      <input
        type="file"
        ref={inputRef}
        onChange={(e) => onFileChange(e, type)}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf"
      />

      {isProcessing ? (
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-red-600 border-t-transparent animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Procesando...
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        </div>
      ) : file ? (
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{label}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-slate-400 hover:text-red-500 flex-shrink-0 text-xs"
          >
            Cambiar
          </Button>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{index}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                JPG, PNG, HEIC o PDF
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={onScan}
              className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold gap-1.5"
            >
              <ScanLine className="w-3.5 h-3.5" />
              Escanear
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onFileClick}
              className="flex-1 h-9 border-slate-200 text-slate-600 text-xs font-medium gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Archivo
            </Button>
          </div>
        </div>
      )}

      {error && (
        <AnimatePresence>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pb-3 text-xs text-red-500 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" />
            {error}
          </motion.p>
        </AnimatePresence>
      )}
    </div>
  );
}

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
  const [errors, setErrors] = useState<Partial<Record<DocType, string>>>({});
  const [processing, setProcessing] = useState<
    Partial<Record<DocType, boolean>>
  >({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<{
    type: DocType;
    label: string;
  } | null>(null);

  const idInputRef = useRef<HTMLInputElement>(null);
  const tarjetonInputRef = useRef<HTMLInputElement>(null);
  const constanciaInputRef = useRef<HTMLInputElement>(null);

  const setFile = (type: DocType, file: File | null) => {
    if (type === "identificacion") setIdentificacion(file);
    else if (type === "tarjeton") setTarjeton(file);
    else setConstanciaAfiliacion(file);
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: DocType,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      const limitLabel = file.type === "application/pdf" ? "1.4 MB" : "20 MB";
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
      if (file.type.startsWith("image/")) {
        finalFile = await optimizeImage(file);
      }
      if (finalFile.size > MAX_PROCESSED_FILE_SIZE_BYTES) {
        setErrors((prev) => ({
          ...prev,
          [type]:
            "El archivo es demasiado grande incluso después de comprimirlo. Máximo 1.4 MB por documento.",
        }));
        return;
      }
      setFile(type, finalFile);
    } catch {
      setErrors((prev) => ({
        ...prev,
        [type]: "Error al procesar el archivo",
      }));
    } finally {
      setProcessing((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleScanCapture = async (file: File) => {
    if (!scannerTarget) return;
    const { type } = scannerTarget;

    setProcessing((prev) => ({ ...prev, [type]: true }));
    setErrors((prev) => ({ ...prev, [type]: undefined }));

    try {
      const optimized = await optimizeImage(file);
      setFile(type, optimized);
    } catch {
      setFile(type, file);
    } finally {
      setProcessing((prev) => ({ ...prev, [type]: false }));
      setScannerOpen(false);
      setScannerTarget(null);
    }
  };

  const handleSubmit = () => {
    const newErrors: Partial<Record<DocType, string>> = {};
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

  const allReady = !!(identificacion && tarjeton && constanciaAfiliacion);
  const anyProcessing = !!(
    processing.identificacion ||
    processing.tarjeton ||
    processing.constanciaAfiliacion
  );

  return (
    <>
      <div className="px-5 py-6 space-y-3">
        <DocCard
          index={1}
          label="Identificación Oficial (INE/IFE)"
          type="identificacion"
          file={identificacion}
          inputRef={idInputRef}
          error={errors.identificacion}
          isProcessing={processing.identificacion || false}
          onScan={() => {
            setScannerTarget({
              type: "identificacion",
              label: "Identificación Oficial (INE/IFE)",
            });
            setScannerOpen(true);
          }}
          onFileClick={() => idInputRef.current?.click()}
          onClear={() => {
            setIdentificacion(null);
            if (idInputRef.current) idInputRef.current.value = "";
          }}
          onFileChange={handleFileChange}
        />
        <DocCard
          index={2}
          label="Tarjetón de Pago Reciente"
          type="tarjeton"
          file={tarjeton}
          inputRef={tarjetonInputRef}
          error={errors.tarjeton}
          isProcessing={processing.tarjeton || false}
          onScan={() => {
            setScannerTarget({
              type: "tarjeton",
              label: "Tarjetón de Pago Reciente",
            });
            setScannerOpen(true);
          }}
          onFileClick={() => tarjetonInputRef.current?.click()}
          onClear={() => {
            setTarjeton(null);
            if (tarjetonInputRef.current) tarjetonInputRef.current.value = "";
          }}
          onFileChange={handleFileChange}
        />
        <DocCard
          index={3}
          label="Constancia de Afiliación Sindical"
          type="constanciaAfiliacion"
          file={constanciaAfiliacion}
          inputRef={constanciaInputRef}
          error={errors.constanciaAfiliacion}
          isProcessing={processing.constanciaAfiliacion || false}
          onScan={() => {
            setScannerTarget({
              type: "constanciaAfiliacion",
              label: "Constancia de Afiliación Sindical",
            });
            setScannerOpen(true);
          }}
          onFileClick={() => constanciaInputRef.current?.click()}
          onClear={() => {
            setConstanciaAfiliacion(null);
            if (constanciaInputRef.current)
              constanciaInputRef.current.value = "";
          }}
          onFileChange={handleFileChange}
        />

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className="border-slate-200 text-slate-600 h-12 px-5"
          >
            Atrás
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !allReady || anyProcessing}
            className="flex-1 h-12 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold rounded-xl"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              "Finalizar registro"
            )}
          </Button>
        </div>
      </div>

      {scannerOpen && (
        <DocumentScannerSheet
          open={scannerOpen}
          onClose={() => {
            setScannerOpen(false);
            setScannerTarget(null);
          }}
          onCapture={handleScanCapture}
          documentLabel={scannerTarget?.label ?? "Documento"}
          documentType={scannerTarget?.type}
        />
      )}
    </>
  );
}

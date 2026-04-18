"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  RotateCcw,
  CheckCircle2,
  Loader2,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadOpenCV } from "@/lib/utils/opencv-loader";

interface DocumentScannerSheetProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  documentLabel: string;
}

type Phase = "loading" | "camera" | "preview" | "error";

const DETECTION_FPS = 10;
const DETECTION_INTERVAL_MS = 1000 / DETECTION_FPS;

export default function DocumentScannerSheet({
  open,
  onClose,
  onCapture,
  documentLabel,
}: DocumentScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastProcessRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadingMsg, setLoadingMsg] = useState("Iniciando...");
  const [errorMsg, setErrorMsg] = useState("");
  const [documentDetected, setDocumentDetected] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = displayCanvasRef.current;
    if (!video || !canvas || !scannerRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (timestamp: number) => {
      if (video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Sync canvas size to video
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight)
        canvas.height = video.videoHeight;

      const shouldProcess =
        timestamp - lastProcessRef.current >= DETECTION_INTERVAL_MS;

      if (shouldProcess) {
        lastProcessRef.current = timestamp;

        // Dibuja frame actual en canvas temporal para detección
        const tmp = document.createElement("canvas");
        tmp.width = video.videoWidth;
        tmp.height = video.videoHeight;
        tmp.getContext("2d")!.drawImage(video, 0, 0);

        try {
          const highlighted = scannerRef.current.highlightPaper(tmp);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(highlighted, 0, 0);
          setDocumentDetected(true);
        } catch {
          // Sin detección — muestra el frame limpio
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0);
          setDocumentDetected(false);
        }
      } else {
        // Entre detecciones: solo redibuja el video para que se vea fluido
        ctx.drawImage(video, 0, 0);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const initScanner = useCallback(async () => {
    setPhase("loading");
    setDocumentDetected(false);
    setPreviewUrl(null);
    setCapturedBlob(null);

    try {
      setLoadingMsg("Cargando motor de escaneo...");
      await loadOpenCV();

      setLoadingMsg("Iniciando cámara...");
      const jscanifyModule = await import("jscanify/client");
      const jscanify = jscanifyModule.default ?? jscanifyModule;
      scannerRef.current = new (jscanify as any)();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setPhase("camera");
      startDetectionLoop();
    } catch (err: any) {
      const msg = err?.message || "";
      if (
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("denied")
      ) {
        setErrorMsg(
          "Permiso de cámara denegado. Habilítalo en la configuración del navegador.",
        );
      } else if (
        msg.toLowerCase().includes("opencv") ||
        msg.toLowerCase().includes("cargar")
      ) {
        setErrorMsg(
          "No se pudo cargar el motor de escaneo. Verifica tu conexión.",
        );
      } else {
        setErrorMsg("No se pudo iniciar la cámara.");
      }
      setPhase("error");
    }
  }, [startDetectionLoop]);

  // Abrir/cerrar
  useEffect(() => {
    if (open) {
      initScanner();
    } else {
      stopCamera();
      setPhase("loading");
      setPreviewUrl(null);
      setCapturedBlob(null);
    }
    return () => stopCamera();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !scannerRef.current) return;

    // Parar el loop de detección
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const tmp = document.createElement("canvas");
    tmp.width = video.videoWidth;
    tmp.height = video.videoHeight;
    tmp.getContext("2d")!.drawImage(video, 0, 0);

    let resultCanvas: HTMLCanvasElement;
    try {
      resultCanvas = scannerRef.current.extractPaper(
        tmp,
        video.videoWidth,
        video.videoHeight,
      );
    } catch {
      resultCanvas = tmp; // sin corrección si falla
    }

    resultCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setPreviewUrl(resultCanvas.toDataURL("image/jpeg", 0.92));
        setPhase("preview");
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  }, [stopCamera]);

  const handleConfirm = useCallback(() => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `scan_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file);
    onClose();
  }, [capturedBlob, onCapture, onClose]);

  const handleRetry = useCallback(() => {
    initScanner();
  }, [initScanner]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-red-400" />
          <span className="text-white text-sm font-semibold truncate max-w-[220px]">
            {documentLabel}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Cargando */}
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black"
            >
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              <p className="text-white/60 text-sm">{loadingMsg}</p>
              <p className="text-white/30 text-xs max-w-[240px] text-center">
                La primera vez puede tardar unos segundos mientras carga el
                motor de visión
              </p>
            </motion.div>
          )}

          {/* Cámara activa */}
          {phase === "camera" && (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {/* Video oculto — fuente de frames */}
              <video
                ref={videoRef}
                className="hidden"
                playsInline
                muted
                autoPlay
              />

              {/* Canvas con video + detección */}
              <canvas
                ref={displayCanvasRef}
                className="w-full h-full object-contain"
              />

              {/* Indicador de detección */}
              <div className="absolute top-14 left-1/2 -translate-x-1/2">
                <motion.div
                  animate={
                    documentDetected
                      ? { backgroundColor: "rgba(16,185,129,0.9)", scale: 1 }
                      : {
                          backgroundColor: "rgba(255,255,255,0.15)",
                          scale: 0.97,
                        }
                  }
                  transition={{ duration: 0.3 }}
                  className="px-3 py-1.5 rounded-full flex items-center gap-1.5"
                >
                  <ScanLine className="w-3.5 h-3.5 text-white" />
                  <span className="text-white text-xs font-semibold">
                    {documentDetected
                      ? "Documento detectado"
                      : "Apunta al documento"}
                  </span>
                </motion.div>
              </div>

              {/* Guía de encuadre */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[75%] h-[55%] relative">
                  {/* Esquinas */}
                  {[
                    "top-0 left-0 border-t-2 border-l-2",
                    "top-0 right-0 border-t-2 border-r-2",
                    "bottom-0 left-0 border-b-2 border-l-2",
                    "bottom-0 right-0 border-b-2 border-r-2",
                  ].map((cls, i) => (
                    <div
                      key={i}
                      className={`absolute w-6 h-6 ${cls} ${documentDetected ? "border-emerald-400" : "border-white/50"} transition-colors duration-300`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Preview del escaneo */}
          {phase === "preview" && previewUrl && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black flex items-center justify-center p-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Documento escaneado"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
              <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-emerald-500/90 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span className="text-white text-xs font-semibold">
                  Corrección de perspectiva aplicada
                </span>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black px-8"
            >
              <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                <X className="w-7 h-7 text-red-400" />
              </div>
              <p className="text-white/70 text-sm text-center leading-relaxed">
                {errorMsg}
              </p>
              <Button
                variant="outline"
                onClick={handleRetry}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Reintentar
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer con acciones */}
      <div className="shrink-0 px-6 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent absolute bottom-0 left-0 right-0">
        <AnimatePresence mode="wait">
          {phase === "camera" && (
            <motion.div
              key="capture-btn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex justify-center"
            >
              <button
                onClick={handleCapture}
                className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-white border-[3px] border-white/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shadow-xl"
              >
                <Camera className="w-7 h-7 text-black" />
              </button>
            </motion.div>
          )}

          {phase === "preview" && (
            <motion.div
              key="preview-btns"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex gap-3"
            >
              <Button
                variant="outline"
                onClick={handleRetry}
                className="flex-1 border-white/20 text-white hover:bg-white/10 gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Repetir
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Usar esta foto
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

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

interface DocumentScannerSheetProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  documentLabel: string;
  documentType?: "identificacion" | "tarjeton" | "constanciaAfiliacion";
}

type Phase = "loading" | "camera" | "preview" | "error";

export default function DocumentScannerSheet({
  open,
  onClose,
  onCapture,
  documentLabel,
  documentType = "identificacion",
}: DocumentScannerSheetProps) {
  // INE es horizontal (landscape). Tarjetón y constancia son verticales (portrait, tamaño carta)
  const isPortrait =
    documentType === "constanciaAfiliacion" || documentType === "tarjeton";
  const guideStyle = isPortrait
    ? { top: "10%", bottom: "10%", left: "18%", right: "18%" }
    : { top: "22%", bottom: "22%", left: "8%", right: "8%" };
  const videoRef = useRef<HTMLVideoElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
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

  const startRenderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = displayCanvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      if (video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const cw = canvas.parentElement?.clientWidth || canvas.clientWidth;
      const ch = canvas.parentElement?.clientHeight || canvas.clientHeight;
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.min(cw / vw, ch / vh);
      const dx = (cw - vw * scale) / 2;
      const dy = (ch - vh * scale) / 2;

      ctx.drawImage(video, dx, dy, vw * scale, vh * scale);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (phase === "camera") {
      startRenderLoop();
    }
  }, [phase, startRenderLoop]);

  const initCamera = useCallback(async () => {
    setPhase("loading");
    setPreviewUrl(null);
    setCapturedBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0) return resolve();
        video.addEventListener("loadedmetadata", () => resolve(), {
          once: true,
        });
      });
      await video.play();

      setPhase("camera");
    } catch (err: any) {
      const name = err?.name || "";
      const msg = err?.message || "";
      const detail = `[${name}] ${msg}`;
      if (
        name === "NotAllowedError" ||
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("denied")
      ) {
        setErrorMsg(
          `Permiso de cámara denegado. Habilítalo en la configuración del navegador. (${detail})`,
        );
      } else if (name === "NotReadableError" || name === "AbortError") {
        setErrorMsg(
          `La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo. (${detail})`,
        );
      } else {
        setErrorMsg(`No se pudo iniciar la cámara. (${detail})`);
      }
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (open) {
      initCamera();
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
    if (!video) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const tmp = document.createElement("canvas");
    tmp.width = video.videoWidth;
    tmp.height = video.videoHeight;
    tmp.getContext("2d")!.drawImage(video, 0, 0);

    tmp.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setPreviewUrl(tmp.toDataURL("image/jpeg", 0.92));
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
    initCamera();
  }, [initCamera]);

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
        <video
          ref={videoRef}
          className="absolute opacity-0 pointer-events-none w-px h-px"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={displayCanvasRef}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
            phase === "camera" ? "opacity-100" : "opacity-0"
          }`}
        />

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
              <p className="text-white/60 text-sm">Iniciando cámara...</p>
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
              {/* Overlay oscuro con recorte — guía adaptada al tipo de documento */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* Franja superior */}
                <div
                  className="absolute top-0 left-0 right-0 bg-black/60"
                  style={{ height: guideStyle.top }}
                />
                {/* Franja inferior */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-black/60"
                  style={{ height: guideStyle.bottom }}
                />
                {/* Franja izquierda */}
                <div
                  className="absolute left-0 bg-black/60"
                  style={{
                    top: guideStyle.top,
                    bottom: guideStyle.bottom,
                    width: guideStyle.left,
                  }}
                />
                {/* Franja derecha */}
                <div
                  className="absolute right-0 bg-black/60"
                  style={{
                    top: guideStyle.top,
                    bottom: guideStyle.bottom,
                    width: guideStyle.right,
                  }}
                />

                {/* Marco de la zona de captura */}
                <div className="absolute" style={guideStyle}>
                  {/* Esquinas prominentes */}
                  {[
                    "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-md",
                    "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-md",
                    "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-md",
                    "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-md",
                  ].map((cls, i) => (
                    <div
                      key={i}
                      className={`absolute w-8 h-8 ${cls} border-white`}
                    />
                  ))}
                  {/* Línea de escaneo animada */}
                  <motion.div
                    className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-red-400 to-transparent"
                    animate={{ top: ["8%", "88%", "8%"] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              </div>

              {/* Instrucción */}
              <div className="absolute top-[14%] left-1/2 -translate-x-1/2 z-20 w-full flex justify-center">
                <div className="bg-black/60 px-4 py-2 rounded-full flex items-center gap-2">
                  <ScanLine className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-white text-xs font-semibold whitespace-nowrap">
                    Coloca el documento dentro del marco
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Preview */}
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
                alt="Documento capturado"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
              <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-emerald-500/90 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span className="text-white text-xs font-semibold">
                  Foto capturada
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
                className="border-white/20 text-white bg-transparent hover:bg-white/10"
              >
                Reintentar
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
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
                className="w-[72px] h-[72px] rounded-full bg-white border-[3px] border-white/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shadow-xl"
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
                className="flex-1 border-white/20 text-white bg-transparent hover:bg-white/10 gap-2"
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

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase/firebase-client";
import type {
  TipoBolsaDeTrabajo,
  Sincronizacion,
} from "@/types/bolsa-de-trabajo";
import {
  NOMBRES_TIPOS,
  detectarTipoDocumentoPorNombre,
} from "@/types/bolsa-de-trabajo";
import { cn } from "@/lib/utils";
import {
  createSincronizacion,
  updateSincronizacion,
  getSincronizacionPorPeriodo,
} from "@/lib/firebase/sincronizaciones";
import { getBolsaDeTrabajoDocumentosBySyncId } from "@/lib/firebase/bolsa-de-trabajo";
import { useRouter, useSearchParams } from "next/navigation";
import { PeriodSelector } from "@/components/bolsa-de-trabajo/PeriodSelector";

interface FileItem {
  id: string;
  file: File;
  tipo: TipoBolsaDeTrabajo | null;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
  documentoId?: string;
  willReplace?: boolean;
}

const MAX_BOLSA_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export function BulkFileUpload() {
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [syncId, setSyncId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [periodo, setPeriodo] = useState({
    anio: Number(searchParams.get("anio")) || new Date().getFullYear(),
    mes: Number(searchParams.get("mes")) || new Date().getMonth() + 1,
    quincena:
      (Number(searchParams.get("quincena")) as 1 | 2) ||
      (new Date().getDate() <= 15 ? 1 : 2),
  });
  const [existingSync, setExistingSync] = useState<Sincronizacion | null>(null);
  const [existingTipos, setExistingTipos] = useState<TipoBolsaDeTrabajo[]>([]);
  const [checkingSync, setCheckingSync] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const tipoPreseleccionado =
    (searchParams.get("tipo") as TipoBolsaDeTrabajo | null) || null;

  const periodoEnCurso = (() => {
    const ahora = new Date();
    return (
      periodo.anio === ahora.getFullYear() &&
      periodo.mes === ahora.getMonth() + 1 &&
      periodo.quincena === (ahora.getDate() <= 15 ? 1 : 2)
    );
  })();

  useEffect(() => {
    const revisarQuincena = async () => {
      if (syncId) return;
      try {
        setCheckingSync(true);
        const sync = await getSincronizacionPorPeriodo(
          periodo.anio,
          periodo.mes,
          periodo.quincena as 1 | 2,
        );
        setExistingSync(sync);
        if (sync?.id) {
          const documentos = await getBolsaDeTrabajoDocumentosBySyncId(sync.id);
          setExistingTipos(documentos.map((doc) => doc.tipo));
        } else {
          setExistingTipos([]);
        }
      } catch (error) {
        console.error(error);
        setExistingSync(null);
        setExistingTipos([]);
      } finally {
        setCheckingSync(false);
      }
    };

    revisarQuincena();
  }, [periodo, syncId]);

  const detectType = useCallback(
    (fileName: string): TipoBolsaDeTrabajo | null => {
      return detectarTipoDocumentoPorNombre(fileName);
    },
    [],
  );

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const validFiles = newFiles.filter((f) => {
        const normalizedName = f.name.toLowerCase();
        const isPDF =
          f.type === "application/pdf" || normalizedName.endsWith(".pdf");
        const isExcel =
          EXCEL_MIME_TYPES.includes(f.type) ||
          normalizedName.endsWith(".xlsx") ||
          normalizedName.endsWith(".xls");
        return (
          (isPDF || isExcel) &&
          f.size > 0 &&
          f.size <= MAX_BOLSA_UPLOAD_SIZE_BYTES
        );
      });

      const invalidCount = newFiles.length - validFiles.length;
      if (invalidCount > 0) {
        toast({
          title: "Archivos ignorados",
          description:
            "Solo se aceptan PDFs o Excels del corte quincenal de hasta 25 MB.",
          variant: "destructive",
        });
      }

      const unknownFiles: string[] = [];
      const replacedTypes: string[] = [];

      setFiles((prev) => {
        const next = [...prev];

        for (const file of validFiles) {
          const tipo = detectType(file.name);

          if (!tipo) {
            unknownFiles.push(file.name);
            continue;
          }

          if (tipoPreseleccionado && tipo !== tipoPreseleccionado) {
            unknownFiles.push(file.name);
            continue;
          }

          const newItem: FileItem = {
            id: Math.random().toString(36).substring(7),
            file,
            tipo,
            status: "pending",
            progress: 0,
            willReplace: existingTipos.includes(tipo),
          };

          const existingIndex = next.findIndex((item) => item.tipo === tipo);
          if (existingIndex >= 0) {
            next[existingIndex] = newItem;
            replacedTypes.push(NOMBRES_TIPOS[tipo]);
          } else {
            next.push(newItem);
          }
        }

        return next;
      });

      if (unknownFiles.length > 0) {
        toast({
          title: tipoPreseleccionado
            ? "Archivo fuera del tipo esperado"
            : "Tipo no detectado",
          description: tipoPreseleccionado
            ? `Solo puedes cargar ${NOMBRES_TIPOS[tipoPreseleccionado]} en este flujo dirigido.`
            : `No se agregaron ${unknownFiles.length} archivo(s) porque su nombre no coincide con un tipo oficial.`,
          variant: "destructive",
        });
      }

      if (replacedTypes.length > 0) {
        toast({
          title: "Archivo reemplazado",
          description: `Se reemplazó el archivo previo para: ${replacedTypes.join(", ")}.`,
        });
      }
    },
    [detectType, existingTipos, tipoPreseleccionado, toast],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    },
    [addFiles],
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const resetUploadState = () => {
    setFiles([]);
    setSyncId(null);
    setIsSyncing(false);
  };

  const startBulkUpload = async () => {
    if (!user || files.length === 0) return;

    setIsSyncing(true);

    try {
      // 1. Reutilizar la quincena si ya existe; si no, crearla
      const id =
        existingSync?.id ||
        (await createSincronizacion({
          ...periodo,
          quincena: periodo.quincena as 1 | 2,
          subidoPor: user.uid,
          subidoPorEmail: user.email || "",
          archivosSubidos: [],
        }));
      setSyncId(id);

      // 2. Procesar archivos uno por uno
      const updatedFiles = [...files];
      const docsExitosos: string[] = [];

      for (let i = 0; i < updatedFiles.length; i++) {
        const item = updatedFiles[i];
        try {
          // Actualizar estado a procesando y empezar simulación de progreso
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, status: "processing", progress: 5 }
                : f,
            ),
          );

          // Intervalo para simular progreso (se siente más vivo)
          const progressInterval = setInterval(() => {
            setFiles((prev) =>
              prev.map((f) => {
                if (f.id === item.id && f.progress < 92) {
                  return { ...f, progress: f.progress + Math.random() * 5 };
                }
                return f;
              }),
            );
          }, 800);

          const formData = new FormData();
          formData.append("file", item.file);
          if (item.tipo) formData.append("tipo", item.tipo);
          formData.append("userId", user.uid);
          formData.append("userEmail", user.email || "");
          formData.append("anio", periodo.anio.toString());
          formData.append("mes", periodo.mes.toString());
          formData.append("quincena", periodo.quincena.toString());
          formData.append("syncId", id);

          const idToken = await auth.currentUser?.getIdToken();

          const response = await fetch("/api/bolsa-de-trabajo/procesar", {
            method: "POST",
            body: formData,
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          const result = await response.json();
          clearInterval(progressInterval);

          if (result.success) {
            docsExitosos.push(result.documentoId);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? {
                      ...f,
                      status: "completed",
                      progress: 100,
                      documentoId: result.documentoId,
                      willReplace: Boolean(result.reemplazado),
                    }
                  : f,
              ),
            );
          } else {
            throw new Error(result.error || "Error desconocido");
          }
        } catch (err: any) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: "error",
                    error: err.message,
                    progress: 0,
                  }
                : f,
            ),
          );
        }
      }

      // 3. Actualizar la sincronización con los documentos finalizados
      await updateSincronizacion(id, {
        archivosSubidos: docsExitosos,
        estado: docsExitosos.length === files.length ? "COMPLETADO" : "ERROR",
      });

      if (docsExitosos.length === files.length) {
        toast({
          title: "Sincronización Completa",
          description: `Se han procesado los ${files.length} archivos correctamente.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error en Sincronización",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    if (!syncId || isPublishing) return;
    setIsPublishing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/bolsa-de-trabajo/publicar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ syncId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "No se pudo publicar.");
      }

      toast({
        title: "Publicado",
        description: "Esta quincena ya es la información oficial.",
      });
      router.push("/admin/bolsa-de-trabajo");
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo publicar.",
        variant: "destructive",
      });
      setIsPublishing(false);
    }
  };

  const tiposFaltantes = Object.keys(NOMBRES_TIPOS).filter(
    (t) => !files.some((f) => f.tipo === t),
  ) as TipoBolsaDeTrabajo[];

  const hasUnknownTypes = files.some((f) => !f.tipo);
  const completedCount = files.filter((f) => f.status === "completed").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const canStartUpload =
    syncId === null &&
    files.length > 0 &&
    tiposFaltantes.length === 0 &&
    !hasUnknownTypes &&
    !isSyncing;
  const tiposFaltantesReales = tipoPreseleccionado ? [] : tiposFaltantes;
  const canStartFocusedUpload =
    Boolean(tipoPreseleccionado) &&
    syncId === null &&
    files.length === 1 &&
    !hasUnknownTypes &&
    !isSyncing;
  const canStartAnyUpload = tipoPreseleccionado
    ? canStartFocusedUpload
    : canStartUpload;
  const canPublish =
    Boolean(syncId) &&
    !isSyncing &&
    files.length > 0 &&
    completedCount === files.length &&
    errorCount === 0;

  const totalProgress =
    files.length > 0
      ? Math.round(files.reduce((acc, f) => acc + f.progress, 0) / files.length)
      : 0;

  return (
    <div className="space-y-8">
      {!isSyncing && syncId === null && (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              Paso 1
            </p>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Selecciona la quincena de destino
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Puedes cargar y activar cualquier quincena como oficial.
            </p>
          </div>

          <PeriodSelector
            anio={periodo.anio}
            mes={periodo.mes}
            quincena={periodo.quincena as 1 | 2}
            onChange={setPeriodo}
          />

          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-medium",
              existingSync
                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300"
                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300",
            )}
          >
            {checkingSync
              ? "Revisando si esta quincena ya existe..."
              : existingSync
                ? existingTipos.length > 0
                  ? "Ya existe una quincena para este periodo y ya tiene documentos cargados. Si subes un tipo existente, se reemplazará su documento actual."
                  : "Ya existe una quincena para este periodo, pero todavía no tiene documentos cargados. Puedes comenzar a poblarla ahora."
                : "No existe todavía una quincena para este periodo. Se creará una nueva al iniciar la carga."}
          </div>

          {tipoPreseleccionado && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
              Flujo dirigido al tipo{" "}
              <span className="font-black uppercase">
                {NOMBRES_TIPOS[tipoPreseleccionado]}
              </span>
              . Si subes ese documento en esta quincena, el sistema lo tratará
              como reemplazo del tipo.
            </div>
          )}

          {!periodoEnCurso && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
              Esta no es la quincena en curso. Al publicar, reemplazará la
              quincena oficial actual.
            </div>
          )}
        </div>
      )}

      {/* Global Progress View when Syncing */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-primary/5 border border-primary/10 rounded-3xl p-8 mb-8 overflow-hidden relative"
          >
            <div className="relative z-10 flex flex-col items-center text-center space-y-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-200 dark:text-slate-800"
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="251.2"
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{
                      strokeDashoffset: 251.2 - (251.2 * totalProgress) / 100,
                    }}
                    transition={{ duration: 0.5 }}
                    className="text-primary"
                  />
                </svg>
                <span className="absolute text-2xl font-black text-primary">
                  {totalProgress}%
                </span>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Procesando Quincena
                </h3>
                <p className="text-slate-500 font-medium">
                  Extrayendo datos y validando registros AI...
                </p>
              </div>
            </div>

            {/* Animated Background Pulse */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.2, 0.1],
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-primary/10 blur-3xl pointer-events-none"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Drop Zone */}
      {!isSyncing && syncId === null && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center hover:border-primary/50 transition-all bg-white dark:bg-slate-900/50 group"
        >
          <Upload className="h-16 w-16 text-slate-300 mx-auto mb-4 group-hover:scale-110 group-hover:text-primary transition-all duration-300" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            {tipoPreseleccionado
              ? `Carga dirigida: ${NOMBRES_TIPOS[tipoPreseleccionado]}`
              : "Sincronización Quincenal"}
          </h3>
          <p className="text-slate-500 font-medium mb-2">
            {tipoPreseleccionado
              ? `Arrastra aquí únicamente el archivo de ${NOMBRES_TIPOS[tipoPreseleccionado]}.`
              : "Arrastra aquí los 8 archivos oficiales del corte."}
          </p>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">
            {tipoPreseleccionado
              ? "Este flujo reemplaza o carga sólo un tipo dentro de la quincena seleccionada"
              : "Solo se conserva un archivo por tipo de trámite"}
          </p>
          <input
            type="file"
            multiple={!tipoPreseleccionado}
            accept=".pdf,.xlsx"
            className="hidden"
            id="bulk-upload"
            onChange={(e) => addFiles(Array.from(e.target.files || []))}
          />
          <Button
            asChild
            size="lg"
            className="rounded-2xl font-black h-14 px-8 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
          >
            <label htmlFor="bulk-upload" className="cursor-pointer">
              Seleccionar Archivos
            </label>
          </Button>
        </div>
      )}

      {/* Checklist of required types */}
      {!isSyncing && syncId === null && files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-100/50 dark:bg-slate-800/30 p-6 rounded-3xl border border-slate-200 dark:border-slate-800"
        >
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 text-center">
            {tipoPreseleccionado
              ? `Estado del tipo seleccionado (${files.length > 0 ? "1/1" : "0/1"})`
              : `Estado de Documentación Requerida (${8 - tiposFaltantes.length}/8)`}
          </h4>
          <div
            className={cn(
              "grid gap-2",
              tipoPreseleccionado
                ? "grid-cols-1"
                : "grid-cols-1 sm:grid-cols-2",
            )}
          >
            {(tipoPreseleccionado
              ? [[tipoPreseleccionado, NOMBRES_TIPOS[tipoPreseleccionado]]]
              : Object.entries(NOMBRES_TIPOS)
            ).map(([tipo, nombre]) => {
              const existe = files.some((f) => f.tipo === tipo);
              return (
                <div
                  key={tipo}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-xl text-[10px] font-black uppercase transition-colors",
                    existe
                      ? "bg-emerald-500/10 text-emerald-600 shadow-sm"
                      : "bg-slate-200/50 text-slate-400",
                  )}
                >
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      existe ? "bg-emerald-500 animate-pulse" : "bg-slate-300",
                    )}
                  />
                  {nombre}
                </div>
              );
            })}
          </div>
          {tiposFaltantesReales.length > 0 && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 text-[10px] font-bold text-center">
              Aviso: La quincena requiere {tiposFaltantesReales.length}{" "}
              documentos más para estar completa.
            </div>
          )}
          {(tipoPreseleccionado
            ? files.length === 1
            : tiposFaltantes.length === 0) &&
            !hasUnknownTypes && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-[10px] font-bold text-center">
                {tipoPreseleccionado
                  ? "Documento listo. Ya puedes iniciar el reemplazo o carga del tipo seleccionado."
                  : "Quincena completa. Ya puedes iniciar el procesamiento."}
              </div>
            )}
        </motion.div>
      )}

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">
              Documentos Detectados ({files.length})
            </h4>
            {!isSyncing && syncId === null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                className="text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl"
              >
                Limpiar todo
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {files.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border rounded-2xl transition-all relative overflow-hidden",
                  item.status === "processing"
                    ? "border-primary/50 shadow-lg shadow-primary/5 ring-1 ring-primary/20"
                    : "border-slate-200 dark:border-slate-800",
                )}
              >
                {/* Scanning line animation for processing */}
                {item.status === "processing" && (
                  <motion.div
                    animate={{ y: [0, 100, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20 z-0"
                  />
                )}

                <div className="flex items-center gap-4 relative z-10">
                  <div
                    className={cn(
                      "p-3 rounded-xl transition-all",
                      item.status === "completed"
                        ? "bg-emerald-100 text-emerald-600 scale-110"
                        : item.status === "error"
                          ? "bg-red-100 text-red-600"
                          : item.status === "processing"
                            ? "bg-primary/10 text-primary animate-pulse"
                            : "bg-slate-100 text-slate-400",
                    )}
                  >
                    <FileText className="h-6 w-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {item.file.name}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {item.tipo
                        ? NOMBRES_TIPOS[item.tipo]
                        : "Tipo no detectado"}
                    </p>
                    {item.tipo && (
                      <p
                        className={cn(
                          "mt-1 text-[10px] font-black uppercase tracking-widest",
                          item.willReplace
                            ? "text-amber-600"
                            : "text-emerald-600",
                        )}
                      >
                        {item.willReplace
                          ? "Reemplazará el documento existente de este tipo"
                          : "Creará un documento nuevo para este tipo"}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {item.status === "processing" ? (
                      <span className="text-xs font-black text-primary">
                        {Math.round(item.progress)}%
                      </span>
                    ) : item.status === "completed" ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring" }}
                      >
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      </motion.div>
                    ) : item.status === "error" ? (
                      <AlertCircle className="h-6 w-6 text-red-500" />
                    ) : (
                      !isSyncing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(item.id)}
                          className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* Granular individual progress bar */}
                <AnimatePresence>
                  {(item.status === "processing" ||
                    item.status === "uploading") && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 4 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                    >
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {item.error && (
                  <p className="text-[10px] font-bold text-red-500 px-1">
                    {item.error}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-4">
        {syncId === null ? (
          <>
            <Button
              size="lg"
              disabled={!canStartAnyUpload}
              onClick={startBulkUpload}
              className="w-full h-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSyncing ? (
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              ) : (
                <Play className="mr-3 h-6 w-6" />
              )}
              {tipoPreseleccionado
                ? "INICIAR CARGA DEL TIPO"
                : "INICIAR PROCESO DE CARGA"}
            </Button>
            {!canStartAnyUpload && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                  {tipoPreseleccionado
                    ? "Debes cargar exactamente el documento del tipo seleccionado antes de iniciar este flujo."
                    : "Debes tener los 8 tipos oficiales, sin tipos desconocidos, antes de procesar la quincena."}
                </p>
              </div>
            )}
          </>
        ) : canPublish ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-[2.5rem] space-y-6 shadow-2xl shadow-emerald-500/5"
          >
            <div className="flex items-center gap-4 text-emerald-600">
              <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/40">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h4 className="font-black text-2xl tracking-tight">
                  ¡Procesamiento exitoso!
                </h4>
                <p className="font-medium text-emerald-600/70">
                  Todo listo para activar esta quincena.
                </p>
              </div>
            </div>
            <Button
              onClick={handlePublish}
              disabled={isPublishing}
              className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isPublishing ? (
                <span className="flex items-center justify-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Publicando quincena...
                </span>
              ) : (
                "ACTIVAR QUINCENA OFICIAL"
              )}
            </Button>
          </motion.div>
        ) : !isSyncing ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-[2.5rem] space-y-6"
          >
            <div className="flex items-center gap-4 text-amber-600">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/30">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div>
                <h4 className="font-black text-2xl tracking-tight">
                  Revisión necesaria
                </h4>
                <p className="font-medium text-amber-700/80">
                  {errorCount > 0
                    ? `Hay ${errorCount} archivo(s) con error. La quincena no puede publicarse todavía.`
                    : "La sincronización no está lista para publicarse."}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={resetUploadState}
                className="rounded-2xl font-black"
              >
                Preparar nueva carga
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/admin/bolsa-de-trabajo")}
                className="rounded-2xl font-black"
              >
                Volver al dashboard
              </Button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

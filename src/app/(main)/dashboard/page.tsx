"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMisTramitesCliente,
  getMiTramiteDetalleCliente,
  getMiEscalafonCliente,
  type EscalafonPosicionResult,
} from "@/lib/firebase/trabajador-portal";
import {
  NOMBRES_TIPOS,
  type TipoBolsaDeTrabajo,
} from "@/types/bolsa-de-trabajo";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Loader2,
  MapPin,
  ShieldCheck,
  UserRound,
  Sparkles,
  TrendingUp,
  X,
  Building2,
  ChevronRight,
  PartyPopper,
  Clock,
  Phone,
  GraduationCap,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConveniosCarrusel } from "@/components/ConveniosCarrusel";
import type { ConvenioPublico } from "@/types/convenios";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TramiteData {
  documentoId: string;
  recordId?: string;
  matricula: string;
  nombre: string;
  categoria: string;
  zona: string;
  tipoDocumento: TipoBolsaDeTrabajo;
  tipoContratacion?: string;
  adscripcionNueva?: string;
  turnoNueva?: string; // Note: Some fields might vary between list/detail
  turnoNuevo?: string;
  posicionBase: number;
  posicionInterinato?: number;
  totalEnCategoria: number;
  totalEventualesEnCategoria?: number;
}

interface Periodo {
  anio: number;
  mes: number;
  quincena: number;
}

function getTurnoLabel(turno?: string) {
  switch ((turno || "").toUpperCase()) {
    case "MAT":
      return "Turno matutino";
    case "VES":
      return "Turno vespertino";
    case "NOC":
      return "Turno nocturno";
    default:
      return turno || "";
  }
}

function getTramiteSubtitle(item: TramiteData) {
  switch (item.tipoDocumento) {
    case "CAMBIOS_TURNO_ADSCRIPCION":
      return item.adscripcionNueva
        ? `${item.adscripcionNueva}${item.turnoNuevo ? ` • ${getTurnoLabel(item.turnoNuevo)}` : ""}`
        : "Trámite vigente";
    case "AMPLIACIONES_JORNADA":
      return item.adscripcionNueva
        ? `${item.adscripcionNueva}${item.turnoNuevo ? ` • ${getTurnoLabel(item.turnoNuevo)}` : ""}`
        : "Solicitud vigente";
    default:
      return `${item.categoria} • ${item.zona}`;
  }
}

function getPrimaryMetric(item: TramiteData) {
  return {
    label: "Posición actual",
    value: item.posicionBase,
    total: item.totalEnCategoria,
  };
}

function isNuevoIngresoEventual(item: TramiteData) {
  return (
    item.tipoDocumento === "NUEVO_INGRESO" && Boolean(item.posicionInterinato)
  );
}

export default function DashboardPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [tramites, setTramites] = useState<TramiteData[]>([]);
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [greetingInfo, setGreetingInfo] = useState({
    greeting: "Hola",
    dayMessage: "",
  });

  const [convenios, setConvenios] = useState<ConvenioPublico[]>([]);
  const [escalafon, setEscalafon] = useState<EscalafonPosicionResult[]>([]);

  // Modal State (bolsa)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<TramiteData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTramiteId, setSelectedTramiteId] = useState<string | null>(
    null,
  );
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(
    undefined,
  );

  // Modal State (escalafón)
  const [isEscalafonModalOpen, setIsEscalafonModalOpen] = useState(false);
  const [escalafonDetalle, setEscalafonDetalle] =
    useState<EscalafonPosicionResult | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Generar saludo dinámico
    const hour = new Date().getHours();
    let newGreeting = "Buenas noches";
    if (hour >= 5 && hour < 12) newGreeting = "Buenos días";
    else if (hour >= 12 && hour < 19) newGreeting = "Buenas tardes";

    const days = [
      "¡Feliz Domingo! ☀️",
      "¡Excelente Lunes! 🚀",
      "¡Gran Martes! ⚡️",
      "¡Feliz Miércoles! 🐪",
      "¡Casi Viernes! Jueves 💪",
      "¡Por fin es Viernes! 🎉",
      "¡Gran Sábado! 🍻",
    ];
    const dayIndex = new Date().getDay();

    setGreetingInfo({
      greeting: newGreeting,
      dayMessage: days[dayIndex],
    });
  }, []);

  useEffect(() => {
    const fetchTramites = async () => {
      if (!user || userData?.role?.toUpperCase() !== "USER") return;

      try {
        setPageLoading(true);
        setError(null);
        setErrorStatus(null);

        if (!userData?.matricula?.trim()) {
          throw new Error(
            "El usuario autenticado no tiene matrícula vinculada.",
          );
        }

        const result = await getMisTramitesCliente();
        setTramites(result.data || []);
        setPeriodo(result.periodo || null);
      } catch (err: any) {
        let nextErrorStatus: number | null = null;
        const msg = err?.message || "";
        if (msg.includes("matrícula vinculada")) nextErrorStatus = 400;
        else if (msg.includes("No se pudo validar la sesión"))
          nextErrorStatus = 401;
        else if (msg.includes("no está activa")) nextErrorStatus = 403;
        else if (msg.includes("No se encontraron trámites vigentes")) {
          // Sin trámites no es un error — mostrar empty state de bienvenida
          setTramites([]);
          return;
        } else if (msg.includes("No hay información oficial activa"))
          nextErrorStatus = 404;
        else if (msg.includes("todavía se está preparando"))
          nextErrorStatus = 503;
        setErrorStatus(nextErrorStatus);
        setError(msg || "Error al cargar tus trámites.");
      } finally {
        setPageLoading(false);
      }
    };

    fetchTramites();
  }, [user, userData]);

  useEffect(() => {
    if (!user) return;
    const fetchConvenios = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/convenios", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setConvenios(json.data);
      } catch {
        // silencioso — convenios no son críticos
      }
    };
    fetchConvenios();
  }, [user]);

  useEffect(() => {
    if (!user || userData?.role?.toUpperCase() !== "USER") return;
    if (!userData?.matricula?.trim()) return;
    const fetchEscalafon = async () => {
      try {
        const result = await getMiEscalafonCliente();
        setEscalafon(result.data || []);
      } catch {
        // silencioso — escalafón puede no estar disponible para todos
      }
    };
    fetchEscalafon();
  }, [user, userData]);

  const handleOpenDetail = useCallback(async (item: TramiteData) => {
    setSelectedTramiteId(item.documentoId);
    setSelectedRecordId(item.recordId);
    setDetailData(item); // Set initial data from the list item to ensure consistency and avoid "1" position flickering
    setIsModalOpen(true);
    setDetailLoading(true);

    try {
      const result = await getMiTramiteDetalleCliente(
        item.documentoId,
        item.recordId,
      );
      // Merge official detail data, prioritizing what's returned from the specialized endpoint
      if (result && result.data) {
        setDetailData((prev) => ({
          ...prev,
          ...result.data,
          // If the list item has a valid position that is different from 1, and the API returns 1,
          // we might want to investigate, but for now we prioritize current list data if API seems suspicious.
          // However, usually we trust API. Let's trust API but ensure field mismatch is handled.
        }));
      }
    } catch (err) {
      console.error("Error loading detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-widest">
            Personalizando tu espacio...
          </span>
        </div>
      </div>
    );
  }

  if (!user || userData?.role?.toUpperCase() !== "USER") {
    return null;
  }

  return (
    <main className="container mx-auto p-4 md:p-8 min-h-[calc(100vh-4rem)] flex flex-col justify-start">
      <div className="max-w-7xl w-full mx-auto my-4 md:my-8 space-y-10">
        {/* HERO HEADER */}
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-primary/8 via-white to-slate-50 dark:from-primary/10 dark:via-slate-900 dark:to-slate-950 border border-primary/10 shadow-sm px-6 py-10 md:px-12 md:py-14 text-center"
        >
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/6 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-emerald-500/8 blur-3xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-black mb-6 shadow-sm border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              SNTSS SECCIÓN VII • {greetingInfo.dayMessage}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent mb-3 tracking-tighter leading-none">
              {greetingInfo.greeting},{" "}
              <span className="text-primary">
                {userData?.nombre?.split(" ")[0]}
              </span>
            </h1>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto font-semibold mb-8 leading-relaxed">
              Portal sindical oficial · Sección VII Baja California
            </p>

            <div
              className={cn(
                "grid gap-4 max-w-xl mx-auto",
                periodo ? "grid-cols-2" : "grid-cols-1 max-w-xs",
              )}
            >
              <motion.div
                whileHover={{ scale: 1.03 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Card className="border-border/40 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md shadow-sm rounded-3xl overflow-hidden group border">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-300">
                      <UserRound className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">
                        Matrícula
                      </p>
                      <p className="text-lg font-black text-slate-900 dark:text-white leading-none mt-1">
                        {userData.matricula}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {periodo && (
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Card className="border-border/40 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md shadow-sm rounded-3xl overflow-hidden group border">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                        <CalendarDays className="h-6 w-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 transition-colors">
                          Corte oficial
                        </p>
                        <p className="text-lg font-black text-slate-900 dark:text-white leading-none mt-1 uppercase tracking-tight">
                          {`${periodo.quincena}ª Q ${periodo.mes}/${periodo.anio}`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </div>
        </motion.section>

        {/* CONVENIOS CARRUSEL */}
        {convenios.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="px-4 md:px-8"
          >
            <ConveniosCarrusel convenios={convenios} />
          </motion.div>
        )}

        {/* ERROR / EMPTY STATE */}
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="border-amber-500/20 bg-amber-500/5 backdrop-blur-sm rounded-[2rem] border-2">
                <CardContent className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none mb-2">
                        {errorStatus === 400
                          ? "Matrícula no vinculada"
                          : errorStatus === 401
                            ? "Sesión expirada"
                            : errorStatus === 403
                              ? "Cuenta no activa"
                              : errorStatus === 404
                                ? "Sin movimientos registrados"
                                : errorStatus === 503
                                  ? "Datos en preparación"
                                  : "Error al cargar tu información"}
                      </p>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                        {error}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {errorStatus === 401 ? (
                      <Button
                        onClick={() => router.push("/login")}
                        className="rounded-2xl font-black bg-amber-600 hover:bg-amber-700 px-8 h-12"
                      >
                        Iniciar sesión
                      </Button>
                    ) : (
                      <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        className="rounded-2xl font-black border-amber-200 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40 px-8 h-12"
                      >
                        Reintentar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : tramites.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* Bienvenida */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] rounded-[2rem] border shadow-sm overflow-hidden">
                <CardContent className="flex flex-col items-center text-center gap-5 p-10">
                  <div className="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center shadow-inner">
                    <PartyPopper className="h-10 w-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">
                      <ShieldCheck className="h-3 w-3" />
                      Cuenta verificada y activa
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      ¡Bienvenido al Portal Sindical!
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                      Tu acceso está confirmado. Aquí aparecerán tus posiciones
                      en la bolsa de trabajo una vez que tu matrícula sea
                      incluida en la siguiente sincronización oficial de la
                      Sección VII.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Qué esperar + Contacto */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 rounded-[2rem] border">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                        ¿Cuándo aparece mi información?
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Los datos se actualizan cada quincena a partir de los
                        cortes oficiales. Si acabas de ser validado, verás tu
                        posición en el siguiente corte.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 rounded-[2rem] border">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                        ¿Ves algo incorrecto?
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Contacta a tu representación sindical de la Sección VII
                        para verificar que tu matrícula esté registrada
                        correctamente.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                <ClipboardList className="h-3.5 w-3.5" />
                Solo se muestran datos oficiales vinculados a tu matrícula
              </div>
            </motion.div>
          ) : (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
                    Mis Posiciones Actuales
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-white text-base font-black shadow-lg shadow-primary/20">
                      {tramites.length}
                    </span>
                  </h2>
                </div>
              </div>

              <div
                className={cn(
                  "grid gap-6",
                  tramites.length === 1
                    ? "grid-cols-1 max-w-3xl mx-auto"
                    : tramites.length === 2
                      ? "lg:grid-cols-2 max-w-5xl mx-auto"
                      : "lg:grid-cols-3",
                )}
              >
                {tramites.map((item, index) => {
                  const metric = getPrimaryMetric(item);

                  return (
                    <motion.div
                      key={`${item.documentoId}-${item.recordId || item.tipoDocumento}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      whileHover={{ y: -5 }}
                      className="group relative"
                    >
                      <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm group-hover:shadow-2xl group-hover:shadow-primary/5 transition-all duration-500 border relative overflow-visible h-full flex flex-col">
                        <div className="p-6 lg:p-7 space-y-6 flex-1 flex flex-col">
                          {/* Header de la tarjeta */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 min-w-0 flex-1">
                              <div className="inline-block px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">
                                {NOMBRES_TIPOS[item.tipoDocumento]}
                              </div>
                              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight line-clamp-2">
                                {getTramiteSubtitle(item)}
                              </h3>
                            </div>

                            <div className="flex flex-col gap-2 shrink-0">
                              <div className="rounded-3xl bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/10 p-4 text-center min-w-[90px] shadow-inner relative group-hover:from-primary group-hover:to-primary/90 transition-all duration-500">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary group-hover:text-white/80 transition-colors mb-1">
                                  BASE
                                </p>
                                <div className="flex items-baseline justify-center gap-1">
                                  <span className="text-3xl font-black text-slate-900 dark:text-white group-hover:text-white transition-colors">
                                    {metric.value}
                                  </span>
                                </div>
                              </div>
                              {isNuevoIngresoEventual(item) && (
                                <div className="rounded-3xl bg-amber-500/10 border border-amber-500/20 p-3 text-center min-w-[90px]">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">
                                    INTERINATO
                                  </p>
                                  <span className="text-2xl font-black text-amber-700">
                                    {item.posicionInterinato}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Info Row (Categoría y Zona compactas) */}
                          <div className="flex flex-col gap-3 py-4 border-y border-slate-50 dark:border-slate-800/50 mt-auto">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                                <Briefcase className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                              </div>
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight truncate">
                                {item.categoria}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                                <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                              </div>
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight truncate">
                                {item.zona}
                              </span>
                            </div>
                          </div>

                          {/* Footer Acción */}
                          <div className="pt-2">
                            <Button
                              onClick={() => handleOpenDetail(item)}
                              className="w-full rounded-2xl h-12 px-6 font-black bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white transition-all group/btn shadow-md hover:shadow-primary/20 text-xs uppercase tracking-widest border-none"
                            >
                              VER DETALLES
                              <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* SECCIÓN ESCALAFÓN */}
        {escalafon.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
              <div>
                <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
                  Mi Escalafón
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-white text-base font-black shadow-lg shadow-primary/20">
                    {escalafon.length}
                  </span>
                </h2>
              </div>
            </div>

            <div
              className={cn(
                "grid gap-6",
                escalafon.length === 1
                  ? "grid-cols-1 max-w-3xl mx-auto"
                  : escalafon.length === 2
                    ? "lg:grid-cols-2 max-w-5xl mx-auto"
                    : "lg:grid-cols-3",
              )}
            >
              {escalafon.map((item, index) => {
                const zonasRank =
                  item.estatus === "Activo"
                    ? item.posicionesActivoPorZona
                    : item.posicionesPeiPorZona;
                const zonasOrdenadas = Object.entries(zonasRank).sort(
                  (a, b) => a[1] - b[1],
                );
                const mejorZona = zonasOrdenadas[0];

                return (
                  <motion.div
                    key={item.listadoId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ y: -5 }}
                    className="group relative"
                  >
                    <Card className="border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm group-hover:shadow-2xl group-hover:shadow-primary/5 transition-all duration-500 border relative overflow-visible h-full flex flex-col">
                      <div className="p-6 lg:p-7 space-y-6 flex-1 flex flex-col">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 min-w-0 flex-1">
                            <div className="inline-block px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">
                              Escalafón
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight line-clamp-2">
                              {item.categoriaDesc}
                            </h3>
                          </div>

                          <div className="flex flex-col gap-2 shrink-0">
                            <div className="rounded-3xl bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/10 p-4 text-center min-w-[90px] shadow-inner relative group-hover:from-primary group-hover:to-primary/90 transition-all duration-500">
                              <p className="text-[9px] font-black uppercase tracking-widest text-primary group-hover:text-white/80 transition-colors mb-0.5 truncate max-w-[80px] mx-auto">
                                {mejorZona
                                  ? mejorZona[0].replace(/^\d+\s+/, "")
                                  : "ZONA"}
                              </p>
                              <span className="text-3xl font-black text-slate-900 dark:text-white group-hover:text-white transition-colors">
                                {mejorZona ? mejorZona[1] : item.lugar}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Info Row */}
                        <div className="flex flex-col gap-3 py-4 border-y border-slate-50 dark:border-slate-800/50 mt-auto">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                              <Briefcase className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight truncate">
                              {item.areaDesc || item.areaCode || item.estatus}
                            </span>
                          </div>
                          {zonasOrdenadas.length > 0
                            ? zonasOrdenadas.map(([zona, rank]) => (
                                <div
                                  key={zona}
                                  className="flex items-center gap-3 min-w-0"
                                >
                                  <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                                    <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight truncate">
                                    Pos. {rank} · {zona.replace(/^\d+\s+/, "")}
                                  </span>
                                </div>
                              ))
                            : null}
                        </div>

                        {/* Footer */}
                        <div className="pt-2">
                          <Button
                            onClick={() => {
                              setEscalafonDetalle(item);
                              setIsEscalafonModalOpen(true);
                            }}
                            className="w-full rounded-2xl h-12 px-6 font-black bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white transition-all group/btn shadow-md hover:shadow-primary/20 text-xs uppercase tracking-widest border-none"
                          >
                            VER DETALLES
                            <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* MODAL ESCALAFÓN */}
        <Dialog
          open={isEscalafonModalOpen}
          onOpenChange={(open) => {
            setIsEscalafonModalOpen(open);
            if (!open) setEscalafonDetalle(null);
          }}
        >
          <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[88vh] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-slate-200/50 dark:border-slate-800/50 rounded-[2rem] p-0 overflow-hidden shadow-2xl">
            <div className="overflow-y-auto max-h-[88vh]">
              <div className="relative p-5 sm:p-7">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
                <div className="relative">
                  <DialogHeader className="flex flex-row items-center justify-between mb-4">
                    <div className="space-y-0.5 text-left min-w-0 flex-1 mr-3">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary mb-1">
                        <ShieldCheck className="h-3 w-3" />
                        Escalafón
                      </div>
                      {escalafonDetalle && (
                        <DialogTitle className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                          {escalafonDetalle.categoriaDesc}
                        </DialogTitle>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsEscalafonModalOpen(false)}
                      className="rounded-full h-9 w-9 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogHeader>

                  {escalafonDetalle && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      {/* Hero */}
                      {(() => {
                        const mzRank =
                          escalafonDetalle.estatus === "Activo"
                            ? escalafonDetalle.posicionesActivoPorZona
                            : escalafonDetalle.posicionesPeiPorZona;
                        const mzOrdenadas = Object.entries(mzRank).sort(
                          (a, b) => a[1] - b[1],
                        );
                        const mz = mzOrdenadas[0];
                        return (
                          <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-950 py-6 px-5 text-center shadow-lg">
                            <div className="absolute top-0 right-0 p-5 opacity-5">
                              <TrendingUp className="w-20 h-20" />
                            </div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                              Tu posición en
                            </p>
                            <p className="text-sm font-black uppercase tracking-widest text-white/80 mb-2">
                              {mz ? mz[0].replace(/^\d+\s+/, "") : "Escalafón"}
                            </p>
                            <span className="text-6xl sm:text-7xl font-black text-white tracking-tighter leading-none">
                              {mz ? mz[1] : escalafonDetalle.lugar}
                            </span>
                            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                  escalafonDetalle.estatus === "Activo"
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    : "bg-amber-500/20 text-amber-400 border-amber-500/30",
                                )}
                              >
                                {escalafonDetalle.estatus}
                              </span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                {escalafonDetalle.periodoDecierre}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Zonas — chips compactos */}
                      {(() => {
                        const zonasRank =
                          escalafonDetalle.estatus === "Activo"
                            ? escalafonDetalle.posicionesActivoPorZona
                            : escalafonDetalle.posicionesPeiPorZona;
                        const zonas = Object.entries(zonasRank).sort(
                          (a, b) => a[1] - b[1],
                        );
                        if (zonas.length === 0) return null;
                        return (
                          <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-0.5">
                              Posición por zona
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {zonas.map(([zona, rank]) => (
                                <div
                                  key={zona}
                                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                                >
                                  <span className="text-sm font-black text-primary">
                                    #{rank}
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                                    {zona.replace(/^\d+\s+/, "")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Info compacta */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            Área
                          </p>
                          <div className="flex items-start gap-2">
                            <Briefcase className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">
                              {escalafonDetalle.areaDesc ||
                                escalafonDetalle.areaCode ||
                                "—"}
                            </span>
                          </div>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            Vigencia
                          </p>
                          <div className="flex items-start gap-2">
                            <CalendarDays className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 leading-tight">
                              {escalafonDetalle.vigenciaInicio} –{" "}
                              {escalafonDetalle.vigenciaFin}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => setIsEscalafonModalOpen(false)}
                        className="w-full rounded-2xl h-11 font-black bg-slate-900 dark:bg-white dark:text-slate-900 hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-lg"
                      >
                        CERRAR
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PREMIUM DETAIL MODAL */}
        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) setDetailData(null);
          }}
        >
          <DialogContent className="max-w-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] p-0 overflow-hidden shadow-2xl transition-all duration-500">
            <div className="relative">
              {/* Decorative Background */}
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />

              <div className="relative p-8 lg:p-10">
                <DialogHeader className="flex flex-row items-center justify-between mb-8">
                  <div className="space-y-1 text-left">
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary mb-2">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Detalle de Trámite
                    </div>
                    {detailData && (
                      <DialogTitle className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                        {NOMBRES_TIPOS[detailData.tipoDocumento]}
                      </DialogTitle>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-full h-10 w-10 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </DialogHeader>

                <AnimatePresence mode="wait">
                  {detailLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-20 gap-4"
                    >
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">
                        Obteniendo escalafón oficial...
                      </p>
                    </motion.div>
                  ) : detailData ? (
                    <motion.div
                      key="content"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8"
                    >
                      {/* Main Rank Section */}
                      <div className="relative overflow-hidden group rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-950 p-10 text-center shadow-xl shadow-slate-200/50 dark:shadow-black/20">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                          <TrendingUp className="w-32 h-32" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 tracking-widest">
                          {isNuevoIngresoEventual(detailData)
                            ? "Posición Base"
                            : "Tu Posición Vigente"}
                        </p>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-8xl font-black text-white tracking-tighter leading-none">
                            {getPrimaryMetric(detailData).value}
                          </span>
                        </div>
                        {isNuevoIngresoEventual(detailData) && (
                          <div className="mt-6 pt-6 border-t border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">
                              Posición para Interinato
                            </p>
                            <span className="text-5xl font-black text-amber-400 tracking-tighter leading-none">
                              {detailData.posicionInterinato}
                            </span>
                            {detailData.totalEventualesEnCategoria && (
                              <p className="text-[10px] font-bold text-slate-400 mt-1">
                                de {detailData.totalEventualesEnCategoria}{" "}
                                eventuales
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Info Sections */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            Categoría Oficial
                          </p>
                          <div className="flex items-start gap-3">
                            <Briefcase className="h-4 w-4 text-primary mt-1 shrink-0" />
                            <span className="text-base font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">
                              {detailData.categoria}
                            </span>
                          </div>
                        </div>

                        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            Zona Operativa
                          </p>
                          <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-primary mt-1 shrink-0" />
                            <span className="text-base font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">
                              {detailData.zona}
                            </span>
                          </div>
                        </div>

                        {(detailData.adscripcionNueva ||
                          detailData.turnoNuevo ||
                          detailData.turnoNueva) && (
                          <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 md:col-span-2 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                              Detalle de Solicitud
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              {detailData.adscripcionNueva && (
                                <div className="flex items-start gap-3">
                                  <Building2 className="h-4 w-4 text-primary mt-1 shrink-0" />
                                  <span className="text-base font-black text-slate-900 dark:text-white uppercase leading-tight">
                                    {detailData.adscripcionNueva}
                                  </span>
                                </div>
                              )}
                              {(detailData.turnoNuevo ||
                                detailData.turnoNueva) && (
                                <div className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest shadow-sm self-start sm:self-auto border border-primary/20">
                                  {getTurnoLabel(
                                    detailData.turnoNuevo ||
                                      detailData.turnoNueva,
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Official Statement */}
                      <div className="flex items-start gap-4 p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/10">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 mt-1" />
                        <div className="text-left">
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight mb-1">
                            Información Verificada
                          </p>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                            Este ranking es calculado según el corte quincenal
                            oficial. Cualquier duda contacta a tu representante
                            sindical de la Sección VII.
                          </p>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button
                          onClick={() => setIsModalOpen(false)}
                          className="w-full rounded-2xl h-14 font-black bg-slate-900 dark:bg-white dark:text-slate-900 hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl"
                        >
                          CERRAR VENTANA
                        </Button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

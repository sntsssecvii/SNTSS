"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Users,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase-client";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface OverviewData {
  pendingValidations: number;
  activeUsers: number;
  registrationsToday: number;
  registrationErrorsToday: number;
  registrationsLastHour: number;
  registrationErrorsLastHour: number;
  registrationWarningsLastHour: number;
  approvalsLastHour: number;
  rejectionsLastHour: number;
}

interface RecentEvent {
  id: string;
  source: "registration" | "admin";
  status: "success" | "warning" | "error";
  title: string;
  message: string;
  createdAt: string | null;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  totalPages: number;
}

interface ObservabilidadData {
  overview: OverviewData;
  events: RecentEvent[];
  pagination: PaginationData;
}

type SourceFilter = "all" | "registration" | "admin";
type StatusFilter = "all" | "success" | "warning" | "error";

const REFRESH_INTERVAL_MS = 30_000;

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `hace ${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  variant = "neutral",
  sublabel,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: "neutral" | "success" | "error" | "warning" | "info";
  sublabel?: string;
}) {
  const colors = {
    neutral: "bg-slate-50 border-slate-200 text-slate-700",
    success: "bg-emerald-50 border-emerald-200 text-emerald-700",
    error: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };
  const iconColors = {
    neutral: "text-slate-400",
    success: "text-emerald-500",
    error: "text-red-500",
    warning: "text-amber-500",
    info: "text-blue-500",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 flex flex-col gap-3",
        colors[variant],
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest opacity-70">
          {label}
        </span>
        <Icon className={cn("w-4 h-4", iconColors[variant])} />
      </div>
      <div>
        <span className="text-4xl font-black tabular-nums">{value}</span>
        {sublabel && <p className="text-xs opacity-60 mt-1">{sublabel}</p>}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: RecentEvent }) {
  const icon = {
    success: (
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
    ),
    warning: (
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
    ),
    error: <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
  }[event.status];

  const rowBg = {
    success: "",
    warning: "bg-amber-50/50",
    error: "bg-red-50/60",
  }[event.status];

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3 rounded-xl", rowBg)}>
      {icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">
            {event.title}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 font-medium"
          >
            {event.source === "registration" ? "registro" : "admin"}
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 break-all">
          {event.message}
        </p>
      </div>
      <span className="text-[10px] text-slate-400 shrink-0 pt-0.5 tabular-nums">
        {formatRelativeTime(event.createdAt)}
      </span>
    </div>
  );
}

export default function ObservabilidadPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ObservabilidadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!authLoading && (!user || !isAdminRole(userData?.role))) {
      router.push("/login");
    }
  }, [user, userData, authLoading, router]);

  const fetchData = useCallback(
    async (opts: { manual?: boolean; page?: number } = {}) => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (opts.manual) setRefreshing(true);

      try {
        const token = await currentUser.getIdToken();
        const sp = new URLSearchParams({
          source: sourceFilter,
          status: statusFilter,
          limit: "25",
          page: String(opts.page ?? page),
        });
        const res = await fetch(
          `/api/admin/observabilidad/registro?${sp.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP_${res.status}`);
        setData(json.data);
        setLastUpdated(new Date());
        setError(null);
      } catch (err: any) {
        setError(err.message || "Error al cargar datos");
      } finally {
        if (isFirstLoad.current) {
          setLoading(false);
          isFirstLoad.current = false;
        }
        setRefreshing(false);
      }
    },
    [sourceFilter, statusFilter, page],
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [sourceFilter, statusFilter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const goToPage = (newPage: number) => {
    setPage(newPage);
    fetchData({ page: newPage });
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="w-10 h-10 text-red-500" />
        <p className="text-slate-600 text-sm">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData({ manual: true })}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const ov = data?.overview;
  const pagination = data?.pagination;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-red-600" />
            Monitor de Registros
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Actualización automática cada 30 segundos
            {lastUpdated && (
              <span className="ml-2 text-slate-400">
                · última:{" "}
                {lastUpdated.toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData({ manual: true })}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5", refreshing && "animate-spin")}
          />
          Actualizar
        </Button>
      </div>

      {/* KPIs — hoy */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
          Hoy
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Registros exitosos"
            value={ov?.registrationsToday ?? 0}
            icon={CheckCircle2}
            variant={ov?.registrationsToday ? "success" : "neutral"}
            sublabel="solicitudes recibidas"
          />
          <KpiCard
            label="Errores"
            value={ov?.registrationErrorsToday ?? 0}
            icon={XCircle}
            variant={ov?.registrationErrorsToday ? "error" : "neutral"}
            sublabel="intentos fallidos"
          />
          <KpiCard
            label="Pendientes"
            value={ov?.pendingValidations ?? 0}
            icon={Clock}
            variant={ov?.pendingValidations ? "warning" : "neutral"}
            sublabel="esperando validación"
          />
          <KpiCard
            label="Usuarios activos"
            value={ov?.activeUsers ?? 0}
            icon={Users}
            variant="info"
            sublabel="cuentas aprobadas"
          />
        </div>
      </section>

      {/* KPIs — última hora */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
          Última hora
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Registros"
            value={ov?.registrationsLastHour ?? 0}
            icon={UserCheck}
            variant={ov?.registrationsLastHour ? "success" : "neutral"}
          />
          <KpiCard
            label="Errores"
            value={ov?.registrationErrorsLastHour ?? 0}
            icon={XCircle}
            variant={ov?.registrationErrorsLastHour ? "error" : "neutral"}
          />
          <KpiCard
            label="Aprobados"
            value={ov?.approvalsLastHour ?? 0}
            icon={ShieldCheck}
            variant={ov?.approvalsLastHour ? "success" : "neutral"}
          />
          <KpiCard
            label="Rechazados"
            value={ov?.rejectionsLastHour ?? 0}
            icon={AlertTriangle}
            variant={ov?.rejectionsLastHour ? "warning" : "neutral"}
          />
        </div>
      </section>

      {/* Feed de eventos */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex-1">
            Actividad reciente
          </h2>
          <div className="flex gap-2">
            <Select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="text-xs h-8 py-0"
            >
              <option value="all">Todas las fuentes</option>
              <option value="registration">Registro</option>
              <option value="admin">Admin</option>
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="text-xs h-8 py-0"
            >
              <option value="all">Todos los estados</option>
              <option value="success">Exitosos</option>
              <option value="warning">Advertencias</option>
              <option value="error">Errores</option>
            </Select>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          <AnimatePresence initial={false}>
            {data?.events.length ? (
              data.events.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <EventRow event={event} />
                </motion.div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                Sin actividad para los filtros seleccionados
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Paginación */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-slate-500">
              {pagination.total} evento{pagination.total !== 1 ? "s" : ""} ·
              página {pagination.page} de {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || refreshing}
                className="gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page + 1)}
                disabled={!pagination.hasMore || refreshing}
                className="gap-1"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {pagination && pagination.totalPages <= 1 && pagination.total > 0 && (
          <p className="text-xs text-slate-400 mt-3">
            {pagination.total} evento{pagination.total !== 1 ? "s" : ""}
          </p>
        )}
      </section>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { Bell, Search, CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { auth } from "@/lib/firebase/firebase-client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useToast } from "./ui/use-toast";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { isAdminRole } from "@/lib/auth/roles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import type { TipoBolsaDeTrabajo } from "@/types/bolsa-de-trabajo";

interface ResultadoNavbar {
  nombre: string;
  matricula: string;
  tipoDocumento: TipoBolsaDeTrabajo;
  tipoLabel: string;
  posicionBase: number;
  posicionInterinato: number | null;
  categoria: string;
  zona: string;
  adscripcionNueva: string | null;
  turnoNuevo: string | null;
}

export function Navbar() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();

  // Bolsa live search state
  const [bolsaQuery, setBolsaQuery] = useState("");
  const [bolsaResultados, setBolsaResultados] = useState<ResultadoNavbar[]>([]);
  const [bolsaLoading, setBolsaLoading] = useState(false);
  const [bolsaOpen, setBolsaOpen] = useState(false);
  const bolsaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bolsaAbortRef = useRef<AbortController | null>(null);
  const bolsaWrapperRef = useRef<HTMLDivElement>(null);

  const isBolsa = userData?.role?.toUpperCase() === "BOLSA";

  const buscarBolsa = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setBolsaResultados([]);
      setBolsaOpen(false);
      return;
    }

    bolsaAbortRef.current?.abort();
    const controller = new AbortController();
    bolsaAbortRef.current = controller;

    try {
      setBolsaLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();
      const res = await fetch(
        `/api/admin/bolsa/buscar?q=${encodeURIComponent(trimmed)}`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        },
      );
      const payload = await res.json();
      if (res.ok && payload.data) {
        setBolsaResultados(payload.data.resultados ?? []);
        setBolsaOpen(true);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    } finally {
      setBolsaLoading(false);
    }
  }, []);

  const handleBolsaChange = (value: string) => {
    setBolsaQuery(value);
    if (bolsaDebounceRef.current) clearTimeout(bolsaDebounceRef.current);
    bolsaDebounceRef.current = setTimeout(() => buscarBolsa(value), 300);
  };

  const limpiarBolsa = () => {
    setBolsaQuery("");
    setBolsaResultados([]);
    setBolsaOpen(false);
  };

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        bolsaWrapperRef.current &&
        !bolsaWrapperRef.current.contains(e.target as Node)
      ) {
        setBolsaOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
      router.push("/login");
    } catch (error: any) {
      console.error("Error al cerrar sesión:", error);
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión",
        variant: "destructive",
      });
    }
  };

  const isAdmin = isAdminRole(userData?.role);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "info":
      case "registration":
      case "system":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const formatTime = (createdAt: any) => {
    if (!createdAt) return "Reciente";
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Ahora";
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;

    return date.toLocaleDateString();
  };

  return (
    <nav className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-2 sm:px-4 lg:pl-4">
        {/* Left side - Search */}
        <div className="flex flex-1 items-center gap-2 sm:gap-4 ml-12 lg:ml-0">
          {isBolsa ? (
            <div
              ref={bolsaWrapperRef}
              className="relative w-full max-w-xs sm:max-w-sm"
            >
              <Search
                className={cn(
                  "absolute left-2 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 transition-colors",
                  bolsaLoading
                    ? "text-primary animate-pulse"
                    : "text-muted-foreground",
                )}
              />
              <Input
                type="text"
                inputMode="numeric"
                value={bolsaQuery}
                onChange={(e) => handleBolsaChange(e.target.value)}
                onFocus={() => bolsaResultados.length > 0 && setBolsaOpen(true)}
                placeholder="Matrícula..."
                className="pl-7 sm:pl-9 pr-8 h-9 sm:h-10 text-sm font-bold"
                autoComplete="off"
              />
              {bolsaQuery && (
                <button
                  onClick={limpiarBolsa}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Dropdown resultados */}
              {bolsaOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto">
                  {bolsaResultados.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Sin resultados para{" "}
                      <span className="font-bold">
                        {bolsaQuery.trim().toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    bolsaResultados.map((r, i) => (
                      <div
                        key={`${r.tipoDocumento}-${i}`}
                        className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors space-y-2"
                      >
                        {/* Nombre, matrícula y posición */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                              {r.nombre || "SIN NOMBRE"}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {r.matricula}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-2xl font-black leading-none text-primary">
                              #{r.posicionBase}
                            </p>
                            {r.posicionInterinato && (
                              <p className="text-[11px] font-bold text-amber-500 mt-0.5">
                                Int. #{r.posicionInterinato}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Tipo badge */}
                        <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          {r.tipoLabel}
                        </span>

                        {/* Detalles secundarios */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                          {r.categoria && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Categoría
                              </p>
                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                                {r.categoria}
                              </p>
                            </div>
                          )}
                          {r.zona && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Zona
                              </p>
                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                                {r.zona}
                              </p>
                            </div>
                          )}
                          {r.adscripcionNueva && (
                            <div className="col-span-2">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Adscripción solicitada
                              </p>
                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                                {r.adscripcionNueva}
                              </p>
                            </div>
                          )}
                          {r.turnoNuevo && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Turno
                              </p>
                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                                {r.turnoNuevo}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="relative w-full max-w-xs sm:max-w-sm">
              <Search className="absolute left-2 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar..."
                className="pl-7 sm:pl-9 h-9 sm:h-10 text-sm"
              />
            </div>
          )}
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 sm:h-10 sm:w-10"
              >
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-red-600 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0">
              <div className="flex items-center justify-between p-4 border-b">
                <DropdownMenuLabel className="p-0 font-semibold">
                  Notificaciones
                </DropdownMenuLabel>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Marcar todas como leídas
                  </Button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay notificaciones</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 border-b hover:bg-muted/50 transition-colors cursor-pointer",
                        !notification.read &&
                          "bg-blue-50/50 dark:bg-blue-950/20",
                      )}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "text-sm font-medium",
                                !notification.read && "font-semibold",
                              )}
                            >
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    Ver todas las notificaciones
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2 sm:px-3"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-xs sm:text-sm">
                  {userData?.nombre?.charAt(0) || user?.email?.charAt(0) || "U"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs sm:text-sm font-medium truncate max-w-[120px]">
                    {userData?.nombre} {userData?.apellidoPaterno}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[120px]">
                    {user?.email}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 sm:w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {userData?.nombre} {userData?.apellidoPaterno}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  {userData?.role && (
                    <span className="mt-1 inline-block px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      {userData.role.toUpperCase()}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/perfil">Mi Perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/configuracion">Configuración</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/cambiar-contrasena">
                      Cambiar Contraseña
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Mi Portal</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleLogout}
              >
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}

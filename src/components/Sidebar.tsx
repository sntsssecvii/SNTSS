"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import {
  LayoutDashboard,
  FileText,
  User,
  Settings,
  Lock,
  LogOut,
  Menu,
  X,
  ChevronRight,
  BarChart3,
  FileBarChart,
  Users,
  ShieldCheck,
  Crown,
  Activity,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import logoSNTSS from "@/assets/logo-sntss.png";
import seccion7 from "@/assets/seccion7.png";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase-client";
import { useToast } from "./ui/use-toast";
import { getRoleLabel, isAdminRole } from "@/lib/auth/roles";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const getNavItems = (
  rol?: string,
  pendingCount: number = 0,
  isDeveloper?: boolean,
): NavItem[] => {
  const baseItems: NavItem[] = [];

  // Dashboard según rol
  const roleUpper = rol?.toUpperCase();

  if (roleUpper === "ADMIN" || roleUpper === "SUPER_ADMIN") {
    baseItems.push({
      title: "Panel Admin",
      href: "/admin",
      icon: LayoutDashboard,
    });
  } else if (roleUpper !== "BOLSA") {
    baseItems.push({
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    });
  }

  // Solo ADMIN puede ver estas secciones en el MVP
  if (roleUpper === "ADMIN" || roleUpper === "SUPER_ADMIN") {
    baseItems.push(
      {
        title: "Bolsa de Trabajo",
        href: "/admin/bolsa-de-trabajo",
        icon: Users,
      },
      {
        title: "Escalafón",
        href: "/admin/escalafon",
        icon: Users,
      },
      {
        title: "Validaciones",
        href: "/admin/validaciones",
        icon: ShieldCheck,
        badge: pendingCount > 0 ? pendingCount.toString() : undefined,
      },
      {
        title: "Monitor",
        href: "/admin/observabilidad",
        icon: Activity,
      },
      /* Oculto para MVP:
      {
        title: 'Propuestas',
        href: '/admin/propuestas',
        icon: FileText,
      },
      {
        title: 'Estadísticas',
        href: '/admin/estadisticas',
        icon: BarChart3,
      },
      {
        title: 'Reportes',
        href: '/admin/reportes',
        icon: FileBarChart,
      }
      */
    );
  }

  if (isDeveloper) {
    baseItems.push({
      title: "Admin Global",
      href: "/admin/global",
      icon: Crown,
    });
  }

  if (roleUpper === "BOLSA") {
    baseItems.push(
      {
        title: "Dashboard",
        href: "/admin/bolsa-de-trabajo/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Bolsa de Trabajo",
        href: "/admin/bolsa-de-trabajo",
        icon: Users,
      },
    );
  }

  if (roleUpper === "ESCALAFON") {
    baseItems.push({
      title: "Escalafón",
      href: "/admin/escalafon",
      icon: Users,
    });
  }

  // Items comunes para roles admin
  if (
    roleUpper === "ADMIN" ||
    roleUpper === "SUPER_ADMIN" ||
    roleUpper === "BOLSA"
  ) {
    baseItems.push(
      {
        title: "Mi Perfil",
        href: "/admin/perfil",
        icon: User,
      },
      {
        title: "Configuración",
        href: "/admin/configuracion",
        icon: Settings,
      },
      {
        title: "Cambiar Contraseña",
        href: "/admin/cambiar-contrasena",
        icon: Lock,
      },
    );
  }

  return baseItems;
};

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, userData } = useAuth();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isAdminRole(userData?.role)) {
      setPendingCount(0);
      return;
    }

    let cancelled = false;

    const loadPendingCount = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/admin/validaciones/resumen", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setPendingCount(payload?.data?.pending ?? 0);
        }
      } catch (error) {
        console.error("Error obteniendo badge de validaciones:", error);
      }
    };

    loadPendingCount();
    const intervalId = window.setInterval(loadPendingCount, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userData]);

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

  const isActive = (href: string) => {
    if (
      href === "/dashboard" ||
      href === "/admin" ||
      href === "/admin/bolsa-de-trabajo"
    ) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-3 left-3 sm:top-4 sm:left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-background/90 backdrop-blur-sm border shadow-md h-9 w-9 sm:h-10 sm:w-10"
        >
          {isOpen ? (
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>
      </div>

      {/* Overlay para mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 sm:w-72 lg:w-64 bg-[#7F1D1D] dark:bg-[#450a0a] border-r border-white/5 text-white z-50 transform transition-transform duration-500 ease-in-out shadow-2xl",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Capa de gradiente profundo para efecto premium */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />

        <div className="flex flex-col h-full relative z-10">
          {/* Header con logo único (Sección VII) */}
          <div className="p-8 pb-6 border-b border-white/10">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative group">
                <div className="absolute -inset-2 bg-white/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Image
                  src={seccion7}
                  alt="Sección VII SNTSS"
                  width={85}
                  height={85}
                  className="object-contain w-20 h-20 sm:w-24 sm:h-24 drop-shadow-2xl relative"
                  priority
                />
              </div>
              <div className="space-y-1">
                <p className="text-xl font-black tracking-tighter text-white uppercase leading-none">
                  Sección VII
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] font-black text-red-200 uppercase tracking-[0.25em]">
                    SNTSS
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User info - Estilo Premium Card */}
          <div className="p-4">
            <div className="p-4 rounded-[1.5rem] bg-black/20 backdrop-blur-md border border-white/5 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-lg ring-2 ring-white/10">
                  {userData?.nombre?.charAt(0) || user?.email?.charAt(0) || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black tracking-tight truncate text-white">
                    {userData?.nombre} {userData?.apellidoPaterno}
                  </p>
                  <p className="text-[10px] font-bold text-red-200/60 truncate leading-tight mb-1">
                    {user?.email}
                  </p>
                  {userData?.role && (
                    <span className="inline-flex px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-white/10 text-white rounded-md border border-white/10">
                      {getRoleLabel(userData.role)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 custom-scrollbar">
            {getNavItems(
              userData?.role,
              pendingCount,
              userData?.isDeveloper,
            ).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative",
                    active
                      ? "bg-white text-red-950 shadow-[0_10px_20px_-5px_rgba(0,0,0,0.3)] font-black"
                      : "text-red-100 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
                      active
                        ? "text-red-600"
                        : "text-red-300/80 group-hover:text-white",
                    )}
                  />
                  <span className="flex-1 text-sm font-bold tracking-tight">
                    {item.title}
                  </span>
                  {active ? (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-40" />
                  ) : (
                    item.badge && (
                      <span className="px-2 py-0.5 text-[10px] bg-red-500 text-white font-black rounded-lg shadow-lg">
                        {item.badge}
                      </span>
                    )
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer con logout */}
          <div className="p-4 pb-6">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-red-200 hover:text-white hover:bg-white/10 h-12 rounded-2xl px-4 transition-all duration-300 group"
            >
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center mr-3 group-hover:bg-red-500/20 transition-colors">
                <LogOut className="h-4 w-4" />
              </div>
              <span className="text-sm font-black tracking-tight">
                Cerrar Sesión
              </span>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

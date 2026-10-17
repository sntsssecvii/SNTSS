"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { CommandPalette } from "@/components/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isBolsa = userData?.role?.toUpperCase() === "BOLSA";
  const isCapturista = userData?.role?.toUpperCase() === "CAPTURISTA";

  // BOLSA puede navegar a cualquier /admin/* excepto rutas exclusivas de otros roles
  const isBolsaAllowed =
    pathname.startsWith("/admin/bolsa-de-trabajo") ||
    pathname.startsWith("/admin/perfil") ||
    pathname.startsWith("/admin/configuracion") ||
    pathname.startsWith("/admin/cambiar-contrasena");

  // CAPTURISTA solo puede acceder a validaciones y rutas comunes
  const isCapturistaAllowed =
    pathname.startsWith("/admin/validaciones") ||
    pathname.startsWith("/admin/perfil") ||
    pathname.startsWith("/admin/configuracion") ||
    pathname.startsWith("/admin/cambiar-contrasena");

  useEffect(() => {
    if (isBolsa && !isBolsaAllowed) {
      router.replace("/admin/bolsa-de-trabajo/dashboard");
    }
    if (isCapturista && !isCapturistaAllowed) {
      router.replace("/admin/validaciones");
    }
  }, [isBolsa, isBolsaAllowed, isCapturista, isCapturistaAllowed, router]);

  // Evitar flash de contenido incorrecto mientras se redirige
  const isRedirecting =
    (!loading && isBolsa && !isBolsaAllowed) ||
    (!loading && isCapturista && !isCapturistaAllowed);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-64">
        <Navbar />
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {isRedirecting ? null : children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

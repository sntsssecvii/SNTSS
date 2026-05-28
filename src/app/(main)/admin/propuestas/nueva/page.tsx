"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAdminRole } from "@/lib/auth/roles";

export default function NuevaPropuestaPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isAdminRole(userData?.role))) {
      router.push("/login");
    }
  }, [user, userData, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!user || !isAdminRole(userData?.role)) {
    return null;
  }

  return (
    <main className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Nueva Propuesta</h1>
        <p className="text-muted-foreground">Módulo en construcción</p>
      </div>
    </main>
  );
}

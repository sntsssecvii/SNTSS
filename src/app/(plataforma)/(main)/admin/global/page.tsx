"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Crown, ShieldCheck } from "lucide-react";

import AdminGlobalManager from "@/components/admin/AdminGlobalManager";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdminRole } from "@/lib/auth/roles";

export default function AdminGlobalPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  const canAccess =
    isSuperAdminRole(userData?.role) && userData?.isDeveloper === true;

  useEffect(() => {
    if (!loading && (!user || !canAccess)) {
      router.push("/admin");
    }
  }, [loading, router, user, canAccess]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !canAccess) {
    return null;
  }

  return (
    <main className="container mx-auto space-y-8 py-6">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/70 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(239,68,68,0.08),_transparent_35%)]" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              <Crown className="h-4 w-4" />
              Admin Global
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Gobierno operativo de usuarios
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                Este módulo concentra la administración de roles y estatus
                internos. Los cambios sensibles quedan auditados y la cuenta
                global no puede autodeshabilitarse desde esta interfaz.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-3 self-start rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Control exclusivo para SUPER_ADMIN
          </div>
        </div>
      </section>

      <AdminGlobalManager />
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export default function DashboardPerfilPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user || !userData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }
    if (form.newPassword.length < 6) {
      toast({
        title: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !user.email) throw new Error("No autenticado");

      const credential = EmailAuthProvider.credential(
        user.email,
        form.currentPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, form.newPassword);

      toast({ title: "Contraseña actualizada correctamente" });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast({
        title:
          error.code === "auth/wrong-password"
            ? "La contraseña actual es incorrecta"
            : "No se pudo cambiar la contraseña",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const field = (label: string, value?: string) => (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
        {value || "—"}
      </p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Mi Perfil
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tus datos registrados en el sistema SNTSS Sección VII
        </p>
      </div>

      {/* Datos personales */}
      <Card className="rounded-3xl border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
            <UserRound className="h-4 w-4 text-primary" />
            Información Personal
          </CardTitle>
          <CardDescription>
            Datos capturados al momento de tu registro
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {field("Nombre(s)", userData.nombre)}
          {field("Apellido Paterno", userData.apellidoPaterno)}
          {field("Apellido Materno", userData.apellidoMaterno || undefined)}
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <IdCard className="h-3 w-3" />
              Matrícula IMSS
            </p>
            <p className="text-base font-black text-primary tracking-wider">
              {userData.matricula || "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              Correo electrónico
            </p>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100 break-all">
              {userData.email || user.email}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Estado de cuenta */}
      <Card className="rounded-3xl border shadow-sm bg-emerald-500/5 border-emerald-500/20">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Cuenta activa y verificada
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              Tu acceso al Portal Sindical está habilitado.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cambiar contraseña */}
      <Card className="rounded-3xl border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
            <Lock className="h-4 w-4 text-primary" />
            Cambiar Contraseña
          </CardTitle>
          <CardDescription>
            Ingresa tu contraseña actual y elige una nueva
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  value={form.currentPassword}
                  onChange={(e) =>
                    setForm({ ...form, currentPassword: e.target.value })
                  }
                  required
                  placeholder="Tu contraseña actual"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrent(!showCurrent)}
                >
                  {showCurrent ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  value={form.newPassword}
                  onChange={(e) =>
                    setForm({ ...form, newPassword: e.target.value })
                  }
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirmar nueva contraseña
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({ ...form, confirmPassword: e.target.value })
                  }
                  required
                  minLength={6}
                  placeholder="Repite tu nueva contraseña"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="rounded-2xl px-8 font-black"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar contraseña"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

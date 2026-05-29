"use client";

import AdminValidacion from "@/components/admin/AdminValidacion";
import { motion } from "framer-motion";
import {
  Users,
  Clock,
  UserX,
  UserPlus,
  Eye,
  EyeOff,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { getRoleLabel } from "@/lib/auth/roles";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { auth } from "@/lib/firebase/firebase-client";
import { useToast } from "@/components/ui/use-toast";

interface ValidationSummaryResponse {
  data?: {
    pending?: number;
    active?: number;
    rejected?: number;
  };
  error?: string;
}

interface StaffUser {
  uid: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  role: string;
}

interface NewUserForm {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  password: string;
  role: string;
}

const ROLE_OPTIONS = [
  { value: "CAPTURISTA", label: "Validador" },
  { value: "BOLSA", label: "Bolsa de Trabajo" },
  { value: "ESCALAFON", label: "Escalafón" },
];

const EMPTY_FORM: NewUserForm = {
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  email: "",
  password: "",
  role: "CAPTURISTA",
};

export default function ValidacionesPage() {
  const [counts, setCounts] = useState({ pending: 0, active: 0, rejected: 0 });
  const [activeTab, setActiveTab] = useState<
    "pending" | "active" | "rejected" | "staff"
  >("pending");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const { userData } = useAuth();
  const isAdmin =
    userData?.role?.toUpperCase() === "ADMIN" ||
    userData?.role?.toUpperCase() === "SUPER_ADMIN" ||
    !!userData?.isDeveloper;
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const loadCounts = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/admin/validaciones/resumen", {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    const payload = (await response.json()) as ValidationSummaryResponse;

    if (!response.ok) {
      throw new Error(payload.error || `HTTP_${response.status}`);
    }

    setCounts({
      pending: payload.data?.pending ?? 0,
      active: payload.data?.active ?? 0,
      rejected: payload.data?.rejected ?? 0,
    });
  };

  const loadStaffUsers = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setLoadingStaff(true);
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(
        "/api/admin/global/usuarios?role=STAFF&limit=100",
        {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || `HTTP_${response.status}`);
      setStaffUsers(payload.data?.usuarios ?? []);
    } catch (error) {
      console.error("Error cargando personal:", error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleDeleteStaff = async (uid: string, nombre: string) => {
    if (!confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`))
      return;
    setDeletingUid(uid);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No autenticado");
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/admin/global/usuarios/${uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || `HTTP_${response.status}`);
      toast({
        title: "Usuario eliminado",
        description: `${nombre} fue eliminado.`,
      });
      await loadStaffUsers();
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
        description: error.message || "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setDeletingUid(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const syncCounts = async () => {
      try {
        await loadCounts();
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading validation counts:", error);
        }
      }
    };

    syncCounts();
    const intervalId = window.setInterval(syncCounts, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleCreateUser = async () => {
    if (
      !form.nombre ||
      !form.apellidoPaterno ||
      !form.email ||
      !form.password
    ) {
      toast({
        title: "Campos requeridos",
        description: "Completa nombre, apellido paterno, correo y contraseña.",
        variant: "destructive",
      });
      return;
    }
    if (form.password.length < 8) {
      toast({
        title: "Contraseña muy corta",
        description: "Debe tener al menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No autenticado");
      const idToken = await currentUser.getIdToken();

      const response = await fetch("/api/admin/global/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || `HTTP_${response.status}`);

      const roleLabel =
        ROLE_OPTIONS.find((r) => r.value === form.role)?.label ?? form.role;
      toast({
        title: "Usuario creado",
        description: `${form.nombre} ${form.apellidoPaterno} fue creado como ${roleLabel}.`,
      });
      setShowNewUser(false);
      setForm(EMPTY_FORM);
      await loadCounts();
      await loadStaffUsers();
    } catch (error: any) {
      toast({
        title: "Error al crear usuario",
        description: error.message || "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="container mx-auto py-6 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
            Usuarios
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Gestión de usuarios del sistema y validación de solicitudes.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setShowNewUser(true);
          }}
          className="bg-red-700 hover:bg-red-800 text-white gap-2 self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Usuario
        </Button>
      </motion.div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as "pending" | "active" | "rejected" | "staff");
          if (value === "staff") loadStaffUsers();
        }}
        className="w-full"
      >
        <TabsList
          className={`grid w-full mb-8 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}
        >
          <TabsTrigger
            value="pending"
            className="flex items-center gap-1 sm:gap-2"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Pendientes</span>
            {counts.pending > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 sm:ml-1 h-5 px-1.5 min-w-[20px] justify-center"
              >
                {counts.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className="flex items-center gap-1 sm:gap-2"
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Activos</span>
            {counts.active > 0 && (
              <Badge
                variant="outline"
                className="ml-0.5 sm:ml-1 h-5 px-1.5 min-w-[20px] justify-center bg-green-50 text-green-700 border-green-200"
              >
                {counts.active}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="rejected"
            className="flex items-center gap-1 sm:gap-2"
          >
            <UserX className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Rechazados</span>
            {counts.rejected > 0 && (
              <Badge
                variant="outline"
                className="ml-0.5 sm:ml-1 h-5 px-1.5 min-w-[20px] justify-center bg-red-50 text-red-700 border-red-200"
              >
                {counts.rejected}
              </Badge>
            )}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="staff"
              className="flex items-center gap-1 sm:gap-2"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Personal</span>
              {staffUsers.length > 0 && (
                <Badge
                  variant="outline"
                  className="ml-0.5 sm:ml-1 h-5 px-1.5 min-w-[20px] justify-center bg-blue-50 text-blue-700 border-blue-200"
                >
                  {staffUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="pending">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {activeTab === "pending" ? (
              <AdminValidacion
                filterStatus="pending"
                onDataChanged={loadCounts}
              />
            ) : null}
          </motion.div>
        </TabsContent>

        <TabsContent value="active">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {activeTab === "active" ? (
              <AdminValidacion
                filterStatus="active"
                onDataChanged={loadCounts}
              />
            ) : null}
          </motion.div>
        </TabsContent>

        <TabsContent value="rejected">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {activeTab === "rejected" ? (
              <AdminValidacion
                filterStatus="rejected"
                onDataChanged={loadCounts}
              />
            ) : null}
          </motion.div>
        </TabsContent>

        <TabsContent value="staff">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {loadingStaff ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Cargando personal...
              </div>
            ) : staffUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <ShieldCheck className="w-10 h-10 opacity-20" />
                <p className="text-sm">
                  No hay usuarios de personal registrados.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                        Nombre
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                        Correo
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                        Rol
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {staffUsers.map((u, i) => {
                      const fullName =
                        `${u.nombre} ${u.apellidoPaterno} ${u.apellidoMaterno}`.trim();
                      return (
                        <tr
                          key={u.uid}
                          className={
                            i % 2 === 0 ? "bg-background" : "bg-muted/20"
                          }
                        >
                          <td className="px-4 py-3 font-medium">{fullName}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {u.email}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {getRoleLabel(u.role)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deletingUid === u.uid}
                              onClick={() => handleDeleteStaff(u.uid, fullName)}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>

      <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nu-nombre">
                  Nombre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nu-nombre"
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                  placeholder="Juan"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-ap">
                  Apellido paterno <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nu-ap"
                  value={form.apellidoPaterno}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, apellidoPaterno: e.target.value }))
                  }
                  placeholder="García"
                  disabled={isCreating}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nu-am">Apellido materno</Label>
              <Input
                id="nu-am"
                value={form.apellidoMaterno}
                onChange={(e) =>
                  setForm((f) => ({ ...f, apellidoMaterno: e.target.value }))
                }
                placeholder="López"
                disabled={isCreating}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nu-email">
                Correo electrónico <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nu-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="usuario@ejemplo.com"
                disabled={isCreating}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nu-password">
                Contraseña <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="nu-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Mínimo 8 caracteres"
                  disabled={isCreating}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nu-role">
                Rol <span className="text-red-500">*</span>
              </Label>
              <Select
                id="nu-role"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }
                disabled={isCreating}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNewUser(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={isCreating}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              {isCreating ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

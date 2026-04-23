"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth } from "@/lib/firebase/firebase-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { getRoleLabel } from "@/lib/auth/roles";
import { ROLES } from "@/types/roles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  BadgeCheck,
  Loader2,
  Pencil,
  Search,
  Shield,
  Trash2,
  Users,
} from "lucide-react";

type UserStatus = "pending" | "active" | "rejected";

type ManagedUser = {
  uid: string;
  email: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  matricula: string;
  curp: string;
  role: string;
  status: UserStatus;
  createdAtMs: number | null;
  updatedAtMs: number | null;
};

type PaginationState = {
  total: number;
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
};

const DEFAULT_PAGINATION: PaginationState = {
  total: 0,
  limit: 25,
  nextCursor: null,
  hasMore: false,
};

const ROLE_OPTIONS = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.REVISOR,
  ROLES.CAPTURISTA,
  ROLES.CONSULTA,
  ROLES.USER,
];

function getStatusBadgeVariant(status: UserStatus) {
  if (status === "active") return "success";
  if (status === "rejected") return "destructive";
  return "warning";
}

function formatStatusLabel(status: UserStatus) {
  if (status === "active") return "Activo";
  if (status === "rejected") return "Rechazado";
  return "Pendiente";
}

export default function AdminGlobalManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    matricula: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | UserStatus>("ALL");
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION);
  const [summary, setSummary] = useState({
    total: 0,
    superAdmins: 0,
    active: 0,
    pending: 0,
  });
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(
    undefined,
  );
  const deferredQuery = useDeferredValue(query);

  const loadUsers = useCallback(
    async (cursor?: string) => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("AUTH_REQUIRED");
      }

      const idToken = await currentUser.getIdToken();
      const searchParams = new URLSearchParams({
        limit: "25",
        status: statusFilter,
        role: roleFilter,
      });

      if (deferredQuery.trim()) {
        searchParams.set("q", deferredQuery.trim());
      }

      if (cursor) {
        searchParams.set("cursor", cursor);
      }

      const response = await fetch(
        `/api/admin/global/usuarios?${searchParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        data?: {
          usuarios?: ManagedUser[];
          pagination?: PaginationState;
          summary?: {
            total: number;
            superAdmins: number;
            active: number;
            pending: number;
          };
        };
        error?: string;
      };

      if (!response.ok || !payload?.data?.usuarios) {
        throw new Error(
          payload?.error || "No se pudo cargar la administración global.",
        );
      }

      setUsers(payload.data.usuarios);
      setPagination(payload.data.pagination || DEFAULT_PAGINATION);
      setSummary(
        payload.data.summary || {
          total: 0,
          superAdmins: 0,
          active: 0,
          pending: 0,
        },
      );
      setCurrentCursor(cursor);
    },
    [deferredQuery, roleFilter, statusFilter],
  );

  const isFirstLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const syncUsers = async () => {
      try {
        if (isFirstLoad.current) {
          if (!cancelled) setLoading(true);
        } else {
          if (!cancelled) setIsFetching(true);
        }
        setCursorStack([]);
        setCurrentCursor(undefined);
        await loadUsers();
        isFirstLoad.current = false;
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast({
            title: "Error",
            description: "No se pudo cargar la administración global.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsFetching(false);
        }
      }
    };

    syncUsers();

    return () => {
      cancelled = true;
    };
  }, [loadUsers, toast]);

  const filteredUsers = useMemo(() => users, [users]);

  const handleDelete = async (uid: string) => {
    setDeletingUid(uid);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("AUTH_REQUIRED");

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/admin/global/usuarios/${uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo eliminar el usuario.");
      }

      setUsers((current) => current.filter((u) => u.uid !== uid));
      toast({
        title: "Usuario eliminado",
        description: "La cuenta fue eliminada permanentemente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el usuario.",
        variant: "destructive",
      });
    } finally {
      setDeletingUid(null);
      setConfirmDeleteUid(null);
    }
  };

  const openEditDialog = (user: ManagedUser) => {
    setEditUser(user);
    setEditForm({
      nombre: user.nombre,
      apellidoPaterno: user.apellidoPaterno,
      apellidoMaterno: user.apellidoMaterno,
      matricula: user.matricula,
    });
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setIsSavingEdit(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("AUTH_REQUIRED");

      const idToken = await currentUser.getIdToken();
      const response = await fetch(
        `/api/admin/global/usuarios/${editUser.uid}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editForm),
        },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar los cambios.");
      }

      setUsers((current) =>
        current.map((u) =>
          u.uid === editUser.uid
            ? {
                ...u,
                nombre: editForm.nombre.trim(),
                apellidoPaterno: editForm.apellidoPaterno.trim(),
                apellidoMaterno: editForm.apellidoMaterno.trim(),
                matricula: editForm.matricula.trim().toUpperCase(),
              }
            : u,
        ),
      );
      setEditUser(null);
      toast({
        title: "Perfil actualizado",
        description: "Los datos fueron guardados.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "No se pudo guardar.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-12 dark:border-slate-800 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Usuarios
              </p>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {summary.total}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Admins Globales
              </p>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {summary.superAdmins}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Activos
              </p>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {summary.active}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Pendientes
              </p>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {summary.pending}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-black tracking-tight">
            Gobierno de usuarios
          </CardTitle>
          <CardDescription>
            Gestión operativa de cuentas. Solo disponible para desarrolladores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.5fr)_minmax(180px,0.5fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, correo o matrícula"
                className="pl-9 pr-9"
              />
              {isFetching && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              )}
            </div>

            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="ALL">Todos los roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </Select>

            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "ALL" | UserStatus)
              }
            >
              <option value="ALL">Todos los estatus</option>
              <option value="active">Activos</option>
              <option value="pending">Pendientes</option>
              <option value="rejected">Rechazados</option>
            </Select>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200/70 dark:border-slate-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-slate-500"
                      >
                        No hay usuarios que coincidan con los filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.uid}>
                        <TableCell className="min-w-[240px]">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {user.nombre} {user.apellidoPaterno}{" "}
                              {user.apellidoMaterno}
                            </p>
                            <p className="text-xs text-slate-500">
                              {user.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {user.matricula || "Sin matrícula"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getRoleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(user.status)}>
                            {formatStatusLabel(user.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {user.createdAtMs
                            ? new Date(user.createdAtMs).toLocaleDateString(
                                "es-MX",
                              )
                            : "Sin fecha"}
                        </TableCell>
                        <TableCell className="text-right">
                          {confirmDeleteUid === user.uid ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={deletingUid === user.uid}
                                onClick={() => handleDelete(user.uid)}
                              >
                                {deletingUid === user.uid ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Confirmar"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={deletingUid === user.uid}
                                onClick={() => setConfirmDeleteUid(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditDialog(user)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setConfirmDeleteUid(user.uid)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Mostrando {filteredUsers.length} de {pagination.total} usuarios
              para los filtros actuales.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const nextStack = cursorStack.slice(0, -1);
                  setCursorStack(nextStack);
                  await loadUsers(nextStack[nextStack.length - 1]);
                }}
                disabled={cursorStack.length === 0}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!pagination.nextCursor) return;
                  setCursorStack((current) => [
                    ...current,
                    currentCursor || "",
                  ]);
                  await loadUsers(pagination.nextCursor!);
                }}
                disabled={!pagination.hasMore}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar datos del usuario</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-nombre">Nombre(s)</Label>
              <Input
                id="edit-nombre"
                value={editForm.nombre}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, nombre: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-ap">Apellido paterno</Label>
              <Input
                id="edit-ap"
                value={editForm.apellidoPaterno}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    apellidoPaterno: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-am">Apellido materno</Label>
              <Input
                id="edit-am"
                value={editForm.apellidoMaterno}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    apellidoMaterno: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-matricula">Matrícula</Label>
              <Input
                id="edit-matricula"
                value={editForm.matricula}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, matricula: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditUser(null)}
              disabled={isSavingEdit}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

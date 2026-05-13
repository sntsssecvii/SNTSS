"use client";

import {
  useDeferredValue,
  useState,
  useEffect,
  useCallback,
  useRef,
  useId,
} from "react";
import { auth } from "@/lib/firebase/firebase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Check,
  X,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import Image from "next/image";
import { Label } from "@/components/ui/label";

interface UserRequest {
  uid: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  matricula: string;
  email: string;
  curp: string;
  status: "pending" | "active" | "rejected";
  documents: {
    identificacion: string;
    tarjeton: string;
    constanciaAfiliacion: string;
  };
  rejectionReason?: string;
  createdAtMs: number | null;
  updatedAtMs: number | null;
}

interface AdminValidacionProps {
  filterStatus?: "pending" | "active" | "rejected";
  onDataChanged?: () => void;
}

interface UserRequestsResponse {
  data?: {
    requests?: UserRequest[];
    pagination?: {
      total: number;
      limit: number;
      page: number;
      totalPages: number;
      hasMore: boolean;
    };
  };
  error?: string;
}

interface ValidationActionResponse {
  data?: {
    uid?: string;
    status?: "pending" | "active" | "rejected";
  };
  warning?: string | null;
  error?: string;
}

type PaginationState = {
  total: number;
  limit: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
};

const DEFAULT_PAGINATION: PaginationState = {
  total: 0,
  limit: 25,
  page: 1,
  totalPages: 1,
  hasMore: false,
};

export default function AdminValidacion({
  filterStatus = "pending",
  onDataChanged,
}: AdminValidacionProps) {
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<UserRequest | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isFetching, setIsFetching] = useState(false);
  const dragState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION);
  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const [editingUser, setEditingUser] = useState<UserRequest | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    matricula: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  // Reemplazo de documentos (tab rechazados)
  type DocKey = "identificacion" | "tarjeton" | "constanciaAfiliacion";
  const [replacementFiles, setReplacementFiles] = useState<
    Partial<Record<DocKey, File>>
  >({});
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const idInputRef = useRef<HTMLInputElement>(null);
  const tarjetonInputRef = useRef<HTMLInputElement>(null);
  const constanciaInputRef = useRef<HTMLInputElement>(null);
  const docInputRefs: Record<DocKey, React.RefObject<HTMLInputElement>> = {
    identificacion: idInputRef,
    tarjeton: tarjetonInputRef,
    constanciaAfiliacion: constanciaInputRef,
  };
  const docId = useId();

  const { toast } = useToast();

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }, [viewingDoc]);

  const loadRequests = useCallback(
    async (targetPage: number) => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setRequests([]);
        setPagination(DEFAULT_PAGINATION);
        return;
      }

      const idToken = await currentUser.getIdToken();
      const searchParams = new URLSearchParams({
        status: filterStatus,
        scope: "workers",
        limit: "25",
        page: String(targetPage),
      });

      if (deferredQuery.trim()) {
        searchParams.set("q", deferredQuery.trim());
      }

      const response = await fetch(
        `/api/admin/validaciones/solicitudes?${searchParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as UserRequestsResponse;

      if (!response.ok) {
        throw new Error(payload.error || `HTTP_${response.status}`);
      }

      setRequests(payload.data?.requests || []);
      setPagination(payload.data?.pagination || DEFAULT_PAGINATION);
      setPage(targetPage);
      pageRef.current = targetPage;
    },
    [deferredQuery, filterStatus],
  );

  const isFirstLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const syncRequests = async () => {
      try {
        if (isFirstLoad.current) {
          if (!cancelled) setLoading(true);
        } else {
          if (!cancelled) setIsFetching(true);
        }
        if (!cancelled) {
          setPage(1);
          pageRef.current = 1;
          await loadRequests(1);
          isFirstLoad.current = false;
          if (!cancelled) {
            setLoading(false);
            setIsFetching(false);
          }
        }
      } catch (error) {
        console.error("Error fetching validation requests:", error);
        if (!cancelled) {
          setRequests([]);
          setLoading(false);
          setIsFetching(false);
        }
      }
    };

    syncRequests();
    const intervalId = window.setInterval(
      () => loadRequests(pageRef.current),
      45_000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loadRequests]);

  const refreshRequests = async () => {
    await loadRequests(pageRef.current);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("AUTH_REQUIRED");
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(
        `/api/admin/validaciones/solicitudes/${selectedRequest.uid}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "active" }),
        },
      );
      const payload = (await response.json()) as ValidationActionResponse;

      if (!response.ok) {
        throw new Error(payload.error || `HTTP_${response.status}`);
      }

      await refreshRequests();
      onDataChanged?.();
      toast({
        title: "Usuario Aprobado",
        description: payload.warning || "El usuario ha sido notificado.",
      });
      setSelectedRequest(null);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "No se pudo aprobar al usuario.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReplaceDocuments = async () => {
    if (!selectedRequest || Object.keys(replacementFiles).length === 0) return;
    setIsUploadingDocs(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("AUTH_REQUIRED");
      const idToken = await currentUser.getIdToken();

      const formData = new FormData();
      for (const [key, file] of Object.entries(replacementFiles)) {
        formData.append(key, file);
      }

      const response = await fetch(
        `/api/admin/validaciones/solicitudes/${selectedRequest.uid}/documentos`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: formData,
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || `HTTP_${response.status}`);

      // Actualizar URLs en el modal sin cerrar
      setSelectedRequest((prev) =>
        prev
          ? {
              ...prev,
              documents: {
                ...prev.documents,
                ...payload.data.documents,
              },
            }
          : prev,
      );
      setReplacementFiles({});
      // Limpiar file inputs
      Object.values(docInputRefs).forEach((ref) => {
        if (ref.current) ref.current.value = "";
      });

      toast({
        title: "Documentos actualizados",
        description:
          "Los documentos fueron reemplazados. Ya puedes reactivar al usuario.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "No se pudieron subir los documentos.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingDocs(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRequest) return;
    const fullName = [
      selectedRequest.nombre,
      selectedRequest.apellidoPaterno,
    ].join(" ");
    if (
      !confirm(
        `¿Eliminar permanentemente a ${fullName}? El usuario podrá volver a registrarse desde cero.`,
      )
    )
      return;
    setIsProcessing(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("AUTH_REQUIRED");
      const idToken = await currentUser.getIdToken();
      const response = await fetch(
        `/api/admin/global/usuarios/${selectedRequest.uid}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || `HTTP_${response.status}`);
      }

      await refreshRequests();
      onDataChanged?.();
      toast({
        title: "Usuario eliminado",
        description: `${fullName} fue eliminado. Ya puede volver a registrarse.`,
      });
      setSelectedRequest(null);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "No se pudo eliminar al usuario.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectReason) return;
    setIsProcessing(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("AUTH_REQUIRED");
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(
        `/api/admin/validaciones/solicitudes/${selectedRequest.uid}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "rejected",
            rejectionReason: rejectReason,
          }),
        },
      );
      const payload = (await response.json()) as ValidationActionResponse;

      if (!response.ok) {
        throw new Error(payload.error || `HTTP_${response.status}`);
      }

      await refreshRequests();
      onDataChanged?.();
      toast({
        title: "Usuario Rechazado",
        description:
          payload.warning || "Se ha enviado la notificación de rechazo.",
      });
      setSelectedRequest(null);
      setRejectReason("");
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "No se pudo realizar la acción.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openDocument = (url: string, title: string) => {
    setViewingDoc({ url, title });
  };

  const openEditDialog = (user: UserRequest) => {
    setEditingUser(user);
    setEditForm({
      nombre: user.nombre,
      apellidoPaterno: user.apellidoPaterno,
      apellidoMaterno: user.apellidoMaterno,
      matricula: user.matricula,
    });
  };

  const handleSaveProfile = async () => {
    if (!editingUser) return;
    setIsSavingEdit(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("AUTH_REQUIRED");
      const idToken = await currentUser.getIdToken();
      const response = await fetch(
        `/api/admin/validaciones/solicitudes/${editingUser.uid}`,
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
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar.");

      setRequests((prev) =>
        prev.map((r) =>
          r.uid === editingUser.uid
            ? {
                ...r,
                nombre: editForm.nombre.trim(),
                apellidoPaterno: editForm.apellidoPaterno.trim(),
                apellidoMaterno: editForm.apellidoMaterno.trim(),
                matricula: editForm.matricula.trim().toUpperCase(),
              }
            : r,
        ),
      );
      setEditingUser(null);
      toast({
        title: "Perfil actualizado",
        description: "Los datos fueron guardados correctamente.",
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

  if (loading)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          {filterStatus === "pending"
            ? "Solicitudes Pendientes"
            : filterStatus === "active"
              ? "Usuarios Activos"
              : "Usuarios Rechazados"}
        </h2>
        <Badge
          variant={
            filterStatus === "pending"
              ? "default"
              : filterStatus === "active"
                ? "outline"
                : "destructive"
          }
          className="text-sm"
        >
          {pagination.total}{" "}
          {filterStatus === "pending"
            ? "Pendientes"
            : filterStatus === "active"
              ? "Activos"
              : "Rechazados"}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, correo o matrícula"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
          )}
        </div>
        <p className="text-sm text-slate-500">
          La búsqueda consulta al backend y devuelve coincidencias por prefijo.
        </p>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Fecha</TableHead>
              {filterStatus === "pending" && <TableHead>Documentos</TableHead>}
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={filterStatus === "pending" ? 5 : 4}
                  className="text-center py-8 text-slate-500"
                >
                  No hay solicitudes pendientes.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => (
                <TableRow key={req.uid}>
                  <TableCell>
                    <div className="font-medium">
                      {req.nombre} {req.apellidoPaterno} {req.apellidoMaterno}
                    </div>
                    <div className="text-xs text-slate-500">{req.email}</div>
                  </TableCell>
                  <TableCell>{req.matricula}</TableCell>
                  <TableCell>
                    {req.createdAtMs
                      ? new Date(req.createdAtMs).toLocaleDateString()
                      : "Reciente"}
                  </TableCell>
                  {filterStatus === "pending" && (
                    <TableCell>
                      <div className="flex gap-2">
                        {req.documents.identificacion ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openDocument(
                                req.documents.identificacion,
                                `INE - ${req.nombre}`,
                              )
                            }
                          >
                            <FileText className="w-4 h-4 mr-1" /> INE
                          </Button>
                        ) : null}
                        {req.documents.tarjeton ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openDocument(
                                req.documents.tarjeton,
                                `Tarjetón - ${req.nombre}`,
                              )
                            }
                          >
                            <FileText className="w-4 h-4 mr-1" /> Tarjetón
                          </Button>
                        ) : null}
                        {req.documents.constanciaAfiliacion ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openDocument(
                                req.documents.constanciaAfiliacion,
                                `Constancia - ${req.nombre}`,
                              )
                            }
                          >
                            <FileText className="w-4 h-4 mr-1" /> Constancia
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(req)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {filterStatus === "pending" ? (
                        <Button
                          size="sm"
                          onClick={() => setSelectedRequest(req)}
                        >
                          <Eye className="w-4 h-4 mr-2" /> Revisar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedRequest(req)}
                        >
                          <Eye className="w-4 h-4 mr-2" /> Ver
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Mostrando {requests.length} de {pagination.total} registros.
        </p>
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadRequests(page - 1)}
              disabled={page <= 1}
            >
              ‹
            </Button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === pagination.totalPages ||
                  Math.abs(p - page) <= 1,
              )
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-1 text-slate-400 text-sm"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="min-w-[2rem]"
                    onClick={() => loadRequests(p as number)}
                  >
                    {p}
                  </Button>
                ),
              )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadRequests(page + 1)}
              disabled={page >= pagination.totalPages}
            >
              ›
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedRequest}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setReplacementFiles({});
          }
        }}
      >
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Revisión de Solicitud</DialogTitle>
            <DialogDescription>
              Valida la información y documentos del usuario.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="grid gap-6 py-4 overflow-y-auto flex-1 min-h-0 pr-1">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold block">Nombre:</span>
                  {selectedRequest.nombre} {selectedRequest.apellidoPaterno}{" "}
                  {selectedRequest.apellidoMaterno}
                </div>
                <div>
                  <span className="font-semibold block">Matrícula:</span>
                  {selectedRequest.matricula}
                </div>
                <div>
                  <span className="font-semibold block">Correo:</span>
                  {selectedRequest.email}
                </div>
                <div>
                  <span className="font-semibold block">
                    Fecha de registro:
                  </span>
                  {selectedRequest.createdAtMs
                    ? new Date(selectedRequest.createdAtMs).toLocaleString(
                        "es-MX",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "—"}
                </div>
                {selectedRequest.status !== "pending" &&
                  selectedRequest.updatedAtMs && (
                    <div>
                      <span className="font-semibold block">
                        {selectedRequest.status === "active"
                          ? "Fecha de aprobación:"
                          : "Fecha de rechazo:"}
                      </span>
                      {new Date(selectedRequest.updatedAtMs).toLocaleString(
                        "es-MX",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </div>
                  )}
                {selectedRequest.rejectionReason ? (
                  <div className="col-span-2">
                    <span className="font-semibold block">
                      Motivo de rechazo:
                    </span>
                    {selectedRequest.rejectionReason}
                  </div>
                ) : null}
              </div>

              {filterStatus === "rejected" && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-slate-900">
                    Documentos actuales
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(
                      [
                        {
                          label: "Identificación (INE)",
                          url: selectedRequest.documents.identificacion,
                          title: "Identificación Oficial",
                          alt: "Identificación",
                          key: "identificacion" as DocKey,
                        },
                        {
                          label: "Tarjetón de Pago",
                          url: selectedRequest.documents.tarjeton,
                          title: "Tarjetón de Pago",
                          alt: "Tarjetón",
                          key: "tarjeton" as DocKey,
                        },
                        {
                          label: "Constancia de Afiliación",
                          url: selectedRequest.documents.constanciaAfiliacion,
                          title: "Constancia de Afiliación Sindical",
                          alt: "Constancia",
                          key: "constanciaAfiliacion" as DocKey,
                        },
                      ] as const
                    ).map(({ label, url, title, alt, key }) => (
                      <div
                        key={label}
                        className="group relative border rounded-xl overflow-hidden bg-slate-50"
                      >
                        <input
                          id={`${docId}-${key}`}
                          ref={docInputRefs[key]}
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file)
                              setReplacementFiles((prev) => ({
                                ...prev,
                                [key]: file,
                              }));
                          }}
                        />
                        <div className="p-2 border-b bg-white flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 truncate mr-1">
                            {replacementFiles[key]
                              ? replacementFiles[key]!.name
                              : label}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            {url && (
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-slate-100"
                                onClick={() => openDocument(url, title)}
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-slate-100 text-red-600"
                              title="Reemplazar"
                              onClick={() => docInputRefs[key].current?.click()}
                            >
                              <Upload className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="h-32 relative bg-slate-200 flex items-center justify-center overflow-hidden">
                          {replacementFiles[key] ? (
                            <div className="flex flex-col items-center gap-1 p-2 text-center">
                              <FileText className="h-6 w-6 text-red-500" />
                              <span className="text-[10px] text-slate-600 leading-tight">
                                Nuevo archivo listo
                              </span>
                            </div>
                          ) : !url ? (
                            <p className="text-xs text-slate-400">
                              No adjuntado
                            </p>
                          ) : url.toLowerCase().includes(".pdf") ? (
                            <iframe
                              src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
                              className="w-full h-full border-none pointer-events-none"
                              title={`Preview ${label}`}
                            />
                          ) : (
                            <Image
                              src={url}
                              alt={alt}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, 33vw"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {Object.keys(replacementFiles).length > 0 && (
                    <Button
                      onClick={handleReplaceDocuments}
                      disabled={isUploadingDocs}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
                    >
                      {isUploadingDocs ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Subiendo documentos...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Guardar{" "}
                          {Object.keys(replacementFiles).length === 1
                            ? "1 documento nuevo"
                            : `${Object.keys(replacementFiles).length} documentos nuevos`}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {filterStatus === "pending" && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-slate-900">
                    Documentación Adjunta
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(
                      [
                        {
                          label: "Identificación (INE)",
                          url: selectedRequest.documents.identificacion,
                          title: "Identificación Oficial",
                          alt: "Identificación",
                        },
                        {
                          label: "Tarjetón de Pago",
                          url: selectedRequest.documents.tarjeton,
                          title: "Tarjetón de Pago",
                          alt: "Tarjetón",
                        },
                        {
                          label: "Constancia de Afiliación",
                          url: selectedRequest.documents.constanciaAfiliacion,
                          title: "Constancia de Afiliación Sindical",
                          alt: "Constancia de Afiliación",
                        },
                      ] as const
                    ).map(({ label, url, title, alt }) => (
                      <div
                        key={label}
                        className="group relative border rounded-xl overflow-hidden bg-slate-50 transition-all hover:ring-2 hover:ring-red-500/20"
                      >
                        <div className="p-2 border-b bg-white flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            {label}
                          </span>
                          {url ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => openDocument(url, title)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>
                        <div className="h-48 relative bg-slate-200 flex items-center justify-center overflow-hidden">
                          {!url ? (
                            <p className="text-xs text-slate-400">
                              No adjuntado
                            </p>
                          ) : url.toLowerCase().includes(".pdf") ? (
                            <iframe
                              src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
                              className="w-full h-full border-none pointer-events-none"
                              title={`Preview ${label}`}
                            />
                          ) : (
                            <Image
                              src={url}
                              alt={alt}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, 33vw"
                            />
                          )}
                          {url && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openDocument(url, title)}
                              >
                                Ver en Grande
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filterStatus === "pending" && !rejectReason && (
                <p className="text-sm text-red-500">
                  Razón de rechazo requerida para rechazar.
                </p>
              )}

              {filterStatus === "pending" && (
                <Textarea
                  placeholder="Razón de rechazo (requerido si se rechaza)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-3 sm:flex-col shrink-0">
            {filterStatus === "pending" && (
              <>
                {/* Botón Rechazar — rojo outline, solo habilitado con razón */}
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={isProcessing || !rejectReason}
                  className="w-full border-2 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold disabled:opacity-40"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" /> Rechazar solicitud
                    </>
                  )}
                </Button>

                {/* Separador visual */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex-1 border-t border-slate-200" />
                  <span>o</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>

                {/* Botón Aprobar — verde sólido grande */}
                <Button
                  className="w-full h-12 text-base bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-500/20"
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" /> Aprobar y activar
                      acceso
                    </>
                  )}
                </Button>
              </>
            )}
            {filterStatus === "active" && (
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isProcessing || !rejectReason}
                className="w-full border-2 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold disabled:opacity-40"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <X className="w-4 h-4 mr-2" /> Desactivar / Rechazar
                  </>
                )}
              </Button>
            )}
            {filterStatus === "rejected" && (
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1 h-12 border-2 border-red-300 text-red-600 hover:bg-red-50 font-semibold"
                  onClick={handleDelete}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-500/20"
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" /> Reactivar
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit profile dialog */}
      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar datos del usuario</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="val-edit-nombre">Nombre(s)</Label>
              <Input
                id="val-edit-nombre"
                value={editForm.nombre}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, nombre: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="val-edit-ap">Apellido paterno</Label>
              <Input
                id="val-edit-ap"
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
              <Label htmlFor="val-edit-am">Apellido materno</Label>
              <Input
                id="val-edit-am"
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
              <Label htmlFor="val-edit-matricula">Matrícula</Label>
              <Input
                id="val-edit-matricula"
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
              onClick={() => setEditingUser(null)}
              disabled={isSavingEdit}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizador de Documentos Expandido */}
      <Dialog
        open={!!viewingDoc}
        onOpenChange={(open) => !open && setViewingDoc(null)}
      >
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden border-none bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader className="p-4 bg-white/10 text-white flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {viewingDoc?.title}
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs">
                  Visualización segura de documentos SNTSS
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewingDoc(null)}
              className="text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>

          <div
            className="flex-1 w-full h-full bg-slate-800/50 flex items-center justify-center p-4 overflow-hidden"
            style={{ cursor: zoom > 1 ? "grab" : "default" }}
            onWheel={(e) => {
              if (viewingDoc?.url.toLowerCase().includes(".pdf")) return;
              e.preventDefault();
              setZoom((prev) =>
                Math.min(5, Math.max(1, prev + (e.deltaY > 0 ? -0.2 : 0.2))),
              );
            }}
            onMouseDown={(e) => {
              if (zoom <= 1) return;
              dragState.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                originX: offset.x,
                originY: offset.y,
              };
              (e.currentTarget as HTMLElement).style.cursor = "grabbing";
            }}
            onMouseMove={(e) => {
              if (!dragState.current.active) return;
              setOffset({
                x:
                  dragState.current.originX +
                  e.clientX -
                  dragState.current.startX,
                y:
                  dragState.current.originY +
                  e.clientY -
                  dragState.current.startY,
              });
            }}
            onMouseUp={(e) => {
              dragState.current.active = false;
              (e.currentTarget as HTMLElement).style.cursor =
                zoom > 1 ? "grab" : "default";
            }}
            onMouseLeave={() => {
              dragState.current.active = false;
            }}
          >
            {viewingDoc?.url.toLowerCase().includes(".pdf") ? (
              <iframe
                src={viewingDoc.url}
                className="w-full h-full rounded-lg shadow-2xl bg-white"
                title="Visor PDF"
              />
            ) : (
              <div
                className="relative w-full h-full flex items-center justify-center select-none"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: dragState.current.active
                    ? "none"
                    : "transform 0.15s ease",
                }}
              >
                <Image
                  src={viewingDoc?.url || ""}
                  alt="Documento expandido"
                  fill
                  unoptimized
                  className="object-contain rounded-lg shadow-2xl"
                  sizes="100vw"
                  draggable={false}
                />
              </div>
            )}
          </div>

          <div className="p-3 bg-white/5 border-t border-white/10 flex items-center justify-between">
            {!viewingDoc?.url.toLowerCase().includes(".pdf") ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                  onClick={() =>
                    setZoom((prev) =>
                      Math.max(1, parseFloat((prev - 0.25).toFixed(2))),
                    )
                  }
                  disabled={zoom <= 1}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-[11px] text-slate-300 w-10 text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                  onClick={() =>
                    setZoom((prev) =>
                      Math.min(5, parseFloat((prev + 0.25).toFixed(2))),
                    )
                  }
                  disabled={zoom >= 5}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-white/20 mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                  onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                  title="Rotar izquierda"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  title="Rotar derecha"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10 ml-1"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                    setOffset({ x: 0, y: 0 });
                  }}
                  disabled={
                    zoom === 1 &&
                    rotation === 0 &&
                    offset.x === 0 &&
                    offset.y === 0
                  }
                  title="Restablecer"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div />
            )}
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
              Propiedad del SNTSS Sección VII • Confidencial
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

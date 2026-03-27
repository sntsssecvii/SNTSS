"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase/firebase-client";
import { Button } from "@/components/ui/button";
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
import { Check, X, Eye, FileText, Loader2 } from "lucide-react";
import Image from "next/image";

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
  };
  rejectionReason?: string;
  createdAtMs: number | null;
}

interface AdminValidacionProps {
  filterStatus?: "pending" | "active" | "rejected";
  onDataChanged?: () => void;
}

interface UserRequestsResponse {
  data?: {
    requests?: UserRequest[];
  };
  error?: string;
}

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

  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const loadRequests = async () => {
      try {
        if (!cancelled) setLoading(true);

        const currentUser = auth.currentUser;
        if (!currentUser) {
          if (!cancelled) {
            setRequests([]);
            setLoading(false);
          }
          return;
        }

        const idToken = await currentUser.getIdToken();
        const response = await fetch(
          `/api/admin/validaciones/solicitudes?status=${filterStatus}`,
          {
            headers: { Authorization: `Bearer ${idToken}` },
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as UserRequestsResponse;

        if (!response.ok) {
          throw new Error(payload.error || `HTTP_${response.status}`);
        }

        if (!cancelled) {
          setRequests(payload.data?.requests || []);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching validation requests:", error);
        if (!cancelled) {
          setRequests([]);
          setLoading(false);
        }
      }
    };

    loadRequests();
    const intervalId = window.setInterval(() => {
      if (!document.hidden) loadRequests();
    }, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [filterStatus]);

  const refreshRequests = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const idToken = await currentUser.getIdToken();
    const response = await fetch(
      `/api/admin/validaciones/solicitudes?status=${filterStatus}`,
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
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || `HTTP_${response.status}`);
      }

      await refreshRequests();
      onDataChanged?.();
      toast({
        title: "Usuario Aprobado",
        description: "El usuario ha sido notificado.",
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
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || `HTTP_${response.status}`);
      }

      await refreshRequests();
      onDataChanged?.();
      toast({
        title: "Usuario Rechazado",
        description: "Se ha enviado la notificación de rechazo.",
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
          {requests.length}{" "}
          {filterStatus === "pending"
            ? "Pendientes"
            : filterStatus === "active"
              ? "Activos"
              : "Rechazados"}
        </Badge>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Documentos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
                  <TableCell>
                    <div className="flex gap-2">
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
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {filterStatus === "pending" ? (
                      <Button size="sm" onClick={() => setSelectedRequest(req)}>
                        <Eye className="w-4 h-4 mr-2" /> Revisar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRequest(req)}
                      >
                        <Eye className="w-4 h-4 mr-2" /> Ver Detalles
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisión de Solicitud</DialogTitle>
            <DialogDescription>
              Valida la información y documentos del usuario.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="grid gap-6 py-4">
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
                  <span className="font-semibold block">CURP:</span>
                  {selectedRequest.curp}
                </div>
                <div>
                  <span className="font-semibold block">Correo:</span>
                  {selectedRequest.email}
                </div>
                {selectedRequest.rejectionReason ? (
                  <div className="col-span-2">
                    <span className="font-semibold block">
                      Motivo de rechazo:
                    </span>
                    {selectedRequest.rejectionReason}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-slate-900">
                  Documentación Adjunta
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="group relative border rounded-xl overflow-hidden bg-slate-50 transition-all hover:ring-2 hover:ring-red-500/20">
                    <div className="p-2 border-b bg-white flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        Identificación (INE)
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          openDocument(
                            selectedRequest.documents.identificacion,
                            "Identificación Oficial",
                          )
                        }
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="h-48 relative bg-slate-200 flex items-center justify-center overflow-hidden">
                      {selectedRequest.documents.identificacion
                        .toLowerCase()
                        .includes(".pdf") ? (
                        <iframe
                          src={`${selectedRequest.documents.identificacion}#toolbar=0&navpanes=0&scrollbar=0`}
                          className="w-full h-full border-none pointer-events-none"
                          title="Preview INE"
                        />
                      ) : (
                        <Image
                          src={selectedRequest.documents.identificacion}
                          alt="Identificación"
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            openDocument(
                              selectedRequest.documents.identificacion,
                              "Identificación Oficial",
                            )
                          }
                        >
                          Ver en Grande
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="group relative border rounded-xl overflow-hidden bg-slate-50 transition-all hover:ring-2 hover:ring-red-500/20">
                    <div className="p-2 border-b bg-white flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        Tarjetón de Pago
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          openDocument(
                            selectedRequest.documents.tarjeton,
                            "Tarjetón de Pago",
                          )
                        }
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="h-48 relative bg-slate-200 flex items-center justify-center overflow-hidden">
                      {selectedRequest.documents.tarjeton
                        .toLowerCase()
                        .includes(".pdf") ? (
                        <iframe
                          src={`${selectedRequest.documents.tarjeton}#toolbar=0&navpanes=0&scrollbar=0`}
                          className="w-full h-full border-none pointer-events-none"
                          title="Preview Tarjetón"
                        />
                      ) : (
                        <Image
                          src={selectedRequest.documents.tarjeton}
                          alt="Tarjetón"
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            openDocument(
                              selectedRequest.documents.tarjeton,
                              "Tarjetón de Pago",
                            )
                          }
                        >
                          Ver en Grande
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {rejectReason && (
                <p className="text-sm text-red-500">
                  Razon de rechazo requerida para rechazar.
                </p>
              )}

              <Textarea
                placeholder="Razón de rechazo (requerido si se rechaza)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {filterStatus === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isProcessing || !rejectReason}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" /> Rechazar
                    </>
                  )}
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" /> Aprobar
                    </>
                  )}
                </Button>
              </>
            )}
            {filterStatus === "active" && (
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isProcessing || !rejectReason}
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
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApprove}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" /> Reactivar / Aprobar
                  </>
                )}
              </Button>
            )}
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

          <div className="flex-1 w-full h-full bg-slate-800/50 flex items-center justify-center p-4">
            {viewingDoc?.url.toLowerCase().includes(".pdf") ? (
              <iframe
                src={viewingDoc.url}
                className="w-full h-full rounded-lg shadow-2xl bg-white"
                title="Visor PDF"
              />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                <Image
                  src={viewingDoc?.url || ""}
                  alt="Documento expandido"
                  fill
                  unoptimized
                  className="object-contain rounded-lg shadow-2xl"
                  sizes="100vw"
                />
              </div>
            )}
          </div>

          <div className="p-3 bg-white/5 border-t border-white/10 flex justify-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
              Propiedad del SNTSS Sección VII • Confidencial
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

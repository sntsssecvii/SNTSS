"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { useToast } from "./ui/use-toast";
import {
  getPropuestas,
  deletePropuesta,
  searchPropuestas,
} from "@/lib/firebase/propuestas";
import { descargarPropuestaPDF } from "@/lib/pdf/generarPropuesta";
import type {
  Propuesta,
  FiltrosPropuesta,
  CategoriaPropuesta,
} from "@/types/propuestas";
import { CATEGORIAS_ARRAY } from "@/types/propuestas";
import { format } from "date-fns";
import {
  Edit,
  Trash2,
  Download,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { PropuestaForm } from "./PropuestaForm";

interface PropuestasTableProps {
  onNuevaPropuesta?: () => void;
}

export function PropuestasTable({ onNuevaPropuesta }: PropuestasTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [propuestaAEliminar, setPropuestaAEliminar] =
    useState<Propuesta | null>(null);
  const [showNuevaPropuestaModal, setShowNuevaPropuestaModal] = useState(false);
  const [showEditarPropuestaModal, setShowEditarPropuestaModal] =
    useState(false);
  const [propuestaAEditar, setPropuestaAEditar] = useState<string | null>(null);

  // Filtros
  const [filtros, setFiltros] = useState<FiltrosPropuesta>({});
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");

  // Cargar propuestas
  // Debounce para la búsqueda (esperar 500ms después de que el usuario deje de escribir)
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 500);

    return () => clearTimeout(timer);
  }, [busqueda]);

  const cargarPropuestas = useCallback(async () => {
    try {
      setLoading(true);
      const todasLasPropuestas = await getPropuestas();
      setPropuestas(todasLasPropuestas);
    } catch (error: any) {
      console.error("Error cargando propuestas:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las propuestas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Aplicar filtros y búsqueda
  useEffect(() => {
    const aplicarFiltros = async () => {
      try {
        setLoading(true);
        let resultados: Propuesta[];

        const tieneFiltros = Object.keys(filtros).length > 0;
        const tieneBusqueda = busquedaDebounced.trim().length > 0;

        if (tieneFiltros || tieneBusqueda) {
          // Usar búsqueda con filtros
          const filtrosBusqueda: FiltrosPropuesta = { ...filtros };

          if (tieneBusqueda) {
            // Búsqueda general: buscar en todos los campos relevantes
            // La función searchPropuestas detectará que es una búsqueda general
            // cuando los tres campos tienen el mismo valor
            filtrosBusqueda.trabajadorNombre = busquedaDebounced.trim();
            filtrosBusqueda.trabajadorMatricula = busquedaDebounced.trim();
            filtrosBusqueda.aspiranteNombre = busquedaDebounced.trim();
          }

          resultados = await searchPropuestas(filtrosBusqueda);
        } else {
          resultados = await getPropuestas();
        }

        setPropuestas(resultados);
      } catch (error: any) {
        console.error("Error aplicando filtros:", error);
        toast({
          title: "Error",
          description: error.message || "No se pudieron aplicar los filtros",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    aplicarFiltros();
  }, [filtros, busquedaDebounced, toast]);

  const handleEliminar = (propuesta: Propuesta) => {
    setPropuestaAEliminar(propuesta);
    setShowDeleteDialog(true);
  };

  const confirmarEliminar = async () => {
    if (!propuestaAEliminar?.id) return;

    try {
      setEliminandoId(propuestaAEliminar.id);
      await deletePropuesta(propuestaAEliminar.id);
      toast({
        title: "Éxito",
        description: "Propuesta eliminada correctamente",
      });
      cargarPropuestas();
    } catch (error: any) {
      console.error("Error eliminando propuesta:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la propuesta",
        variant: "destructive",
      });
    } finally {
      setEliminandoId(null);
      setShowDeleteDialog(false);
      setPropuestaAEliminar(null);
    }
  };

  const handleDescargar = async (propuesta: Propuesta) => {
    try {
      await descargarPropuestaPDF(propuesta);
      toast({
        title: "Éxito",
        description: "PDF descargado correctamente",
      });
    } catch (error: any) {
      console.error("Error descargando PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  const formatearFecha = (fecha: Date | any): string => {
    if (!fecha) return "N/A";
    try {
      const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
      return format(fechaDate, "dd/MM/yyyy");
    } catch {
      return "N/A";
    }
  };

  return (
    <>
      {/* Barra de búsqueda y filtros */}
      <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground z-10" />
            <Input
              placeholder="Buscar por nombre, matrícula..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 sm:pl-10 pr-8 sm:pr-10 h-10 sm:h-11 text-sm"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={() => setShowNuevaPropuestaModal(true)}
            className="h-10 sm:h-11 w-full sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
            <span className="text-sm sm:text-base">Nueva Propuesta</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">
              Categoría
            </label>
            <Select
              value={filtros.categoria || ""}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  categoria: e.target.value
                    ? (e.target.value as CategoriaPropuesta)
                    : undefined,
                })
              }
              className="h-9 sm:h-10 text-sm"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIAS_ARRAY.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">
              Fecha desde
            </label>
            <Input
              type="date"
              value={
                filtros.fechaDesde
                  ? format(filtros.fechaDesde, "yyyy-MM-dd")
                  : ""
              }
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  fechaDesde: e.target.value
                    ? new Date(e.target.value)
                    : undefined,
                })
              }
              className="h-9 sm:h-10 text-sm"
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">
              Fecha hasta
            </label>
            <Input
              type="date"
              value={
                filtros.fechaHasta
                  ? format(filtros.fechaHasta, "yyyy-MM-dd")
                  : ""
              }
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  fechaHasta: e.target.value
                    ? new Date(e.target.value)
                    : undefined,
                })
              }
              className="h-9 sm:h-10 text-sm"
            />
          </div>
        </div>

        {(filtros.categoria || filtros.fechaDesde || filtros.fechaHasta) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltros({})}
            className="h-9 sm:h-10 text-sm"
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Tabla - Desktop / Cards - Mobile */}
      {loading ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
        </div>
      ) : propuestas.length === 0 ? (
        <div className="text-center py-8 sm:py-12 text-muted-foreground">
          <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
          <p className="text-sm sm:text-base">No se encontraron propuestas</p>
        </div>
      ) : (
        <>
          {/* Vista de tabla para desktop */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Fecha</TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    Trabajador
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    Matrícula
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    Aspirante
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    Categoría
                  </TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propuestas.map((propuesta) => (
                  <TableRow key={propuesta.id}>
                    <TableCell className="text-xs sm:text-sm">
                      {formatearFecha(propuesta.fechaCreacion)}
                    </TableCell>
                    <TableCell className="font-medium text-xs sm:text-sm">
                      {propuesta.trabajadorActivo.nombre}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      {propuesta.trabajadorActivo.matricula}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      {propuesta.aspirante.nombre}
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {propuesta.aspirante.categoria}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 sm:gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDescargar(propuesta)}
                          title="Descargar PDF"
                          className="h-8 w-8 sm:h-9 sm:w-9"
                        >
                          <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPropuestaAEditar(propuesta.id || null);
                            setShowEditarPropuestaModal(true);
                          }}
                          title="Editar"
                          className="h-8 w-8 sm:h-9 sm:w-9"
                        >
                          <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEliminar(propuesta)}
                          disabled={eliminandoId === propuesta.id}
                          title="Eliminar"
                          className="h-8 w-8 sm:h-9 sm:w-9"
                        >
                          {eliminandoId === propuesta.id ? (
                            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Vista de cards para móvil */}
          <div className="md:hidden space-y-3">
            {propuestas.map((propuesta) => (
              <div
                key={propuesta.id}
                className="border rounded-lg p-4 bg-card shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">
                        Fecha
                      </p>
                      <p className="text-sm font-medium">
                        {formatearFecha(propuesta.fechaCreacion)}
                      </p>
                    </div>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded flex-shrink-0">
                      {propuesta.aspirante.categoria}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Trabajador
                      </p>
                      <p className="text-sm font-medium truncate">
                        {propuesta.trabajadorActivo.nombre}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Matrícula</p>
                      <p className="text-sm">
                        {propuesta.trabajadorActivo.matricula}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Aspirante</p>
                      <p className="text-sm truncate">
                        {propuesta.aspirante.nombre}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDescargar(propuesta)}
                      className="flex-1 h-9 text-xs"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPropuestaAEditar(propuesta.id || null);
                        setShowEditarPropuestaModal(true);
                      }}
                      className="flex-1 h-9 text-xs"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEliminar(propuesta)}
                      disabled={eliminandoId === propuesta.id}
                      className="flex-1 h-9 text-xs text-destructive hover:text-destructive"
                    >
                      {eliminandoId === propuesta.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dialog de confirmación de eliminación */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogClose onClose={() => setShowDeleteDialog(false)} />
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar esta propuesta? Esta acción
              no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {propuestaAEliminar && (
            <div className="py-4 space-y-2 text-sm">
              <p>
                <strong>Trabajador:</strong>{" "}
                {propuestaAEliminar.trabajadorActivo.nombre}
              </p>
              <p>
                <strong>Matrícula:</strong>{" "}
                {propuestaAEliminar.trabajadorActivo.matricula}
              </p>
              <p>
                <strong>Aspirante:</strong>{" "}
                {propuestaAEliminar.aspirante.nombre}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminar}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Nueva Propuesta */}
      <Dialog
        open={showNuevaPropuestaModal}
        onOpenChange={(open) => {
          setShowNuevaPropuestaModal(open);
          if (!open) {
            // Limpiar estados al cerrar
          }
        }}
      >
        <DialogContent className="max-w-7xl w-[95vw] sm:w-[90vw] max-h-[95vh] overflow-hidden flex flex-col p-0 sm:p-6">
          <DialogClose onClose={() => setShowNuevaPropuestaModal(false)} />
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6">
            <DialogTitle className="text-xl sm:text-2xl">
              Nueva Propuesta
            </DialogTitle>
            <DialogDescription className="text-sm">
              Completa el formulario para crear una nueva propuesta sindical
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <PropuestaForm
              onSuccess={() => {
                setShowNuevaPropuestaModal(false);
                cargarPropuestas();
                if (onNuevaPropuesta) onNuevaPropuesta();
              }}
              onCancel={() => setShowNuevaPropuestaModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Editar Propuesta */}
      <Dialog
        open={showEditarPropuestaModal}
        onOpenChange={(open) => {
          setShowEditarPropuestaModal(open);
          if (!open) {
            // Limpiar estados al cerrar
            setPropuestaAEditar(null);
          }
        }}
      >
        <DialogContent className="max-w-7xl w-[95vw] sm:w-[90vw] max-h-[95vh] overflow-hidden flex flex-col p-0 sm:p-6">
          <DialogClose
            onClose={() => {
              setShowEditarPropuestaModal(false);
              setPropuestaAEditar(null);
            }}
          />
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6">
            <DialogTitle className="text-xl sm:text-2xl">
              Editar Propuesta
            </DialogTitle>
            <DialogDescription className="text-sm">
              Modifica los datos de la propuesta sindical
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {propuestaAEditar && (
              <PropuestaForm
                propuestaId={propuestaAEditar}
                onSuccess={() => {
                  setShowEditarPropuestaModal(false);
                  setPropuestaAEditar(null);
                  cargarPropuestas();
                }}
                onCancel={() => {
                  setShowEditarPropuestaModal(false);
                  setPropuestaAEditar(null);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { db } from "./firebase-client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { convertirTimestamp } from "./firestore-utils";
import type {
  Propuesta,
  TrabajadorActivo,
  Aspirante,
  DuplicadoDetectado,
  FiltrosPropuesta,
} from "@/types/propuestas";
import {
  EstadoPropuesta,
  HistorialCambio,
  ComentarioPropuesta,
  esTransicionValida,
} from "@/types/workflow";
import { arrayUnion, arrayRemove } from "firebase/firestore";

const COLECCION = "propuestas";

// Convertir Propuesta de Firestore a Propuesta con fechas como Date
const convertirPropuesta = (doc: any): Propuesta => {
  const data = doc.data();
  return {
    id: doc.id,
    trabajadorActivo: data.trabajadorActivo,
    aspirante: data.aspirante,
    fechaCreacion: convertirTimestamp(data.fechaCreacion),
    fechaActualizacion: convertirTimestamp(data.fechaActualizacion),
    creadoPor: data.creadoPor,
    creadoPorEmail: data.creadoPorEmail,
    estado: data.estado || EstadoPropuesta.BORRADOR,
    historial:
      data.historial?.map((h: any) => ({
        ...h,
        fecha: convertirTimestamp(h.fecha),
      })) || [],
    comentarios:
      data.comentarios?.map((c: any) => ({
        ...c,
        fecha: convertirTimestamp(c.fecha),
      })) || [],
    etiquetas: data.etiquetas || [],
    prioridad: data.prioridad || "MEDIA",
    fechaVencimiento: data.fechaVencimiento
      ? convertirTimestamp(data.fechaVencimiento)
      : undefined,
    archivosAdjuntos: data.archivosAdjuntos || [],
  };
};

// Crear nueva propuesta
export const createPropuesta = async (
  trabajadorActivo: TrabajadorActivo,
  aspirante: Aspirante,
  creadoPor: string,
  creadoPorEmail?: string,
  estado: EstadoPropuesta = EstadoPropuesta.BORRADOR,
): Promise<string> => {
  try {
    const ahora = Timestamp.now();
    const historialInicial: HistorialCambio = {
      id: `hist_${Date.now()}`,
      fecha: ahora,
      usuarioId: creadoPor,
      usuarioEmail: creadoPorEmail,
      estadoAnterior: null,
      estadoNuevo: estado,
      comentario: "Propuesta creada",
    };

    const nuevaPropuesta = {
      trabajadorActivo,
      aspirante,
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
      creadoPor,
      creadoPorEmail: creadoPorEmail || null,
      estado,
      historial: [historialInicial],
      comentarios: [],
      etiquetas: [],
      prioridad: "MEDIA" as const,
      archivosAdjuntos: [],
    };

    const docRef = await addDoc(collection(db, COLECCION), nuevaPropuesta);
    return docRef.id;
  } catch (error) {
    console.error("Error creando propuesta:", error);
    throw error;
  }
};

// Obtener propuesta por ID
export const getPropuestaById = async (
  id: string,
): Promise<Propuesta | null> => {
  try {
    const docRef = doc(db, COLECCION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return convertirPropuesta(docSnap);
  } catch (error) {
    console.error("Error obteniendo propuesta:", error);
    throw error;
  }
};

// Obtener todas las propuestas
export const getPropuestas = async (
  limite: number = 500,
): Promise<Propuesta[]> => {
  try {
    const constraints: QueryConstraint[] = [
      orderBy("fechaCreacion", "desc"),
      limit(limite),
    ];

    const q = query(collection(db, COLECCION), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(convertirPropuesta);
  } catch (error) {
    console.error("Error obteniendo propuestas:", error);
    throw error;
  }
};

// Actualizar propuesta
export const updatePropuesta = async (
  id: string,
  trabajadorActivo: TrabajadorActivo,
  aspirante: Aspirante,
): Promise<void> => {
  try {
    const docRef = doc(db, COLECCION, id);
    await updateDoc(docRef, {
      trabajadorActivo,
      aspirante,
      fechaActualizacion: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error actualizando propuesta:", error);
    throw error;
  }
};

// Eliminar propuesta
export const deletePropuesta = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLECCION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error eliminando propuesta:", error);
    throw error;
  }
};

// Función para normalizar strings para comparación
const normalizar = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

// Función para verificar si dos strings son similares
const sonSimilares = (str1: string, str2: string): boolean => {
  const n1 = normalizar(str1);
  const n2 = normalizar(str2);

  // Coincidencia exacta
  if (n1 === n2) return true;

  // Coincidencia parcial (una contiene a la otra)
  if (n1.includes(n2) || n2.includes(n1)) {
    return true;
  }

  return false;
};

// Detectar campos que coinciden entre dos propuestas
const detectarCamposCoincidentes = (
  propuesta1: Propuesta,
  propuesta2: Propuesta,
): string[] => {
  const coincidencias: string[] = [];
  const t1 = propuesta1.trabajadorActivo;
  const t2 = propuesta2.trabajadorActivo;
  const a1 = propuesta1.aspirante;
  const a2 = propuesta2.aspirante;

  // Comparar datos del trabajador
  if (sonSimilares(t1.nombre, t2.nombre)) {
    coincidencias.push("Nombre del Trabajador");
  }
  if (
    t1.matricula &&
    t2.matricula &&
    sonSimilares(t1.matricula, t2.matricula)
  ) {
    coincidencias.push("Matrícula");
  }
  if (sonSimilares(t1.adscripcion, t2.adscripcion)) {
    coincidencias.push("Adscripción");
  }
  if (sonSimilares(t1.localidad, t2.localidad)) {
    coincidencias.push("Localidad del Trabajador");
  }
  if (t1.telefono && t2.telefono && t1.telefono === t2.telefono) {
    coincidencias.push("Teléfono del Trabajador");
  }

  // Comparar datos del aspirante
  if (sonSimilares(a1.nombre, a2.nombre)) {
    coincidencias.push("Nombre del Aspirante");
  }
  if (a1.curp && a2.curp && sonSimilares(a1.curp, a2.curp)) {
    coincidencias.push("CURP");
  }
  if (a1.rfc && a2.rfc && sonSimilares(a1.rfc, a2.rfc)) {
    coincidencias.push("RFC");
  }
  if (a1.telefono && a2.telefono && a1.telefono === a2.telefono) {
    coincidencias.push("Teléfono del Aspirante");
  }
  if (sonSimilares(a1.domicilio, a2.domicilio)) {
    coincidencias.push("Domicilio del Aspirante");
  }

  return coincidencias;
};

// Verificar duplicados antes de crear/actualizar
export const checkDuplicados = async (
  trabajadorActivo: TrabajadorActivo,
  aspirante: Aspirante,
  excluirId?: string,
): Promise<DuplicadoDetectado[]> => {
  try {
    const todasLasPropuestas = await getPropuestas();
    const duplicados: DuplicadoDetectado[] = [];

    for (const propuesta of todasLasPropuestas) {
      // Excluir la propuesta actual si estamos editando
      if (excluirId && propuesta.id === excluirId) {
        continue;
      }

      const camposCoincidentes = detectarCamposCoincidentes(
        {
          id: "",
          trabajadorActivo,
          aspirante,
          fechaCreacion: new Date(),
          fechaActualizacion: new Date(),
          creadoPor: "",
        },
        propuesta,
      );

      // Si hay al menos un campo coincidente, es un duplicado potencial
      if (camposCoincidentes.length > 0) {
        duplicados.push({
          propuesta,
          camposCoincidentes,
          porcentajeCoincidencia: (camposCoincidentes.length / 10) * 100, // Aproximado
        });
      }
    }

    return duplicados;
  } catch (error) {
    console.error("Error verificando duplicados:", error);
    throw error;
  }
};

// Búsqueda de propuestas con filtros
export const searchPropuestas = async (
  filtros: FiltrosPropuesta,
): Promise<Propuesta[]> => {
  try {
    const constraints: QueryConstraint[] = [orderBy("fechaCreacion", "desc")];

    // Aplicar filtros de Firestore (solo los que soporta directamente)
    if (filtros.categoria) {
      constraints.push(where("aspirante.categoria", "==", filtros.categoria));
    }

    const q = query(collection(db, COLECCION), ...constraints);
    const querySnapshot = await getDocs(q);

    let resultados = querySnapshot.docs.map(convertirPropuesta);

    // Si hay búsqueda de texto general (mismo término en múltiples campos), usar OR
    const tieneBusquedaGeneral =
      filtros.trabajadorNombre &&
      filtros.trabajadorMatricula &&
      filtros.aspiranteNombre &&
      filtros.trabajadorNombre === filtros.trabajadorMatricula &&
      filtros.trabajadorNombre === filtros.aspiranteNombre;

    if (tieneBusquedaGeneral) {
      // Búsqueda general: buscar en todos los campos con OR
      const terminoBusqueda = normalizar(filtros.trabajadorNombre!);
      resultados = resultados.filter((p) => {
        const nombreTrabajador = normalizar(p.trabajadorActivo.nombre);
        const matricula = normalizar(p.trabajadorActivo.matricula);
        const nombreAspirante = normalizar(p.aspirante.nombre);
        const adscripcion = normalizar(p.trabajadorActivo.adscripcion);
        const localidadTrabajador = normalizar(p.trabajadorActivo.localidad);
        const localidadAspirante = normalizar(p.aspirante.localidadDeseada);
        const curp = normalizar(p.aspirante.curp || "");
        const rfc = normalizar(p.aspirante.rfc || "");

        return (
          nombreTrabajador.includes(terminoBusqueda) ||
          matricula.includes(terminoBusqueda) ||
          nombreAspirante.includes(terminoBusqueda) ||
          adscripcion.includes(terminoBusqueda) ||
          localidadTrabajador.includes(terminoBusqueda) ||
          localidadAspirante.includes(terminoBusqueda) ||
          curp.includes(terminoBusqueda) ||
          rfc.includes(terminoBusqueda)
        );
      });
    } else {
      // Búsqueda específica por campos individuales (AND)
      if (filtros.trabajadorNombre) {
        const nombreBusqueda = normalizar(filtros.trabajadorNombre);
        resultados = resultados.filter((p) =>
          normalizar(p.trabajadorActivo.nombre).includes(nombreBusqueda),
        );
      }

      if (filtros.trabajadorMatricula) {
        const matriculaBusqueda = normalizar(filtros.trabajadorMatricula);
        resultados = resultados.filter((p) =>
          normalizar(p.trabajadorActivo.matricula).includes(matriculaBusqueda),
        );
      }

      if (filtros.aspiranteNombre) {
        const nombreBusqueda = normalizar(filtros.aspiranteNombre);
        resultados = resultados.filter((p) =>
          normalizar(p.aspirante.nombre).includes(nombreBusqueda),
        );
      }
    }

    // Filtros adicionales
    if (filtros.localidad) {
      const localidadBusqueda = normalizar(filtros.localidad);
      resultados = resultados.filter(
        (p) =>
          normalizar(p.trabajadorActivo.localidad).includes(
            localidadBusqueda,
          ) ||
          normalizar(p.aspirante.localidadDeseada).includes(localidadBusqueda),
      );
    }

    if (filtros.fechaDesde) {
      resultados = resultados.filter((p) => {
        const fechaCreacion = convertirTimestamp(p.fechaCreacion);
        return fechaCreacion >= filtros.fechaDesde!;
      });
    }

    if (filtros.fechaHasta) {
      resultados = resultados.filter((p) => {
        const fechaCreacion = convertirTimestamp(p.fechaCreacion);
        return fechaCreacion <= filtros.fechaHasta!;
      });
    }

    return resultados;
  } catch (error) {
    console.error("Error buscando propuestas:", error);
    throw error;
  }
};

// Cambiar estado de una propuesta
export const cambiarEstadoPropuesta = async (
  propuestaId: string,
  nuevoEstado: EstadoPropuesta,
  usuarioId: string,
  usuarioEmail?: string,
  usuarioNombre?: string,
  comentario?: string,
  motivo?: string,
): Promise<void> => {
  try {
    const docRef = doc(db, COLECCION, propuestaId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Propuesta no encontrada");
    }

    const propuesta = convertirPropuesta(docSnap);
    const estadoActual = propuesta.estado || EstadoPropuesta.BORRADOR;

    // Verificar si la transición es válida
    if (!esTransicionValida(estadoActual, nuevoEstado)) {
      throw new Error(
        `Transición inválida: no se puede cambiar de ${estadoActual} a ${nuevoEstado}`,
      );
    }

    // Crear entrada de historial
    const cambioHistorial: HistorialCambio = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fecha: Timestamp.now(),
      usuarioId,
      usuarioEmail,
      usuarioNombre,
      estadoAnterior: estadoActual,
      estadoNuevo: nuevoEstado,
      comentario,
      motivo,
    };

    // Actualizar propuesta
    await updateDoc(docRef, {
      estado: nuevoEstado,
      fechaActualizacion: Timestamp.now(),
      historial: arrayUnion(cambioHistorial),
    });
  } catch (error) {
    console.error("Error cambiando estado de propuesta:", error);
    throw error;
  }
};

// Agregar comentario a una propuesta
export const agregarComentario = async (
  propuestaId: string,
  contenido: string,
  usuarioId: string,
  usuarioEmail?: string,
  usuarioNombre?: string,
  mencionados?: string[],
  respuestaA?: string,
  archivosAdjuntos?: string[],
): Promise<string> => {
  try {
    const docRef = doc(db, COLECCION, propuestaId);
    const nuevoComentario: ComentarioPropuesta = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fecha: Timestamp.now(),
      usuarioId,
      usuarioEmail,
      usuarioNombre,
      contenido,
      mencionados: mencionados || [],
      respuestaA,
      archivosAdjuntos: archivosAdjuntos || [],
    };

    await updateDoc(docRef, {
      comentarios: arrayUnion(nuevoComentario),
      fechaActualizacion: Timestamp.now(),
    });

    return nuevoComentario.id;
  } catch (error) {
    console.error("Error agregando comentario:", error);
    throw error;
  }
};

// Actualizar etiquetas de una propuesta
export const actualizarEtiquetas = async (
  propuestaId: string,
  etiquetas: string[],
): Promise<void> => {
  try {
    const docRef = doc(db, COLECCION, propuestaId);
    await updateDoc(docRef, {
      etiquetas,
      fechaActualizacion: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error actualizando etiquetas:", error);
    throw error;
  }
};

// Actualizar prioridad de una propuesta
export const actualizarPrioridad = async (
  propuestaId: string,
  prioridad: "ALTA" | "MEDIA" | "BAJA",
): Promise<void> => {
  try {
    const docRef = doc(db, COLECCION, propuestaId);
    await updateDoc(docRef, {
      prioridad,
      fechaActualizacion: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error actualizando prioridad:", error);
    throw error;
  }
};

// Obtener propuestas por estado
export const getPropuestasPorEstado = async (
  estado: EstadoPropuesta,
): Promise<Propuesta[]> => {
  try {
    const q = query(
      collection(db, COLECCION),
      where("estado", "==", estado),
      orderBy("fechaActualizacion", "desc"),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertirPropuesta);
  } catch (error) {
    console.error("Error obteniendo propuestas por estado:", error);
    throw error;
  }
};

// Obtener propuestas por prioridad
export const getPropuestasPorPrioridad = async (
  prioridad: "ALTA" | "MEDIA" | "BAJA",
): Promise<Propuesta[]> => {
  try {
    const q = query(
      collection(db, COLECCION),
      where("prioridad", "==", prioridad),
      orderBy("fechaActualizacion", "desc"),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertirPropuesta);
  } catch (error) {
    console.error("Error obteniendo propuestas por prioridad:", error);
    throw error;
  }
};

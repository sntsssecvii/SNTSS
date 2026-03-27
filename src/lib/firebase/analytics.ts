import { db } from "./firebase-client";
import {
  collection,
  query,
  getDocs,
  where,
  orderBy,
  Timestamp,
  startAt,
  endAt,
} from "firebase/firestore";
import { convertirTimestamp } from "./firestore-utils";
import { EstadoPropuesta } from "@/types/workflow";
import { CategoriaPropuesta } from "@/types/propuestas";

const COLECCION = "propuestas";

// Obtener total de propuestas
export const getTotalPropuestas = async (): Promise<number> => {
  try {
    const q = query(collection(db, COLECCION));
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error("Error obteniendo total de propuestas:", error);
    return 0;
  }
};

// Obtener propuestas por estado
export const getPropuestasPorEstado = async (
  estado: EstadoPropuesta,
): Promise<number> => {
  try {
    const q = query(collection(db, COLECCION), where("estado", "==", estado));
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error(`Error obteniendo propuestas por estado ${estado}:`, error);
    return 0;
  }
};

// Obtener propuestas por categoría
export const getPropuestasPorCategoria = async (
  categoria: CategoriaPropuesta,
): Promise<number> => {
  try {
    const q = query(
      collection(db, COLECCION),
      where("aspirante.categoria", "==", categoria),
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error(
      `Error obteniendo propuestas por categoría ${categoria}:`,
      error,
    );
    return 0;
  }
};

// Obtener distribución de propuestas por estado
export const getDistribucionPorEstado = async (): Promise<
  Record<EstadoPropuesta, number>
> => {
  try {
    const estados = Object.values(EstadoPropuesta);
    const distribucion: Record<string, number> = {};

    for (const estado of estados) {
      distribucion[estado] = await getPropuestasPorEstado(estado);
    }

    return distribucion as Record<EstadoPropuesta, number>;
  } catch (error) {
    console.error("Error obteniendo distribución por estado:", error);
    return {} as Record<EstadoPropuesta, number>;
  }
};

// Obtener propuestas por mes (últimos 12 meses)
export const getPropuestasPorMes = async (): Promise<
  Array<{ mes: string; cantidad: number }>
> => {
  try {
    const ahora = new Date();
    const meses: Array<{ mes: string; cantidad: number }> = [];

    for (let i = 11; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const inicioMes = Timestamp.fromDate(fecha);
      const finMes = Timestamp.fromDate(
        new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59),
      );

      const q = query(
        collection(db, COLECCION),
        where("fechaCreacion", ">=", inicioMes),
        where("fechaCreacion", "<=", finMes),
      );

      const snapshot = await getDocs(q);
      const nombreMes = fecha.toLocaleDateString("es-MX", { month: "short" });

      meses.push({
        mes: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
        cantidad: snapshot.size,
      });
    }

    return meses;
  } catch (error) {
    console.error("Error obteniendo propuestas por mes:", error);
    return [];
  }
};

// Obtener propuestas pendientes de revisión (en revisión o borrador)
export const getPropuestasPendientes = async (): Promise<number> => {
  try {
    const enRevision = await getPropuestasPorEstado(
      EstadoPropuesta.EN_REVISION,
    );
    const borrador = await getPropuestasPorEstado(EstadoPropuesta.BORRADOR);
    return enRevision + borrador;
  } catch (error) {
    console.error("Error obteniendo propuestas pendientes:", error);
    return 0;
  }
};

// Obtener propuestas aprobadas
export const getPropuestasAprobadas = async (): Promise<number> => {
  return getPropuestasPorEstado(EstadoPropuesta.APROBADA);
};

// Obtener propuestas rechazadas
export const getPropuestasRechazadas = async (): Promise<number> => {
  return getPropuestasPorEstado(EstadoPropuesta.RECHAZADA);
};

// Obtener propuestas que requieren atención (alta prioridad o vencidas)
export const getPropuestasRequierenAtencion = async (): Promise<number> => {
  try {
    const ahora = Timestamp.now();
    const q = query(
      collection(db, COLECCION),
      where("prioridad", "==", "ALTA"),
    );
    const snapshot = await getDocs(q);

    // También contar propuestas vencidas
    const todas = await getDocs(collection(db, COLECCION));
    let vencidas = 0;

    todas.forEach((doc) => {
      const data = doc.data();
      if (data.fechaVencimiento && data.fechaVencimiento < ahora) {
        vencidas++;
      }
    });

    return snapshot.size + vencidas;
  } catch (error) {
    console.error("Error obteniendo propuestas que requieren atención:", error);
    return 0;
  }
};

// Obtener actividad del mes actual
export const getActividadDelMes = async (): Promise<number> => {
  try {
    const ahora = new Date();
    const inicioMes = Timestamp.fromDate(
      new Date(ahora.getFullYear(), ahora.getMonth(), 1),
    );
    const finMes = Timestamp.fromDate(
      new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59),
    );

    const q = query(
      collection(db, COLECCION),
      where("fechaCreacion", ">=", inicioMes),
      where("fechaCreacion", "<=", finMes),
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error("Error obteniendo actividad del mes:", error);
    return 0;
  }
};

// Obtener tasa de aprobación (últimos 30 días)
export const getTasaAprobacion = async (): Promise<number> => {
  try {
    const ahora = new Date();
    const hace30Dias = Timestamp.fromDate(
      new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000),
    );

    const q = query(
      collection(db, COLECCION),
      where("fechaActualizacion", ">=", hace30Dias),
    );

    const snapshot = await getDocs(q);
    let aprobadas = 0;
    let totales = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      totales++;
      if (data.estado === EstadoPropuesta.APROBADA) {
        aprobadas++;
      }
    });

    return totales > 0 ? (aprobadas / totales) * 100 : 0;
  } catch (error) {
    console.error("Error obteniendo tasa de aprobación:", error);
    return 0;
  }
};

// Obtener tiempo promedio de procesamiento (días)
export const getTiempoPromedioProcesamiento = async (): Promise<number> => {
  try {
    const q = query(
      collection(db, COLECCION),
      where("estado", "in", [
        EstadoPropuesta.APROBADA,
        EstadoPropuesta.COMPLETADA,
      ]),
    );

    const snapshot = await getDocs(q);
    let totalDias = 0;
    let count = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fechaCreacion && data.fechaActualizacion) {
        const fechaCreacion = convertirTimestamp(data.fechaCreacion);
        const fechaActualizacion = convertirTimestamp(data.fechaActualizacion);
        const dias = Math.ceil(
          (fechaActualizacion.getTime() - fechaCreacion.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        totalDias += dias;
        count++;
      }
    });

    return count > 0 ? Math.round(totalDias / count) : 0;
  } catch (error) {
    console.error("Error obteniendo tiempo promedio de procesamiento:", error);
    return 0;
  }
};

// Obtener top categorías más solicitadas
export const getTopCategorias = async (
  limite: number = 5,
): Promise<Array<{ categoria: string; cantidad: number }>> => {
  try {
    const snapshot = await getDocs(collection(db, COLECCION));
    const categorias: Record<string, number> = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      const categoria = data.aspirante?.categoria || "Sin categoría";
      categorias[categoria] = (categorias[categoria] || 0) + 1;
    });

    return Object.entries(categorias)
      .map(([categoria, cantidad]) => ({ categoria, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, limite);
  } catch (error) {
    console.error("Error obteniendo top categorías:", error);
    return [];
  }
};

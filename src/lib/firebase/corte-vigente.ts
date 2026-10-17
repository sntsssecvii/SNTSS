import { adminDb } from "@/lib/firebase/admin";

export interface CorteVigente {
  anio: number;
  mes: number;
  quincena: number;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Periodo de la sincronización marcada como fuente de verdad: el mismo corte
 * que ve el trabajador en su portal ("Corte oficial"). Solo el periodo, sin
 * datos de trabajadores, para mostrarlo en la landing pública.
 */
export async function getCorteVigente(): Promise<CorteVigente | null> {
  const snap = await adminDb
    .collection("sincronizaciones")
    .where("esFuenteVerdad", "==", true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const { anio, mes, quincena } = snap.docs[0].data();
  if (!anio || !mes || !quincena) return null;
  return { anio: Number(anio), mes: Number(mes), quincena: Number(quincena) };
}

/** "2ª quincena de octubre 2026" */
export function formatearCorte(c: CorteVigente): string {
  return `${c.quincena}ª quincena de ${MESES[c.mes - 1] ?? ""} ${c.anio}`;
}

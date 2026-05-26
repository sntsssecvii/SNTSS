// src/lib/firebase/contadores.ts
// Solo para uso en servidor (API Routes) — usa firebase-admin
import { adminDb } from "./admin";
import { Timestamp } from "firebase-admin/firestore";

const CONTADOR_DOC = "contadores/propuestas";

interface ContadorPropuestas {
  ultimoCaso: number;
  ultimoFolio: number;
  anio: number;
}

/**
 * Genera un numeroCaso único en formato "CASO-YYYY-NNNN".
 * Ejecuta en transacción para garantizar unicidad.
 */
export async function generarNumeroCaso(): Promise<string> {
  const anioActual = new Date().getFullYear();
  const ref = adminDb.doc(CONTADOR_DOC);

  const numero = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as ContadorPropuestas | undefined;
    const anioDoc = data?.anio ?? anioActual;
    const base = anioDoc === anioActual ? (data?.ultimoCaso ?? 0) : 0;
    const siguiente = base + 1;
    tx.set(ref, { ultimoCaso: siguiente, anio: anioActual }, { merge: true });
    return siguiente;
  });

  return `CASO-${anioActual}-${String(numero).padStart(4, "0")}`;
}

/**
 * Genera un folio oficial único en formato "YYYY-NNNN".
 * Solo llamar al APROBAR una propuesta.
 */
export async function generarFolio(): Promise<string> {
  const anioActual = new Date().getFullYear();
  const ref = adminDb.doc(CONTADOR_DOC);

  const numero = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as ContadorPropuestas | undefined;
    const anioDoc = data?.anio ?? anioActual;
    const base = anioDoc === anioActual ? (data?.ultimoFolio ?? 0) : 0;
    const siguiente = base + 1;
    tx.set(ref, { ultimoFolio: siguiente, anio: anioActual }, { merge: true });
    return siguiente;
  });

  return `${anioActual}-${String(numero).padStart(4, "0")}`;
}

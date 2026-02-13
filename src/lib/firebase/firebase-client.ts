"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

// Inicializamos la App una sola vez fuera de las funciones
// para que el registro de servicios sea global.
const app = typeof window !== "undefined"
    ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
    : null;

export const auth = app ? getAuth(app) : {} as any;
export const db = app ? getFirestore(app) : {} as any;

/**
 * Esta función es la ÚNICA forma de obtener Storage.
 * Importa el SDK y lo conecta a la App en un solo paso.
 */
export async function getStorageTools() {
    if (typeof window === "undefined" || !app) return null;

    try {
        // Importamos el módulo de storage
        const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");

        // Obtenemos la instancia (Firebase la registrará automáticamente al llamar a getStorage)
        const storage = getStorage(app);

        return { storage, ref, uploadBytes, getDownloadURL };
    } catch (e: any) {
        console.error("❌ Fallo crítico en getStorageTools:", e.message);
        return null;
    }
}

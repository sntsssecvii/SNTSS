// lib/firebase/server-config.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

/**
 * Inicialización segura para el Servidor (Node.js/SSR).
 * IMPORTANTE: No importar servicios de cliente (como Storage o Analytics) aquí.
 */
export const getServerApp = (): FirebaseApp => {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
};

export const getServerDb = (): Firestore => {
  return getFirestore(getServerApp());
};

// Exportar instancias directas para uso en server components o API routes
export const app = getServerApp();
export const db = getServerDb();

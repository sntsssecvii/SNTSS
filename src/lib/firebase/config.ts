// lib/firebase/config.ts
/**
 * Configuración centralizada de Firebase.
 * Este archivo SOLO contiene la configuración y tipos, no inicializa servicios
 * para evitar efectos secundarios en entornos SSR de Next.js.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyANP-3Ld0HibnyZIiPiiBePmtStFrjY0bI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sntss-f352c.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sntss-f352c",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sntss-f352c.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "201506560314",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:201506560314:web:85dee924b6e2d3b310d803",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-T5Q62E3C60"
};

export type FirebaseConfig = typeof firebaseConfig;

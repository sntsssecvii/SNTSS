// lib/firebase/config.ts
/**
 * Configuración centralizada de Firebase.
 * Este archivo SOLO contiene la configuración y tipos, no inicializa servicios
 * para evitar efectos secundarios en entornos SSR de Next.js.
 */
const requiredClientEnv = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const

const clientEnvMap = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} satisfies Record<typeof requiredClientEnv[number], string | undefined>

function getClientEnv(name: typeof requiredClientEnv[number]) {
  const value = clientEnvMap[name]
  if (!value) {
    throw new Error(`Missing required Firebase client env: ${name}`)
  }
  return value
}

export const firebaseConfig = {
  apiKey: getClientEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: getClientEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: getClientEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: getClientEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getClientEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getClientEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export type FirebaseConfig = typeof firebaseConfig;

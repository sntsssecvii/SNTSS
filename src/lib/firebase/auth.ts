import { onAuthStateChanged, type Unsubscribe } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  getAuth
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from './config';
import { auth as clientAuth } from './firebase-client';

// Usar la auth principal del cliente si estamos en el browser, si no una dummy
export const auth = typeof window !== 'undefined' ? clientAuth : {} as any;

// Instancia administrativa (Solo para cuando el admin crea otros usuarios)
let adminApp: any;
let adminAuth: any;

const initializeAdminAuth = () => {
  if (adminAuth) return adminAuth;
  const existingAdminApp = getApps().find(app => app.name === 'adminApp');
  adminApp = existingAdminApp || initializeApp(firebaseConfig, 'adminApp');
  adminAuth = getAuth(adminApp);
  return adminAuth;
};

// Variables de estado
let isCreatingUser = false;
let currentAuthUnsubscribe: Unsubscribe | null = null;

export const setCreatingUserState = (state: boolean) => { isCreatingUser = state; };
export const getCreatingUserState = () => isCreatingUser;

export const initializeAuthListener = () => {
  if (typeof window === 'undefined') return;
  if (currentAuthUnsubscribe) currentAuthUnsubscribe();
  currentAuthUnsubscribe = onAuthStateChanged(auth, (user) => {
    console.log('🔄 [Auth] Estado cambiado:', user?.email);
  });
};

export const cleanupAuthListener = () => {
  if (currentAuthUnsubscribe) {
    currentAuthUnsubscribe();
    currentAuthUnsubscribe = null;
  }
};

export const createUserAndMaintainSession = async (adminEmail: string, adminPassword: string, newUserEmail: string, newUserPassword: string) => {
  try {
    setCreatingUserState(true);
    const aAuth = initializeAdminAuth();
    await setPersistence(aAuth, browserLocalPersistence);
    await signInWithEmailAndPassword(aAuth, adminEmail, adminPassword);

    const newUserCredential = await createUserWithEmailAndPassword(aAuth, newUserEmail, newUserPassword);
    await aAuth.signOut();
    return newUserCredential.user;
  } finally {
    setCreatingUserState(false);
  }
};

export const createNewUserWithoutSignIn = async (email: string, password: string) => {
  const adminEmail = auth.currentUser?.email;
  const adminPassword = sessionStorage.getItem('adminPassword');
  if (!adminEmail || !adminPassword) throw new Error('El alta delegada desde cliente fue deshabilitada por seguridad');
  return createUserAndMaintainSession(adminEmail, adminPassword, email, password);
};

export const setAdminCredentials = () => {};

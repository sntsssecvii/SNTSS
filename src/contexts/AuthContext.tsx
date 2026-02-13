'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase/firebase-client'
import { type UserData } from '@/lib/firebase/users'
import { getAuth } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { getCreatingUserState, initializeAuthListener, cleanupAuthListener } from '@/lib/firebase/auth'
import { LoadingScreen } from '@/components/ui/loading-screen'

interface AuthUser {
  uid: string
  email: string | null
}

interface AuthContextType {
  user: AuthUser | null
  userData: UserData | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setCreatingUser: (creating: boolean) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// Mapeo de roles a rutas iniciales
const HOME_ROUTES = {
  'ADMIN': '/admin',
  'USER': '/dashboard',
} as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingUser, setIsCreatingUser] = useState(false)

  useEffect(() => {
    const auth = getAuth();
    initializeAuthListener();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔄 AuthContext: Cambio de estado detectado', {
        email: firebaseUser?.email,
        uid: firebaseUser?.uid,
        isAuthenticated: !!firebaseUser,
      });

      if (getCreatingUserState()) {
        console.log('⏳ Creación de usuario en proceso, ignorando cambio de estado');
        return;
      }

      if (!firebaseUser) {
        console.log('👤 No hay usuario autenticado, limpiando estado');
        setUser(null);
        setUserData(null);
        setLoading(false);
        return;
      }

      console.log('👤 Usuario autenticado encontrado:', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
      });

      try {
        console.log('🔄 Iniciando carga de datos del usuario...');

        // Verificar que Firebase esté configurado antes de intentar obtener datos
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        console.log('🔑 Verificando configuración de Firebase:', {
          hasApiKey: !!apiKey,
          apiKeyLength: apiKey?.length || 0,
        });

        if (!apiKey) {
          console.warn('⚠️ Firebase no está configurado - NEXT_PUBLIC_FIREBASE_API_KEY no existe');
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

        // Obtener datos del usuario directamente
        console.log('📄 Leyendo documento:', `users/${firebaseUser.uid}`);

        const userDocRef = doc(db, 'users', firebaseUser.uid);

        // Intentar lectura con timeout de 8 segundos
        const userDoc = await Promise.race([
          getDoc(userDocRef),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT: Firestore no responde después de 8 segundos')), 8000)
          )
        ]) as any;

        if (!userDoc.exists()) {
          console.warn('⚠️ Documento no existe en Firestore para el UID:', firebaseUser.uid);
          // No lanzamos error ni cerramos sesión aquí, solo dejamos userData como null
          // Esto permite que el flujo de registro termine de crear el documento
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email
          });
          setUserData(null);
          setLoading(false);
          return;
        }

        const userDataFromFirestore = userDoc.data() as UserData;

        // GUARDIA DE STATUS: Si el usuario es 'pending', no le dejamos entrar
        if (userDataFromFirestore.status === 'pending') {
          console.log('⏳ Usuario con estatus PENDIENTE, cerrando sesión...');
          await signOut(auth);
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

        console.log('✅ Datos de usuario cargados exitosamente:', {
          email: userDataFromFirestore.email,
          role: userDataFromFirestore.role,
          nombre: userDataFromFirestore.nombre
        });

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email
        });
        setUserData(userDataFromFirestore);
        setError(null);

        // La redirección se manejará en el componente LoginForm cuando detecte userData
      } catch (error: any) {
        console.error('❌ Error en AuthContext:', error);
        console.error('❌ Stack trace:', error.stack);

        // Mensajes de error más específicos
        let errorMessage = 'Error al cargar datos del usuario';

        if (error?.message?.includes('Timeout')) {
          errorMessage = 'Tiempo de espera agotado al conectar con Firestore. Verifica tu conexión a internet y las reglas de seguridad.';
        } else if (error?.code === 'unavailable' || error?.message?.includes('database') || error?.message?.includes('NOT_FOUND')) {
          errorMessage = '⚠️ FIRESTORE NO ESTÁ DISPONIBLE. Verifica las reglas de seguridad en Firebase Console.';
        } else if (error?.code === 'permission-denied') {
          errorMessage = 'PERMISOS DENEGADOS: Las reglas de Firestore están bloqueando la lectura. Ve a Firebase Console → Firestore → Reglas.';
        } else if (error?.message) {
          errorMessage = error.message;
        }

        setError(errorMessage);
        setUser(null);
        setUserData(null);

        // Cerrar sesión en caso de error
        try {
          await signOut(auth);
        } catch (e) {
          console.error('Error al cerrar sesión:', e);
        }
      } finally {
        console.log('🏁 Finalizando carga de datos del usuario');
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      cleanupAuthListener();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      setUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido')
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
      setUser(null)
      setUserData(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido')
      throw error
    }
  }

  const setCreatingUser = (creating: boolean) => {
    setIsCreatingUser(creating);
  };

  const value = {
    user,
    userData,
    loading,
    error,
    login,
    logout,
    setCreatingUser
  }

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
}

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase/firebase-client";
import { type UserData } from "@/lib/firebase/users";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  getCreatingUserState,
  initializeAuthListener,
  cleanupAuthListener,
} from "@/lib/firebase/auth";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { getHomeRouteForRole } from "@/lib/auth/roles";

interface AuthUser {
  uid: string;
  email: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  userData: UserData | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCreatingUser: (creating: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setIsCreatingUser] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    initializeAuthListener();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (getCreatingUserState()) {
        return;
      }

      if (!firebaseUser) {
        setUser(null);
        setUserData(null);
        setLoading(false);
        return;
      }

      try {
        // Verificar que Firebase esté configurado antes de intentar obtener datos
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

        if (!apiKey) {
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

        // Obtener datos del usuario directamente
        const userDocRef = doc(db, "users", firebaseUser.uid);

        // Intentar lectura con timeout de 8 segundos
        const userDoc = (await Promise.race([
          getDoc(userDocRef),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "TIMEOUT: Firestore no responde después de 8 segundos",
                  ),
                ),
              8000,
            ),
          ),
        ])) as any;

        if (!userDoc.exists()) {
          // No lanzamos error ni cerramos sesión aquí, solo dejamos userData como null
          // Esto permite que el flujo de registro termine de crear el documento
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          });
          setUserData(null);
          setLoading(false);
          return;
        }

        const userDataFromFirestore = userDoc.data() as UserData;

        // GUARDIA DE STATUS: Si el usuario es 'pending', no le dejamos entrar
        if (userDataFromFirestore.status === "pending") {
          await signOut(auth);
          setError(
            "Tu solicitud de registro está en revisión. El sindicato te avisará por correo cuando sea aprobada.",
          );
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

        // GUARDIA DE STATUS: Si el usuario fue rechazado, tampoco entra
        if (userDataFromFirestore.status === "rejected") {
          await signOut(auth);
          setError(
            "Tu solicitud fue rechazada. Puedes volver a registrarte con tus documentos correctos.",
          );
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
        });
        setUserData(userDataFromFirestore);
        setError(null);

        // La redirección se manejará en el componente LoginForm cuando detecte userData
      } catch (error: any) {
        console.error("Error en AuthContext:", error);

        // Mensajes de error más específicos
        let errorMessage = "Error al cargar datos del usuario";

        if (error?.message?.includes("Timeout")) {
          errorMessage =
            "Tiempo de espera agotado al conectar con Firestore. Verifica tu conexión a internet y las reglas de seguridad.";
        } else if (
          error?.code === "unavailable" ||
          error?.message?.includes("database") ||
          error?.message?.includes("NOT_FOUND")
        ) {
          errorMessage =
            "⚠️ FIRESTORE NO ESTÁ DISPONIBLE. Verifica las reglas de seguridad en Firebase Console.";
        } else if (error?.code === "permission-denied") {
          errorMessage =
            "PERMISOS DENEGADOS: Las reglas de Firestore están bloqueando la lectura. Ve a Firebase Console → Firestore → Reglas.";
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
          console.error("Error al cerrar sesión:", e);
        }
      } finally {
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
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      setUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error desconocido");
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error desconocido");
      throw error;
    }
  };

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
    setCreatingUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}

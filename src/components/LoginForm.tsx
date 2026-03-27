"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/components/ui/use-toast";
import { setAdminCredentials } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "./ui/loading-screen";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// Mapeo de roles a rutas iniciales
const HOME_ROUTES = {
  ADMIN: "/admin",
  USER: "/dashboard",
} as const;

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user, userData, error } = useAuth();
  const auth = getAuth();

  // Efecto para redirigir si ya hay sesión activa
  useEffect(() => {
    if (user && userData?.role) {
      // Normalizamos a mayúsculas para coincidir con HOME_ROUTES (ADMIN/USER)
      const roleKey = userData.role.toUpperCase() as keyof typeof HOME_ROUTES;
      const redirectPath = HOME_ROUTES[roleKey];

      if (redirectPath) {
        router.push(redirectPath);
      } else {
        console.warn("⚠️ No se encontró ruta para el rol:", userData.role);
      }
    }
  }, [user, userData, router]);

  // Mostrar error del AuthContext si existe
  useEffect(() => {
    if (error) {
      console.error("❌ Error del AuthContext:", error);
      toast({
        title: "Error de base de datos",
        description: error,
        variant: "destructive",
        duration: 10000,
      });
      setLoading(false);
    }
  }, [error, toast]);

  // Si hay usuario autenticado, mostrar estado de redirección en lugar del formulario
  if (user && userData) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Redirigiendo a su panel...
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevenir múltiples envíos
    setLoading(true);

    let success = false;
    let authSuccess = false;
    try {
      // Verificar que Firebase esté configurado
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        throw new Error(
          "Firebase no está configurado. Por favor, configura las variables de entorno.",
        );
      }

      // Autenticar con Firebase (AuthContext manejará la lectura de Firestore)
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      authSuccess = true;

      // Guardar credenciales del admin en memoria (para re-auth al crear usuarios)
      setAdminCredentials(email, password);

      // Mostrar toast de éxito
      toast({
        title: "¡Bienvenido!",
        description: "Iniciando sesión...",
      });

      success = true;

      // Esperar a que AuthContext cargue los datos y redirigir
      // El AuthContext manejará la redirección automáticamente cuando tenga los datos
      // Si hay un error de Firestore, se mostrará en el AuthContext
    } catch (error: any) {
      console.error("❌ Error en login:", error);
      const errorMessage = error?.message || "Error desconocido";
      const isConfigError =
        errorMessage.includes("Firebase no está configurado") ||
        errorMessage.includes("invalid-api-key");

      // Si ya se autenticó pero falló después, cerrar sesión
      if (authSuccess) {
        try {
          await auth.signOut();
        } catch (e) {
          console.error("Error al cerrar sesión:", e);
        }
      }

      toast({
        title: "Error al iniciar sesión",
        description: isConfigError
          ? "Firebase no está configurado. Por favor, configura las variables de entorno en el archivo .env"
          : errorMessage.includes("Credenciales") ||
              errorMessage.includes("auth/")
            ? "Credenciales incorrectas. Por favor, verifica tus datos."
            : errorMessage.includes("Firestore") ||
                errorMessage.includes("database")
              ? "⚠️ Base de datos no disponible. Por favor contacta al administrador."
              : errorMessage,
        variant: "destructive",
      });
    } finally {
      if (!success) {
        setLoading(false);
      }
    }
  };

  return (
    <>
      {loading && <LoadingScreen message="Iniciando sesión..." />}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-auto space-y-4 sm:space-y-6"
      >
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="correo@ejemplo.com"
              className="h-11"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="/recuperar-password"
                className="text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="h-11 pr-10"
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 font-medium"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar Sesión"
            )}
          </Button>
        </form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">¿No tienes cuenta? </span>
          <Link
            href="/registro"
            className="font-semibold text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            Regístrate aquí
          </Link>
        </div>
      </motion.div>
    </>
  );
}

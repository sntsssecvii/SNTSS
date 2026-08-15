/**
 * SNTSS — Plataforma institucional
 * © 2026 Zentry Tech Group S de RL de CV. Todos los derechos reservados.
 * Software y código fuente propiedad intelectual de Zentry Tech Group.
 * Licencia de uso institucional para el SNTSS. Prohibida su comercialización,
 * reventa o sublicenciamiento a terceros.
 */
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/next";
import { MaintenanceGate } from "@/components/MaintenanceGate";

// Importar diagnóstico para que esté disponible globalmente
if (typeof window !== "undefined") {
  import("@/lib/firebase/diagnostico");
}

export const metadata = {
  title: "SNTSS",
  description: "Sistema de gestión SNTSS",
  applicationName: "SNTSS",
  authors: [{ name: "Zentry Tech Group" }],
  creator: "Zentry Tech Group S de RL de CV",
  publisher: "Zentry Tech Group S de RL de CV",
  icons: {
    icon: [
      {
        url: "/images/logo.png",
        href: "/images/logo.png",
      },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased transition-colors duration-300 font-sans">
        <MaintenanceGate>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
          >
            <AuthProvider>
              <NotificationProvider>
                {children}
                <Toaster />
                <Analytics />
              </NotificationProvider>
            </AuthProvider>
          </ThemeProvider>
        </MaintenanceGate>
      </body>
    </html>
  );
}

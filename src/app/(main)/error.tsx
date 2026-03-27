"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MainLayout] Error no capturado:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Ocurrió un error inesperado</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          No se pudo cargar esta sección. Por favor intenta de nuevo.
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Intentar de nuevo
      </Button>
    </div>
  );
}

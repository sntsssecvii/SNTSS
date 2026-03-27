"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PublicLayout] Error no capturado:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 text-center py-20">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Algo salió mal</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          No se pudo cargar la información. Por favor intenta de nuevo.
        </p>
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        Intentar de nuevo
      </Button>
    </div>
  );
}

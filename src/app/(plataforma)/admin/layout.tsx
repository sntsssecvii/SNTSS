import { PanelEnPausa } from "@/components/PanelEnPausa";
import { PausaGate } from "@/components/PausaGate";

/** Rutas admin fuera del shell: mismo aviso de pausa, centrado. */
export default function AdminSueltoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PausaGate
      aviso={
        <div className="min-h-screen bg-background p-4 sm:p-8">
          <PanelEnPausa />
        </div>
      }
    >
      {children}
    </PausaGate>
  );
}

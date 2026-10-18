import { PanelEnPausa } from "@/components/PanelEnPausa";
import { PausaGate } from "@/components/PausaGate";

/** En modo "solo consulta" el panel de administración queda en pausa. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PausaGate aviso={<PanelEnPausa />}>{children}</PausaGate>;
}

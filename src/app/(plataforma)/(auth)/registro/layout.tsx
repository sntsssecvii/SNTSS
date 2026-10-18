import { MantenimientoScreen } from "@/components/MantenimientoScreen";
import { PausaGate } from "@/components/PausaGate";

/** En modo "solo consulta" nadie valida cuentas: el registro se pausa. */
export default function RegistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PausaGate aviso={<MantenimientoScreen variante="registro" />}>
      {children}
    </PausaGate>
  );
}

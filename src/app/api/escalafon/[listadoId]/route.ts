import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { obtenerListado, obtenerAspirantes } from "@/lib/firebase/escalafon";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { listadoId: string } },
) {
  try {
    await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const listado = await obtenerListado(params.listadoId);
  if (!listado) {
    return NextResponse.json(
      { error: "Listado no encontrado" },
      { status: 404 },
    );
  }

  const aspirantes = await obtenerAspirantes(params.listadoId);
  return NextResponse.json({ listado, aspirantes });
}

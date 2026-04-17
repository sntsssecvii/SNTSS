import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";
import { listarListados } from "@/lib/firebase/escalafon";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdminRequest(req);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const listados = await listarListados();
    return NextResponse.json({ listados });
  } catch (error) {
    console.error("[escalafon]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

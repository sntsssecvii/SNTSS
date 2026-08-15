import { NextRequest, NextResponse } from "next/server";
import { requireDeveloperRequest } from "@/lib/firebase/server-auth";
import {
  getEstadoMantenimiento,
  setMantenimiento,
} from "@/lib/firebase/mantenimiento";
import { COOKIE_BYPASS } from "@/lib/mantenimiento-secreto";

/**
 * Control del kill-switch desde la sesión de admin (solo developer).
 *
 * Toda respuesta siembra/renueva la cookie de bypass en el navegador del
 * operador, de modo que el gate NUNCA lo bloquee aunque la plataforma esté
 * suspendida (anti-lockout). Solo `requireDeveloperRequest` puede llegar aquí.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UN_ANIO = 60 * 60 * 24 * 365;

function sembrarBypass(res: NextResponse) {
  const secreto = process.env.MAINTENANCE_CONTROL_SECRET;
  if (!secreto) return;
  res.cookies.set(COOKIE_BYPASS, secreto, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UN_ANIO,
  });
}

async function autorizar(req: NextRequest): Promise<NextResponse | null> {
  try {
    await requireDeveloperRequest(req);
    return null;
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
}

export async function GET(req: NextRequest) {
  const noAuth = await autorizar(req);
  if (noAuth) return noAuth;

  const estado = await getEstadoMantenimiento();
  const res = NextResponse.json(estado);
  sembrarBypass(res); // dejar lista la cookie antes de cualquier suspensión
  return res;
}

export async function POST(req: NextRequest) {
  const noAuth = await autorizar(req);
  if (noAuth) return noAuth;

  const body = (await req.json().catch(() => ({}))) as { activar?: boolean };
  const activar = body?.activar === true;

  await setMantenimiento(
    activar,
    activar ? "Suspensión manual desde panel admin" : undefined,
  );

  const estado = await getEstadoMantenimiento();
  const res = NextResponse.json(estado);
  sembrarBypass(res);
  return res;
}

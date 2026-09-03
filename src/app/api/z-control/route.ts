import { NextRequest, NextResponse } from "next/server";
import {
  getEstadoMantenimiento,
  setMantenimiento,
} from "@/lib/firebase/mantenimiento";
import { secretoMantenimientoValido } from "@/lib/mantenimiento-secreto";

/**
 * Control privado del kill-switch de mantenimiento.
 *
 * NO aparece en el panel admin y está protegido por un secreto que solo
 * el operador conoce (`MAINTENANCE_CONTROL_SECRET`, en variables de entorno).
 * Al ser un route handler NO pasa por el gate del layout raíz, así que sigue
 * accesible aunque la plataforma esté suspendida (anti-lockout).
 *
 * Uso: abrir `/api/z-control?k=<secreto>` desde un bookmark. Sin el secreto
 * correcto responde 404 para no delatar su existencia.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noEncontrado = () =>
  new NextResponse("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });

function paginaControl(
  activo: boolean,
  desde: string | undefined,
  secreto: string,
): string {
  const estadoTexto = activo ? "SUSPENDIDA" : "OPERATIVA";
  const estadoColor = activo ? "#dc2626" : "#16a34a";
  const desdeTexto =
    activo && desde
      ? `Suspendida desde ${new Date(desde).toLocaleString("es-MX")}`
      : "";
  const esc = (s: string) => s.replace(/"/g, "&quot;");
  const botones = activo
    ? `<button name="accion" value="reactivar" class="btn verde">REACTIVAR PLATAFORMA</button>`
    : `<button name="accion" value="suspender" class="btn rojo">SUSPENDER PLATAFORMA</button>`;

  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Control</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family:-apple-system,system-ui,sans-serif; background:#f8fafc; color:#0f172a; padding:24px; }
  .card { width:100%; max-width:380px; background:#fff; border:1px solid #e2e8f0; border-radius:16px;
    padding:28px 24px; box-shadow:0 4px 24px rgba(0,0,0,.06); text-align:center; }
  h1 { font-size:15px; font-weight:600; color:#64748b; margin:0 0 18px; letter-spacing:.02em; }
  .estado { font-size:30px; font-weight:800; letter-spacing:.03em; color:${estadoColor}; }
  .desde { font-size:12px; color:#94a3b8; margin-top:6px; min-height:16px; }
  form { margin-top:24px; }
  .btn { width:100%; border:0; border-radius:12px; padding:18px; font-size:16px; font-weight:700;
    color:#fff; cursor:pointer; letter-spacing:.02em; }
  .rojo { background:#dc2626; } .rojo:active { background:#b91c1c; }
  .verde { background:#16a34a; } .verde:active { background:#15803d; }
  .hint { font-size:11px; color:#cbd5e1; margin-top:18px; }
</style></head><body>
  <div class="card">
    <h1>CONTROL DE PLATAFORMA</h1>
    <div class="estado">${estadoTexto}</div>
    <div class="desde">${esc(desdeTexto)}</div>
    <form method="post">
      <input type="hidden" name="k" value="${esc(secreto)}">
      ${botones}
    </form>
    <div class="hint">Zentry Tech Group · acceso restringido</div>
  </div>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const secreto = req.nextUrl.searchParams.get("k");
  if (!secretoMantenimientoValido(secreto)) return noEncontrado();

  const { activo, desde } = await getEstadoMantenimiento();
  return new NextResponse(paginaControl(activo, desde, secreto!), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const secreto = form.get("k");
  const secretoStr = typeof secreto === "string" ? secreto : null;
  if (!secretoMantenimientoValido(secretoStr)) return noEncontrado();

  const accion = form.get("accion");
  if (accion === "suspender") {
    await setMantenimiento(true, "Suspensión manual vía control");
  } else if (accion === "reactivar") {
    await setMantenimiento(false);
  }

  // Redirigir de vuelta al panel (GET) para mostrar el nuevo estado.
  const url = req.nextUrl.clone();
  url.pathname = "/api/z-control";
  url.search = `?k=${encodeURIComponent(secretoStr!)}`;
  return NextResponse.redirect(url, { status: 303 });
}

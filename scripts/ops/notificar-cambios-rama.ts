import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

// ─── Correo ───────────────────────────────────────────────────────────────────

const SUBJECT = "Tu posición en Cambios de Rama — Corrección de error";

function buildHtml(nombre: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
        <tr><td style="background:#1a3a5c;padding:24px 32px">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold">SNTSS — Sección VII Baja California</p>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 16px;color:#111827;font-size:15px">Estimado/a ${nombre},</p>
          <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
            Te informamos que se detectó y corrigió un error en el cálculo de posiciones del listado de <strong>Cambios de Rama</strong>.
          </p>
          <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
            El sistema no estaba considerando correctamente a los trabajadores de zona incondicional,
            quienes tienen prioridad en el listado. Esto causó que la quincena anterior se mostraran posiciones incorrectas.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
            <tr><td style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px 20px;border-radius:0 6px 6px 0">
              <p style="margin:0;color:#15803d;font-size:15px;font-weight:bold">
                La posición que ves hoy en el portal es la correcta y coincide con el último corte quincenal emitido por el Instituto.
              </p>
            </td></tr>
          </table>
          <p style="margin:0 0 32px;color:#374151;font-size:15px">Lamentamos la confusión.</p>
          <p style="margin:0;color:#6b7280;font-size:13px">Atentamente,<br><strong>SNTSS Sección VII — Baja California</strong></p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center">
            Este correo fue enviado desde el Portal Sindical Oficial. No responder a este mensaje.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");

  const [{ adminDb }, { Resend }] = await Promise.all([
    import("@/lib/firebase/admin"),
    import("resend"),
  ]);

  if (!process.env.RESEND_API_KEY)
    throw new Error("RESEND_API_KEY no configurada");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM =
    process.env.RESEND_FROM ||
    "SNTSS Sección VII <notificaciones@sntssvii.com>";

  // 1. Sync activa
  const syncSnap = await adminDb
    .collection("sincronizaciones")
    .where("esFuenteVerdad", "==", true)
    .limit(1)
    .get();

  if (syncSnap.empty)
    throw new Error("No hay sync activa (esFuenteVerdad=true)");
  const syncId = syncSnap.docs[0].id;
  console.log(`Sync activa: ${syncId}`);

  // 2. Matriculas con CAMBIOS_RAMA en la sync activa (deduplicadas)
  const posSnap = await adminDb
    .collection("bolsa_posiciones_materializadas")
    .where("syncId", "==", syncId)
    .where("tipoDocumento", "==", "CAMBIOS_RAMA")
    .get();

  const matriculasCambiosRama = new Set(
    posSnap.docs.map((d) => d.get("matricula") as string).filter(Boolean),
  );
  console.log(`Matriculas CAMBIOS_RAMA: ${matriculasCambiosRama.size}`);

  // 3. Usuarios activos con esas matriculas
  const usersSnap = await adminDb
    .collection("users")
    .where("status", "==", "active")
    .get();

  const destinatarios: { email: string; nombre: string; matricula: string }[] =
    [];

  usersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const matricula = (data.matricula as string)?.trim().toUpperCase();
    if (matricula && matriculasCambiosRama.has(matricula) && data.email) {
      destinatarios.push({
        email: data.email as string,
        nombre: (data.nombre || data.displayName || "trabajador/a") as string,
        matricula,
      });
    }
  });

  console.log(`Destinatarios encontrados: ${destinatarios.length}`);

  if (destinatarios.length === 0) {
    console.log("Sin destinatarios. Terminando.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Se enviaría a:");
    destinatarios.forEach((d) =>
      console.log(`  ${d.matricula}  ${d.email}  ${d.nombre}`),
    );
    return;
  }

  // 4. Enviar con pausa entre correos para no saturar Resend
  let enviados = 0;
  let errores = 0;

  for (const dest of destinatarios) {
    try {
      const { error } = await resend.emails.send({
        from: FROM,
        to: dest.email,
        subject: SUBJECT,
        html: buildHtml(dest.nombre),
      });

      if (error) {
        console.error(
          `  ERROR ${dest.matricula} ${dest.email}: ${error.message}`,
        );
        errores++;
      } else {
        console.log(`  OK ${dest.matricula} ${dest.email}`);
        enviados++;
      }
    } catch (err: any) {
      console.error(
        `  EXCEPCION ${dest.matricula} ${dest.email}: ${err?.message}`,
      );
      errores++;
    }

    // Pausa 200ms para no golpear rate limits de Resend
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nResultado: ${enviados} enviados, ${errores} errores`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});

/**
 * Premium Email Templates for SNTSS Sección VII
 * Designed with a "startup" aesthetic: clean, responsive, and trustworthy.
 */

const baseStyles = `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  .wrapper { width: 100%; table-layout: fixed; background-color: #f9fafb; padding-bottom: 40px; }
  .content { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
  .header { background-color: #991b1b; padding: 40px 20px; text-align: center; }
  .logo-text { color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: -0.5px; }
  .body { padding: 40px 30px; line-height: 1.6; color: #374151; }
  .h1 { margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; }
  .p { margin: 0 0 20px; font-size: 16px; }
  .button-container { text-align: center; margin: 30px 0; }
  .button { background-color: #b91c1c; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; }
  .footer { padding: 30px; text-align: center; font-size: 12px; color: #6b7280; }
  .divider { height: 1px; background-color: #e5e7eb; margin: 30px 0; }
  .reason-box { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; font-style: italic; }
`;

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://sntssvii.com"
).replace(/\/+$/, "");

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const layout = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="wrapper">
    <div class="content">
      <div class="header">
        <div class="logo-text">SNTSS SECCIÓN VII</div>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="divider"></div>
      <div class="footer">
        <p>© 2026 SNTSS Sección VII. Todos los derechos reservados.</p>
        <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const registrationTemplate = (name: string) =>
  layout(`
  <h1 class="h1">¡Gracias por registrarte, ${escapeHtml(name)}!</h1>
  <p class="p">Hemos recibido tu solicitud de registro para el portal de SNTSS Sección VII.</p>
  <p class="p">En este momento, nuestro equipo administrativo está revisando tus documentos para validar tu identidad. Recibirás otro correo electrónico en cuanto tu cuenta sea activada.</p>
  <p class="p">Este proceso suele tardar entre 24 y 48 horas hábiles.</p>
  <div class="button-container">
    <a href="${APP_URL}" class="button">Ir al Portal</a>
  </div>
  <p class="p">Si no realizaste esta solicitud, por favor ignora este correo.</p>
`);

export const approvalTemplate = (name: string) =>
  layout(`
  <h1 class="h1">¡Tu cuenta ha sido activada!</h1>
  <p class="p">Hola ${escapeHtml(name)}, nos complace informarte que tu solicitud de registro ha sido <strong>aprobada exitosamente</strong>.</p>
  <p class="p">Ya puedes acceder a todas las funcionalidades del portal con tu correo electrónico y contraseña.</p>
  <div class="button-container">
    <a href="${APP_URL}/login" class="button">Iniciar Sesión Ahora</a>
  </div>
  <p class="p">¡Bienvenido a la plataforma oficial de la Sección VII!</p>
`);

export const rejectionTemplate = (name: string, reason: string) =>
  layout(`
  <h1 class="h1">Actualización sobre tu registro</h1>
  <p class="p">Hola ${escapeHtml(name)}, te informamos que tu solicitud de registro ha sido rechazada por el siguiente motivo:</p>
  <div class="reason-box">
    "${escapeHtml(reason)}"
  </div>
  <p class="p">No te preocupes, puedes volver a intentar el proceso de registro corrigiendo los detalles mencionados anteriormente.</p>
  <div class="button-container">
    <a href="${APP_URL}/registro" class="button">Intentar de Nuevo</a>
  </div>
  <p class="p">Si tienes alguna duda, ponte en contacto con tu delegado sindical.</p>
`);

export const passwordResetTemplate = (name: string, resetLink: string) =>
  layout(`
  <h1 class="h1">Restablecer tu contraseña</h1>
  <p class="p">Hola ${escapeHtml(name)},</p>
  <p class="p">Recibimos una solicitud para restablecer la contraseña de tu cuenta en el portal SNTSS Sección VII.</p>
  <div class="button-container">
    <a href="${resetLink}" class="button">Restablecer Contraseña</a>
  </div>
  <p class="p">Este enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Evita que Next empaquete pdf-parse en el servidor; así se ejecuta en Node
  // y se evita el error "DOMMatrix is not defined" (APIs de navegador).
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;

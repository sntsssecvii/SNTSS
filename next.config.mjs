/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "*.firebasestorage.app" },
    ],
  },
  transpilePackages: ["framer-motion"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        child_process: false,
        dns: false,
        os: false,
        path: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
        util: false,
        assert: false,
        buffer: false,
      };
    }
    return config;
  },
  experimental: {
    // pdfjs-dist debe estar FUERA del bundle para que se cargue con require en
    // runtime (su worker .mjs y su init dependen de ello). En Next 14 la clave
    // correcta es experimental.serverComponentsExternalPackages; la de nivel
    // superior `serverExternalPackages` es de Next 15 y aquí se ignoraba en
    // silencio → pdfjs terminaba empaquetado y el parser por coordenadas fallaba.
    serverComponentsExternalPackages: ["pdfjs-dist"],
    // pdfjs v4 (build legacy) importa dinámicamente su worker `pdf.worker.mjs`
    // para el fake worker. Al externalizar pdfjs, el file-tracing de Vercel NO
    // detecta ese import dinámico y el archivo queda FUERA del Lambda, así que
    // en runtime falla con "Cannot find module .../pdf.worker.mjs" y el parser
    // por coordenadas cae al fallback de Adobe (extracción incorrecta). Forzamos
    // su inclusión en las rutas que procesan PDF.
    outputFileTracingIncludes: {
      "/api/cambios-escalafon/procesar": [
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      ],
      "/api/escalafon/procesar": [
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      ],
    },
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            // unsafe-inline y unsafe-eval son requeridos por Next.js 14 para sus scripts internos
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.firebasestorage.app",
              "frame-src 'self' https://firebasestorage.googleapis.com https://*.firebasestorage.app",
              "connect-src 'self' *.googleapis.com *.firebaseio.com *.firebaseapp.com *.firebasestorage.app *.upstash.io",
              "font-src 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/bolsa-de-trabajo/consulta",
        destination: "/auth/login",
        permanent: true,
      },
      {
        source: "/bolsa-de-trabajo/resultado/:matricula",
        destination: "/auth/login",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

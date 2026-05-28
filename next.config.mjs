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
  // pdfjs-dist debe estar fuera del bundle para que su worker (.mjs) sea
  // accesible en runtime via require.resolve() en Vercel.
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
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

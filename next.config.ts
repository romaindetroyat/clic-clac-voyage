import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // L'app est presque entièrement authentifiée : rendu dynamique classique.
  cacheComponents: false,
  serverExternalPackages: ["@electric-sql/pglite", "@myriaddreamin/typst-ts-node-compiler"],
  // Polices embarquées dans les PDF du livre (lues sur le disque par Typst).
  // Vercel tourne sous glibc : la variante musl du compilateur Typst (52 Mo) est inutile.
  outputFileTracingExcludes: {
    "/*": ["**/typst-ts-node-compiler-linux-x64-musl/**"],
  },
  outputFileTracingIncludes: {
    "/api/voyages/\\[slug\\]/livre/impression": ["./polices/*.ttf"],
  },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

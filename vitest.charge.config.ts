import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests de charge : à lancer à la main (`pnpm test:charge`), pas dans la CI ordinaire.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: { include: ["tests/charge/**/*.test.ts"], environment: "node", testTimeout: 600_000, hookTimeout: 120_000 },
});

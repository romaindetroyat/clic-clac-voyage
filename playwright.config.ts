import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DOSSIER = ".data/e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-FR", trace: "retain-on-failure" },
  projects: [
    { name: "telephone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Base pglite neuve et boîte d'envoi locale : aucun service externe.
    command: `rm -rf ${DOSSIER} && mkdir -p ${DOSSIER} && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/connexion`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      APP_URL: `http://localhost:${PORT}`,
      DATABASE_URL: `pglite:${DOSSIER}/db`,
      BETTER_AUTH_SECRET: "e2e-uniquement-e2e-uniquement-e2e-uniquement",
      ADMIN_EMAILS: "romain@exemple.fr",
      MAIL_OUTBOX_FILE: `${DOSSIER}/outbox.jsonl`,
      STOCKAGE_LOCAL: `${DOSSIER}/stockage`,
    },
  },
});

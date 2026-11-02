/**
 * Applique les migrations SQL de `drizzle/` sur la base Neon de DATABASE_URL.
 * Lancé au build Vercel (`pnpm build`). Sans effet pour une base pglite
 * (elle se migre seule au démarrage).
 */
import "dotenv/config";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.log("DATABASE_URL absente : migrations ignorées.");
    return;
  }
  if (url.startsWith("pglite:")) {
    console.log("Base pglite : migrations appliquées au démarrage.");
    return;
  }
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  await pool.end();
  console.log("Migrations appliquées.");
}

main().catch((e) => {
  console.error("Échec des migrations :", e instanceof Error ? e.message : e);
  process.exit(1);
});

import path from "node:path";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Base Postgres. Deux modes :
 * - `postgres://…` : Neon (production, préproduction) via WebSocket, transactions possibles ;
 * - `pglite:<dossier>` ou `pglite:memoire` : Postgres embarqué (dev local, tests, CI),
 *   migrations appliquées automatiquement.
 */
export type Db = ReturnType<typeof drizzleNeon<typeof schema>>;

export async function createDb(url: string): Promise<Db> {
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const cible = url.slice("pglite:".length);
    const client = cible === "memoire" || cible === "" ? new PGlite() : new PGlite(cible);
    const db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    // Même API de requêtes que le pilote Neon : on unifie le type.
    return db as unknown as Db;
  }
  const pool = new Pool({ connectionString: url });
  return drizzleNeon({ client: pool, schema });
}

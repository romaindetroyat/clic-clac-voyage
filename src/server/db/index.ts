import "server-only";
import { env } from "../env";
import { createDb, type Db } from "./client";

export * as schema from "./schema";

const globalPourDb = globalThis as unknown as { __clicClacDb?: Promise<Db> };

/** Connexion unique par processus (et conservée entre rechargements en dev). */
export function getDb(): Promise<Db> {
  if (!globalPourDb.__clicClacDb) {
    globalPourDb.__clicClacDb = createDb(env().DATABASE_URL);
  }
  return globalPourDb.__clicClacDb;
}

export type { Db };

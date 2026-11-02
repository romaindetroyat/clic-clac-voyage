import { createDb, type Db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";

/** Base Postgres neuve en mémoire (pglite), migrations appliquées. */
export async function baseDeTest(): Promise<Db> {
  return createDb("pglite:memoire");
}

export async function creerUtilisateur(db: Db, email: string, nom = email.split("@")[0]) {
  const id = genererId();
  await db.insert(user).values({ id, email, name: nom, emailVerified: true });
  return { id, email, nom };
}

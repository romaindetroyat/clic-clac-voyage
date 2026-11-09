import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sum } from "drizzle-orm";
import { TARIFS } from "../../lib/couts/estimation";
import { coutMicroUsd, type UsageIa } from "../../lib/ia/tarifs";
import type { Db } from "../db/client";
import { depenseIa } from "../db/schema";
import { ErreurMetier } from "../domaine/voyages";
import { env } from "../env";

export const moisCourant = (d = new Date()) => d.toISOString().slice(0, 7);

const enEur = (microUsd: number) => (microUsd / 1e6) * TARIFS.usdEnEur;

/** Dépense d'IA du mois en cours (toute l'application) et plafond, en euros. */
export async function budgetIa(db: Db, plafondEur = env().IA_BUDGET_MENSUEL_EUR) {
  const [l] = await db.select({ total: sum(depenseIa.coutMicroUsd) }).from(depenseIa).where(eq(depenseIa.mois, moisCourant()));
  const depenseEur = enEur(Number(l?.total ?? 0));
  return { depenseEur, plafondEur, resteEur: Math.max(0, plafondEur - depenseEur) };
}

/** Refuse l'appel s'il risque de dépasser le plafond du mois. */
export async function verifierBudget(db: Db, estimationUsd: number, plafondEur?: number) {
  const b = await budgetIa(db, plafondEur);
  if (b.depenseEur + estimationUsd * TARIFS.usdEnEur > b.plafondEur) {
    const f = (v: number) => v.toFixed(2).replace(".", ",");
    throw new ErreurMetier(`Budget d’IA du mois atteint (${f(b.depenseEur)} € dépensés sur ${f(b.plafondEur)} €). Il se renouvelle le 1er du mois.`);
  }
}

export async function enregistrerDepense(db: Db, d: { voyageId: string | null; usage: "rafale" | "imprimeur" | "site"; u: UsageIa }) {
  await db.insert(depenseIa).values({
    id: randomUUID(),
    voyageId: d.voyageId,
    usage: d.usage,
    mois: moisCourant(),
    coutMicroUsd: coutMicroUsd(d.u),
    jetonsEntree: d.u.input_tokens + (d.u.cache_read_input_tokens ?? 0) + (d.u.cache_creation_input_tokens ?? 0),
    jetonsSortie: d.u.output_tokens,
    recherches: d.u.server_tool_use?.web_search_requests ?? 0,
  });
}

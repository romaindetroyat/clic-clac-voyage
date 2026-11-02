import "server-only";
import { appUrl, env } from "../env";
import { StockageLocal } from "./local";
import { StockageR2 } from "./r2";
import type { Stockage } from "./types";

export * from "./types";

const g = globalThis as unknown as { __clicClacStockage?: Stockage };

/** R2 si ses variables sont présentes ; sinon stockage local (développement et tests uniquement). */
export function getStockage(): Stockage {
  if (g.__clicClacStockage) return g.__clicClacStockage;
  const e = env();
  if (e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET) {
    g.__clicClacStockage = new StockageR2({
      accountId: e.R2_ACCOUNT_ID,
      accessKeyId: e.R2_ACCESS_KEY_ID,
      secretAccessKey: e.R2_SECRET_ACCESS_KEY,
      bucket: e.R2_BUCKET,
      juridiction: e.R2_JURIDICTION,
    });
  } else {
    g.__clicClacStockage = getStockageLocal();
  }
  return g.__clicClacStockage;
}

export function getStockageLocal(): StockageLocal {
  const e = env();
  if (process.env.NODE_ENV === "production" && !e.STOCKAGE_LOCAL) {
    throw new Error("Stockage non configuré : renseignez R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY et R2_BUCKET.");
  }
  return new StockageLocal(e.STOCKAGE_LOCAL ?? ".data/stockage", appUrl(), e.BETTER_AUTH_SECRET);
}

export function stockageConfigure(): boolean {
  const e = env();
  return !!(e.R2_ACCOUNT_ID && e.R2_BUCKET) || process.env.NODE_ENV !== "production" || !!e.STOCKAGE_LOCAL;
}

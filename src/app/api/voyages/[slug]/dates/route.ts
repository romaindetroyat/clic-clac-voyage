import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { voyage } from "@/server/db/schema";
import { fixerDates, instantDuJour, rangerHorsVoyage, relireDatesServeur } from "@/server/domaine/dates";
import { getStockage } from "@/server/stockage";

// La relecture des originaux traite un lot par requête.
export const maxDuration = 120;

const corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("relire-serveur") }),
  z.object({ action: z.literal("ranger") }),
  z.object({ action: z.literal("suggestions"), choix: z.array(z.object({ id: z.string().uuid(), instant: z.string().datetime() })).min(1).max(5000) }),
  z.object({
    action: z.literal("jour"),
    ids: z.array(z.string().uuid()).min(1).max(5000),
    jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Jour invalide."),
    heure: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide."),
  }),
]);

/** Dates des médias : relecture des originaux (serveur), suggestions acceptées, jour choisi à la main. */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/dates">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    const db = await getDb();
    const a = corps.parse(await req.json());
    if (a.action === "relire-serveur") return relireDatesServeur(db, getStockage(), ctx);
    if (a.action === "ranger") return rangerHorsVoyage(db, ctx);
    if (a.action === "suggestions") return { datees: await fixerDates(db, ctx, a.choix.map((c) => ({ id: c.id, instant: new Date(c.instant) }))) };
    const v = (await db.query.voyage.findFirst({ where: eq(voyage.id, ctx.voyageId) }))!;
    // Une seconde d'écart entre médias pour garder l'ordre de la sélection.
    const debut = instantDuJour(a.jour, a.heure, v.fuseau).getTime();
    return { datees: await fixerDates(db, ctx, a.ids.map((id, i) => ({ id, instant: new Date(debut + i * 1000) }))) };
  });
}

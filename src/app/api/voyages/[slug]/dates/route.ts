import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { voyage } from "@/server/db/schema";
import { enregistrerExifRelu, fixerDates, instantDuJour, originauxSansDate, schemaExifRelu } from "@/server/domaine/dates";
import { getStockage } from "@/server/stockage";

/** Originaux des photos sans date, pour relire leurs métadonnées dans le navigateur. */
export async function GET(_: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/dates">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => ({ photos: await originauxSansDate(await getDb(), getStockage(), ctx) }));
}

const corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("relire"), mediaId: z.string().uuid(), exif: schemaExifRelu }),
  z.object({ action: z.literal("suggestions"), choix: z.array(z.object({ id: z.string().uuid(), instant: z.string().datetime() })).min(1).max(5000) }),
  z.object({
    action: z.literal("jour"),
    ids: z.array(z.string().uuid()).min(1).max(5000),
    jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Jour invalide."),
    heure: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide."),
  }),
]);

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/dates">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    const db = await getDb();
    const a = corps.parse(await req.json());
    if (a.action === "relire") return enregistrerExifRelu(db, ctx, a.mediaId, a.exif);
    if (a.action === "suggestions") return { datees: await fixerDates(db, ctx, a.choix.map((c) => ({ id: c.id, instant: new Date(c.instant) }))) };
    const v = (await db.query.voyage.findFirst({ where: eq(voyage.id, ctx.voyageId) }))!;
    // Une seconde d'écart entre médias pour garder l'ordre de la sélection.
    const debut = instantDuJour(a.jour, a.heure, v.fuseau).getTime();
    return { datees: await fixerDates(db, ctx, a.ids.map((id, i) => ({ id, instant: new Date(debut + i * 1000) }))) };
  });
}

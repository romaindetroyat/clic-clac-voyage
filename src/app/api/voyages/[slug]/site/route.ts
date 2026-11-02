import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { choisirPresentation, enregistrerConfigSite, mettreEnAvant } from "@/server/domaine/site";
import { ErreurMetier } from "@/server/domaine/voyages";

/** Réglages du site (administrateur) : configuration, présentation d'un épisode, photos mises en avant. */
const corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("config"), config: z.unknown() }),
  z.object({ action: z.literal("presentation"), episodeId: z.string().uuid(), presentation: z.string().max(30) }),
  z.object({ action: z.literal("vedette"), mediaId: z.string().uuid(), valeur: z.boolean() }),
]);

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/site">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    if (!ctx.estAdmin) throw new ErreurMetier("Le site est réglé par les administrateurs du voyage.");
    const db = await getDb();
    const a = corps.parse(await req.json());
    if (a.action === "config") await enregistrerConfigSite(db, ctx.voyageId, a.config);
    else if (a.action === "presentation") await choisirPresentation(db, ctx.voyageId, a.episodeId, a.presentation);
    else await mettreEnAvant(db, ctx.voyageId, a.mediaId, a.valeur);
    return { ok: true };
  });
}

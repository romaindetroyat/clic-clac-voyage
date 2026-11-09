import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { choisirPresentation, enregistrerConfigSite, enregistrerEdition, mettreEnAvant, modifierChapitre } from "@/server/domaine/site";
import { ErreurMetier } from "@/server/domaine/voyages";
import { appelIa, iaActive } from "@/server/ia/client";
import { proposerDisposition, proposerLegendes } from "@/server/ia/site";
import { getStockage } from "@/server/stockage";

/** Réglages du site (administrateur) : configuration, présentation d'un épisode, photos mises en avant. */
const corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("config"), config: z.unknown() }),
  z.object({ action: z.literal("presentation"), episodeId: z.string().uuid(), presentation: z.string().max(30) }),
  z.object({ action: z.literal("vedette"), mediaId: z.string().uuid(), valeur: z.boolean() }),
  z.object({ action: z.literal("edition"), edition: z.unknown() }),
  z.object({ action: z.literal("chapitre"), episodeId: z.string().uuid(), titre: z.string().max(200).optional(), recit: z.string().max(20000).nullable().optional() }),
  z.object({
    action: z.literal("ia-legendes"),
    ids: z.array(z.string().uuid()).min(1).max(8),
    contexte: z.object({ titre: z.string().max(200).nullish(), lieu: z.string().max(200).nullish(), dates: z.string().max(200).nullish() }).default({}),
  }),
  z.object({ action: z.literal("ia-disposition"), ids: z.array(z.string().uuid()).min(2).max(30) }),
]);

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/site">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    if (!ctx.estAdmin) throw new ErreurMetier("Le site est réglé par les administrateurs du voyage.");
    const db = await getDb();
    const a = corps.parse(await req.json());
    if (a.action === "ia-legendes" || a.action === "ia-disposition") {
      if (!iaActive()) throw new ErreurMetier("L’IA n’est pas configurée.");
      return a.action === "ia-legendes"
        ? proposerLegendes(db, getStockage(), appelIa(), ctx.voyageId, a.ids, a.contexte)
        : proposerDisposition(db, getStockage(), appelIa(), ctx.voyageId, a.ids);
    }
    if (a.action === "config") await enregistrerConfigSite(db, ctx.voyageId, a.config);
    else if (a.action === "edition") await enregistrerEdition(db, ctx.voyageId, a.edition);
    else if (a.action === "chapitre") await modifierChapitre(db, ctx.voyageId, a.episodeId, { titre: a.titre, recit: a.recit });
    else if (a.action === "presentation") await choisirPresentation(db, ctx.voyageId, a.episodeId, a.presentation);
    else await mettreEnAvant(db, ctx.voyageId, a.mediaId, a.valeur);
    return { ok: true };
  });
}

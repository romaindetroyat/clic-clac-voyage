import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { cocher, deplacerMedias } from "@/server/domaine/recit";
import { ErreurMetier } from "@/server/domaine/voyages";

/** Actions sur plusieurs médias à la fois : cocher, ou déplacer vers un épisode (administrateur). */
const corps = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cocher"),
    ids: z.array(z.string().uuid()).min(1).max(5000),
    champ: z.enum(["dansSite", "dansLivre"]),
    valeur: z.boolean(),
  }),
  z.object({
    action: z.literal("deplacer"),
    ids: z.array(z.string().uuid()).min(1).max(5000),
    episodeId: z.string().uuid().nullable(),
  }),
]);

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/selection">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    const db = await getDb();
    const a = corps.parse(await req.json());
    if (a.action === "cocher") await cocher(db, ctx.voyageId, a.ids, a.champ, a.valeur);
    else {
      if (!ctx.estAdmin) throw new ErreurMetier("Seul l'administrateur organise les épisodes.");
      await deplacerMedias(db, ctx.voyageId, a.ids, a.episodeId);
    }
    return { ok: true };
  });
}

import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { choisirDansRafale, detecterRafales, enregistrerQualite } from "@/server/domaine/rafales";
import { cocher, deplacerMedias } from "@/server/domaine/recit";
import { ErreurMetier } from "@/server/domaine/voyages";
import { appelIa, iaActive } from "@/server/ia/client";
import { departagerRafales } from "@/server/ia/rafales";
import { getStockage } from "@/server/stockage";

// Le départage par l'IA traite un lot de rafales par requête.
export const maxDuration = 300;

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
  z.object({ action: z.literal("choisir-rafale"), mediaId: z.string().uuid() }),
  z.object({ action: z.literal("detecter-rafales") }),
  z.object({ action: z.literal("departager-ia") }),
  z.object({
    action: z.literal("qualite"),
    mesures: z
      .array(z.object({ id: z.string().uuid(), nettete: z.number().min(0).max(1), exposition: z.number().min(0).max(1) }))
      .max(200),
  }),
]);

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/selection">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    const db = await getDb();
    const a = corps.parse(await req.json());
    if (a.action === "cocher") await cocher(db, ctx.voyageId, a.ids, a.champ, a.valeur);
    else if (a.action === "choisir-rafale") await choisirDansRafale(db, ctx.voyageId, a.mediaId);
    else if (a.action === "qualite") await enregistrerQualite(db, ctx.voyageId, a.mesures);
    else if (a.action === "detecter-rafales") return detecterRafales(db, ctx.voyageId);
    else if (a.action === "departager-ia") {
      if (!ctx.estAdmin) throw new ErreurMetier("Seul l'administrateur peut faire appel à l'IA.");
      if (!iaActive()) throw new ErreurMetier("L'IA n'est pas configurée.");
      return departagerRafales(db, getStockage(), appelIa(), ctx.voyageId);
    }
    else {
      if (!ctx.estAdmin) throw new ErreurMetier("Seul l'administrateur organise les épisodes.");
      await deplacerMedias(db, ctx.voyageId, a.ids, a.episodeId);
    }
    return { ok: true };
  });
}

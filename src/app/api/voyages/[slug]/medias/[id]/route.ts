import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { basculerReaction, cocher, commenter, detailMedia, legender, supprimerCommentaire } from "@/server/domaine/recit";

export async function GET(_: Request, { params }: RouteContext<"/api/voyages/[slug]/medias/[id]">) {
  const { slug, id } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => detailMedia(await getDb(), ctx, id));
}

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("legende"), texte: z.string().max(1000) }),
  z.object({ action: z.literal("commenter"), texte: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("supprimer-commentaire"), commentaireId: z.string().uuid() }),
  z.object({ action: z.literal("reaction"), emoji: z.string().max(16) }),
  z.object({ action: z.literal("cocher"), champ: z.enum(["dansSite", "dansLivre"]), valeur: z.boolean() }),
]);

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/medias/[id]">) {
  const { slug, id } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    const db = await getDb();
    const a = action.parse(await req.json());
    if (a.action === "legende") await legender(db, ctx, id, a.texte);
    else if (a.action === "commenter") await commenter(db, ctx, id, a.texte);
    else if (a.action === "supprimer-commentaire") await supprimerCommentaire(db, ctx, a.commentaireId);
    else if (a.action === "reaction") await basculerReaction(db, ctx, id, a.emoji);
    else await cocher(db, ctx.voyageId, [id], a.champ, a.valeur);
    return detailMedia(db, ctx, id);
  });
}

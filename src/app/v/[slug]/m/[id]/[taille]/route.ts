import { getDb } from "@/server/db";
import { cleMediaPublie } from "@/server/domaine/site";
import { accesSite } from "@/server/lecteur";
import { getStockage } from "@/server/stockage";
import type { TailleSite } from "@/lib/site/types";

const TAILLES = new Set<TailleSite>(["s", "m", "l", "affiche", "video"]);

/**
 * Image ou vidéo du site : contrôle d'accès, puis redirection vers une URL signée du stockage.
 * Seules les versions web sont servies (réencodées dans le navigateur, donc sans EXIF ni GPS) :
 * jamais l'original.
 */
export async function GET(_: Request, ctx: RouteContext<"/v/[slug]/m/[id]/[taille]">) {
  const { slug, id, taille } = await ctx.params;
  if (!TAILLES.has(taille as TailleSite)) return new Response("Introuvable", { status: 404 });
  const acces = await accesSite(slug);
  if (acces.statut !== "ok") return new Response("Introuvable", { status: 404 });
  const cle = await cleMediaPublie(await getDb(), acces.voyage.id, id, taille as TailleSite);
  if (!cle) return new Response("Introuvable", { status: 404 });
  const url = await getStockage().urlLectureStable(cle);
  return new Response(null, {
    status: 302,
    headers: { location: url, "cache-control": "private, max-age=3600" },
  });
}

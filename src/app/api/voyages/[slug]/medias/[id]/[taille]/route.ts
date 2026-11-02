import type { TailleSite } from "@/lib/site/types";
import { contexteApi } from "@/server/api";
import { getDb } from "@/server/db";
import { cleMedia } from "@/server/domaine/site";
import { getStockage } from "@/server/stockage";

const TAILLES = new Set<TailleSite>(["s", "m", "l", "affiche", "video"]);

/**
 * Version web d'un média pour les membres du voyage : contrôle d'accès, puis redirection
 * vers une URL signée stable sur la journée. Les pages n'ont plus à signer des milliers
 * d'URL d'avance (10 000 photos = plus de 2 s et plusieurs Mo de page), et le navigateur
 * garde les images en cache.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/voyages/[slug]/medias/[id]/[taille]">) {
  const { slug, id, taille } = await ctx.params;
  if (!TAILLES.has(taille as TailleSite)) return new Response("Introuvable", { status: 404 });
  const c = await contexteApi(slug);
  if (c instanceof Response) return c;
  const cle = await cleMedia(await getDb(), c.voyageId, id, taille as TailleSite);
  if (!cle) return new Response("Introuvable", { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { location: await getStockage().urlLectureStable(cle), "cache-control": "private, max-age=3600" },
  });
}

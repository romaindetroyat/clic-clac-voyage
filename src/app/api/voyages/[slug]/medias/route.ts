import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { galerie, urlsMembre } from "@/server/domaine/medias";

export async function GET(_: Request, { params }: RouteContext<"/api/voyages/[slug]/medias">) {
  const { slug } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => ({ medias: await galerie(await getDb(), urlsMembre(slug), ctx.voyageId) }));
}

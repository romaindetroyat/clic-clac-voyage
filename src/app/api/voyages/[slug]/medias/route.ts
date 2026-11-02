import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { galerie } from "@/server/domaine/medias";
import { getStockage } from "@/server/stockage";

export async function GET(_: Request, { params }: RouteContext<"/api/voyages/[slug]/medias">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => ({ medias: await galerie(await getDb(), getStockage(), ctx.voyageId) }));
}

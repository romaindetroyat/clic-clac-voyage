import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { annulerEnvoi, morceauxRecus } from "@/server/domaine/medias";
import { getStockage } from "@/server/stockage";

/** Morceaux déjà reçus (reprise après coupure). */
export async function GET(_: Request, { params }: RouteContext<"/api/voyages/[slug]/envois/[id]">) {
  const { slug, id } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => morceauxRecus(await getDb(), getStockage(), ctx, id));
}

export async function DELETE(_: Request, { params }: RouteContext<"/api/voyages/[slug]/envois/[id]">) {
  const { slug, id } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    await annulerEnvoi(await getDb(), getStockage(), ctx, id);
    return { ok: true };
  });
}

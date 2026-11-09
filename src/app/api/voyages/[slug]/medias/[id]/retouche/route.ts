import type { NextRequest } from "next/server";
import { z } from "zod";
import { schemaRetouche } from "@/lib/rendu/parametres";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { enregistrerRemplacement, enregistrerRetouche, preparerRemplacement, preparerRetouche, revenirOriginal } from "@/server/domaine/retouches";
import { getStockage } from "@/server/stockage";

const corps = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["preparer", "enregistrer"]), retouche: schemaRetouche }),
  // Image modifiée ailleurs (ChatGPT…) : ses versions web remplacent la photo ; l'original reste intact.
  z.object({ action: z.literal("preparer-remplacement") }),
  z.object({ action: z.literal("remplacer"), empreinte: z.string().max(40) }),
  z.object({ action: z.literal("original") }),
]);

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/medias/[id]/retouche">) {
  const { slug, id } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    const a = corps.parse(await req.json());
    const db = await getDb();
    if (a.action === "preparer") return preparerRetouche(db, getStockage(), ctx, id, a.retouche);
    if (a.action === "enregistrer") await enregistrerRetouche(db, getStockage(), ctx, id, a.retouche);
    else if (a.action === "preparer-remplacement") return preparerRemplacement(db, getStockage(), ctx, id);
    else if (a.action === "remplacer") await enregistrerRemplacement(db, getStockage(), ctx, id, a.empreinte);
    else await revenirOriginal(db, getStockage(), ctx, id);
    return { ok: true };
  });
}

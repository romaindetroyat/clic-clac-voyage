import type { NextRequest } from "next/server";
import { z } from "zod";
import { schemaRetouche } from "@/lib/rendu/parametres";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { enregistrerRetouche, preparerRetouche } from "@/server/domaine/retouches";
import { getStockage } from "@/server/stockage";

const corps = z.object({ action: z.enum(["preparer", "enregistrer"]), retouche: schemaRetouche });

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/medias/[id]/retouche">) {
  const { slug, id } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    const { action, retouche } = corps.parse(await req.json());
    if (action === "preparer") return preparerRetouche(await getDb(), getStockage(), ctx, id, retouche);
    await enregistrerRetouche(await getDb(), getStockage(), ctx, id, retouche);
    return { ok: true };
  });
}

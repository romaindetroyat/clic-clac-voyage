import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { signerMorceaux } from "@/server/domaine/medias";
import { getStockage } from "@/server/stockage";

const corps = z.object({ numeros: z.array(z.number().int().positive()).min(1).max(100) });

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/envois/[id]/morceaux">) {
  const { slug, id } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => ({
    urls: await signerMorceaux(await getDb(), getStockage(), ctx, id, corps.parse(await req.json()).numeros),
  }));
}

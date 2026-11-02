import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { terminerEnvoi } from "@/server/domaine/medias";
import { getStockage } from "@/server/stockage";

const corps = z.object({
  morceaux: z.array(z.object({ numero: z.number().int().positive(), etag: z.string().min(1).max(200) })).max(10_000).optional(),
  versions: z.array(z.string().max(20)).max(5).default([]),
});

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/envois/[id]/terminer">) {
  const { slug, id } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => terminerEnvoi(await getDb(), getStockage(), ctx, id, corps.parse(await req.json())));
}

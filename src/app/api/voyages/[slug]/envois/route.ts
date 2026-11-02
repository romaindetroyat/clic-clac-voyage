import type { NextRequest } from "next/server";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { preparerEnvoi, schemaDeclaration } from "@/server/domaine/medias";
import { getStockage } from "@/server/stockage";

/** Déclare un fichier à envoyer ; renvoie les URL signées ou « doublon ». */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/envois">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => preparerEnvoi(await getDb(), getStockage(), ctx, schemaDeclaration.parse(await req.json())));
}

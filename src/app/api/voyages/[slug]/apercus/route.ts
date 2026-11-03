import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { enregistrerApercu, photosSansApercu, preparerApercu, schemaMesures } from "@/server/domaine/apercus";
import { getStockage } from "@/server/stockage";

/** Photos sans aperçu : liste (avec un lien de lecture de l'original), préparation de l'envoi, enregistrement. */
export async function GET(_: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/apercus">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => ({ photos: await photosSansApercu(await getDb(), getStockage(), ctx) }));
}

const corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preparer"), mediaId: z.string().uuid() }),
  z.object({ action: z.literal("enregistrer"), mediaId: z.string().uuid(), mesures: schemaMesures }),
]);

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/apercus">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    const a = corps.parse(await req.json());
    const db = await getDb();
    if (a.action === "preparer") return preparerApercu(db, getStockage(), ctx, a.mediaId);
    await enregistrerApercu(db, getStockage(), ctx, a.mediaId, a.mesures);
    return { ok: true };
  });
}

import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { ErreurMetier } from "@/server/domaine/voyages";
import { assemblerLivre, dernierExport, planPreparation } from "@/server/livre/impression";
import { getStockage } from "@/server/stockage";

// L'assemblage d'un gros livre prend du temps : le maximum autorisé sur Vercel Hobby.
export const maxDuration = 300;

const corps = z.object({ action: z.enum(["plan", "assembler", "liens"]) });

/** Export PDF du livre : plan des images à préparer, assemblage, liens de téléchargement. */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/livre/impression">) {
  const { slug } = await params;
  const ctx = await contexteApi(slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    if (!ctx.estAdmin) throw new ErreurMetier("L’export du livre est réservé aux administrateurs du voyage.");
    const db = await getDb();
    const stockage = getStockage();
    const { action } = corps.parse(await req.json());
    if (action === "plan") return planPreparation(db, stockage, ctx.voyageId);
    const r = action === "assembler" ? await assemblerLivre(db, stockage, ctx.voyageId, slug) : await dernierExport(db, ctx.voyageId);
    if (!r) return { export: null };
    return {
      export: r,
      liens: {
        interieur: await stockage.urlLecture(r.interieur.cle, 24 * 3600, `${slug}-interieur.pdf`),
        couverture: await stockage.urlLecture(r.couverture.cle, 24 * 3600, `${slug}-couverture.pdf`),
      },
    };
  });
}

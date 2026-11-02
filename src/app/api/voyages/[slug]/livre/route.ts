import type { NextRequest } from "next/server";
import { z } from "zod";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { creerVersion, enregistrerLivre, livreDe, restaurerVersion, versionsDe } from "@/server/domaine/livre";
import { ErreurMetier } from "@/server/domaine/voyages";

/** Livre photo (administrateur) : enregistrer, créer une version, revenir à une version. */
const corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enregistrer"), contenu: z.unknown(), revision: z.number().int().nullable() }),
  z.object({ action: z.literal("version"), libelle: z.string().max(120) }),
  z.object({ action: z.literal("restaurer"), versionId: z.string().uuid() }),
]);

export async function POST(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/livre">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    if (!ctx.estAdmin) throw new ErreurMetier("Le livre est mis en page par les administrateurs du voyage.");
    const db = await getDb();
    const a = corps.parse(await req.json());
    if (a.action === "enregistrer") return { revision: await enregistrerLivre(db, ctx, a.contenu, a.revision) };
    if (a.action === "version") {
      await creerVersion(db, ctx, a.libelle);
      return { versions: await versionsDe(db, ctx.voyageId) };
    }
    const revision = await restaurerVersion(db, ctx, a.versionId);
    return { revision, livre: (await livreDe(db, ctx.voyageId))?.contenu, versions: await versionsDe(db, ctx.voyageId) };
  });
}

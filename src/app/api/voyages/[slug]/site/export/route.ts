import type { NextRequest } from "next/server";
import { contexteApi, repondre } from "@/server/api";
import { getDb } from "@/server/db";
import { donneesSite } from "@/server/domaine/site";
import { ErreurMetier } from "@/server/domaine/voyages";
import { getStockage } from "@/server/stockage";

/**
 * Données de l'export .zip : le site avec des chemins relatifs (medias/…), et pour chaque
 * fichier une URL signée de quelques heures que le navigateur télécharge pour remplir l'archive.
 * Les grandes versions ne sont pas incluses (taille de l'archive) : la moyenne (1 200 px) les remplace.
 */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/voyages/[slug]/site/export">) {
  const ctx = await contexteApi((await params).slug);
  if (ctx instanceof Response) return ctx;
  return repondre(async () => {
    if (!ctx.estAdmin) throw new ErreurMetier("L’export est réservé aux administrateurs du voyage.");
    const avecVideos = req.nextUrl.searchParams.get("videos") === "1";
    const cles = new Map<string, string>();
    const d = await donneesSite(await getDb(), ctx.voyageId, (id, taille, cle) => {
      const ext = /\.[a-z0-9]{2,5}$/i.exec(cle)?.[0] ?? "";
      const chemin = `medias/${id}-${taille}${ext}`;
      cles.set(chemin, cle);
      return chemin;
    });
    for (const m of [...d.episodes.flatMap((e) => e.medias), ...d.horsEpisodes, ...(d.couverture ? [d.couverture] : [])]) {
      if (m.urls.m) m.urls.l = m.urls.m;
      else delete m.urls.l;
      if (!avecVideos) delete m.urls.video;
    }
    const utilises = new Set<string>();
    for (const m of [...d.episodes.flatMap((e) => e.medias), ...d.horsEpisodes, ...(d.couverture ? [d.couverture] : [])]) {
      for (const u of Object.values(m.urls)) if (u) utilises.add(u);
    }
    const stockage = getStockage();
    const fichiers = await Promise.all(
      [...utilises].map(async (chemin) => ({ chemin, url: await stockage.urlLecture(cles.get(chemin)!, 4 * 3600) })),
    );
    return { donnees: d, fichiers };
  });
}

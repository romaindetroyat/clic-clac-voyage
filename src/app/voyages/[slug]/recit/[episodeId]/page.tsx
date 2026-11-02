import Link from "next/link";
import { notFound } from "next/navigation";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { galerie } from "@/server/domaine/medias";
import { episodesDe } from "@/server/domaine/recit";
import { getStockage } from "@/server/stockage";
import { OutilsEpisode } from "./outils-episode";

export default async function PageEpisode({ params }: PageProps<"/voyages/[slug]/recit/[episodeId]">) {
  const { slug, episodeId } = await params;
  const { voyage, utilisateur, estAdmin } = await accesVoyage(slug);
  const db = await getDb();
  const { episodes } = await episodesDe(db, voyage.id);
  const aClasser = episodeId === "a-classer";
  const e = aClasser ? null : episodes.find((x) => x.id === episodeId);
  if (!aClasser && !e) notFound();
  const medias = await galerie(db, getStockage(), voyage.id, { episodeId: aClasser ? null : episodeId });

  return (
    <div className="space-y-6">
      <Link href={`/voyages/${voyage.slug}/recit`} className="lien text-sm">
        ← Tous les épisodes
      </Link>
      <div className="space-y-2">
        <h2 className="text-3xl">{e?.titre ?? "Photos à classer"}</h2>
        {e?.lieu ? <p className="text-encre-douce">{e.lieu}</p> : null}
        {e?.recit ? <p className="max-w-2xl whitespace-pre-line">{e.recit}</p> : null}
      </div>
      <OutilsEpisode
        key={medias.map((m) => m.id).join()}
        slug={voyage.slug}
        episodeId={e?.id ?? null}
        medias={medias}
        episodes={episodes.map((x) => ({ id: x.id, titre: x.titre }))}
        utilisateurId={utilisateur.id}
        estAdmin={estAdmin}
      />
    </div>
  );
}

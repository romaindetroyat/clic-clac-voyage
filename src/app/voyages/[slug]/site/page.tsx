import { classesPolices } from "@/app/v/polices";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { galerie } from "@/server/domaine/medias";
import { episodesDe } from "@/server/domaine/recit";
import { configSite } from "@/server/domaine/site";
import { getStockage } from "@/server/stockage";
import { ReglagesSite } from "./reglages-site";

export const metadata = { title: "Site" };

export default async function PageSite({ params }: PageProps<"/voyages/[slug]/site">) {
  const { slug } = await params;
  const { voyage, estAdmin } = await accesVoyage(slug);
  if (!estAdmin) {
    return (
      <div className="space-y-3">
        <p className="text-encre-douce">Le site est réglé par les administrateurs du voyage.</p>
        <a href={`/v/${slug}`} className="bouton-discret">
          Voir le site
        </a>
      </div>
    );
  }
  const db = await getDb();
  const [config, { episodes }, medias] = await Promise.all([
    configSite(db, voyage.id),
    episodesDe(db, voyage.id),
    galerie(db, getStockage(), voyage.id),
  ]);
  const photos = medias.filter((m) => m.type === "photo" && m.dansSite && m.vignette).map((m) => ({ id: m.id, vignette: m.vignette!, vedette: m.vedette }));

  return (
    <div className={classesPolices}>
      <ReglagesSite
        slug={slug}
        initial={config}
        episodes={episodes.map((e) => ({ id: e.id, titre: e.titre, presentation: e.presentation, nbMedias: e.nbMedias }))}
        photos={photos}
        classesPolices={classesPolices}
      />
    </div>
  );
}

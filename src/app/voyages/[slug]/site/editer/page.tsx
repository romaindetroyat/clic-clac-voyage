import Link from "next/link";
import { classesPolices } from "@/app/v/polices";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { urlsMembre } from "@/server/domaine/medias";
import { donneesSite } from "@/server/domaine/site";
import { iaActive } from "@/server/ia/client";
import { EditeurSite } from "./editeur-site";

export const metadata = { title: "Modifier le site" };

/** Éditeur visuel : le site tel que les lecteurs le verront, modifiable directement. */
export default async function PageEditerSite({ params }: PageProps<"/voyages/[slug]/site/editer">) {
  const { slug } = await params;
  const { voyage, estAdmin } = await accesVoyage(slug);
  if (!estAdmin) return <p className="text-encre-douce">Le site est mis en page par les administrateurs du voyage.</p>;
  const d = await donneesSite(await getDb(), voyage.id, urlsMembre(slug));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-3xl">Modifier le site</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={`/voyages/${slug}/site`} className="lien">
            Réglages du site
          </Link>
          <a href={`/v/${slug}`} className="lien">
            Voir le site
          </a>
        </div>
      </div>
      <div className={classesPolices}>
        <EditeurSite slug={slug} initial={d} ia={iaActive()} />
      </div>
    </div>
  );
}

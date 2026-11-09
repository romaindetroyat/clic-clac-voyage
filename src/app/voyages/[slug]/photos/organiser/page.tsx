import Link from "next/link";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { urlsMembre } from "@/server/domaine/medias";
import { donneesTri } from "@/server/domaine/tri";
import { Organiseur } from "./organiseur";

export const metadata = { title: "Organiser les photos" };

/** Photo par photo : date, site et livre, masquer, ordre dans la journée, retouche, remplacement. */
export default async function Organiser({ params, searchParams }: PageProps<"/voyages/[slug]/photos/organiser">) {
  const { slug } = await params;
  const q = await searchParams;
  const masquees = q.masquees === "1";
  const { voyage, utilisateur, estAdmin } = await accesVoyage(slug);
  const ctx = { voyageId: voyage.id, userId: utilisateur.id, estAdmin };
  const db = await getDb();
  const [{ medias }, { medias: cachees }] = await Promise.all([
    donneesTri(db, urlsMembre(slug), ctx, { masques: masquees }),
    masquees ? Promise.resolve({ medias: [] }) : donneesTri(db, urlsMembre(slug), ctx, { masques: true }),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl">{masquees ? "Photos masquées" : "Organiser les photos"}</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          {masquees ? (
            <Link href={`/voyages/${voyage.slug}/photos/organiser`} className="lien">
              Retour à l’organisation
            </Link>
          ) : (
            <Link href={`/voyages/${voyage.slug}/photos/organiser?masquees=1`} className="lien" data-testid="lien-masquees">
              Photos masquées ({cachees.length})
            </Link>
          )}
          <Link href={`/voyages/${voyage.slug}/photos`} className="lien">
            Toutes les photos
          </Link>
        </div>
      </div>
      <Organiseur
        slug={voyage.slug}
        medias={medias}
        fuseau={voyage.fuseau}
        estAdmin={estAdmin}
        masquees={masquees}
        depart={typeof q.m === "string" ? q.m : null}
      />
    </div>
  );
}

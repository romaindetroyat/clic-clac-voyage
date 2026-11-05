import Link from "next/link";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { RelectureDates } from "@/components/relecture-dates";
import { compterSansApercu } from "@/server/domaine/apercus";
import { compterARelire } from "@/server/domaine/dates";
import { galerie, urlsMembre } from "@/server/domaine/medias";
import { compterATrier } from "@/server/domaine/tri";
import { ApercusManquants } from "./apercus-manquants";
import { Galerie } from "./galerie";

export const metadata = { title: "Photos" };

export default async function Photos({ params }: PageProps<"/voyages/[slug]/photos">) {
  const { slug } = await params;
  const { voyage, utilisateur, estAdmin } = await accesVoyage(slug);
  const db = await getDb();
  const ctx = { voyageId: voyage.id, userId: utilisateur.id, estAdmin };
  const [medias, sansApercu, aRelire] = await Promise.all([galerie(db, urlsMembre(slug), voyage.id), compterSansApercu(db, ctx), compterARelire(db, ctx)]);
  if (medias.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-encre-douce">Aucune photo pour l’instant.</p>
        <Link href={`/voyages/${voyage.slug}/importer`} className="bouton">
          Importer des photos
        </Link>
      </div>
    );
  }
  const photos = medias.filter((m) => m.type === "photo").length;
  const aTrier = await compterATrier(db, voyage.id);
  const sansDate = medias.filter((m) => !m.instant).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-encre-douce" data-testid="compte-medias">
        {photos} photo{photos > 1 ? "s" : ""}
        {medias.length - photos ? ` · ${medias.length - photos} vidéo${medias.length - photos > 1 ? "s" : ""}` : ""}, dans
        l’ordre chronologique
      </p>
      <div className="carte flex flex-wrap items-center justify-between gap-3" data-testid="appel-tri">
        <p className="text-sm">
          {aTrier
            ? `${aTrier} photo${aTrier > 1 ? "s" : ""} ou vidéo${aTrier > 1 ? "s" : ""} à trier : gardez, écartez, choisissez la meilleure d’une série, retouchez.`
            : "Tout est trié. Vous pouvez revoir vos choix à tout moment."}
        </p>
        <Link href={`/voyages/${voyage.slug}/photos/trier`} className={aTrier ? "bouton" : "bouton-discret"}>
          {aTrier ? "Trier les photos" : "Revoir le tri"}
        </Link>
      </div>
      {sansDate ? (
        <div className="carte flex flex-wrap items-center gap-3" data-testid="sans-date">
          <p className="text-sm">
            {sansDate} photo{sansDate > 1 ? "s ou vidéos" : " ou vidéo"} sans date : hors des épisodes, du site et du livre.
          </p>
          <Link href={`/voyages/${voyage.slug}/photos/dates`} className="bouton-discret">
            Leur donner une date
          </Link>
          <RelectureDates slug={voyage.slug} aRelire={aRelire} />
        </div>
      ) : null}
      {sansApercu ? <ApercusManquants slug={voyage.slug} nombre={sansApercu} /> : null}
      <Galerie medias={medias} slug={voyage.slug} utilisateurId={utilisateur.id} estAdmin={estAdmin} />
    </div>
  );
}

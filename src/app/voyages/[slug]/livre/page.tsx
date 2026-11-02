import { periode } from "@/lib/dates";
import { lireConfig } from "@/lib/site/config";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { episodesDuLivre, livreDe, mediasDuLivre, versionsDe } from "@/server/domaine/livre";
import { participantsDe } from "@/server/domaine/voyages";
import { getStockage } from "@/server/stockage";
import { EditeurLivre } from "./editeur";

export const metadata = { title: "Livre" };

export default async function PageLivre({ params }: PageProps<"/voyages/[slug]/livre">) {
  const { slug } = await params;
  const { voyage, estAdmin } = await accesVoyage(slug);
  if (!estAdmin) return <p className="text-encre-douce">Le livre est mis en page par les administrateurs du voyage.</p>;
  const db = await getDb();
  const [medias, episodes, livre, versions, participants] = await Promise.all([
    mediasDuLivre(db, getStockage(), voyage.id),
    episodesDuLivre(db, voyage.id),
    livreDe(db, voyage.id),
    versionsDe(db, voyage.id),
    participantsDe(db, voyage.id),
  ]);
  const motDeLaFin = lireConfig(voyage.site).motDeLaFin;
  const noms = participants.map((p) => p.nom).filter(Boolean);
  const fin = noms.length || motDeLaFin ? { titre: "Les voyageurs", corps: [noms.join(", "), motDeLaFin].filter(Boolean).join("\n\n") } : null;

  return (
    <EditeurLivre
      slug={slug}
      nom={voyage.nom}
      periode={periode(voyage.dateDebut, voyage.dateFin)}
      fuseau={voyage.fuseau}
      episodes={episodes}
      medias={medias}
      fin={fin}
      initial={livre?.contenu ?? null}
      revisionInitiale={livre?.revision ?? null}
      versionsInitiales={versions}
    />
  );
}

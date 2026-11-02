import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { schemaRetouche } from "@/lib/rendu/parametres";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { media } from "@/server/db/schema";
import { getStockage } from "@/server/stockage";
import { Editeur } from "./editeur";

export const metadata = { title: "Retoucher" };

export default async function Retoucher({ params }: PageProps<"/voyages/[slug]/photos/[id]/retouche">) {
  const { slug, id } = await params;
  const { voyage, utilisateur, estAdmin } = await accesVoyage(slug);
  const m = await (await getDb()).query.media.findFirst({ where: and(eq(media.id, id), eq(media.voyageId, voyage.id)) });
  if (!m || m.type !== "photo") notFound();
  const retour = `/voyages/${voyage.slug}/photos`;
  if (m.auteurId !== utilisateur.id && !estAdmin) {
    return (
      <div className="space-y-4">
        <p className="text-encre-douce">Seuls l’auteur de la photo et l’administrateur peuvent la retoucher.</p>
        <Link href={retour} className="lien">
          Retour aux photos
        </Link>
      </div>
    );
  }
  // La retouche part toujours de la version d'origine (jamais d'une version déjà retouchée).
  const cleSource = m.versions.l ?? m.versions.m;
  if (!cleSource) return <p className="text-encre-douce">Aperçu indisponible : cette photo ne peut pas être retouchée ici.</p>;
  const source = await getStockage().urlLecture(cleSource, 3600);
  return (
    <Editeur
      slug={voyage.slug}
      mediaId={m.id}
      source={source}
      nom={m.nomFichier}
      initiale={schemaRetouche.parse(m.retouche ?? {})}
      retour={retour}
    />
  );
}

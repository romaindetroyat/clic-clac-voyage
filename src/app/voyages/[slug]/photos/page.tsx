import Link from "next/link";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { galerie } from "@/server/domaine/medias";
import { getStockage } from "@/server/stockage";
import { Galerie } from "./galerie";

export const metadata = { title: "Photos" };

export default async function Photos({ params }: PageProps<"/voyages/[slug]/photos">) {
  const { slug } = await params;
  const { voyage, utilisateur, estAdmin } = await accesVoyage(slug);
  const medias = await galerie(await getDb(), getStockage(), voyage.id);
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
  return (
    <div className="space-y-4">
      <p className="text-sm text-encre-douce" data-testid="compte-medias">
        {photos} photo{photos > 1 ? "s" : ""}
        {medias.length - photos ? ` · ${medias.length - photos} vidéo${medias.length - photos > 1 ? "s" : ""}` : ""}, dans
        l’ordre chronologique
      </p>
      <Galerie medias={medias} slug={voyage.slug} utilisateurId={utilisateur.id} estAdmin={estAdmin} />
    </div>
  );
}

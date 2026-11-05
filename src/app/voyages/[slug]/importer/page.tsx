import Link from "next/link";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { compterMedias } from "@/server/domaine/medias";
import { Importeur } from "./importeur";

export const metadata = { title: "Importer" };

export default async function Importer({ params }: PageProps<"/voyages/[slug]/importer">) {
  const { slug } = await params;
  const { voyage } = await accesVoyage(slug);
  return (
    <div className="space-y-6">
      <Importeur voyage={voyage.slug} remiseAZero={voyage.remiseAZeroLe?.getTime() ?? 0} dansLeVoyage={await compterMedias(await getDb(), voyage.id)} />
      <p className="text-sm text-encre-douce">
        Droit à l’image : n’envoyez que des photos que les personnes reconnaissables accepteraient de voir partagées dans le groupe.{" "}
        <Link href="/confidentialite" className="lien">
          En savoir plus
        </Link>
      </p>
    </div>
  );
}

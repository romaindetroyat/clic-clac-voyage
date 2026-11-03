import Link from "next/link";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { etatDates } from "@/server/domaine/dates";
import { urlsMembre } from "@/server/domaine/medias";
import { DatesAFixer } from "./dates-a-fixer";

export const metadata = { title: "Dates à fixer" };

export default async function PageDates({ params }: PageProps<"/voyages/[slug]/photos/dates">) {
  const { slug } = await params;
  const { voyage, utilisateur, estAdmin } = await accesVoyage(slug);
  const etat = await etatDates(await getDb(), urlsMembre(slug), { voyageId: voyage.id, userId: utilisateur.id, estAdmin });
  return (
    <div className="space-y-6">
      <Link href={`/voyages/${voyage.slug}/photos`} className="lien text-sm">
        ← Photos
      </Link>
      <div className="space-y-2">
        <h2 className="text-3xl">Dates à fixer</h2>
        <p className="max-w-2xl text-encre-douce">
          Ces photos et vidéos n’ont pas de date de prise de vue (captures d’écran, fichiers reçus par messagerie, métadonnées effacées…).
          Sans date, elles restent hors des épisodes, du site et du livre chronologique. Les dates données ici sont marquées « estimées ».
        </p>
      </div>
      <DatesAFixer slug={voyage.slug} {...etat} />
    </div>
  );
}

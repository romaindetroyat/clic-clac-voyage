import Link from "next/link";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { urlsMembre } from "@/server/domaine/medias";
import { donneesTri } from "@/server/domaine/tri";
import { iaActive } from "@/server/ia/client";
import { Trieuse } from "./trieuse";

export const metadata = { title: "Trier les photos" };

export default async function Trier({ params, searchParams }: PageProps<"/voyages/[slug]/photos/trier">) {
  const { slug } = await params;
  const { m } = await searchParams;
  const { voyage, utilisateur, estAdmin } = await accesVoyage(slug);
  const { medias, avis } = await donneesTri(await getDb(), urlsMembre(slug), { voyageId: voyage.id, userId: utilisateur.id, estAdmin });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl">Trier les photos</h1>
        <Link href={`/voyages/${voyage.slug}/photos`} className="lien text-sm">
          Retour à toutes les photos
        </Link>
      </div>
      <Trieuse slug={voyage.slug} medias={medias} avis={avis} estAdmin={estAdmin} ia={iaActive()} depart={typeof m === "string" ? m : null} />
    </div>
  );
}

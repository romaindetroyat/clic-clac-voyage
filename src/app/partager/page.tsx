import { Marque } from "@/components/marque";
import { exigerUtilisateur } from "@/server/auth";
import { getDb } from "@/server/db";
import { voyagesDe } from "@/server/domaine/voyages";
import { RecevoirPartage } from "./recevoir-partage";

export const metadata = { title: "Partager vers un voyage" };

export default async function Partager({ searchParams }: PageProps<"/partager">) {
  const u = await exigerUtilisateur();
  const voyages = await voyagesDe(await getDb(), u.id);
  const { id, erreur } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-8 px-4 py-8">
      <Marque />
      {erreur ? (
        <div className="space-y-3">
          <h1 className="text-3xl">Partage non reçu</h1>
          <p className="text-encre-douce">
            {erreur === "premier"
              ? "L’app venait d’être installée : partagez à nouveau vos photos, cela fonctionnera cette fois."
              : "Les fichiers n’ont pas pu être reçus. Réessayez, ou importez-les depuis l’écran Importer."}
          </p>
        </div>
      ) : (
        <RecevoirPartage id={typeof id === "string" ? id : ""} voyages={voyages.map((v) => ({ slug: v.slug, nom: v.nom }))} />
      )}
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Marque } from "@/components/marque";
import { utilisateurCourant } from "@/server/auth";

export default async function Accueil({ searchParams }: PageProps<"/">) {
  if (await utilisateurCourant()) redirect("/voyages");
  const supprime = (await searchParams).compte === "supprime";
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <Marque href="/" />
      {supprime ? (
        <p role="status" className="rounded-lg border border-filet bg-papier-2 p-3 text-sm">
          Votre compte et vos photos ont été supprimés.
        </p>
      ) : null}
      <div className="space-y-5">
        <h1 className="text-5xl leading-[1.05] sm:text-6xl">Toutes les photos du voyage, enfin réunies.</h1>
        <p className="text-lg text-encre-douce">
          Chacun envoie ses photos, on raconte le voyage ensemble, puis on en fait un beau site et un livre imprimé.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/connexion" className="bouton">
          Se connecter
        </Link>
      </div>
      <p className="text-sm text-encre-douce">
        Accès sur invitation. Pas de mot de passe : un code arrive par e-mail.{" "}
        <Link href="/confidentialite" className="lien">
          Confidentialité et droit à l’image
        </Link>
      </p>
    </main>
  );
}

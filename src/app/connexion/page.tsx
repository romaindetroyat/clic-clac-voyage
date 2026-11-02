import { redirect } from "next/navigation";
import { Marque } from "@/components/marque";
import { googleActif, utilisateurCourant } from "@/server/auth";
import { getDb } from "@/server/db";
import { invitationValide } from "@/server/domaine/voyages";
import { FormulaireConnexion } from "./formulaire";

export const metadata = { title: "Connexion" };

export default async function Connexion({ searchParams }: PageProps<"/connexion">) {
  if (await utilisateurCourant()) redirect("/voyages");
  const { invitation: invitationId, erreur } = await searchParams;

  let invitation: { email: string; nomVoyage: string } | null = null;
  if (typeof invitationId === "string" && /^[0-9a-f-]{36}$/.test(invitationId)) {
    invitation = await invitationValide(await getDb(), invitationId);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <Marque href="/" />
      <div className="space-y-3">
        <h1 className="text-4xl">{invitation ? `Rejoindre « ${invitation.nomVoyage} »` : "Connexion"}</h1>
        <p className="text-encre-douce">
          Indiquez votre adresse e-mail : vous recevrez un code à 6 chiffres et un lien pour vous connecter.
        </p>
      </div>
      {erreur ? (
        <p role="alert" className="rounded-md border border-danger/40 px-3 py-2 text-sm text-danger">
          La connexion avec Google n’a pas abouti. Cette adresse a-t-elle bien été invitée ?
        </p>
      ) : null}
      <FormulaireConnexion emailInitial={invitation?.email ?? ""} google={googleActif()} />
    </main>
  );
}

import Link from "next/link";
import { Entete } from "@/components/entete";
import { FormulaireAction } from "@/components/formulaires";
import { exigerUtilisateur } from "@/server/auth";
import { getDb } from "@/server/db";
import { voyagesABloquer } from "@/server/domaine/suppression";
import { actionDeconnexion, actionModifierNom, actionSupprimerCompte } from "../voyages/actions";

export const metadata = { title: "Mon compte" };

export default async function Compte() {
  const u = await exigerUtilisateur();
  const { bloquants } = await voyagesABloquer(await getDb(), u.id);
  return (
    <>
      <Entete nom={u.nom} />
      <main className="mx-auto w-full max-w-lg flex-1 space-y-10 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-4xl">Mon compte</h1>
        <section className="space-y-4">
          <p className="text-encre-douce">
            Connecté avec <strong className="text-encre">{u.email}</strong>
          </p>
          <FormulaireAction action={actionModifierNom} bouton="Enregistrer" reinitialiser={false}>
            <label className="block space-y-1.5">
              <span className="etiquette">Nom affiché (signe vos légendes et commentaires)</span>
              <input name="nom" className="champ" required maxLength={80} defaultValue={u.nom} />
            </label>
          </FormulaireAction>
        </section>
        <form action={actionDeconnexion}>
          <button className="bouton-discret">Se déconnecter</button>
        </form>
        <p className="text-sm">
          <Link href="/confidentialite" className="lien">
            Confidentialité et droit à l’image
          </Link>
        </p>
        <section className="space-y-3 rounded-lg border border-danger/40 p-4">
          <h2 className="text-2xl">Supprimer mon compte</h2>
          <p className="text-sm text-encre-douce">
            Supprime votre compte, toutes les photos et vidéos que vous avez envoyées (originaux compris), vos commentaires et réactions,
            vos commandes, et les voyages où vous êtes seul. Les photos des autres restent dans les voyages partagés.
          </p>
          {bloquants.length ? (
            <p className="text-sm text-danger">
              Vous êtes le seul administrateur de : {bloquants.join(", ")}. Nommez d’abord un autre administrateur dans l’onglet Participants,
              ou supprimez ces voyages.
            </p>
          ) : (
            <FormulaireAction action={actionSupprimerCompte} bouton="Supprimer définitivement mon compte">
              <label className="block space-y-1.5">
                <span className="etiquette">Recopiez votre adresse e-mail pour confirmer</span>
                <input name="confirmation" type="email" className="champ" required autoComplete="off" />
              </label>
            </FormulaireAction>
          )}
        </section>
      </main>
    </>
  );
}

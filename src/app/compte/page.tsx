import { Entete } from "@/components/entete";
import { FormulaireAction } from "@/components/formulaires";
import { exigerUtilisateur } from "@/server/auth";
import { actionDeconnexion, actionModifierNom } from "../voyages/actions";

export const metadata = { title: "Mon compte" };

export default async function Compte() {
  const u = await exigerUtilisateur();
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
      </main>
    </>
  );
}

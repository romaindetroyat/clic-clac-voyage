import { FormulaireAction } from "@/components/formulaires";
import { accesVoyage } from "@/server/acces";
import { estimerCout, TARIFS } from "@/lib/couts/estimation";
import { getDb } from "@/server/db";
import { usage } from "@/server/domaine/usage";
import { adminEmails, appUrl } from "@/server/env";
import { budgetIa } from "@/server/ia/budget";
import { iaActive } from "@/server/ia/client";
import { actionModifierVoyage, actionSupprimerVoyage } from "../../actions";

export const metadata = { title: "Réglages" };

export default async function Reglages({ params }: PageProps<"/voyages/[slug]/reglages">) {
  const { slug } = await params;
  const { voyage, estAdmin, utilisateur } = await accesVoyage(slug);
  if (!estAdmin) return <p className="text-encre-douce">Les réglages sont gérés par les administrateurs du voyage.</p>;
  const db = await getDb();
  const ici = await usage(db, voyage.id);
  // Toute l'application : seulement pour les administrateurs de l'app (ADMIN_EMAILS).
  const toutes = adminEmails().includes(utilisateur.email.toLowerCase()) ? await usage(db) : null;
  const cout = toutes ? estimerCout(toutes) : null;
  const ia = toutes && iaActive() ? await budgetIa(db) : null;
  const go = (o: number) => `${(o / 1e9).toFixed(o < 1e9 ? 2 : 1).replace(".", ",")} Go`;

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-2xl">Réglages du voyage</h2>
      <FormulaireAction action={actionModifierVoyage.bind(null, slug)} bouton="Enregistrer" reinitialiser={false}>
        <label className="block space-y-1.5">
          <span className="etiquette">Nom</span>
          <input name="nom" className="champ" required maxLength={120} defaultValue={voyage.nom} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="etiquette">Début</span>
            <input name="dateDebut" type="date" className="champ" defaultValue={voyage.dateDebut ?? ""} />
          </label>
          <label className="block space-y-1.5">
            <span className="etiquette">Fin</span>
            <input name="dateFin" type="date" className="champ" defaultValue={voyage.dateFin ?? ""} />
          </label>
        </div>
      </FormulaireAction>
      <p className="text-sm text-encre-douce">
        Adresse du site : <code>{`${appUrl()}/v/${voyage.slug}`}</code> (accessible seulement avec un lien secret).
      </p>
      <section className="space-y-2">
        <h2 className="text-2xl">Espace et coût</h2>
        <p className="text-sm">
          Ce voyage : {ici.photos} photo{ici.photos > 1 ? "s" : ""}, {ici.videos} vidéo{ici.videos > 1 ? "s" : ""}, {go(ici.octetsOriginaux)} d’originaux et
          environ {go(ici.octetsVersions)} de versions pour l’écran.
        </p>
        {toutes && cout ? (
          <div className="space-y-1 text-sm" data-testid="cout">
            <p>
              Toute l’application : {go(toutes.octetsOriginaux + toutes.octetsVersions)} de photos et vidéos
              {cout.baseGo != null ? `, base de données ${cout.baseGo.toFixed(2).replace(".", ",")} Go` : ""}.
            </p>
            <p>
              Coût estimé : <strong>{cout.totalEur.toFixed(2).replace(".", ",")} € par mois</strong>{" "}
              {cout.dansLeBudget ? "(dans le budget de 5 €)" : "(au-delà du budget de 5 € !)"} : Vercel Hobby et Neon gratuits, Cloudflare R2
              gratuit jusqu’à {TARIFS.r2.gratuitGo} Go puis {TARIFS.r2.parGoMois.toString().replace(".", ",")} $ par Go et par mois (tarifs du{" "}
              {new Date(TARIFS.releve).toLocaleDateString("fr-FR")}).
            </p>
            {ia ? (
              <p>
                IA (Anthropic, facturée à part) : {ia.depenseEur.toFixed(2).replace(".", ",")} € dépensés ce mois-ci, plafond{" "}
                {ia.plafondEur.toFixed(2).replace(".", ",")} € (variable IA_BUDGET_MENSUEL_EUR dans Vercel).
              </p>
            ) : null}
            {cout.alertes.map((a) => (
              <p key={a} className="text-accent">
                {a}
              </p>
            ))}
          </div>
        ) : null}
      </section>
      <section className="space-y-3 rounded-lg border border-danger/40 p-4">
        <h2 className="text-2xl">Supprimer le voyage</h2>
        <p className="text-sm text-encre-douce">
          Supprime définitivement le voyage pour tout le monde : photos et vidéos (originaux compris), récit, commentaires, site, livre,
          commandes et liens de partage. Rien ne peut être récupéré ensuite : pensez à exporter le site ou le livre avant.
        </p>
        <FormulaireAction action={actionSupprimerVoyage.bind(null, slug)} bouton="Supprimer définitivement">
          <label className="block space-y-1.5">
            <span className="etiquette">Recopiez le nom du voyage : {voyage.nom}</span>
            <input name="confirmation" className="champ" required autoComplete="off" />
          </label>
        </FormulaireAction>
      </section>
    </div>
  );
}

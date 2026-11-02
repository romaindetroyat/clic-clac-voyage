import Link from "next/link";
import { BoutonAction, FormulaireAction } from "@/components/formulaires";
import { euros } from "@/lib/imprimeurs/parts";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { etatCommande, STATUTS, type StatutCommande } from "@/server/domaine/commande";
import { actionCommandePassee, actionMaCommande, actionPaye, actionPayeur, actionStatutCommande } from "../../actions";
import { MaCommande } from "./ma-commande";

export const metadata = { title: "Commande" };

const SUIVANT: Record<StatutCommande, StatutCommande | null> = { demandee: "commandee", commandee: "expediee", expediee: null };

export default async function PageCommande({ params }: PageProps<"/voyages/[slug]/commande">) {
  const { slug } = await params;
  const { voyage, utilisateur, estAdmin } = await accesVoyage(slug);
  const e = await etatCommande(await getDb(), { voyageId: voyage.id, userId: utilisateur.id, estAdmin });
  const moi = e.commandes.find((c) => c.userId === utilisateur.id);
  const maPart = e.recap?.parts.find((p) => p.userId === utilisateur.id);
  const verrouillee = !!moi && moi.statut !== "demandee";
  const passee = e.commandes.some((c) => c.statut !== "demandee");

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        <section className="space-y-2">
          <h2 className="text-2xl">Le livre</h2>
          {e.choix ? (
            <p>
              Imprimé par <strong>{e.choix.imprimeur.nom}</strong> : {e.choix.produit.nom}, {e.choix.pages} pages.{" "}
              {e.prix != null ? (
                <>
                  <strong>{euros(Math.round(e.prix * 100))}</strong> l’exemplaire
                  {e.choix.produit.prix.statut !== "V" ? " (prix à confirmer)" : ""}.
                </>
              ) : (
                "Prix pas encore relevé : à vérifier sur le site de l’imprimeur."
              )}
              {!e.portConnu ? " Frais de port non relevés : ils seront ajoutés au moment de commander." : ""}
            </p>
          ) : (
            <p className="text-encre-douce">
              L’imprimeur n’est pas encore choisi.{" "}
              <Link href={`/voyages/${slug}/imprimeurs`} className="lien">
                Comparer les imprimeurs
              </Link>
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Ma commande</h2>
          <MaCommande
            action={actionMaCommande.bind(null, slug)}
            initial={{ exemplaires: moi?.exemplaires ?? 1, livraison: moi?.livraison ?? "groupee", adresse: moi?.adresse ?? null }}
            verrouillee={verrouillee}
          />
          {verrouillee ? <p className="text-sm text-encre-douce">La commande est passée : voyez avec {e.payeur.nom} pour tout changement.</p> : null}
          {maPart ? (
            <p data-testid="ma-part">
              Je dois <strong>{euros(moi?.montantFige ?? maPart.total)}</strong>
              {maPart.doitA ? ` à ${e.payeur.nom}` : " (c’est moi qui paie l’imprimeur)"} : {euros(maPart.livres)} de livres et {euros(maPart.port)} de port.
              {moi?.paye ? " Remboursement reçu." : ""}
            </p>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Qui doit combien à qui</h2>
          {e.recap && e.recap.dettes.length ? (
            <ul className="divide-y divide-filet border-y border-filet" data-testid="dettes">
              {e.recap.dettes.map((d) => {
                const c = e.commandes.find((x) => x.userId === d.de);
                return (
                  <li key={d.de} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <strong>{d.deNom}</strong> doit {euros(c?.montantFige ?? d.montant)} à {d.aNom}
                      {c?.paye ? <span className="ml-2 text-sm text-succes">payé</span> : null}
                    </span>
                    {estAdmin ? (
                      <BoutonAction libelle={c?.paye ? "Annuler le paiement" : "Marquer payé"} action={actionPaye.bind(null, slug, d.de, !c?.paye)} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-encre-douce">Personne ne doit rien pour l’instant.</p>
          )}
          {e.recap ? (
            <p className="text-sm text-encre-douce">
              Total : {e.recap.exemplaires} exemplaire{e.recap.exemplaires > 1 ? "s" : ""}, {euros(e.recap.livres)} de livres + {euros(e.recap.port)} de port ={" "}
              <strong className="text-encre">{euros(e.recap.total)}</strong>.
            </p>
          ) : null}
        </section>

        {estAdmin ? (
          <section className="space-y-3">
            <h2 className="text-2xl">Toutes les commandes</h2>
            <ul className="divide-y divide-filet border-y border-filet">
              {e.commandes.map((c) => {
                const part = e.recap?.parts.find((p) => p.userId === c.userId);
                const suivant = SUIVANT[c.statut];
                return (
                  <li key={c.userId} className="space-y-1 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>{c.nom}</strong> · {c.exemplaires} ex. · {c.livraison === "groupee" ? "envoi groupé" : "à domicile"} · {STATUTS[c.statut]}
                        {part ? ` · ${euros(c.montantFige ?? part.total)}` : ""}
                      </span>
                      {suivant ? <BoutonAction libelle={`Passer à « ${STATUTS[suivant]} »`} action={actionStatutCommande.bind(null, slug, c.userId, suivant)} /> : null}
                    </div>
                    {c.adresse ? <p className="whitespace-pre-line text-sm text-encre-douce">{c.adresse}</p> : null}
                  </li>
                );
              })}
            </ul>
            {e.commandes.length === 0 ? <p className="text-sm text-encre-douce">Aucune commande pour l’instant.</p> : null}
          </section>
        ) : null}
      </div>

      {estAdmin ? (
        <aside className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-xl">Qui paie l’imprimeur ?</h2>
            <FormulaireAction action={actionPayeur.bind(null, slug)} bouton="Enregistrer" reinitialiser={false}>
              <select name="payeur" defaultValue={e.payeur.id} className="champ" aria-label="Qui paie l’imprimeur">
                {e.admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}
                  </option>
                ))}
              </select>
            </FormulaireAction>
          </section>
          {e.choix ? (
            <section className="space-y-3">
              <h2 className="text-xl">Passer la commande</h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>
                  <Link href={`/voyages/${slug}/livre`} className="lien">
                    Exporter le PDF
                  </Link>{" "}
                  (onglet Livre).
                </li>
                <li>
                  Commander {e.recap?.exemplaires ?? 0} exemplaire(s) chez{" "}
                  <a href={e.choix.imprimeur.lienCommande} target="_blank" rel="noreferrer" className="lien">
                    {e.choix.imprimeur.nom} ↗
                  </a>
                  .
                </li>
                <li>Le noter ici : les montants de chacun sont alors figés.</li>
              </ol>
              {!passee ? (
                <BoutonAction libelle="La commande est passée" confirmation="Noter la commande comme passée et figer les montants ?" action={actionCommandePassee.bind(null, slug)} />
              ) : (
                <p className="text-sm text-succes">Commande passée.</p>
              )}
            </section>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

import { BoutonAction, FormulaireAction } from "@/components/formulaires";
import { getDb } from "@/server/db";
import { budgetIa } from "@/server/ia/budget";
import { CHAMPS, etatMajs, type Champ } from "@/server/ia/imprimeurs";
import { actionMajImprimeurIa, actionRejeterMaj, actionValiderMaj } from "../../actions";

const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const nombre = (v: number | null) => (v == null ? "non relevé" : v.toLocaleString("fr-FR"));

/** IMPR-04 : vérification des fiches par l'IA, réservée aux administrateurs de l'application. */
export async function MajIa({ slug }: { slug: string }) {
  const db = await getDb();
  const [etats, budget] = await Promise.all([etatMajs(db), budgetIa(db)]);
  const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
  return (
    <section className="space-y-4" aria-labelledby="maj-ia">
      <div className="space-y-1">
        <h2 id="maj-ia" className="text-2xl">
          Mettre à jour les fiches avec l’IA
        </h2>
        <p className="text-sm text-encre-douce">
          L’IA cherche sur le web les prix, frais de port, délais et notes de l’imprimeur, et propose des changements sourcés. Rien ne change
          avant votre validation. Compter une à trois minutes et quelques dizaines de centimes par imprimeur. Budget d’IA du mois :{" "}
          {eur(budget.depenseEur)} sur {eur(budget.plafondEur)}.
        </p>
      </div>
      <ul className="space-y-3">
        {etats.map(({ imprimeur, enAttente, derniereVerification }) => (
          <li key={imprimeur.id} className="carte space-y-3" data-testid="maj-imprimeur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <strong>{imprimeur.nom}</strong>{" "}
                <span className="text-sm text-encre-douce">
                  {derniereVerification ? `vérifié par l’IA le ${fmtDate.format(derniereVerification)}` : `relevé à la main le ${fmtDate.format(new Date(imprimeur.releve))}`}
                </span>
              </p>
              {enAttente ? null : <BoutonAction libelle="Mettre à jour avec l’IA" action={actionMajImprimeurIa.bind(null, slug, imprimeur.id)} />}
            </div>
            {enAttente ? (
              <div className="space-y-3">
                {enAttente.resume ? <p className="text-sm">{enAttente.resume}</p> : null}
                <FormulaireAction action={actionValiderMaj.bind(null, slug, enAttente.id)} bouton="Valider la sélection" reinitialiser={false}>
                  {enAttente.propositions.length ? (
                    <ul className="space-y-2 text-sm">
                      {enAttente.propositions.map((p, i) => (
                        <li key={i}>
                          <label className="flex gap-2">
                            <input type="checkbox" name="p" value={i} defaultChecked className="mt-1" />
                            <span>
                              <strong>{CHAMPS[p.champ as Champ] ?? p.champ}</strong>
                              {p.produitId ? ` (${imprimeur.produits.find((x) => x.id === p.produitId)?.nom ?? p.produitId})` : ""} : {nombre(p.actuelle)} →{" "}
                              <strong>{nombre(p.proposee)}</strong>
                              <br />
                              <span className="text-encre-douce">« {p.extrait} » </span>
                              <a href={p.source} target="_blank" rel="noreferrer" className="lien">
                                source
                              </a>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-encre-douce">Aucun changement trouvé. Validez pour dater la vérification.</p>
                  )}
                </FormulaireAction>
                <BoutonAction libelle="Tout rejeter" action={actionRejeterMaj.bind(null, slug, enAttente.id)} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

import Link from "next/link";
import { BoutonAction } from "@/components/formulaires";
import { IMPRIMEURS } from "@/lib/imprimeurs/catalogue";
import { comparer, DATE_TAUX, forme, type Tri } from "@/lib/imprimeurs/comparateur";
import type { Source } from "@/lib/imprimeurs/types";
import { formatParId } from "@/lib/livre/formats";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { etatCommande } from "@/server/domaine/commande";
import { livreDe } from "@/server/domaine/livre";
import { actionChoisirImprimeur } from "../../actions";

export const metadata = { title: "Imprimeurs" };

const TRIS: Record<Tri, string> = { score: "Meilleur compromis", prix: "Prix", note: "Note des clients", delai: "Délai" };
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const STATUTS: Record<Source["statut"], string> = { V: "vérifié", S: "source secondaire", NV: "non vérifié" };
const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function Badge({ s }: { s: Source["statut"] }) {
  const c = s === "V" ? "border-succes text-succes" : s === "S" ? "border-accent text-accent" : "border-filet text-encre-douce";
  return <span className={`ml-1 rounded-full border px-1.5 text-[0.7rem] ${c}`}>{STATUTS[s]}</span>;
}

export default async function PageImprimeurs({ params, searchParams }: PageProps<"/voyages/[slug]/imprimeurs">) {
  const { slug } = await params;
  const q = await searchParams;
  const { voyage, utilisateur, estAdmin } = await accesVoyage(slug);
  const db = await getDb();
  const [l, commande] = await Promise.all([livreDe(db, voyage.id), etatCommande(db, { voyageId: voyage.id, userId: utilisateur.id, estAdmin })]);
  const f = formatParId(l?.contenu.formatId ?? "portrait-21x28");
  const pages = l?.contenu.pages.length ?? 40;
  const commandes = commande.commandes.reduce((s, c) => s + c.exemplaires, 0);
  const demande = Number(q.exemplaires);
  const exemplaires = Number.isInteger(demande) && demande > 0 && demande <= 100 ? demande : Math.max(1, commandes);
  const tri = (Object.keys(TRIS) as Tri[]).includes(q.tri as Tri) ? (q.tri as Tri) : "score";
  const { lignes, exclusions } = comparer(IMPRIMEURS, { pages, largeur: f.largeur, hauteur: f.hauteur }, exemplaires, tri);
  const choisi = f.imprimeurId ? `${f.imprimeurId}` : null;
  const lien = (o: { tri?: string; exemplaires?: number }) => {
    const u = new URLSearchParams({ tri: o.tri ?? tri, exemplaires: String(o.exemplaires ?? exemplaires) });
    return `/voyages/${slug}/imprimeurs?${u}`;
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-encre-douce">
          {l ? (
            <>
              Pour votre livre : <strong className="text-encre">{pages} pages</strong>, format {f.nom} ({forme(f.largeur, f.hauteur) === "carre" ? "carré" : forme(f.largeur, f.hauteur)}).
            </>
          ) : (
            <>Le livre n’existe pas encore : comparaison pour 40 pages au format portrait 21 × 28 cm.</>
          )}{" "}
          Prix pour <strong className="text-encre">{exemplaires} exemplaire{exemplaires > 1 ? "s" : ""}</strong>
          {commandes ? ` (commandés par le groupe : ${commandes})` : ""}, livrés ensemble en France.
        </p>
        <form className="flex flex-wrap items-end gap-3" action={`/voyages/${slug}/imprimeurs`}>
          <input type="hidden" name="tri" value={tri} />
          <label className="space-y-1.5">
            <span className="etiquette block">Exemplaires</span>
            <input name="exemplaires" type="number" min={1} max={100} defaultValue={exemplaires} className="champ w-28" />
          </label>
          <button className="bouton-discret">Recalculer</button>
        </form>
        <nav aria-label="Classer par" className="flex flex-wrap gap-2">
          {(Object.keys(TRIS) as Tri[]).map((t) => (
            <Link key={t} href={lien({ tri: t })} aria-current={t === tri ? "true" : undefined} className={`rounded-full border px-3 py-1.5 text-sm ${t === tri ? "border-encre bg-encre text-papier" : "border-filet hover:bg-papier-2"}`}>
              {TRIS[t]}
            </Link>
          ))}
        </nav>
      </section>

      <ol className="space-y-4">
        {lignes.map((li, i) => (
          <li key={li.imprimeur.id} className={`carte space-y-3 ${choisi === li.imprimeur.id ? "ring-2 ring-encre" : ""}`} data-testid="offre">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-encre-douce">
                  {i + 1}. {li.imprimeur.pays}
                  {choisi === li.imprimeur.id ? " · imprimeur choisi" : ""}
                </p>
                <h2 className="text-2xl">{li.imprimeur.nom}</h2>
                <p className="text-sm">
                  {li.produit.nom} · {li.produit.papier}
                  {li.pagesAjoutees > 0 ? ` · facturé ${li.pages} pages (+${li.pagesAjoutees})` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl" data-testid="total">
                  {li.total != null ? eur.format(li.total) : "Prix à vérifier"}
                </p>
                {li.total != null && !li.portInclus ? <p className="text-xs text-accent">hors frais de port</p> : null}
                <p className="text-sm text-encre-douce">
                  {li.exemplaire != null ? `${eur.format(li.exemplaire)} l’exemplaire` : "prix non relevé"}
                  {li.port != null ? ` · port ${eur.format(li.port)}` : li.exemplaire != null ? " · port à ajouter" : ""}
                </p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="etiquette">Clients</dt>
                <dd>
                  {li.imprimeur.note ? (
                    <>
                      {li.imprimeur.note.valeur.toString().replace(".", ",")} / 5 ({li.imprimeur.note.avis.toLocaleString("fr-FR")} avis, {li.imprimeur.note.domaine})
                    </>
                  ) : (
                    "Note non relevée"
                  )}
                </dd>
              </div>
              <div>
                <dt className="etiquette">Délai</dt>
                <dd>
                  {li.delaiJours != null
                    ? `${li.delaiJours} jours ouvrés`
                    : li.imprimeur.delais.fabrication != null
                      ? `Fabrication ${li.imprimeur.delais.fabrication} j, livraison non relevée`
                      : "Non relevé"}
                </dd>
              </div>
              <div>
                <dt className="etiquette">Score</dt>
                <dd>{li.score.toString().replace(".", ",")} / 100</dd>
              </div>
            </dl>
            {li.incertitudes.length ? (
              <ul className="list-disc pl-5 text-sm text-accent">
                {li.incertitudes.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
            <details className="text-sm">
              <summary className="cursor-pointer text-encre-douce">Fiche technique et sources</summary>
              <div className="mt-2 space-y-1">
                <p>
                  Fichiers :{" "}
                  {{ separes: "intérieur et couverture séparés", "doubles-pages": "intérieur en doubles pages + couverture", unique: "un seul PDF (couverture étalée puis intérieur)", "unique-pages": "un seul PDF en pages simples, sans fond perdu" }[li.imprimeur.technique.fichiers]}
                  , {li.imprimeur.technique.couleur}, {li.imprimeur.technique.normePdf === "libre" ? "PDF libre" : li.imprimeur.technique.normePdf}.
                  <Badge s={li.imprimeur.technique.statut} />
                </p>
                <p>
                  Fond perdu {li.imprimeur.technique.fondPerdu.toString().replace(".", ",")} mm, sécurité {li.imprimeur.technique.securite.toString().replace(".", ",")} mm (+{li.imprimeur.technique.securiteReliure.toString().replace(".", ",")} mm côté reliure), dos{" "}
                  {{ table: "selon la table de l’imprimeur", formule: "calculé", gabarit: "selon son gabarit", api: "calculé par l’imprimeur" }[li.imprimeur.technique.dos]}.
                </p>
                <p>
                  Prix <Badge s={li.produit.prix.statut} /> · port <Badge s={li.imprimeur.port.statut} />
                  {li.imprimeur.port.regle ? ` (${li.imprimeur.port.regle})` : ""} · délais <Badge s={li.imprimeur.delais.statut} />
                </p>
                <p className="text-encre-douce">{li.imprimeur.remarques}</p>
                <p className="text-encre-douce">
                  Relevé le {fmtDate.format(new Date(li.imprimeur.releve))}.{" "}
                  {[li.produit.prix.source, li.imprimeur.technique.source, li.imprimeur.note?.source]
                    .filter((x, j, t): x is string => !!x && t.indexOf(x) === j)
                    .map((u, j) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="lien mr-2">
                        source {j + 1}
                      </a>
                    ))}
                </p>
              </div>
            </details>
            <div className="flex flex-wrap gap-2">
              <a href={li.imprimeur.lienCommande} target="_blank" rel="noreferrer" className="bouton-discret">
                Voir le site ↗
              </a>
              {estAdmin && choisi !== li.imprimeur.id ? (
                <BoutonAction
                  libelle={`Choisir ${li.imprimeur.nom}`}
                  confirmation={`Adapter le livre au format « ${li.produit.nom} » ? La version actuelle est gardée dans l’historique.`}
                  action={actionChoisirImprimeur.bind(null, slug, li.imprimeur.id, li.produit.id)}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {exclusions.length ? (
        <section className="space-y-2">
          <h2 className="text-2xl">Écartés</h2>
          <ul className="space-y-1 text-sm">
            {exclusions.map((e) => (
              <li key={e.imprimeur.id}>
                <strong>{e.imprimeur.nom}</strong> : {e.raison}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-encre-douce">
        Prix TTC hors options, relevés sur les sites des imprimeurs ; devises converties au taux indicatif du {fmtDate.format(new Date(DATE_TAUX))}. « Non vérifié » :
        à confirmer sur le site avant de commander. Le score combine prix (50 %), note des clients (30 %) et délai (20 %).
      </p>
    </div>
  );
}

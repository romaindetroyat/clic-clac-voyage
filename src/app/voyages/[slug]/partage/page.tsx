import { BoutonAction, FormulaireAction } from "@/components/formulaires";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { liensSecretsDe } from "@/server/domaine/voyages";
import { actionCreerLien, actionRevoquerLien } from "../../actions";

export const metadata = { title: "Partage" };

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function Partage({ params }: PageProps<"/voyages/[slug]/partage">) {
  const { slug } = await params;
  const { voyage, estAdmin } = await accesVoyage(slug);
  if (!estAdmin) return <p className="text-encre-douce">Le partage est géré par les administrateurs du voyage.</p>;
  const liens = await liensSecretsDe(await getDb(), voyage.id);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-4">
        <h2 className="text-2xl">Liens secrets</h2>
        <p className="text-encre-douce">
          Les lecteurs n’ont pas de compte : ils consultent le site du voyage avec un lien secret. Vous pouvez en créer
          plusieurs (famille, amis…) et les révoquer à tout moment.
        </p>
        {liens.length === 0 ? (
          <p className="text-sm text-encre-douce">Aucun lien pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-filet border-y border-filet">
            {liens.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className={l.revoqueLe ? "text-encre-douce line-through" : ""}>{l.libelle}</p>
                  <p className="text-sm text-encre-douce">
                    Créé le {fmt.format(l.creeLe)}
                    {l.protege ? " · protégé par mot de passe" : ""}
                    {l.revoqueLe ? ` · révoqué le ${fmt.format(l.revoqueLe)}` : ""}
                  </p>
                </div>
                {!l.revoqueLe ? (
                  <BoutonAction
                    variante="danger"
                    libelle="Révoquer"
                    confirmation="Révoquer ce lien ? Les personnes qui l’ont ne pourront plus voir le site."
                    action={actionRevoquerLien.bind(null, slug, l.id)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="space-y-4">
        <h2 className="text-2xl">Nouveau lien</h2>
        <FormulaireAction action={actionCreerLien.bind(null, slug)} bouton="Créer le lien" reinitialiser={false}>
          <label className="block space-y-1.5">
            <span className="etiquette">Pour qui ?</span>
            <input name="libelle" className="champ" maxLength={80} placeholder="La famille" />
          </label>
          <label className="block space-y-1.5">
            <span className="etiquette">Mot de passe (facultatif)</span>
            <input name="motDePasse" className="champ" type="text" autoComplete="off" maxLength={200} />
          </label>
        </FormulaireAction>
      </aside>
    </div>
  );
}

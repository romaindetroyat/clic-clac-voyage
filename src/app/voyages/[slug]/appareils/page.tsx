import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { appareilsDe } from "@/server/domaine/medias";
import { formaterDecalage } from "@/server/domaine/temps";
import { actionRecalerAppareil } from "../../actions";
import { FormulaireAction } from "@/components/formulaires";

export const metadata = { title: "Appareils" };

export default async function Appareils({ params }: PageProps<"/voyages/[slug]/appareils">) {
  const { slug } = await params;
  const { voyage, estAdmin, utilisateur } = await accesVoyage(slug);
  const apps = await appareilsDe(await getDb(), voyage.id);
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl">Recaler les horloges</h2>
        <p className="text-encre-douce">
          Un appareil photo mal réglé mélange l’ordre des photos. Indiquez son décalage, par exemple « +1 h 12 » s’il
          retardait d’une heure douze, et toutes ses photos se replacent au bon moment.
        </p>
      </div>
      {apps.length === 0 ? (
        <p className="text-sm text-encre-douce">Aucun appareil pour l’instant : importez des photos.</p>
      ) : (
        <ul className="divide-y divide-filet border-y border-filet">
          {apps.map((a) => {
            const modifiable = estAdmin || a.proprietaireId === utilisateur.id;
            return (
              <li key={a.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{a.libelle}</p>
                  <p className="text-sm text-encre-douce">
                    {a.nbMedias} média{a.nbMedias > 1 ? "s" : ""} · décalage : {formaterDecalage(a.decalageSecondes)}
                  </p>
                </div>
                {modifiable ? (
                  <FormulaireAction
                    action={actionRecalerAppareil.bind(null, slug, a.id)}
                    bouton="Recaler"
                    className="flex flex-wrap items-end gap-3"
                    reinitialiser={false}
                  >
                    <label className="block space-y-1.5">
                      <span className="etiquette">Décalage à ajouter</span>
                      <input
                        name="decalage"
                        className="champ w-40"
                        defaultValue={a.decalageSecondes ? formaterDecalage(a.decalageSecondes).replace("−", "-") : ""}
                        placeholder="+1 h 12"
                        aria-label={`Décalage de ${a.libelle}`}
                      />
                    </label>
                  </FormulaireAction>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

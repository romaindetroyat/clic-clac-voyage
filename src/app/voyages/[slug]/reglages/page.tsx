import { FormulaireAction } from "@/components/formulaires";
import { accesVoyage } from "@/server/acces";
import { appUrl } from "@/server/env";
import { actionModifierVoyage } from "../../actions";

export const metadata = { title: "Réglages" };

export default async function Reglages({ params }: PageProps<"/voyages/[slug]/reglages">) {
  const { slug } = await params;
  const { voyage, estAdmin } = await accesVoyage(slug);
  if (!estAdmin) return <p className="text-encre-douce">Les réglages sont gérés par les administrateurs du voyage.</p>;

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
    </div>
  );
}

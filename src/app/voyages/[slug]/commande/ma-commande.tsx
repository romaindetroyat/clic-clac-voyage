"use client";

import { useState } from "react";
import { FormulaireAction } from "@/components/formulaires";
import type { EtatAction } from "../../actions";

/** Mes exemplaires et leur livraison (avec l'envoi groupé ou chez moi). */
export function MaCommande({
  action,
  initial,
  verrouillee,
}: {
  action: (e: EtatAction, f: FormData) => Promise<EtatAction>;
  initial: { exemplaires: number; livraison: "groupee" | "domicile"; adresse: string | null };
  verrouillee: boolean;
}) {
  const [livraison, setLivraison] = useState(initial.livraison);
  return (
    <FormulaireAction action={action} bouton="Enregistrer ma commande" reinitialiser={false}>
      <fieldset disabled={verrouillee} className="space-y-4">
        <label className="block max-w-xs space-y-1.5">
          <span className="etiquette">Nombre d’exemplaires</span>
          <input name="exemplaires" type="number" min={0} max={20} defaultValue={initial.exemplaires} className="champ" required />
        </label>
        <div role="radiogroup" aria-label="Livraison" className="space-y-1">
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="livraison" value="groupee" checked={livraison === "groupee"} onChange={() => setLivraison("groupee")} />
            Avec l’envoi groupé (récupérés auprès de l’organisateur, port partagé)
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="livraison" value="domicile" checked={livraison === "domicile"} onChange={() => setLivraison("domicile")} />
            Livrés chez moi (je paie mon envoi)
          </label>
        </div>
        {livraison === "domicile" ? (
          <label className="block space-y-1.5">
            <span className="etiquette">Adresse de livraison</span>
            <textarea name="adresse" rows={3} maxLength={500} defaultValue={initial.adresse ?? ""} className="champ" placeholder={"Nom\nRue\nCode postal et ville"} />
            <span className="block text-sm text-encre-douce">Visible seulement par vous et les organisateurs.</span>
          </label>
        ) : null}
      </fieldset>
    </FormulaireAction>
  );
}

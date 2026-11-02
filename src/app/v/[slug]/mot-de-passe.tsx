"use client";

import { useActionState } from "react";

export function FormulaireMotDePasse({ action }: { action: (e: string | undefined, f: FormData) => Promise<string | undefined> }) {
  const [erreur, envoyer, enCours] = useActionState(action, undefined);
  return (
    <form action={envoyer} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="etiquette">Mot de passe</span>
        <input name="motDePasse" type="password" className="champ" required autoFocus />
      </label>
      {erreur ? (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      ) : null}
      <button className="bouton" disabled={enCours}>
        Entrer
      </button>
    </form>
  );
}

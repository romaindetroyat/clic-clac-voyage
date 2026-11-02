"use client";

import { useActionState, useState, useTransition } from "react";
import type { EtatAction } from "@/app/voyages/actions";

export function Retour({ etat }: { etat: EtatAction }) {
  if (!etat) return null;
  if (etat.erreur)
    return (
      <p role="alert" className="text-sm text-danger">
        {etat.erreur}
      </p>
    );
  return (
    <p role="status" className="text-sm text-succes">
      {etat.message}
    </p>
  );
}

/** Formulaire branché sur une action serveur, avec message de retour. */
export function FormulaireAction({
  action,
  children,
  bouton,
  className = "space-y-4",
  reinitialiser = true,
}: {
  action: (etat: EtatAction, form: FormData) => Promise<EtatAction>;
  children: React.ReactNode;
  bouton: string;
  className?: string;
  reinitialiser?: boolean;
}) {
  const [etat, envoyer, enCours] = useActionState(action, undefined);
  return (
    <form action={envoyer} className={className} key={reinitialiser && etat?.message ? etat.message : undefined}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button className="bouton" disabled={enCours}>
          {enCours ? "Un instant…" : bouton}
        </button>
        <Retour etat={etat} />
      </div>
      {etat?.lien ? <LienACopier lien={etat.lien} /> : null}
    </form>
  );
}

export function LienACopier({ lien }: { lien: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-filet bg-papier-2 p-3 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 break-all text-sm" data-testid="lien-secret">
        {lien}
      </code>
      <button
        type="button"
        className="bouton-discret shrink-0"
        onClick={async () => {
          await navigator.clipboard.writeText(lien);
          setCopie(true);
        }}
      >
        {copie ? "Copié" : "Copier"}
      </button>
    </div>
  );
}

/** Bouton qui déclenche une action serveur simple, avec confirmation facultative. */
export function BoutonAction({
  action,
  libelle,
  confirmation,
  variante = "discret",
}: {
  action: () => Promise<EtatAction>;
  libelle: string;
  confirmation?: string;
  variante?: "discret" | "danger";
}) {
  const [enCours, lancer] = useTransition();
  const [etat, setEtat] = useState<EtatAction>();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={enCours}
        className={
          variante === "danger"
            ? "min-h-11 rounded-md px-3 text-sm text-danger hover:bg-papier-2 disabled:opacity-50"
            : "min-h-11 rounded-md px-3 text-sm text-encre-douce hover:bg-papier-2 hover:text-encre disabled:opacity-50"
        }
        onClick={() => {
          if (confirmation && !window.confirm(confirmation)) return;
          lancer(async () => setEtat(await action()));
        }}
      >
        {libelle}
      </button>
      {etat?.erreur ? <Retour etat={etat} /> : null}
    </span>
  );
}

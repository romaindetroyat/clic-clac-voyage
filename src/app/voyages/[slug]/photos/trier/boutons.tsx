"use client";

import { decisionDe, type Decision } from "@/lib/tri/moments";
import type { MediaTri } from "@/server/domaine/tri";

/** Où va la photo, d'après son état (rien tant qu'elle n'est pas triée). */
function destinations(m: MediaTri) {
  return m.trie ? { site: m.dansSite, livre: m.dansLivre } : { site: false, livre: false };
}

/** La décision qui correspond à des destinations. */
function versDecision(site: boolean, livre: boolean): Decision {
  if (site && livre) return "garder";
  if (site) return "site";
  if (livre) return "livre";
  return "ecarter";
}

/** Libellé et couleur de l'état d'une photo (pastille sur la vignette). */
export function etat(m: MediaTri): { libelle: string; ton: string } {
  const d = decisionDe(m);
  if (d === null) return { libelle: "À trier", ton: "bg-white/90 text-black" };
  if (d === "ecarter") return { libelle: "✕ Pas gardée", ton: "bg-red-600 text-white" };
  const { site, livre } = destinations(m);
  return { libelle: [m.vedette ? "♥" : null, site ? "✓ Site" : null, livre ? "✓ Livre" : null].filter(Boolean).join("  "), ton: "bg-emerald-600 text-white" };
}

function Case({ coche, libelle, aria, onClick, grand }: { coche: boolean; libelle: string; aria: string; onClick: () => void; grand: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={coche}
      aria-label={aria}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-md border-2 font-medium transition-colors ${grand ? "min-h-12 text-base" : "min-h-9 text-sm"} ${
        coche
          ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : grand
            ? "border-white/30 text-white/80 hover:bg-white/10"
            : "border-filet text-encre-douce hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      <span
        aria-hidden
        className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 text-sm leading-none ${coche ? "border-emerald-600 bg-emerald-600 text-white" : grand ? "border-white/50" : "border-encre-douce/60"}`}
      >
        {coche ? "✓" : ""}
      </span>
      {libelle}
    </button>
  );
}

/**
 * Les choix sous une photo : ✓ Garder (site et livre) ou ✕ Non, puis deux cases « Site » et « Livre »
 * qui portent une coche verte quand la photo y figure. `grand` : photo agrandie, sur fond sombre.
 * `decider(d, avancer)` : `avancer` vaut faux pour une case (on peut cocher l'autre ensuite).
 */
export function Boutons({ m, decider, grand = false }: { m: MediaTri; decider: (d: Decision, avancer: boolean) => void; grand?: boolean }) {
  const actuel = decisionDe(m);
  const { site, livre } = destinations(m);
  const base = `rounded-md border-2 font-medium transition-colors ${grand ? "min-h-12 text-base" : "min-h-9 text-sm"}`;
  return (
    <div className="grid grid-cols-2 gap-1" role="group" aria-label={`Choix pour ${m.nomFichier}`}>
      <button
        type="button"
        aria-label="Garder"
        aria-pressed={actuel === "garder"}
        onClick={() => decider("garder", true)}
        className={`${base} ${actuel === "garder" ? "border-emerald-600 bg-emerald-600 text-white" : grand ? "border-emerald-500 text-emerald-300 hover:bg-white/10" : "border-emerald-600 text-emerald-700 hover:bg-black/5 dark:text-emerald-400"}`}
      >
        ✓ Garder
      </button>
      <button
        type="button"
        aria-label="Ne pas garder"
        aria-pressed={actuel === "ecarter"}
        onClick={() => decider("ecarter", true)}
        className={`${base} ${actuel === "ecarter" ? "border-red-600 bg-red-600 text-white" : grand ? "border-red-500 text-red-300 hover:bg-white/10" : "border-red-600 text-red-700 hover:bg-black/5 dark:text-red-400"}`}
      >
        ✕ Non
      </button>
      <Case coche={site} libelle="Site" aria="Sur le site" grand={grand} onClick={() => decider(versDecision(!site, livre), false)} />
      <Case coche={livre} libelle="Livre" aria="Dans le livre" grand={grand} onClick={() => decider(versDecision(site, !livre), false)} />
    </div>
  );
}

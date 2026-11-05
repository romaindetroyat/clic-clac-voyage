"use client";

import { decisionDe, type Decision } from "@/lib/tri/moments";
import type { MediaTri } from "@/server/domaine/tri";

/** Les quatre choix, toujours dans le même ordre et les mêmes couleurs. */
export const CHOIX = [
  { d: "garder", libelle: "✓ Garder", aria: "Garder", plein: "bg-emerald-600 text-white border-emerald-600", vide: "border-emerald-600 text-emerald-700 dark:text-emerald-400", sombre: "border-emerald-500 text-emerald-300" },
  { d: "ecarter", libelle: "✕ Non", aria: "Ne pas garder", plein: "bg-red-600 text-white border-red-600", vide: "border-red-600 text-red-700 dark:text-red-400", sombre: "border-red-500 text-red-300" },
  { d: "site", libelle: "Site", aria: "Site seulement", plein: "bg-sky-600 text-white border-sky-600", vide: "border-sky-600 text-sky-700 dark:text-sky-400", sombre: "border-sky-500 text-sky-300" },
  { d: "livre", libelle: "Livre", aria: "Livre seulement", plein: "bg-violet-600 text-white border-violet-600", vide: "border-violet-600 text-violet-700 dark:text-violet-400", sombre: "border-violet-500 text-violet-300" },
] as const satisfies readonly { d: Decision; libelle: string; aria: string; plein: string; vide: string; sombre: string }[];

/** Libellé et couleur de l'état d'une photo. */
export function etat(m: MediaTri): { libelle: string; ton: string } {
  const d = decisionDe(m);
  if (d === null) return { libelle: "À trier", ton: "bg-white/90 text-black" };
  if (d === "garder") return { libelle: m.vedette ? "♥ Gardée" : "✓ Gardée", ton: "bg-emerald-600 text-white" };
  if (d === "ecarter") return { libelle: "✕ Pas gardée", ton: "bg-red-600 text-white" };
  if (d === "site") return { libelle: "Site seulement", ton: "bg-sky-600 text-white" };
  return { libelle: "Livre seulement", ton: "bg-violet-600 text-white" };
}

/** `grand` : version de la photo agrandie, sur fond sombre. */
export function Boutons({ m, decider, grand = false }: { m: MediaTri; decider: (d: Decision) => void; grand?: boolean }) {
  const actuel = decisionDe(m);
  return (
    <div className={`grid gap-1 ${grand ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`} role="group" aria-label={`Choix pour ${m.nomFichier}`}>
      {CHOIX.map((c) => (
        <button
          key={c.d}
          type="button"
          aria-label={c.aria}
          aria-pressed={actuel === c.d}
          onClick={() => decider(c.d)}
          className={`rounded-md border-2 font-medium transition-colors ${grand ? "min-h-12 text-base" : "min-h-9 text-sm"} ${actuel === c.d ? c.plein : grand ? `${c.sombre} bg-transparent hover:bg-white/10` : `${c.vide} bg-transparent hover:bg-black/5 dark:hover:bg-white/10`}`}
        >
          {c.libelle}
        </button>
      ))}
    </div>
  );
}

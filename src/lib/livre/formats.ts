/**
 * Formats de livre génériques, en attendant les fiches des imprimeurs (phase 6) qui
 * apporteront leurs propres contraintes. Toutes les mesures sont en millimètres, format fini (rogné).
 */
export type Papier = { nom: string; grammage: number; main: number };

export type Format = {
  id: string;
  nom: string;
  largeur: number;
  hauteur: number;
  fondPerdu: number;
  /** Distance minimale entre un texte et le bord rogné. */
  securite: number;
  /** Marge supplémentaire côté reliure (pli). */
  pli: number;
  pagesMin: number;
  pagesMax: number;
  /** Le nombre de pages doit être un multiple de… */
  multiple: number;
  couverture: "rigide" | "souple";
  papier: Papier;
  /** Dos imposé par l'imprimeur : nombre de pages maximal → épaisseur (mm). Prioritaire sur la formule. */
  tableDos?: [number, number][];
  /** Titre sur le dos à partir de cette épaisseur. */
  dosTitreMin: number;
};

const satine: Papier = { nom: "Couché satiné 170 g", grammage: 170, main: 0.9 };

const commun = { fondPerdu: 3, securite: 6, pli: 6, pagesMin: 24, pagesMax: 200, multiple: 2, couverture: "rigide", papier: satine, dosTitreMin: 6 } as const;

export const FORMATS: Format[] = [
  { id: "portrait-21x28", nom: "Portrait 21 × 28 cm", largeur: 210, hauteur: 280, ...commun },
  { id: "paysage-28x21", nom: "Paysage 28 × 21 cm", largeur: 280, hauteur: 210, ...commun },
  { id: "carre-30", nom: "Carré 30 × 30 cm", largeur: 300, hauteur: 300, ...commun },
  { id: "carre-20", nom: "Carré 20 × 20 cm", largeur: 200, hauteur: 200, ...commun },
  { id: "a4-paysage", nom: "A4 paysage 29,7 × 21 cm", largeur: 297, hauteur: 210, ...commun },
];

export function formatParId(id: string): Format {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

/** Nombre de pages valide le plus proche pour un format (bornes et multiple). */
export function pagesValides(f: Format, n: number): number {
  const borne = Math.min(f.pagesMax, Math.max(f.pagesMin, Math.round(n)));
  const m = Math.ceil(borne / f.multiple) * f.multiple;
  return m > f.pagesMax ? m - f.multiple : m;
}

/**
 * Épaisseur du dos (mm). Tableau de l'imprimeur s'il existe, sinon formule générique :
 * grammage × main × feuilles / 1000 + 2 × épaisseur de la couverture.
 */
export function epaisseurDos(f: Format, pages: number): number {
  if (f.tableDos?.length) {
    const ligne = [...f.tableDos].sort((a, b) => a[0] - b[0]).find(([max]) => pages <= max);
    return ligne ? ligne[1] : f.tableDos[f.tableDos.length - 1][1];
  }
  const couverture = f.couverture === "rigide" ? 3 : 0.5;
  const interieur = (f.papier.grammage * f.papier.main * (pages / 2)) / 1000;
  return Math.round((interieur + 2 * couverture) * 10) / 10;
}

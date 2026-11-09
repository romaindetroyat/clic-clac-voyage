/**
 * Paramètres de retouche non destructive, enregistrés par photo (l'original n'est jamais modifié).
 * Tous les réglages vont de -1 à 1 (0 = neutre), sauf indication contraire.
 */
import { z } from "zod";

const curseur = z.number().min(-1).max(1).default(0);

export const schemaRetouche = z.object({
  v: z.literal(1).default(1),
  // Géométrie
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  redressement: z.number().min(-45).max(45).default(0), // degrés
  // Recadrage dans l'image tournée et redressée, en fractions (0 à 1).
  recadrage: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), l: z.number().min(0.05).max(1), h: z.number().min(0.05).max(1) })
    .default({ x: 0, y: 0, l: 1, h: 1 }),
  // Lumière
  lumiere: curseur,
  contraste: curseur,
  hautesLumieres: curseur,
  ombres: curseur,
  blancs: curseur,
  noirs: curseur,
  // Couleur
  temperature: curseur,
  teinte: curseur,
  saturation: curseur,
  // Présence et effets (à la Lightroom)
  vibrance: curseur,
  clarte: curseur,
  voile: curseur,
  nettete: z.number().min(0).max(1).default(0),
  vignettage: curseur,
  // Filtre sobre et son intensité (0 à 1)
  filtre: z.enum(["aucun", "noir-et-blanc", "argentique", "chaud", "froid"]).default("aucun"),
  intensite: z.number().min(0).max(1).default(1),
  // Réglages de l'outil de cadrage (proportions, zoom, position) : seulement pour l'éditeur.
  cadrageUi: z
    .object({ ratio: z.string().max(10), zoom: z.number().min(1).max(4), px: z.number().min(0).max(1), py: z.number().min(0).max(1) })
    .optional(),
});

export type Retouche = z.infer<typeof schemaRetouche>;

export const NEUTRE: Retouche = schemaRetouche.parse({});

export function estNeutre(r: Retouche): boolean {
  const rendu = { ...schemaRetouche.parse(r), cadrageUi: undefined };
  return JSON.stringify(rendu) === JSON.stringify(NEUTRE);
}

/** Proportions proposées pour le recadrage (largeur / hauteur), « original » = celles de la photo. */
export const RATIOS: Record<string, number | null> = { original: null, "1:1": 1, "4:3": 4 / 3, "3:2": 3 / 2, "16:9": 16 / 9, "4:5": 4 / 5, "2:3": 2 / 3 };

/** Rectangle de recadrage (fractions) d'après des proportions, un zoom et une position. */
export function rectangleCadrage(ratioCadre: number, ratio: number | null, zoom: number, px: number, py: number) {
  const cible = ratio ?? ratioCadre;
  let l = 1;
  let h = 1;
  if (cible > ratioCadre) h = ratioCadre / cible;
  else l = cible / ratioCadre;
  l /= zoom;
  h /= zoom;
  return { x: (1 - l) * px, y: (1 - h) * py, l, h };
}

/** Empreinte courte des paramètres : sert à nommer les versions « cuites » (pas de problème de cache). */
export function empreinteRetouche(r: Retouche): string {
  const s = JSON.stringify(schemaRetouche.parse(r));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

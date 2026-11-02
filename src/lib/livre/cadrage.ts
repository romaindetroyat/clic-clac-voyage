/**
 * Recadrage d'une photo dans un cadre : la même fonction sert à l'écran (éditeur, aperçu)
 * et, plus tard, à la préparation des images du PDF. Une seule vérité géométrique.
 */
import type { Cellule } from "./modele";

export type RectSource = { x: number; y: number; l: number; h: number };

/**
 * Partie de la photo (en pixels de la photo) visible dans un cadre de proportions `ratioCadre`.
 * La photo couvre toujours tout le cadre ; le zoom resserre, (cx, cy) choisit le centre,
 * borné pour ne jamais laisser de vide.
 */
export function rectSource(largeur: number, hauteur: number, ratioCadre: number, c: Pick<Cellule, "zoom" | "cx" | "cy">): RectSource {
  const ratioPhoto = largeur / hauteur;
  let l: number, h: number;
  if (ratioPhoto > ratioCadre) {
    h = hauteur;
    l = hauteur * ratioCadre;
  } else {
    l = largeur;
    h = largeur / ratioCadre;
  }
  l /= c.zoom;
  h /= c.zoom;
  const x = Math.min(largeur - l, Math.max(0, c.cx * largeur - l / 2));
  const y = Math.min(hauteur - h, Math.max(0, c.cy * hauteur - h / 2));
  return { x, y, l, h };
}

/** Résolution effective (points par pouce) d'une photo dans un cadre de `largeurMm` de large. */
export function dpiEffectif(largeur: number, hauteur: number, cadreL: number, cadreH: number, c: Pick<Cellule, "zoom" | "cx" | "cy">): number {
  const src = rectSource(largeur, hauteur, cadreL / cadreH, c);
  return Math.round(src.l / (cadreL / 25.4));
}

/** Coût de recadrage : 0 si les proportions coïncident, croît avec l'écart (échelle logarithmique). */
export function coutRecadrage(ratioPhoto: number, ratioCadre: number): number {
  return Math.abs(Math.log(ratioPhoto / ratioCadre));
}

/** Style CSS d'une image dans son cadre (pourcentages du cadre), d'après rectSource. */
export function styleImage(largeur: number, hauteur: number, ratioCadre: number, c: Pick<Cellule, "zoom" | "cx" | "cy">) {
  const s = rectSource(largeur, hauteur, ratioCadre, c);
  return {
    width: `${(largeur / s.l) * 100}%`,
    height: `${(hauteur / s.h) * 100}%`,
    left: `${(-s.x / s.l) * 100}%`,
    top: `${(-s.y / s.h) * 100}%`,
  };
}

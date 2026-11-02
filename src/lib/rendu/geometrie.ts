/**
 * Géométrie de la retouche : rotation par quarts de tour, redressement (avec zoom pour ne jamais
 * montrer de coins vides), puis recadrage. Partagée par le rendu CPU et le shader WebGL.
 */
import type { Retouche } from "./parametres";

export type Geometrie = {
  /** Dimensions du cadre après rotation par quarts de tour (avant recadrage). */
  cadreL: number;
  cadreH: number;
  /** Rotation totale (radians, sens horaire) et zoom de redressement. */
  angle: number;
  zoom: number;
  recadrage: { x: number; y: number; l: number; h: number };
  /** Proportions du résultat (largeur / hauteur). */
  ratio: number;
};

export function geometrie(r: Retouche, largeur: number, hauteur: number): Geometrie {
  const quart = r.rotation === 90 || r.rotation === 270;
  const cadreL = quart ? hauteur : largeur;
  const cadreH = quart ? largeur : hauteur;
  const t = (Math.abs(r.redressement) * Math.PI) / 180;
  const ar = cadreL / cadreH;
  const zoom = Math.cos(t) + Math.sin(t) * Math.max(ar, 1 / ar);
  const c = r.recadrage;
  return {
    cadreL,
    cadreH,
    angle: ((r.rotation + r.redressement) * Math.PI) / 180,
    zoom,
    recadrage: c,
    ratio: (cadreL * c.l) / (cadreH * c.h),
  };
}

/** Coordonnées (0 à 1) dans l'image source du point (u, v) du résultat (0 à 1). */
export function versSource(g: Geometrie, largeur: number, hauteur: number, u: number, v: number): [number, number] {
  const fx = g.recadrage.x + u * g.recadrage.l;
  const fy = g.recadrage.y + v * g.recadrage.h;
  const px = (fx - 0.5) * g.cadreL;
  const py = (fy - 0.5) * g.cadreH;
  const c = Math.cos(-g.angle);
  const s = Math.sin(-g.angle);
  const qx = (px * c - py * s) / g.zoom;
  const qy = (px * s + py * c) / g.zoom;
  return [qx / largeur + 0.5, qy / hauteur + 0.5];
}

/** Taille de sortie pour un plus grand côté donné, sans agrandir au-delà de la source. */
export function tailleSortie(g: Geometrie, coteMax: number): [number, number] {
  const natL = g.cadreL * g.recadrage.l;
  const natH = g.cadreH * g.recadrage.h;
  const e = Math.min(1, coteMax / Math.max(natL, natH));
  return [Math.max(1, Math.round(natL * e)), Math.max(1, Math.round(natH * e))];
}

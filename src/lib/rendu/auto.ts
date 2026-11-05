/**
 * Retouche automatique : propose des réglages d'après les statistiques d'une petite version de la photo.
 * Prudente par principe : corrige une dominante, une photo trop sombre ou trop claire, un manque de
 * contraste, sans effacer l'ambiance (un coucher de soleil reste chaud). Fonction pure, testable hors navigateur.
 */
import { pixel, versLineaire } from "./couleur";
import { NEUTRE, type Retouche } from "./parametres";

type Image = { donnees: Uint8ClampedArray | Uint8Array; largeur: number; hauteur: number };

const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const arrondi = (x: number) => Math.round(x * 100) / 100;
/** Pas plus de ~4 000 pixels analysés : rapide, et suffisant pour des statistiques. */
function echantillon(img: Image): [number, number, number][] {
  const n = img.largeur * img.hauteur;
  const pas = Math.max(1, Math.floor(Math.sqrt(n / 4000)));
  const px: [number, number, number][] = [];
  for (let y = 0; y < img.hauteur; y += pas) {
    for (let x = 0; x < img.largeur; x += pas) {
      const i = (y * img.largeur + x) * 4;
      px.push([img.donnees[i] / 255, img.donnees[i + 1] / 255, img.donnees[i + 2] / 255]);
    }
  }
  return px;
}

const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function centiles(valeurs: number[], ...ps: number[]) {
  const t = [...valeurs].sort((a, b) => a - b);
  return ps.map((p) => t[Math.min(t.length - 1, Math.floor(p * t.length))]);
}
const apres = (px: [number, number, number][], r: Retouche) => px.map((p) => luminance(pixel(p, r)));

export function retoucheAuto(img: Image): Retouche {
  const px = echantillon(img);
  if (!px.length) return NEUTRE;
  const r: Retouche = { ...NEUTRE };

  // 1. Dominante (« monde gris ») sur les tons moyens, à moitié seulement pour garder l'ambiance.
  let R = 0;
  let G = 0;
  let B = 0;
  let n = 0;
  for (const p of px) {
    const l = luminance(p);
    if (l < 0.08 || l > 0.95) continue;
    R += versLineaire(p[0]);
    G += versLineaire(p[1]);
    B += versLineaire(p[2]);
    n++;
  }
  if (n > px.length * 0.2 && R > 0 && B > 0 && G > 0) {
    // R(1 + 0,3 t) = B(1 − 0,3 t)  →  t = (B − R) / (0,3 (R + B))
    r.temperature = arrondi(borne(((B - R) / (0.3 * (R + B))) * 0.5, -0.5, 0.5));
    const R2 = R * (1 + 0.3 * r.temperature);
    const B2 = B * (1 - 0.3 * r.temperature);
    // G(1 − 0,25 k) = (R + B) / 2  →  k = (1 − (R + B) / 2G) / 0,25
    r.teinte = arrondi(borne(((1 - (R2 + B2) / 2 / G) / 0.25) * 0.5, -0.4, 0.4));
  }

  // 2. Exposition : luminance médiane vers 0,46 (en sRGB).
  const [mediane] = centiles(apres(px, r), 0.5);
  if (mediane > 0.01) {
    const gainLineaire = versLineaire(0.46) / versLineaire(mediane);
    // Le gain vaut 2^(2 × lumière) ; on n'applique que 70 % de la correction.
    r.lumiere = arrondi(borne((Math.log2(gainLineaire) / 2) * 0.7, -0.5, 0.7));
  }

  // 3. Ombres bouchées, hautes lumières brûlées.
  const [p25, p75] = centiles(apres(px, r), 0.25, 0.75);
  if (p25 < 0.18) r.ombres = arrondi(borne((0.18 - p25) * 3, 0, 0.5));
  if (p75 > 0.85) r.hautesLumieres = arrondi(-borne((p75 - 0.85) * 4, 0, 0.5));
  const [p02, p98] = centiles(apres(px, r), 0.02, 0.98);

  // 4. Points noir et blanc, puis contraste si l'image reste plate.
  if (p02 > 0.06) r.noirs = arrondi(-borne((p02 - 0.06) * 4, 0, 0.6));
  if (p98 < 0.9) r.blancs = arrondi(borne((0.9 - p98) * 4, 0, 0.6));
  const [b05, b95] = centiles(apres(px, r), 0.05, 0.95);
  if (b95 - b05 < 0.65) r.contraste = arrondi(borne((0.65 - (b95 - b05)) * 0.8, 0, 0.25));

  // 5. Couleurs ternes : un peu de saturation.
  let sat = 0;
  for (const p of px) sat += Math.max(...p) - Math.min(...p);
  if (sat / px.length < 0.12) r.saturation = 0.12;
  return r;
}

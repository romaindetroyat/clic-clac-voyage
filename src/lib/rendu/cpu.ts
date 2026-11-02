/**
 * Rendu de référence sur CPU (Node ou navigateur) : sert aux tests d'équivalence avec le GPU
 * et de secours si WebGL2 n'est pas disponible.
 */
import { pixel } from "./couleur";
import { geometrie, tailleSortie, versSource } from "./geometrie";
import type { Retouche } from "./parametres";

export type ImageRgba = { donnees: Uint8ClampedArray; largeur: number; hauteur: number };

function echantillon(img: ImageRgba, u: number, v: number): [number, number, number] {
  // Bilinéaire, bords répétés (comme CLAMP_TO_EDGE + LINEAR en WebGL).
  const x = Math.min(Math.max(u * img.largeur - 0.5, 0), img.largeur - 1);
  const y = Math.min(Math.max(v * img.hauteur - 0.5, 0), img.hauteur - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, img.largeur - 1);
  const y1 = Math.min(y0 + 1, img.hauteur - 1);
  const fx = x - x0;
  const fy = y - y0;
  const res: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const p = (xx: number, yy: number) => img.donnees[(yy * img.largeur + xx) * 4 + k] / 255;
    res[k] = (p(x0, y0) * (1 - fx) + p(x1, y0) * fx) * (1 - fy) + (p(x0, y1) * (1 - fx) + p(x1, y1) * fx) * fy;
  }
  return res;
}

export function rendreCpu(img: ImageRgba, r: Retouche, coteMax: number): ImageRgba {
  const g = geometrie(r, img.largeur, img.hauteur);
  const [l, h] = tailleSortie(g, coteMax);
  const out = new Uint8ClampedArray(l * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const [u, v] = versSource(g, img.largeur, img.hauteur, (x + 0.5) / l, (y + 0.5) / h);
      const c = pixel(echantillon(img, u, v), r);
      const i = (y * l + x) * 4;
      out[i] = Math.round(c[0] * 255);
      out[i + 1] = Math.round(c[1] * 255);
      out[i + 2] = Math.round(c[2] * 255);
      out[i + 3] = 255;
    }
  }
  return { donnees: out, largeur: l, hauteur: h };
}

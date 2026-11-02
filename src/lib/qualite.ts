/**
 * Mesures de qualité d'une photo, calculées localement (aucun envoi à un service d'IA) :
 * - netteté : variance du laplacien sur l'image en niveaux de gris (flou → faible variance) ;
 * - exposition : luminance moyenne proche du milieu, peu de pixels bouchés ou brûlés.
 * Les deux scores vont de 0 (mauvais) à 1 (bon). Fonctions pures, testables hors navigateur.
 */

/** Niveaux de gris (0 à 1) d'une image RGBA. */
export function gris(rgba: Uint8ClampedArray | Uint8Array, n = rgba.length / 4): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
  return g;
}

export function nettete(g: Float32Array, largeur: number, hauteur: number): number {
  let somme = 0;
  let somme2 = 0;
  let n = 0;
  for (let y = 1; y < hauteur - 1; y++) {
    for (let x = 1; x < largeur - 1; x++) {
      const i = y * largeur + x;
      const l = g[i - largeur] + g[i + largeur] + g[i - 1] + g[i + 1] - 4 * g[i];
      somme += l;
      somme2 += l * l;
      n++;
    }
  }
  if (!n) return 0;
  const variance = somme2 / n - (somme / n) ** 2;
  // Échelle empirique : une photo nette à ~512 px donne une variance de l'ordre de 0,002 à 0,02.
  return 1 - Math.exp(-variance / 0.004);
}

export function exposition(g: Float32Array): number {
  if (!g.length) return 0;
  let somme = 0;
  let bouches = 0;
  let brules = 0;
  for (const v of g) {
    somme += v;
    if (v < 0.02) bouches++;
    else if (v > 0.98) brules++;
  }
  const moyenne = somme / g.length;
  const ecrete = (bouches + brules) / g.length;
  return Math.max(0, Math.min(1, 1 - Math.abs(moyenne - 0.47) * 1.6 - ecrete * 2.5));
}

/** Score global pour départager les photos d'une rafale. */
export function scoreQualite(m: { nettete: number | null; exposition: number | null }): number {
  return (m.nettete ?? 0.5) * 0.65 + (m.exposition ?? 0.5) * 0.35;
}

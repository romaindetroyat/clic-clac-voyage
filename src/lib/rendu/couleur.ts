/**
 * Chaîne de couleur de référence (CPU), pixel par pixel.
 * Le shader GLSL de `webgl.ts` applique exactement les mêmes formules, dans le même ordre ;
 * un test de bout en bout compare les deux rendus (ΔE). Toute modification se fait des deux côtés.
 *
 * Ordre : sRGB → linéaire → balance des blancs → exposition → retour en sRGB
 *         → noirs, ombres, hautes lumières, blancs → contraste → saturation → filtre.
 */
import type { Retouche } from "./parametres";

export const versLineaire = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const versSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055);
const borne = (x: number) => Math.min(1, Math.max(0, x));
const melange = (a: number, b: number, t: number) => a + (b - a) * t;

/** Courbe tonale sur une composante encodée (0 à 1). */
export function tonalite(x: number, r: Retouche): number {
  x += r.noirs * 0.15 * (1 - x) ** 4;
  x += r.ombres * 0.4 * 4 * x * (1 - x) ** 2;
  x += r.hautesLumieres * 0.4 * 4 * x * x * (1 - x);
  x += r.blancs * 0.15 * x ** 4;
  x = 0.5 + (x - 0.5) * (1 + r.contraste * 0.8);
  return borne(x);
}

export function pixel(rgb: [number, number, number], r: Retouche): [number, number, number] {
  // 1. Linéaire, balance des blancs, exposition (±2 IL).
  let [R, G, B] = rgb.map(versLineaire);
  R *= 1 + 0.3 * r.temperature;
  B *= 1 - 0.3 * r.temperature;
  G *= 1 - 0.25 * r.teinte;
  const gain = 2 ** (r.lumiere * 2);
  R *= gain;
  G *= gain;
  B *= gain;
  // 2. Retour en sRGB et courbe tonale.
  R = tonalite(borne(versSrgb(R)), r);
  G = tonalite(borne(versSrgb(G)), r);
  B = tonalite(borne(versSrgb(B)), r);
  // 3. Saturation autour de la luminance.
  let L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const s = 1 + r.saturation;
  R = borne(L + (R - L) * s);
  G = borne(L + (G - L) * s);
  B = borne(L + (B - L) * s);
  // 4. Filtre sobre.
  if (r.filtre !== "aucun" && r.intensite > 0) {
    L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    let f: [number, number, number];
    if (r.filtre === "noir-et-blanc") f = [L, L, L];
    else if (r.filtre === "argentique") {
      // Noirs relevés, contraste adouci, légère chaleur, couleurs un peu éteintes.
      const d = (c: number) => 0.06 + 0.88 * (0.5 + (c - 0.5) * 0.9);
      f = [d(melange(L, R, 0.85)) * 1.03, d(melange(L, G, 0.85)), d(melange(L, B, 0.85)) * 0.95];
    } else if (r.filtre === "chaud") f = [R * 1.06, G * 1.01, B * 0.92];
    else f = [R * 0.93, G * 1.0, B * 1.07];
    R = borne(melange(R, f[0], r.intensite));
    G = borne(melange(G, f[1], r.intensite));
    B = borne(melange(B, f[2], r.intensite));
  }
  return [R, G, B];
}

/* ------------------------------- ΔE ------------------------------- */

function versLab([r, g, b]: [number, number, number]): [number, number, number] {
  const [R, G, B] = [r, g, b].map(versLineaire);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** Écart de couleur perceptuel (ΔE*76) entre deux couleurs sRGB (0 à 1). Sous 1 : invisible. */
export function deltaE(a: [number, number, number], b: [number, number, number]): number {
  const [l1, a1, b1] = versLab(a);
  const [l2, a2, b2] = versLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

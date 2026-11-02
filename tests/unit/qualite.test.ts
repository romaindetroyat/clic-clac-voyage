import { describe, expect, it } from "vitest";
import { exposition, gris, nettete, scoreQualite } from "@/lib/qualite";

const L = 64;
function image(f: (x: number, y: number) => number) {
  const g = new Float32Array(L * L);
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) g[y * L + x] = f(x, y);
  return g;
}
function flouter(g: Float32Array, passes = 4) {
  let a = g;
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(a.length);
    for (let y = 0; y < L; y++)
      for (let x = 0; x < L; x++) {
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < L && yy < L) {
              s += a[yy * L + xx];
              n++;
            }
          }
        b[y * L + x] = s / n;
      }
    a = b;
  }
  return a;
}

describe("qualité d'une photo", () => {
  const damier = image((x, y) => (((x >> 2) + (y >> 2)) % 2 ? 0.8 : 0.2));

  it("une image nette l'emporte sur sa version floue", () => {
    expect(nettete(damier, L, L)).toBeGreaterThan(0.9);
    expect(nettete(flouter(damier), L, L)).toBeLessThan(nettete(damier, L, L) * 0.6);
    expect(nettete(image(() => 0.5), L, L)).toBe(0);
  });

  it("préfère une exposition équilibrée à une photo brûlée ou bouchée", () => {
    const juste = exposition(damier);
    expect(juste).toBeGreaterThan(0.8);
    expect(exposition(image(() => 1))).toBe(0);
    expect(exposition(image(() => 0))).toBe(0);
    expect(exposition(image((x) => (x < 40 ? 0.99 : 0.6)))).toBeLessThan(juste);
  });

  it("convertit RGBA en niveaux de gris", () => {
    const g = gris(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]));
    expect(g[0]).toBeCloseTo(1);
    expect(g[1]).toBe(0);
  });

  it("combine les deux scores", () => {
    expect(scoreQualite({ nettete: 1, exposition: 1 })).toBeCloseTo(1);
    expect(scoreQualite({ nettete: null, exposition: null })).toBeCloseTo(0.5);
  });
});

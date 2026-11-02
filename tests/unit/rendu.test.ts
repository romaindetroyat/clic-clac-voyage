import { describe, expect, it } from "vitest";
import { deltaE, pixel, tonalite } from "@/lib/rendu/couleur";
import { rendreCpu } from "@/lib/rendu/cpu";
import { geometrie, tailleSortie, versSource } from "@/lib/rendu/geometrie";
import { empreinteRetouche, estNeutre, NEUTRE, schemaRetouche } from "@/lib/rendu/parametres";

const r = (o: object) => schemaRetouche.parse(o);

describe("chaîne de couleur", () => {
  it("les réglages neutres ne changent rien", () => {
    for (const c of [[0, 0, 0], [1, 1, 1], [0.2, 0.5, 0.8], [0.9, 0.1, 0.3]] as [number, number, number][]) {
      const out = pixel(c, NEUTRE);
      expect(deltaE(out, c)).toBeLessThan(0.01);
    }
    expect(estNeutre(NEUTRE)).toBe(true);
  });

  it("chaque réglage agit dans le bon sens", () => {
    const gris: [number, number, number] = [0.5, 0.5, 0.5];
    expect(pixel(gris, r({ lumiere: 0.5 }))[1]).toBeGreaterThan(0.5);
    expect(pixel(gris, r({ lumiere: -0.5 }))[1]).toBeLessThan(0.5);
    expect(pixel([0.2, 0.2, 0.2], r({ ombres: 1 }))[0]).toBeGreaterThan(0.2);
    expect(pixel([0.8, 0.8, 0.8], r({ hautesLumieres: -1 }))[0]).toBeLessThan(0.8);
    expect(pixel([0.05, 0.05, 0.05], r({ noirs: 1 }))[0]).toBeGreaterThan(0.05);
    const chaud = pixel(gris, r({ temperature: 1 }));
    expect(chaud[0]).toBeGreaterThan(chaud[2]);
    const vif = pixel([0.6, 0.4, 0.4], r({ saturation: 1 }));
    expect(vif[0] - vif[1]).toBeGreaterThan(0.2);
    const nb = pixel([0.9, 0.2, 0.1], r({ filtre: "noir-et-blanc" }));
    expect(nb[0]).toBeCloseTo(nb[1]);
    expect(nb[1]).toBeCloseTo(nb[2]);
  });

  it("le contraste écarte les tons du gris moyen", () => {
    expect(tonalite(0.7, r({ contraste: 1 }))).toBeGreaterThan(0.7);
    expect(tonalite(0.3, r({ contraste: 1 }))).toBeLessThan(0.3);
    expect(tonalite(0.5, r({ contraste: 1 }))).toBeCloseTo(0.5);
  });

  it("donne une empreinte stable des paramètres", () => {
    expect(empreinteRetouche(r({ lumiere: 0.2 }))).toBe(empreinteRetouche(r({ lumiere: 0.2 })));
    expect(empreinteRetouche(r({ lumiere: 0.2 }))).not.toBe(empreinteRetouche(r({ lumiere: 0.3 })));
  });
});

describe("géométrie", () => {
  it("un quart de tour échange largeur et hauteur et tourne dans le sens horaire", () => {
    const g = geometrie(r({ rotation: 90 }), 400, 300);
    expect([g.cadreL, g.cadreH]).toEqual([300, 400]);
    // Le haut-gauche du résultat vient du bas-gauche de la source.
    const [u, v] = versSource(g, 400, 300, 0, 0);
    expect(u).toBeCloseTo(0);
    expect(v).toBeCloseTo(1);
  });

  it("le redressement zoome assez pour ne jamais montrer de coins vides", () => {
    const g = geometrie(r({ redressement: 10 }), 400, 300);
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const [su, sv] = versSource(g, 400, 300, u, v);
      expect(su).toBeGreaterThanOrEqual(-1e-9);
      expect(su).toBeLessThanOrEqual(1 + 1e-9);
      expect(sv).toBeGreaterThanOrEqual(-1e-9);
      expect(sv).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("le recadrage donne la bonne taille de sortie", () => {
    const g = geometrie(r({ recadrage: { x: 0.25, y: 0, l: 0.5, h: 1 } }), 4000, 3000);
    expect(tailleSortie(g, 1200)).toEqual([800, 1200]);
    expect(tailleSortie(geometrie(NEUTRE, 300, 200), 1200)).toEqual([300, 200]); // jamais d'agrandissement
  });

  it("rend une petite image sur CPU", () => {
    const donnees = new Uint8ClampedArray(2 * 1 * 4);
    donnees.set([255, 0, 0, 255, 0, 0, 255, 255]);
    const out = rendreCpu({ donnees, largeur: 2, hauteur: 1 }, r({ rotation: 180 }), 10);
    expect([out.largeur, out.hauteur]).toEqual([2, 1]);
    expect(out.donnees[0]).toBe(0); // le bleu est passé à gauche
    expect(out.donnees[2]).toBe(255);
  });
});

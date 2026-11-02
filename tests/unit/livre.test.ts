import { describe, expect, it } from "vitest";
import { dpiEffectif, rectSource } from "@/lib/livre/cadrage";
import { controler } from "@/lib/livre/controles";
import { epaisseurDos, formatParId, FORMATS, pagesValides } from "@/lib/livre/formats";
import { GABARITS, geometriePage, zoneUtile } from "@/lib/livre/gabarits";
import { mettreEnPage } from "@/lib/livre/mise-en-page";
import type { EpisodeLivre, MediaLivre } from "@/lib/livre/modele";

const portrait = formatParId("portrait-21x28");

function photos(n: number, episodeId: string, o: Partial<MediaLivre> = {}, depart = 0): MediaLivre[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${episodeId}-${depart + i}`,
    largeur: i % 3 === 2 ? 3000 : 4000,
    hauteur: i % 3 === 2 ? 4000 : 3000,
    episodeId,
    instant: new Date(Date.UTC(2026, 7, 3, 8, depart + i)).toISOString(),
    legende: i === 0 ? `Légende ${episodeId}` : null,
    auteur: "Romain",
    vedette: false,
    qualite: null,
    vignette: null,
    moyenne: null,
    commentaires: [],
    ...o,
  }));
}

const options = { ciblePages: 40, rythme: "equilibre" as const, fond: "blanc" as const, legendes: true, commentaires: false };
const ep = (id: string, titre: string): EpisodeLivre => ({ id, titre, lieu: null, recit: "Le ferry accoste.", debut: "2026-08-03T08:00:00Z", fin: "2026-08-03T18:00:00Z" });

describe("livre : formats et dos", () => {
  it("arrondit le nombre de pages aux contraintes du format", () => {
    expect(pagesValides(portrait, 10)).toBe(24);
    expect(pagesValides(portrait, 41)).toBe(42);
    expect(pagesValides(portrait, 500)).toBe(200);
  });

  it("calcule le dos : formule générique, ou tableau de l'imprimeur prioritaire", () => {
    // 200 pages, 170 g, main 0,9, couverture rigide : 15,3 + 6 = 21,3 mm
    expect(epaisseurDos(portrait, 200)).toBe(21.3);
    expect(epaisseurDos({ ...portrait, couverture: "souple" }, 24)).toBe(2.8);
    const table = { ...portrait, tableDos: [[40, 8], [100, 12], [200, 18]] as [number, number][] };
    expect(epaisseurDos(table, 26)).toBe(8);
    expect(epaisseurDos(table, 100)).toBe(12);
    expect(epaisseurDos(table, 300)).toBe(18);
  });
});

describe("livre : gabarits et cadrage", () => {
  it("chaque gabarit reste dans la zone utile, sur tous les formats, page paire ou impaire", () => {
    for (const f of FORMATS) {
      for (const numero of [1, 2]) {
        const z = zoneUtile(f, numero);
        for (const g of GABARITS) {
          const geo = geometriePage(f, g.id, numero);
          expect(geo.photos).toHaveLength(g.n);
          for (const c of geo.photos) {
            if (g.id === "pleine-page") {
              expect(c).toEqual({ x: -3, y: -3, l: f.largeur + 6, h: f.hauteur + 6 });
              continue;
            }
            expect(c.l).toBeGreaterThan(10);
            expect(c.h).toBeGreaterThan(10);
            expect(c.x).toBeGreaterThanOrEqual(z.x - 1e-9);
            expect(c.y).toBeGreaterThanOrEqual(z.y - 1e-9);
            expect(c.x + c.l).toBeLessThanOrEqual(z.x + z.l + 1e-9);
            expect(c.y + c.h).toBeLessThanOrEqual(z.y + z.h + 1e-9);
          }
        }
      }
      // La reliure est du côté intérieur : à gauche sur une page de droite.
      expect(zoneUtile(f, 1).x).toBeGreaterThan(zoneUtile(f, 2).x);
    }
  });

  it("recadre sans jamais laisser de vide", () => {
    expect(rectSource(4000, 3000, 1, { zoom: 1, cx: 0.5, cy: 0.5 })).toEqual({ x: 500, y: 0, l: 3000, h: 3000 });
    expect(rectSource(4000, 3000, 1, { zoom: 1, cx: 0, cy: 0.5 }).x).toBe(0);
    expect(rectSource(4000, 3000, 1, { zoom: 2, cx: 1, cy: 1 })).toEqual({ x: 2500, y: 1500, l: 1500, h: 1500 });
  });

  it("mesure la résolution effective", () => {
    // 4000 px sur 254 mm (10 pouces) = 400 dpi ; zoom 2 = 200 dpi
    expect(dpiEffectif(4000, 3000, 254, 190.5, { zoom: 1, cx: 0.5, cy: 0.5 })).toBe(400);
    expect(dpiEffectif(4000, 3000, 254, 190.5, { zoom: 2, cx: 0.5, cy: 0.5 })).toBe(200);
  });
});

describe("livre : mise en page automatique", () => {
  const episodes = [ep("a", "Arrivée à Naxos"), ep("b", "Paros"), ep("c", "Retour")];
  const medias = [...photos(30, "a"), ...photos(45, "b", {}, 100), ...photos(12, "c", {}, 200)];

  it("atteint exactement la cible, garde toutes les photos et l'ordre chronologique", () => {
    for (const cible of [30, 40, 60]) {
      const { livre, rapport } = mettreEnPage({ nom: "Cyclades", periode: "août 2026", fuseau: "Europe/Athens", format: portrait, options: { ...options, ciblePages: cible }, episodes, medias });
      expect(livre.pages).toHaveLength(cible);
      expect(rapport.message).toBeNull();
      const places = livre.pages.flatMap((p) => p.cellules.map((c) => c!.mediaId));
      expect(new Set(places).size).toBe(medias.length);
      expect(places).toHaveLength(medias.length);
      // Les épisodes se suivent dans l'ordre.
      const ordreEp = livre.pages.map((p) => p.episodeId).filter(Boolean);
      expect(ordreEp.indexOf("b")).toBeGreaterThan(ordreEp.lastIndexOf("a"));
      expect(ordreEp.indexOf("c")).toBeGreaterThan(ordreEp.lastIndexOf("b"));
      // Ouvertures d'épisode avec titre et récit, page de titre en tête.
      expect(livre.pages[0]).toMatchObject({ gabarit: "titre", titre: "Cyclades" });
      const ouvertures = livre.pages.filter((p) => p.gabarit.startsWith("ouverture"));
      expect(ouvertures.map((p) => p.titre)).toEqual(["Arrivée à Naxos", "Paros", "Retour"]);
      expect(ouvertures[0].surtitre).toBe("Épisode 1 · 3 août");
    }
  });

  it("plus dense quand la cible est basse, et le rythme change la densité", () => {
    const dense = mettreEnPage({ nom: "C", periode: null, fuseau: "UTC", format: portrait, options: { ...options, ciblePages: 24, rythme: "dense" }, episodes, medias }).livre;
    const aere = mettreEnPage({ nom: "C", periode: null, fuseau: "UTC", format: portrait, options: { ...options, ciblePages: 60, rythme: "aere" }, episodes, medias }).livre;
    const moy = (l: typeof dense) => {
      const p = l.pages.filter((x) => x.gabarit !== "titre" && !x.gabarit.startsWith("ouverture") && x.cellules.length);
      return p.reduce((s, x) => s + x.cellules.length, 0) / p.length;
    };
    expect(moy(dense)).toBeGreaterThan(moy(aere));
  });

  it("donne plus de place aux photos mises en avant", () => {
    const m = photos(20, "a").map((x, i) => (i === 7 ? { ...x, vedette: true } : x));
    const { livre } = mettreEnPage({ nom: "C", periode: null, fuseau: "UTC", format: portrait, options: { ...options, ciblePages: 24, rythme: "dense" }, episodes: [ep("a", "A")], medias: m });
    const page = livre.pages.find((p) => p.cellules.some((c) => c?.mediaId === "a-7"))!;
    // Mise en avant : c'est la photo d'ouverture de l'épisode.
    expect(page.gabarit).toBe("ouverture");
  });

  it("signale un manque ou un excès de photos et complète par des pages blanches", () => {
    const peu = mettreEnPage({ nom: "C", periode: null, fuseau: "UTC", format: portrait, options: { ...options, ciblePages: 40 }, episodes: [ep("a", "A")], medias: photos(5, "a") });
    expect(peu.livre.pages).toHaveLength(40);
    expect(peu.livre.pages.at(-1)!.gabarit).toBe("vierge");
    expect(peu.rapport.message).toMatch(/Pas assez de photos/);
    const trop = mettreEnPage({ nom: "C", periode: null, fuseau: "UTC", format: portrait, options: { ...options, ciblePages: 24 }, episodes: [ep("a", "A")], medias: photos(400, "a") });
    expect(trop.rapport.message).toMatch(/trop de photos/);
    expect(trop.livre.pages.length % portrait.multiple).toBe(0);
  });

  it("varie les gabarits : jamais deux pages identiques de suite quand une variante convient", () => {
    const { livre } = mettreEnPage({ nom: "C", periode: null, fuseau: "UTC", format: portrait, options: { ...options, ciblePages: 40 }, episodes, medias });
    let suites = 0;
    for (let i = 1; i < livre.pages.length; i++) if (livre.pages[i].gabarit === livre.pages[i - 1].gabarit && livre.pages[i].cellules.length > 1) suites++;
    expect(suites).toBeLessThanOrEqual(2);
  });

  it("met en page 1 000 photos en moins d'une seconde", () => {
    const eps = Array.from({ length: 12 }, (_, i) => ep(`e${i}`, `Épisode ${i}`));
    const beaucoup = eps.flatMap((e, i) => photos(84, e.id, {}, i * 100));
    const t = performance.now();
    const { livre } = mettreEnPage({ nom: "C", periode: null, fuseau: "UTC", format: portrait, options: { ...options, ciblePages: 160 }, episodes: eps, medias: beaucoup });
    expect(performance.now() - t).toBeLessThan(1000);
    expect(livre.pages).toHaveLength(160);
  });
});

describe("livre : contrôles", () => {
  const medias = photos(10, "a");
  const parId = new Map(medias.map((m) => [m.id, m]));
  const { livre } = mettreEnPage({ nom: "C", periode: null, fuseau: "UTC", format: portrait, options: { ...options, ciblePages: 24 }, episodes: [ep("a", "A")], medias });

  it("un livre généré ne bloque pas", () => {
    expect(controler(livre, portrait, parId).filter((p) => p.niveau === "bloquant")).toEqual([]);
  });

  it("alerte sous 250 dpi, bloque sous 150 dpi", () => {
    const petite = new Map(parId);
    for (const [k, m] of petite) petite.set(k, { ...m, largeur: 800, hauteur: 600 });
    const r = controler(livre, portrait, petite);
    expect(r.some((p) => p.niveau === "bloquant" && /trop petite/.test(p.message))).toBe(true);
    const moyenne = new Map(parId);
    for (const [k, m] of moyenne) moyenne.set(k, { ...m, largeur: 2200, hauteur: 1650 });
    expect(controler(livre, portrait, moyenne).some((p) => p.niveau === "alerte" && /limite/.test(p.message))).toBe(true);
  });

  it("nombre de pages, texte trop long, photo manquante", () => {
    const l = structuredClone(livre);
    l.pages.pop();
    l.pages[1].corps = "Très long récit. ".repeat(400);
    l.pages[2].cellules[0] = { mediaId: "inconnue", zoom: 1, cx: 0.5, cy: 0.5 };
    const r = controler(l, portrait, parId);
    expect(r.some((p) => /multiple de 2/.test(p.message))).toBe(true);
    expect(r.some((p) => p.page === 2 && /trop long/.test(p.message))).toBe(true);
    expect(r.some((p) => p.page === 3 && /introuvable/.test(p.message))).toBe(true);
  });

  it("un changement de format garde les pages et recalcule les cadres", () => {
    const carre = formatParId("carre-30");
    expect(controler({ ...livre, formatId: carre.id }, carre, parId).filter((p) => p.niveau === "bloquant")).toEqual([]);
  });
});

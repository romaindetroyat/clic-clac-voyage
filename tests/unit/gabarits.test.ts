import { describe, expect, it } from "vitest";
import { IMPRIMEURS } from "@/lib/imprimeurs/catalogue";
import { formatDepuisProduit } from "@/lib/imprimeurs/comparateur";
import { controler } from "@/lib/livre/controles";
import { FORMATS, formatParId, type Format } from "@/lib/livre/formats";
import { AMBIANCES, GABARITS, gabaritsAmbiance, geometriePage, IDS_AMBIANCES, legendesParPhoto, texteDuCadre, type Rect } from "@/lib/livre/gabarits";
import { mettreEnPage } from "@/lib/livre/mise-en-page";
import type { MediaLivre } from "@/lib/livre/modele";
import { FONDS, IDS_STYLES, POLICES, STYLES } from "@/lib/livre/styles";

/** Tous les formats possibles : génériques et chaque produit de chaque imprimeur. */
const tousLesFormats: Format[] = [...FORMATS, ...IMPRIMEURS.flatMap((i) => i.produits.map((p) => formatDepuisProduit(i, p)))];

/** Boîte englobante d'un rectangle tourné autour de son centre. */
function englobante(r: Rect, rotation = 0): Rect {
  const a = (Math.abs(rotation) * Math.PI) / 180;
  const l = r.l * Math.cos(a) + r.h * Math.sin(a);
  const h = r.l * Math.sin(a) + r.h * Math.cos(a);
  return { x: r.x + r.l / 2 - l / 2, y: r.y + r.h / 2 - h / 2, l, h };
}
const chevauche = (a: Rect, b: Rect, tol = 0.3) => a.x + tol < b.x + b.l && b.x + tol < a.x + a.l && a.y + tol < b.y + b.h && b.y + tol < a.y + a.h;

const RATIOS = [4 / 3, 3 / 4, 3 / 2, 1, 16 / 9, 9 / 16];

describe("gabarits : une quinzaine au moins par format, tous valides", () => {
  it("couvre les formats de tous les imprimeurs du catalogue", () => {
    expect(tousLesFormats.length).toBeGreaterThan(15);
  });

  it("au moins 15 gabarits de photos utilisables sur chaque format, page de gauche ou de droite", () => {
    for (const f of tousLesFormats) {
      for (const numero of [1, 2]) {
        let valides = 0;
        for (const g of GABARITS) {
          // Avec et sans proportions connues (cadres qui s'ajustent aux photos).
          for (const ratios of [undefined, Array.from({ length: g.n }, (_, i) => RATIOS[(i + numero) % RATIOS.length])]) {
            const geo = geometriePage(f, g.id, numero, ratios);
            const ou = `${f.id} p${numero} ${g.id}`;
            expect(geo.photos, ou).toHaveLength(g.n);
            const boites = geo.photos.map((p) => englobante(p, p.rotation));
            for (const [i, b] of boites.entries()) {
              expect(geo.photos[i].l, ou).toBeGreaterThan(10);
              expect(geo.photos[i].h, ou).toBeGreaterThan(10);
              // Dans la page, fonds perdus compris.
              expect(b.x, ou).toBeGreaterThanOrEqual(-f.fondPerdu - 1e-6);
              expect(b.y, ou).toBeGreaterThanOrEqual(-f.fondPerdu - 1e-6);
              expect(b.x + b.l, ou).toBeLessThanOrEqual(f.largeur + f.fondPerdu + 1e-6);
              expect(b.y + b.h, ou).toBeLessThanOrEqual(f.hauteur + f.fondPerdu + 1e-6);
              for (let j = 0; j < i; j++) expect(chevauche(b, boites[j]), `${ou} : photos ${j} et ${i} se chevauchent`).toBe(false);
            }
            // Les textes restent dans la zone de sécurité (sauf rotation de quelques degrés).
            for (const t of geo.textes) {
              const b = englobante(t.rect, t.rotation);
              const marge = f.securite - (t.rotation ? 3 : 0) - 1e-6;
              expect(t.rect.l, ou).toBeGreaterThan(5);
              expect(t.rect.h, ou).toBeGreaterThan(2);
              expect(b.x, `${ou} ${t.role}`).toBeGreaterThanOrEqual(marge);
              expect(b.y, `${ou} ${t.role}`).toBeGreaterThanOrEqual(marge);
              expect(b.x + b.l, `${ou} ${t.role}`).toBeLessThanOrEqual(f.largeur - marge);
              expect(b.y + b.h, `${ou} ${t.role}`).toBeLessThanOrEqual(f.hauteur - marge);
            }
          }
          if (g.famille === "photos") valides++;
        }
        expect(valides, f.id).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("un cadre ajusté garde les proportions de la photo, et sa légende le suit", () => {
    const f = formatParId("portrait-21x28");
    const sans = geometriePage(f, "une-galerie", 1);
    const avec = geometriePage(f, "une-galerie", 1, [16 / 9]);
    expect(avec.photos[0].l / avec.photos[0].h).toBeCloseTo(16 / 9, 5);
    expect(avec.photos[0].h).toBeLessThan(sans.photos[0].h);
    const leg = avec.textes.find((t) => t.role === "legende")!;
    expect(leg.rect.y).toBeCloseTo(avec.photos[0].y + avec.photos[0].h + 2, 5);
  });

  it("un polaroïd tourne avec son cadre blanc et sa légende", () => {
    const f = formatParId("carre-20");
    const geo = geometriePage(f, "une-polaroid", 1);
    expect(geo.photos[0].rotation).toBe(-2.5);
    const cadre = geo.formes.find((x) => x.teinte === "blanc")!;
    expect(cadre.rotation).toBe(-2.5);
    expect(geo.textes.find((t) => t.photo === 0)!.rotation).toBe(-2.5);
    // Le cadre entoure la photo (même centre à la rotation près).
    expect(cadre.rect.l).toBeGreaterThan(geo.photos[0].l);
    expect(cadre.rect.h).toBeGreaterThan(geo.photos[0].h);
  });

  it("chaque ambiance a de quoi faire de 1 à 4 photos par page", () => {
    for (const a of IDS_AMBIANCES) {
      const g = gabaritsAmbiance(a);
      expect(g.length, a).toBeGreaterThanOrEqual(6);
      for (const n of [1, 2, 3, 4]) expect(g.some((x) => x.n === n), `${a} ${n}`).toBe(true);
      for (const o of AMBIANCES[a].ouvertures) expect(GABARITS.some((x) => x.id === o)).toBe(true);
    }
  });

  it("styles et fonds : polices connues, au moins une douzaine de styles et de fonds", () => {
    expect(IDS_STYLES.length).toBeGreaterThanOrEqual(12);
    expect(Object.keys(FONDS).length).toBeGreaterThanOrEqual(10);
    for (const id of IDS_STYLES) for (const r of ["titre", "surtitre", "corps", "legende", "folio"] as const) {
      const t = STYLES[id][r];
      expect(POLICES[t.police], `${id} ${r}`).toBeDefined();
      if (t.italique) expect(POLICES[t.police].italique, `${id} ${r} italique`).toBe(true);
    }
  });
});

describe("gabarits : mise en page automatique par ambiance", () => {
  const medias: MediaLivre[] = Array.from({ length: 60 }, (_, i) => ({
    id: `m${i}`,
    largeur: i % 4 === 1 ? 3000 : i % 7 === 3 ? 6000 : 4000,
    hauteur: i % 4 === 1 ? 4000 : i % 7 === 3 ? 2000 : 3000,
    episodeId: i < 30 ? "a" : "b",
    instant: null,
    legende: `Photo ${i}`,
    auteur: null,
    vedette: i === 5,
    qualite: null,
    vignette: null,
    moyenne: null,
    commentaires: [],
  }));
  const parId = new Map(medias.map((m) => [m.id, m]));
  const episodes = [
    { id: "a", titre: "Naxos", lieu: null, recit: "Le ferry accoste.", debut: null, fin: null },
    { id: "b", titre: "Paros", lieu: null, recit: "", debut: null, fin: null },
  ];

  it.each(IDS_AMBIANCES)("%s : bonne cible, toutes les photos, légendes posées, rien de bloquant", (ambiance) => {
    for (const formatId of ["portrait-21x28", "paysage-28x21", "carre-30"]) {
      const f = formatParId(formatId);
      const { livre } = mettreEnPage({
        nom: "Cyclades",
        periode: null,
        fuseau: "UTC",
        format: f,
        options: { ciblePages: 36, rythme: "equilibre", fond: "creme", style: "carnet", ambiance, legendes: true, commentaires: false },
        episodes,
        medias,
      });
      expect(livre.pages).toHaveLength(36);
      const places = livre.pages.flatMap((p) => p.cellules.map((c) => c?.mediaId)).filter(Boolean);
      expect(new Set(places).size).toBe(medias.length);
      const permis = new Set([...gabaritsAmbiance(ambiance).map((g) => g.id), ...AMBIANCES[ambiance].ouvertures, "titre", "texte", "vierge", "ouverture-texte"]);
      for (const p of livre.pages) expect(permis.has(p.gabarit), `${ambiance} ${p.gabarit}`).toBe(true);
      // Chaque légende de photo se retrouve sur la page, sous la photo ou en légende de page.
      for (const [i, p] of livre.pages.entries()) {
        for (const c of p.cellules) {
          if (!c) continue;
          const textes = geometriePage(f, p.gabarit, i + 1).textes.map((t) => texteDuCadre(p, t, i + 1)).join(" ");
          const aLegende = geometriePage(f, p.gabarit, i + 1).textes.some((t) => t.role === "legende");
          if (aLegende && (legendesParPhoto(p.gabarit) || p.legende)) expect(textes, `${ambiance} ${p.gabarit}`).toContain(parId.get(c.mediaId)!.legende!);
        }
      }
      expect(controler(livre, f, parId).filter((x) => x.niveau === "bloquant")).toEqual([]);
    }
  });
});

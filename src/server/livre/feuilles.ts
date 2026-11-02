/**
 * Profil d'export d'un imprimeur : comment les pages du livre se répartissent sur les pages
 * des PDF (« feuilles ») et dans quels fichiers.
 *
 * - separes : intérieur en pages simples + couverture d'une pièce (quatrième, dos, première) ;
 * - doubles-pages : intérieur en planches, une feuille = une double page (Saal Digital) ;
 * - unique : un seul PDF, couverture étalée puis intérieur, gardes vierges si demandé (Gelato,
 *   Pixartprinting) ;
 * - unique-pages : un seul PDF en pages simples, première, intérieur, quatrième (Prodigi).
 */
import { imprimeurParId } from "@/lib/imprimeurs/catalogue";
import type { Fichiers } from "@/lib/imprimeurs/types";
import { epaisseurDos, type Format } from "@/lib/livre/formats";
import type { Rect } from "@/lib/livre/gabarits";

/** Ce qu'affiche une partie de feuille : une page intérieure (numéro), la première, la quatrième ou le dos. */
export type ContenuVue = { type: "page"; numero: number } | { type: "premiere" } | { type: "quatrieme" } | { type: "dos"; largeur: number };

/** Une page logique posée sur une feuille : décalage de son coin rogné, et zone de découpe. */
export type Vue = { contenu: ContenuVue; dx: number; dy: number; clip: Rect };
/** `fondPerdu` : marge autour du format rogné (TrimBox = feuille moins le fond perdu). */
export type Feuille = { largeur: number; hauteur: number; fondPerdu: number; vues: Vue[] };
export type FichierPdf = { suffixe: string; titre: string; feuilles: Feuille[] };

export type Profil = { fichiers: Fichiers; fondPerdu: number; fondPerduCouverture: number; gardesVierges: boolean; imprimeur: string | null };

export function profilDe(f: Format): Profil {
  const imp = f.imprimeurId ? imprimeurParId(f.imprimeurId) : undefined;
  if (!imp) return { fichiers: "separes", fondPerdu: f.fondPerdu, fondPerduCouverture: f.fondPerdu, gardesVierges: false, imprimeur: null };
  const t = imp.technique;
  return { fichiers: t.fichiers, fondPerdu: t.fondPerdu, fondPerduCouverture: t.fondPerduCouverture, gardesVierges: !!t.gardesVierges, imprimeur: imp.nom };
}

/** Feuille d'une page simple, fond perdu tout autour. */
function pageSimple(f: Format, b: number, contenu: ContenuVue): Feuille {
  const l = f.largeur + 2 * b;
  const h = f.hauteur + 2 * b;
  return { largeur: l, hauteur: h, fondPerdu: b, vues: [{ contenu, dx: b, dy: b, clip: { x: 0, y: 0, l, h } }] };
}

/** Couverture d'une pièce : quatrième, dos, première, fond perdu tout autour. */
export function feuilleCouverture(f: Format, pages: number, b: number): Feuille {
  const dos = epaisseurDos(f, pages);
  const l = 2 * f.largeur + dos + 2 * b;
  const h = f.hauteur + 2 * b;
  return {
    largeur: l,
    hauteur: h,
    fondPerdu: b,
    vues: [
      { contenu: { type: "quatrieme" }, dx: b, dy: b, clip: { x: 0, y: 0, l: b + f.largeur, h } },
      { contenu: { type: "dos", largeur: dos }, dx: b + f.largeur, dy: b, clip: { x: b + f.largeur, y: 0, l: dos, h } },
      { contenu: { type: "premiere" }, dx: b + f.largeur + dos, dy: b, clip: { x: b + f.largeur + dos, y: 0, l: f.largeur + b, h } },
    ],
  };
}

/** Planches : la page 1 seule à droite, puis (2, 3), (4, 5)… ; pas de fond perdu au pli. */
function planches(f: Format, pages: number, b: number): Feuille[] {
  const l = 2 * f.largeur + 2 * b;
  const h = f.hauteur + 2 * b;
  const r: Feuille[] = [];
  const paires: [number | null, number | null][] = [[null, 1]];
  for (let n = 2; n <= pages; n += 2) paires.push([n, n + 1 <= pages ? n + 1 : null]);
  for (const [g, d] of paires) {
    const vues: Vue[] = [];
    if (g) vues.push({ contenu: { type: "page", numero: g }, dx: b, dy: b, clip: { x: 0, y: 0, l: b + f.largeur, h } });
    if (d) vues.push({ contenu: { type: "page", numero: d }, dx: b + f.largeur, dy: b, clip: { x: b + f.largeur, y: 0, l: f.largeur + b, h } });
    r.push({ largeur: l, hauteur: h, fondPerdu: b, vues });
  }
  return r;
}

export function fichiersPdf(f: Format, pages: number): FichierPdf[] {
  const p = profilDe(f);
  const b = p.fondPerdu;
  const interieur = Array.from({ length: pages }, (_, i) => pageSimple(f, b, { type: "page", numero: i + 1 }));
  const vierge = (): Feuille => ({ largeur: f.largeur + 2 * b, hauteur: f.hauteur + 2 * b, fondPerdu: b, vues: [] });
  switch (p.fichiers) {
    case "doubles-pages":
      return [
        { suffixe: "interieur", titre: "intérieur (doubles pages)", feuilles: planches(f, pages, b) },
        { suffixe: "couverture", titre: "couverture", feuilles: [feuilleCouverture(f, pages, p.fondPerduCouverture)] },
      ];
    case "unique":
      return [
        {
          suffixe: "livre",
          titre: "livre complet",
          feuilles: [feuilleCouverture(f, pages, p.fondPerduCouverture), ...(p.gardesVierges ? [vierge()] : []), ...interieur, ...(p.gardesVierges ? [vierge()] : [])],
        },
      ];
    case "unique-pages":
      return [
        {
          suffixe: "livre",
          titre: "livre complet",
          feuilles: [pageSimple(f, b, { type: "premiere" }), ...interieur, pageSimple(f, b, { type: "quatrieme" })],
        },
      ];
    default:
      return [
        { suffixe: "interieur", titre: "intérieur", feuilles: interieur },
        { suffixe: "couverture", titre: "couverture", feuilles: [feuilleCouverture(f, pages, p.fondPerduCouverture)] },
      ];
  }
}

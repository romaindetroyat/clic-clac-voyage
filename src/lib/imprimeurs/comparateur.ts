/**
 * Comparateur d'imprimeurs pour le livre d'un voyage : coût total réel (exemplaires et port),
 * imprimeurs incompatibles écartés avec la raison, classement réglable.
 */
import type { Format } from "@/lib/livre/formats";
import type { Devise, Imprimeur, Produit } from "./types";

/** Taux de conversion indicatifs vers l'euro (relevé du 2 novembre 2026). */
export const TAUX: Record<Devise, number> = { EUR: 1, USD: 0.92, GBP: 1.17 };
export const DATE_TAUX = "2026-11-02";

export const enEuros = (v: number, d: Devise) => Math.round(v * TAUX[d] * 100) / 100;

export type Forme = "portrait" | "paysage" | "carre";
export function forme(largeur: number, hauteur: number): Forme {
  const r = largeur / hauteur;
  if (Math.abs(r - 1) < 0.08) return "carre";
  return r < 1 ? "portrait" : "paysage";
}
const NOMS_FORME: Record<Forme, string> = { portrait: "portrait", paysage: "paysage", carre: "carré" };

/** Pages facturées : au moins le minimum du produit, arrondi à son pas. */
export function pagesFacturees(p: Produit, pages: number): number {
  const n = Math.max(p.pagesMin, pages);
  return Math.ceil(n / p.pas) * p.pas;
}

/** Prix d'un exemplaire dans sa devise, ou null s'il n'est pas connu. */
export function prixExemplaire(p: Produit, pages: number): number | null {
  if (p.prix.base == null) return null;
  const sup = Math.max(0, pagesFacturees(p, pages) - p.prix.pagesIncluses);
  if (sup > 0 && p.prix.parPageSup == null) return null;
  const unites = p.prix.parDoublePage ? Math.ceil(sup / 2) : sup;
  return Math.round((p.prix.base + unites * (p.prix.parPageSup ?? 0)) * 100) / 100;
}

/** Port d'un envoi de `n` exemplaires, dans la devise de l'imprimeur. */
export function prixPort(imp: Imprimeur, n: number, sousTotal: number): number | null {
  if (n <= 0) return 0;
  const { premier, suivant, francoDes } = imp.port;
  if (francoDes != null && sousTotal >= francoDes) return 0;
  if (premier == null) return null;
  return Math.round((premier + (suivant ?? premier) * (n - 1)) * 100) / 100;
}

export type Ligne = {
  imprimeur: Imprimeur;
  produit: Produit;
  pages: number;
  pagesAjoutees: number;
  /** En euros (convertis si besoin), null si inconnus. */
  exemplaire: number | null;
  port: number | null;
  total: number | null;
  /** Faux quand le port n'est pas relevé : le total ne compte que les livres. */
  portInclus: boolean;
  delaiJours: number | null;
  note: number | null;
  /** Ce qui reste à vérifier avant de commander. */
  incertitudes: string[];
  score: number;
};

export type Exclusion = { imprimeur: Imprimeur; raison: string };
export type Tri = "prix" | "note" | "delai" | "score";

/** Le produit le plus proche du format du livre, dans la même forme (portrait, paysage, carré). */
export function produitProche(imp: Imprimeur, largeur: number, hauteur: number): Produit | null {
  const f = forme(largeur, hauteur);
  const candidats = imp.produits.filter((p) => forme(p.largeur, p.hauteur) === f);
  if (!candidats.length) return null;
  const r = largeur / hauteur;
  const aire = largeur * hauteur;
  return candidats.sort(
    (a, b) =>
      Math.abs(a.largeur / a.hauteur - r) * 4 + Math.abs(Math.log((a.largeur * a.hauteur) / aire)) -
      (Math.abs(b.largeur / b.hauteur - r) * 4 + Math.abs(Math.log((b.largeur * b.hauteur) / aire))),
  )[0];
}

export function comparer(
  imprimeurs: Imprimeur[],
  livre: { pages: number; largeur: number; hauteur: number },
  exemplaires: number,
  tri: Tri = "score",
): { lignes: Ligne[]; exclusions: Exclusion[] } {
  const lignes: Ligne[] = [];
  const exclusions: Exclusion[] = [];
  const f = forme(livre.largeur, livre.hauteur);

  for (const imp of imprimeurs) {
    if (imp.pdfFrance.valeur === false) {
      exclusions.push({ imprimeur: imp, raison: "Ne propose pas l’impression d’un PDF libre depuis la France (seulement son propre logiciel)." });
      continue;
    }
    if (imp.livraisonFrance.valeur === "non") {
      exclusions.push({ imprimeur: imp, raison: "Ne livre pas en France." });
      continue;
    }
    const produit = produitProche(imp, livre.largeur, livre.hauteur);
    if (!produit) {
      exclusions.push({ imprimeur: imp, raison: `Aucun format ${NOMS_FORME[f]} dans la gamme relevée.` });
      continue;
    }
    if (livre.pages > produit.pagesMax) {
      exclusions.push({ imprimeur: imp, raison: `${produit.nom} : ${produit.pagesMax} pages au plus (votre livre en a ${livre.pages}).` });
      continue;
    }
    const pages = pagesFacturees(produit, livre.pages);
    const unitaire = prixExemplaire(produit, livre.pages);
    const exemplaire = unitaire == null ? null : enEuros(unitaire, produit.prix.devise);
    const port = unitaire == null ? null : prixPort(imp, exemplaires, unitaire * exemplaires);
    const portEur = port == null ? null : enEuros(port, imp.port.devise);
    const incertitudes: string[] = [];
    if (imp.pdfFrance.valeur == null) incertitudes.push("Dépôt de PDF depuis la France à confirmer.");
    if (imp.livraisonFrance.valeur === "procedure") incertitudes.push("Livraison en France hors du tunnel de commande, sur demande au service client.");
    else if (imp.livraisonFrance.valeur == null) incertitudes.push("Livraison en France à confirmer.");
    if (exemplaire == null) incertitudes.push("Prix non relevé : à vérifier sur le site.");
    else if (produit.prix.statut !== "V") incertitudes.push("Prix issu d’une source secondaire.");
    if (portEur == null) incertitudes.push("Frais de port non relevés : non compris dans le total.");
    if (produit.prix.devise !== "EUR") incertitudes.push(`Prix en ${produit.prix.devise}, converti au taux indicatif du ${DATE_TAUX}.`);
    if (imp.technique.couleur !== "sRGB") incertitudes.push(`Demande des fichiers en ${imp.technique.couleur} : l’export est en RVB (sRGB).`);
    if (imp.technique.statut === "NV") incertitudes.push("Contraintes techniques à confirmer.");
    const { fabrication, livraison: envoi, total: delaiTotal } = imp.delais;
    const delai = delaiTotal ?? (fabrication != null && envoi != null ? fabrication + envoi : null);
    lignes.push({
      imprimeur: imp,
      produit,
      pages,
      pagesAjoutees: pages - livre.pages,
      exemplaire,
      port: portEur,
      // Port inconnu : le total compte les livres seulement (et le dit).
      total: exemplaire != null ? Math.round((exemplaire * exemplaires + (portEur ?? 0)) * 100) / 100 : null,
      portInclus: portEur != null,
      delaiJours: delai,
      note: imp.note?.valeur ?? null,
      incertitudes,
      score: 0,
    });
  }

  // Score combiné : prix 50 %, note 30 %, délai 20 % (valeur neutre quand l'information manque).
  const totaux = lignes.map((l) => l.total).filter((x): x is number => x != null);
  const delais = lignes.map((l) => l.delaiJours).filter((x): x is number => x != null);
  const minTotal = Math.min(...totaux);
  const minDelai = Math.min(...delais);
  for (const l of lignes) {
    const p = l.total != null ? minTotal / l.total : 0.4;
    const n = l.note != null ? l.note / 5 : 0.6;
    const d = l.delaiJours != null ? minDelai / l.delaiJours : 0.5;
    l.score = Math.round((0.5 * p + 0.3 * n + 0.2 * d) * 1000) / 10;
  }

  const fin = (x: number | null, inverse = false) => (x == null ? Number.POSITIVE_INFINITY : inverse ? -x : x);
  const cle: Record<Tri, (l: Ligne) => number> = {
    prix: (l) => fin(l.total),
    note: (l) => fin(l.note, true),
    delai: (l) => fin(l.delaiJours),
    score: (l) => -l.score,
  };
  lignes.sort((a, b) => cle[tri](a) - cle[tri](b) || fin(a.total) - fin(b.total));
  return { lignes, exclusions };
}

/** Format de livre d'un produit d'imprimeur : la mise en page et les contrôles suivent ses règles. */
export function formatDepuisProduit(imp: Imprimeur, p: Produit): Format {
  const t = imp.technique;
  return {
    id: `${imp.id}:${p.id}`,
    nom: `${imp.nom} · ${p.nom}`,
    largeur: p.largeur,
    hauteur: p.hauteur,
    fondPerdu: t.fondPerdu,
    securite: t.securite,
    pli: t.securiteReliure,
    pagesMin: p.pagesMin,
    pagesMax: p.pagesMax,
    multiple: p.pas,
    couverture: p.reliure === "souple" ? "souple" : "rigide",
    papier: { nom: p.papier, grammage: p.grammage ?? 170, main: p.main ?? 0.9 },
    tableDos: p.tableDos,
    dosTitreMin: t.dosTitreMin,
    imprimeurId: imp.id,
  };
}

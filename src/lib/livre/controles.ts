/**
 * Contrôles en direct du livre : résolution des photos, textes trop près du bord ou du pli,
 * textes trop longs pour leur cadre, nombre de pages accepté par le format.
 */
import { dpiEffectif } from "./cadrage";
import type { Format } from "./formats";
import { geometriePage, type CadreTexte, type Rect } from "./gabarits";
import type { Livre, MediaLivre } from "./modele";

export const DPI_ALERTE = 250;
export const DPI_BLOQUANT = 150;

export type Probleme = {
  niveau: "bloquant" | "alerte";
  /** Numéro de page (1 = première page intérieure), 0 = couverture, null = livre entier. */
  page: number | null;
  cellule?: number;
  message: string;
};

/** Tailles des textes du livre (points typographiques). */
export const TAILLES: Record<CadreTexte["role"], number> = { titre: 26, surtitre: 8, corps: 10.5, legende: 7.5, folio: 7 };
const PT = 0.3528; // mm

/** Estimation prudente du nombre de caractères qui tiennent dans un cadre. */
export function capaciteTexte(rect: Rect, role: CadreTexte["role"]): number {
  const t = TAILLES[role] * PT;
  const parLigne = Math.floor(rect.l / (t * 0.5));
  const lignes = Math.floor(rect.h / (t * (role === "corps" ? 1.45 : 1.2)));
  return Math.max(0, parLigne * lignes);
}

function texteDe(p: Livre["pages"][number], role: CadreTexte["role"]): string {
  if (role === "titre") return p.titre ?? "";
  if (role === "surtitre") return p.surtitre ?? "";
  if (role === "corps") return p.corps ?? "";
  if (role === "legende") return p.legende ?? "";
  return "";
}

export function controler(livre: Livre, f: Format, medias: Map<string, MediaLivre>): Probleme[] {
  const r: Probleme[] = [];
  const n = livre.pages.length;
  if (n < f.pagesMin) r.push({ niveau: "bloquant", page: null, message: `Le livre doit compter au moins ${f.pagesMin} pages (il en a ${n}).` });
  if (n > f.pagesMax) r.push({ niveau: "bloquant", page: null, message: `Ce format accepte au plus ${f.pagesMax} pages (le livre en a ${n}).` });
  if (n % f.multiple) r.push({ niveau: "bloquant", page: null, message: `Le nombre de pages doit être un multiple de ${f.multiple} (il y en a ${n}).` });

  const vus = new Map<string, number>();
  livre.pages.forEach((p, i) => {
    const numero = i + 1;
    const geo = geometriePage(f, p.gabarit, numero);
    geo.photos.forEach((cadre, ci) => {
      const c = p.cellules[ci];
      if (!c) {
        r.push({ niveau: "alerte", page: numero, cellule: ci, message: "Cadre vide." });
        return;
      }
      const m = medias.get(c.mediaId);
      if (!m) {
        r.push({ niveau: "bloquant", page: numero, cellule: ci, message: "Photo introuvable (supprimée ou décochée du livre ?)." });
        return;
      }
      vus.set(c.mediaId, (vus.get(c.mediaId) ?? 0) + 1);
      const dpi = dpiEffectif(m.largeur, m.hauteur, cadre.l, cadre.h, c);
      if (dpi < DPI_BLOQUANT) r.push({ niveau: "bloquant", page: numero, cellule: ci, message: `Photo trop petite pour ce cadre (${dpi} dpi) : elle sera floue.` });
      else if (dpi < DPI_ALERTE) r.push({ niveau: "alerte", page: numero, cellule: ci, message: `Résolution limite (${dpi} dpi) : agrandissez moins cette photo.` });
    });
    if (p.cellules.length > geo.photos.length && p.cellules.slice(geo.photos.length).some(Boolean)) {
      r.push({ niveau: "alerte", page: numero, message: "Des photos ne sont plus affichées par ce gabarit." });
    }
    for (const t of geo.textes) {
      const texte = texteDe(p, t.role);
      if (!texte) continue;
      const rect = t.rect;
      const pres = Math.min(rect.x, rect.y, f.largeur - rect.x - rect.l, f.hauteur - rect.y - rect.h);
      if (pres < f.securite) r.push({ niveau: "alerte", page: numero, message: "Texte trop près du bord : il risque d’être coupé." });
      const reliureGauche = numero % 2 === 1;
      const distPli = reliureGauche ? rect.x : f.largeur - rect.x - rect.l;
      if (distPli < f.pli) r.push({ niveau: "alerte", page: numero, message: "Texte trop près du pli." });
      if (texte.length > capaciteTexte(rect, t.role)) {
        r.push({ niveau: "alerte", page: numero, message: `Texte trop long pour son cadre (${t.role === "corps" ? "récit" : t.role}) : il sera coupé.` });
      }
    }
  });
  for (const fois of vus.values()) if (fois > 1) r.push({ niveau: "alerte", page: null, message: `Une photo apparaît ${fois} fois dans le livre.` });
  return r;
}

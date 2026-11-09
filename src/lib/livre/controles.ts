/**
 * Contrôles en direct du livre : résolution des photos, textes trop près du bord ou du pli,
 * textes trop longs pour leur cadre, nombre de pages accepté par le format.
 */
import { dpiEffectif } from "./cadrage";
import type { Format } from "./formats";
import { geometriePage, texteDuCadre, type CadreTexte, type Rect } from "./gabarits";
import { ratiosDe, type Livre, type MediaLivre } from "./modele";
import { interligne, STYLES, styleTypo } from "./styles";

export const DPI_ALERTE = 250;
export const DPI_BLOQUANT = 150;

export type Probleme = {
  niveau: "bloquant" | "alerte";
  /** Numéro de page (1 = première page intérieure), 0 = couverture, null = livre entier. */
  page: number | null;
  cellule?: number;
  message: string;
};

/** Tailles des textes du style classique (points typographiques). */
export const TAILLES: Record<CadreTexte["role"], number> = {
  titre: STYLES.classique.titre.taille,
  surtitre: STYLES.classique.surtitre.taille,
  corps: STYLES.classique.corps.taille,
  legende: STYLES.classique.legende.taille,
  folio: STYLES.classique.folio.taille,
};
const PT = 0.3528; // mm

/** Estimation prudente du nombre de caractères qui tiennent dans un cadre. */
export function capaciteTexte(rect: Rect, role: CadreTexte["role"], style?: string, echelle = 1): number {
  const typo = styleTypo(style)[role];
  const t = typo.taille * echelle * PT;
  // Capitales espacées : plus larges.
  const chasse = 0.5 + (typo.majuscules ? 0.15 : 0) + (typo.suivi ?? 0);
  const parLigne = Math.floor(rect.l / (t * chasse));
  const lignes = Math.floor(rect.h / (t * interligne(typo, role)));
  return Math.max(0, parLigne * lignes);
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
    const geo = geometriePage(f, p.gabarit, numero, ratiosDe(p.cellules, (id) => medias.get(id)));
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
      if (t.role === "folio") continue;
      const texte = texteDuCadre(p, t, numero);
      if (!texte) continue;
      const rect = t.rect;
      const pres = Math.min(rect.x, rect.y, f.largeur - rect.x - rect.l, f.hauteur - rect.y - rect.h);
      if (pres < f.securite) r.push({ niveau: "alerte", page: numero, message: "Texte trop près du bord : il risque d’être coupé." });
      const reliureGauche = numero % 2 === 1;
      const distPli = reliureGauche ? rect.x : f.largeur - rect.x - rect.l;
      if (distPli < f.pli) r.push({ niveau: "alerte", page: numero, message: "Texte trop près du pli." });
      if (texte.length > capaciteTexte(rect, t.role, livre.options.style, t.echelle)) {
        r.push({ niveau: "alerte", page: numero, message: `Texte trop long pour son cadre (${t.role === "corps" ? "récit" : t.role}) : il sera coupé.` });
      }
    }
  });
  for (const fois of vus.values()) if (fois > 1) r.push({ niveau: "alerte", page: null, message: `Une photo apparaît ${fois} fois dans le livre.` });
  return r;
}

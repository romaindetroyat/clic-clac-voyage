/**
 * Source Typst du livre : fonds, formes (aplats, cadres blancs, pellicules) et textes. Les photos
 * sont ajoutées ensuite par pdf-lib, telles quelles (JPEG non réencodés) : Typst garde chaque image
 * décodée en mémoire, ce qui ne tiendrait pas dans une fonction de 2 Go pour 200 pages.
 *
 * Deux couches : « dessous » (fond de page, formes et textes, sous les photos) et « dessus »
 * (voiles et textes posés sur les photos). La couche du dessus est compilée à part et posée
 * par pdf-lib après les photos.
 *
 * Pas de paramètre « bleed » dans la version de Typst embarquée (0.14) : chaque feuille fait
 * format + fonds perdus, les pages logiques y sont décalées (voir feuilles.ts), et les boîtes
 * TrimBox / BleedBox sont posées après coup.
 */
import type { Format } from "@/lib/livre/formats";
import { geometrieCouverture, geometriePage, texteDuCadre, type CadreTexte, type Forme, type Geometrie, type Rect } from "@/lib/livre/gabarits";
import { ratiosDe, type Livre } from "@/lib/livre/modele";
import { couleursDe, interligne, POLICES, styleTypo, teinte, type Couleurs, type StyleTypo } from "@/lib/livre/styles";
import type { Feuille, Vue } from "./feuilles";

/** Chaîne Typst entre guillemets. */
export function chaine(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "").replace(/\n/g, "\\n")}"`;
}

const mm = (x: number) => `${Math.round(x * 1000) / 1000}mm`;

/** Couleur Typst, avec opacité éventuelle. */
function couleur(hex: string, opacite = 1): string {
  const a = Math.round(Math.max(0, Math.min(1, opacite)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `rgb(${chaine(opacite < 1 ? `${hex}${a}` : hex)})`;
}

/** Contenu d'un texte : paragraphes séparés par une ligne vide, retours à la ligne gardés. */
function contenu(texte: string): string {
  return texte
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((l) => `#${chaine(l)}`).join(" #linebreak() "))
    .join(" #parbreak() ");
}

/** Pose un élément à (x, y), éventuellement tourné autour de son centre. */
function placer(x: number, y: number, rotation: number | undefined, corps: string): string {
  const el = rotation ? `rotate(${rotation}deg, ${corps})` : corps;
  return `#place(top + left, dx: ${mm(x)}, dy: ${mm(y)}, ${el})\n`;
}

function forme(f: Forme, o: { x: number; y: number }, c: Couleurs): string {
  const t = teinte(c, f.teinte);
  const r = f.rect;
  const remplissage = f.trait ? `stroke: (paint: ${couleur(t, f.opacite)}, thickness: ${mm(f.trait)})` : `fill: ${couleur(t, f.opacite)}`;
  return placer(o.x + r.x, o.y + r.y, f.rotation, `rect(width: ${mm(r.l)}, height: ${mm(r.h)}, ${remplissage})`);
}

function texte(rect: Rect, t: Pick<CadreTexte, "role" | "centre" | "droite" | "bas" | "milieu" | "echelle" | "teinte" | "rotation">, valeur: string, o: { x: number; y: number }, c: Couleurs, st: StyleTypo): string {
  const typo = st[t.role];
  const taille = typo.taille * (t.echelle ?? 1);
  const fill = t.teinte === "clair" ? "#ffffff" : t.teinte === "accent" ? c.accent : typo.couleur === "douce" ? c.douce : typo.couleur === "accent" ? c.accent : c.encre;
  const corps = typo.majuscules ? `#upper[${contenu(valeur)}]` : contenu(valeur);
  const options = [
    `font: ${chaine(POLICES[typo.police].famille)}`,
    `size: ${taille.toFixed(2)}pt`,
    `fill: ${couleur(fill)}`,
    ...(typo.italique ? [`style: "italic"`] : []),
    ...(typo.suivi ? [`tracking: ${typo.suivi}em`] : []),
  ].join(", ");
  const h = t.centre ? "center" : t.droite ? "right" : "left";
  const v = t.bas ? "bottom" : t.milieu ? "horizon" : "top";
  const leading = Math.max(0.05, interligne(typo, t.role) - 0.9).toFixed(2);
  return placer(
    o.x + rect.x,
    o.y + rect.y,
    t.rotation,
    `box(width: ${mm(rect.l)}, height: ${mm(rect.h)}, clip: true, align(${h} + ${v}, par(leading: ${leading}em, justify: false)[#text(${options})[${corps}]]))`,
  );
}

const ENTETE = `#set text(lang: "fr", hyphenate: false, kerning: true)\n`;

export type Couche = "dessous" | "dessus";

type Options = {
  /** Proportions (largeur / hauteur) des photos, pour les cadres qui s'y ajustent. */
  ratios?: Map<string, number>;
  couche?: Couche;
};

/** Géométrie d'une page intérieure, cadres ajustés aux photos. */
function geometrie(livre: Livre, f: Format, numero: number, o: Options): Geometrie | null {
  const p = livre.pages[numero - 1];
  if (!p) return null;
  const r = o.ratios;
  return geometriePage(f, p.gabarit, numero, ratiosDe(p.cellules, (id) => (r?.has(id) ? { largeur: r.get(id)!, hauteur: 1 } : undefined)));
}

/** Contenu d'une page logique posée sur une feuille, pour une couche. */
function contenuVue(livre: Livre, f: Format, v: Vue, o: Options): string {
  const couche = o.couche ?? "dessous";
  const st = styleTypo(livre.options.style);
  const fondLivre = couleursDe(livre.options.fond);
  // Coordonnées relatives à la boîte de découpe de la vue.
  const or = { x: v.dx - v.clip.x, y: v.dy - v.clip.y };
  const c = livre.couverture;
  let src = "";
  const dessus = couche === "dessus";
  switch (v.contenu.type) {
    case "page": {
      const numero = v.contenu.numero;
      const p = livre.pages[numero - 1];
      const geo = geometrie(livre, f, numero, o);
      if (!p || !geo) return "";
      const couleurs = couleursDe(p.fond ?? livre.options.fond);
      if (!dessus && p.fond && p.fond !== livre.options.fond) src += `#place(top + left, rect(width: ${mm(v.clip.l)}, height: ${mm(v.clip.h)}, fill: ${couleur(couleurs.fond)}))\n`;
      for (const fo of geo.formes) if (!!fo.dessus === dessus) src += forme(fo, or, couleurs);
      for (const t of geo.textes) {
        if (!!t.dessus !== dessus) continue;
        const valeur = texteDuCadre(p, t, numero);
        if (valeur) src += texte(t.rect, t, valeur, or, couleurs, st);
      }
      return src;
    }
    case "premiere":
      if (dessus) return "";
      for (const t of geometrieCouverture(f).premiere.textes) {
        const valeur = t.role === "titre" ? c.titre : c.sousTitre;
        if (valeur) src += texte(t.rect, t, valeur, or, fondLivre, st);
      }
      return src;
    case "quatrieme":
      if (dessus) return "";
      for (const t of geometrieCouverture(f).quatrieme.textes) if (c.quatrieme) src += texte(t.rect, t, c.quatrieme, or, fondLivre, st);
      return src;
    case "dos": {
      // Titre sur le dos, de bas en haut (usage français), s'il est assez épais.
      const dos = v.contenu.largeur;
      if (dessus || dos < f.dosTitreMin || !c.titre) return "";
      const taille = Math.min(14, dos * 0.55 * (72 / 25.4));
      const police = POLICES[st.titre.police].famille;
      return (
        `#place(top + left, dx: ${mm(or.x)}, dy: ${mm(or.y)}, box(width: ${mm(dos)}, height: ${mm(f.hauteur)}, ` +
        `align(center + horizon, rotate(-90deg, reflow: true, text(font: ${chaine(police)}, size: ${taille.toFixed(1)}pt, fill: ${couleur(fondLivre.encre)})[#${chaine(c.titre)}]))))\n`
      );
    }
  }
}

/** Source Typst d'un fichier : une page Typst par feuille (photos exclues). */
export function sourceFeuilles(livre: Livre, f: Format, feuilles: Feuille[], o: Options = {}): string {
  const fond = couleursDe(livre.options.fond);
  const dessus = o.couche === "dessus";
  let src = ENTETE;
  for (const fe of feuilles) {
    src += `#page(width: ${mm(fe.largeur)}, height: ${mm(fe.hauteur)}, margin: 0mm, fill: ${dessus ? "none" : couleur(fond.fond)})[\n`;
    // Un élément invisible garantit que la feuille existe, même vide.
    src += "#place(top + left, box(width: 0mm, height: 0mm))\n";
    for (const v of fe.vues) {
      const interieur = contenuVue(livre, f, v, o);
      // Chaque page logique est découpée à sa zone : rien ne déborde sur la page d'en face.
      if (interieur)
        src += `#place(top + left, dx: ${mm(v.clip.x)}, dy: ${mm(v.clip.y)}, box(width: ${mm(v.clip.l)}, height: ${mm(v.clip.h)}, clip: true)[\n${interieur}])\n`;
    }
    src += "]\n";
  }
  return src;
}

/** Le livre a-t-il quelque chose à poser par-dessus les photos ? */
export function aUneCoucheDessus(livre: Livre, f: Format, ratios?: Map<string, number>): boolean {
  return livre.pages.some((_, i) => {
    const geo = geometrie(livre, f, i + 1, { ratios });
    return !!geo && (geo.formes.some((x) => x.dessus) || geo.textes.some((x) => x.dessus));
  });
}

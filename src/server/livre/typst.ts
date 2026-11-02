/**
 * Source Typst du livre : uniquement le fond et les textes. Les photos sont ajoutées
 * ensuite par pdf-lib, telles quelles (JPEG non réencodés) : Typst garde chaque image
 * décodée en mémoire, ce qui ne tiendrait pas dans une fonction de 2 Go pour 200 pages.
 *
 * Pas de paramètre « bleed » dans la version de Typst embarquée (0.14) : chaque feuille fait
 * format + fonds perdus, les pages logiques y sont décalées (voir feuilles.ts), et les boîtes
 * TrimBox / BleedBox sont posées après coup.
 */
import { TAILLES } from "@/lib/livre/controles";
import type { Format } from "@/lib/livre/formats";
import { geometrieCouverture, geometriePage, type CadreTexte, type Rect } from "@/lib/livre/gabarits";
import type { Feuille, Vue } from "./feuilles";
import { FONDS, type Livre, type PageLivre } from "@/lib/livre/modele";

/** Chaîne Typst entre guillemets. */
export function chaine(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "").replace(/\n/g, "\\n")}"`;
}

const mm = (x: number) => `${Math.round(x * 1000) / 1000}mm`;

/** Contenu d'un texte : paragraphes séparés par une ligne vide, retours à la ligne gardés. */
function contenu(texte: string): string {
  return texte
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((l) => `#${chaine(l)}`).join(" #linebreak() "))
    .join(" #parbreak() ");
}

function style(role: CadreTexte["role"], couleurs: (typeof FONDS)[keyof typeof FONDS]) {
  const t = `${TAILLES[role]}pt`;
  switch (role) {
    case "titre":
      return { police: "EB Garamond", taille: t, couleur: couleurs.encre, interligne: "0.3em", majuscules: false };
    case "corps":
      return { police: "EB Garamond", taille: t, couleur: couleurs.encre, interligne: "0.55em", majuscules: false };
    case "surtitre":
      return { police: "Inter", taille: t, couleur: couleurs.douce, interligne: "0.4em", majuscules: true };
    default:
      return { police: "Inter", taille: t, couleur: couleurs.douce, interligne: "0.4em", majuscules: false };
  }
}

function placerTexte(rect: Rect, t: CadreTexte, texte: string, decalage: { x: number; y: number }, couleurs: (typeof FONDS)[keyof typeof FONDS]) {
  const s = style(t.role, couleurs);
  const corps = s.majuscules ? `#upper[${contenu(texte)}]` : contenu(texte);
  const suivi = t.role === "surtitre" ? ", tracking: 0.12em" : "";
  return (
    `#place(top + left, dx: ${mm(decalage.x + rect.x)}, dy: ${mm(decalage.y + rect.y)}, ` +
    `box(width: ${mm(rect.l)}, height: ${mm(rect.h)}, clip: true, align(${t.centre ? "center" : "left"}, ` +
    `par(leading: ${s.interligne})[#text(font: ${chaine(s.police)}, size: ${s.taille}, fill: rgb(${chaine(s.couleur)})${suivi})[${corps}]])))\n`
  );
}

function texteDe(p: PageLivre, role: CadreTexte["role"], numero: number): string {
  if (role === "titre") return p.titre ?? "";
  if (role === "surtitre") return p.surtitre ?? "";
  if (role === "corps") return p.corps ?? "";
  if (role === "legende") return p.legende ?? "";
  return String(numero);
}

const ENTETE = `#set text(lang: "fr", hyphenate: false, kerning: true)\n`;

/** Textes d'une page logique posée sur une feuille. */
function textesVue(livre: Livre, f: Format, v: Vue, couleurs: (typeof FONDS)[keyof typeof FONDS]): string {
  const o = { x: v.dx, y: v.dy };
  const c = livre.couverture;
  let src = "";
  switch (v.contenu.type) {
    case "page": {
      const numero = v.contenu.numero;
      const p = livre.pages[numero - 1];
      if (!p) return "";
      for (const t of geometriePage(f, p.gabarit, numero).textes) {
        const texte = texteDe(p, t.role, numero);
        if (texte) src += placerTexte(t.rect, t, texte, o, couleurs);
      }
      return src;
    }
    case "premiere":
      for (const t of geometrieCouverture(f).premiere.textes) {
        const texte = t.role === "titre" ? c.titre : c.sousTitre;
        if (texte) src += placerTexte(t.rect, t, texte, o, couleurs);
      }
      return src;
    case "quatrieme":
      for (const t of geometrieCouverture(f).quatrieme.textes) if (c.quatrieme) src += placerTexte(t.rect, t, c.quatrieme, o, couleurs);
      return src;
    case "dos": {
      // Titre sur le dos, de bas en haut (usage français), s'il est assez épais.
      const dos = v.contenu.largeur;
      if (dos < f.dosTitreMin || !c.titre) return "";
      const taille = Math.min(14, dos * 0.55 * (72 / 25.4));
      return (
        `#place(top + left, dx: ${mm(v.dx)}, dy: ${mm(v.dy)}, box(width: ${mm(dos)}, height: ${mm(f.hauteur)}, ` +
        `align(center + horizon, rotate(-90deg, reflow: true, text(font: "EB Garamond", size: ${taille.toFixed(1)}pt, fill: rgb(${chaine(couleurs.encre)}))[#${chaine(c.titre)}]))))\n`
      );
    }
  }
}

/** Source Typst d'un fichier : une page Typst par feuille, fonds et textes seulement. */
export function sourceFeuilles(livre: Livre, f: Format, feuilles: Feuille[]): string {
  const couleurs = FONDS[livre.options.fond];
  let src = ENTETE;
  for (const fe of feuilles) {
    src += `#page(width: ${mm(fe.largeur)}, height: ${mm(fe.hauteur)}, margin: 0mm, fill: rgb(${chaine(couleurs.fond)}))[\n`;
    // Un élément invisible garantit que la feuille existe, même vide.
    src += "#place(top + left, box(width: 0mm, height: 0mm))\n";
    for (const v of fe.vues) src += textesVue(livre, f, v, couleurs);
    src += "]\n";
  }
  return src;
}

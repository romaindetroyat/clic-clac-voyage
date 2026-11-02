/**
 * Source Typst du livre : uniquement le fond et les textes. Les photos sont ajoutées
 * ensuite par pdf-lib, telles quelles (JPEG non réencodés) : Typst garde chaque image
 * décodée en mémoire, ce qui ne tiendrait pas dans une fonction de 2 Go pour 200 pages.
 *
 * Pas de paramètre « bleed » dans la version de Typst embarquée (0.14) : la page fait
 * format + 2 × fond perdu, tout est décalé du fond perdu, et les boîtes TrimBox / BleedBox
 * sont posées après coup.
 */
import { TAILLES } from "@/lib/livre/controles";
import { epaisseurDos, type Format } from "@/lib/livre/formats";
import { geometrieCouverture, geometriePage, type CadreTexte, type Rect } from "@/lib/livre/gabarits";
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

/** Intérieur : une page Typst par page du livre, fond perdu compris. */
export function sourceInterieur(livre: Livre, f: Format): string {
  const b = f.fondPerdu;
  const couleurs = FONDS[livre.options.fond];
  let src = `${ENTETE}#set page(width: ${mm(f.largeur + 2 * b)}, height: ${mm(f.hauteur + 2 * b)}, margin: 0mm, fill: rgb(${chaine(couleurs.fond)}))\n`;
  livre.pages.forEach((p, i) => {
    const numero = i + 1;
    if (i) src += "#pagebreak()\n";
    // Un élément invisible garantit que chaque page existe, même vide.
    src += "#place(top + left, box(width: 0mm, height: 0mm))\n";
    for (const t of geometriePage(f, p.gabarit, numero).textes) {
      const texte = texteDe(p, t.role, numero);
      if (texte) src += placerTexte(t.rect, t, texte, { x: b, y: b }, couleurs);
    }
  });
  return src;
}

/** Géométrie de la couverture complète : quatrième, dos, première, fonds perdus. */
export function geometrieCouvertureComplete(f: Format, pages: number) {
  const b = f.fondPerdu;
  const dos = epaisseurDos(f, pages);
  return {
    largeur: 2 * f.largeur + dos + 2 * b,
    hauteur: f.hauteur + 2 * b,
    dos,
    quatrieme: { x: b, y: b },
    tranche: { x: b + f.largeur, y: b, l: dos, h: f.hauteur },
    premiere: { x: b + f.largeur + dos, y: b },
  };
}

export function sourceCouverture(livre: Livre, f: Format): string {
  const g = geometrieCouvertureComplete(f, livre.pages.length);
  const couleurs = FONDS[livre.options.fond];
  const geo = geometrieCouverture(f);
  let src = `${ENTETE}#set page(width: ${mm(g.largeur)}, height: ${mm(g.hauteur)}, margin: 0mm, fill: rgb(${chaine(couleurs.fond)}))\n`;
  src += "#place(top + left, box(width: 0mm, height: 0mm))\n";
  const c = livre.couverture;
  for (const t of geo.premiere.textes) {
    const texte = t.role === "titre" ? c.titre : c.sousTitre;
    if (texte) src += placerTexte(t.rect, t, texte, g.premiere, couleurs);
  }
  for (const t of geo.quatrieme.textes) if (c.quatrieme) src += placerTexte(t.rect, t, c.quatrieme, g.quatrieme, couleurs);
  // Titre sur le dos, de bas en haut (usage français), s'il est assez épais.
  if (g.dos >= f.dosTitreMin && c.titre) {
    const taille = Math.min(14, g.dos * 0.55 * (72 / 25.4));
    src +=
      `#place(top + left, dx: ${mm(g.tranche.x)}, dy: ${mm(g.tranche.y)}, box(width: ${mm(g.tranche.l)}, height: ${mm(g.tranche.h)}, ` +
      `align(center + horizon, rotate(-90deg, reflow: true, text(font: "EB Garamond", size: ${taille.toFixed(1)}pt, fill: rgb(${chaine(couleurs.encre)}))[#${chaine(c.titre)}]))))\n`;
  }
  return src;
}

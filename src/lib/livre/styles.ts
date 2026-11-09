/**
 * Habillage du livre : polices, styles typographiques (titres, récits, légendes) et fonds de page.
 * Tout est partagé entre l'écran (CSS) et le PDF (Typst) : mêmes polices, mêmes tailles, mêmes couleurs.
 * Les fichiers des polices sont dans /polices (licences libres) et chargés à l'écran par next/font.
 */

/** Polices disponibles : nom de famille (Typst, fichiers de /polices) et variable CSS (next/font). */
export const POLICES = {
  garamond: { nom: "EB Garamond", famille: "EB Garamond", css: "var(--font-titre)", italique: true },
  inter: { nom: "Inter", famille: "Inter", css: "var(--font-texte)", italique: true },
  caveat: { nom: "Caveat (manuscrite)", famille: "Caveat", css: "var(--l-caveat)", italique: false },
  kalam: { nom: "Kalam (manuscrite)", famille: "Kalam", css: "var(--l-kalam)", italique: false },
  reenie: { nom: "Reenie Beanie (griffonnée)", famille: "Reenie Beanie", css: "var(--l-reenie)", italique: false },
  dancing: { nom: "Dancing Script (calligraphie)", famille: "Dancing Script", css: "var(--l-dancing)", italique: false },
  amatic: { nom: "Amatic SC (craie)", famille: "Amatic SC", css: "var(--l-amatic)", italique: false },
  special: { nom: "Special Elite (machine à écrire)", famille: "Special Elite", css: "var(--l-special)", italique: false },
  courier: { nom: "Courier Prime (machine à écrire)", famille: "Courier Prime", css: "var(--l-courier)", italique: false },
  playfair: { nom: "Playfair Display", famille: "Playfair Display", css: "var(--l-playfair)", italique: true },
  cormorant: { nom: "Cormorant Garamond", famille: "Cormorant Garamond", css: "var(--l-cormorant)", italique: true },
  baskerville: { nom: "Libre Baskerville", famille: "Libre Baskerville", css: "var(--l-baskerville)", italique: true },
  dmserif: { nom: "DM Serif Display", famille: "DM Serif Display", css: "var(--l-dmserif)", italique: false },
  abril: { nom: "Abril Fatface (affiche)", famille: "Abril Fatface", css: "var(--l-abril)", italique: false },
  josefin: { nom: "Josefin Sans", famille: "Josefin Sans", css: "var(--l-josefin)", italique: false },
  grotesk: { nom: "Space Grotesk", famille: "Space Grotesk", css: "var(--l-grotesk)", italique: false },
  bebas: { nom: "Bebas Neue (affiche)", famille: "Bebas Neue", css: "var(--l-bebas)", italique: false },
} as const;
export type IdPolice = keyof typeof POLICES;

export type RoleTypo = "titre" | "surtitre" | "corps" | "legende" | "folio";

/** Apparence d'un rôle de texte. Tailles en points typographiques. */
export type Typo = {
  police: IdPolice;
  taille: number;
  italique?: boolean;
  majuscules?: boolean;
  /** Espacement des lettres, en em. */
  suivi?: number;
  /** Hauteur de ligne (multiple de la taille). */
  interligne?: number;
  couleur?: "encre" | "douce" | "accent";
};

export type StyleTypo = { nom: string; description: string } & Record<RoleTypo, Typo>;

const t = (police: IdPolice, taille: number, o: Omit<Typo, "police" | "taille"> = {}): Typo => ({ police, taille, ...o });

/** Styles typographiques du livre (titres, récits, légendes des photos, numéros de page). */
export const STYLES = {
  classique: {
    nom: "Classique",
    description: "Garamond et Inter : sobre, intemporel.",
    titre: t("garamond", 26),
    surtitre: t("inter", 8, { majuscules: true, suivi: 0.12, couleur: "douce" }),
    corps: t("garamond", 10.5, { interligne: 1.45 }),
    legende: t("inter", 7.5, { couleur: "douce" }),
    folio: t("inter", 7, { couleur: "douce" }),
  },
  carnet: {
    nom: "Carnet de voyage",
    description: "Écriture à la main pour les titres et les légendes.",
    titre: t("caveat", 36, { interligne: 1.05 }),
    surtitre: t("caveat", 13, { couleur: "accent" }),
    corps: t("garamond", 10.5, { interligne: 1.45 }),
    legende: t("caveat", 14, { interligne: 1.05 }),
    folio: t("caveat", 11, { couleur: "douce" }),
  },
  griffonne: {
    nom: "Griffonné",
    description: "Comme des notes prises sur le vif, au crayon.",
    titre: t("reenie", 40, { interligne: 1 }),
    surtitre: t("kalam", 9, { couleur: "accent" }),
    corps: t("kalam", 9.5, { interligne: 1.5 }),
    legende: t("reenie", 17, { interligne: 1 }),
    folio: t("kalam", 8, { couleur: "douce" }),
  },
  machine: {
    nom: "Machine à écrire",
    description: "Lettres frappées, façon journal de bord.",
    titre: t("special", 22),
    surtitre: t("courier", 8, { majuscules: true, suivi: 0.1, couleur: "douce" }),
    corps: t("courier", 9.5, { interligne: 1.5 }),
    legende: t("special", 8.5, { interligne: 1.3 }),
    folio: t("courier", 7.5, { couleur: "douce" }),
  },
  magazine: {
    nom: "Magazine",
    description: "Grands titres à empattements, légendes en petites capitales.",
    titre: t("playfair", 30, { interligne: 1.1 }),
    surtitre: t("inter", 7.5, { majuscules: true, suivi: 0.22, couleur: "accent" }),
    corps: t("baskerville", 9.5, { interligne: 1.6 }),
    legende: t("inter", 6.8, { majuscules: true, suivi: 0.08, couleur: "douce" }),
    folio: t("inter", 6.8, { suivi: 0.1, couleur: "douce" }),
  },
  moderne: {
    nom: "Moderne",
    description: "Capitales géométriques très espacées.",
    titre: t("josefin", 24, { majuscules: true, suivi: 0.16 }),
    surtitre: t("josefin", 8, { majuscules: true, suivi: 0.28, couleur: "douce" }),
    corps: t("inter", 9.5, { interligne: 1.55 }),
    legende: t("josefin", 8, { suivi: 0.04, couleur: "douce" }),
    folio: t("josefin", 7.5, { suivi: 0.2, couleur: "douce" }),
  },
  romantique: {
    nom: "Romantique",
    description: "Titres calligraphiés, légendes en italique.",
    titre: t("dancing", 34, { interligne: 1.05 }),
    surtitre: t("cormorant", 11, { italique: true, couleur: "accent" }),
    corps: t("cormorant", 12, { interligne: 1.4 }),
    legende: t("cormorant", 10.5, { italique: true, couleur: "douce" }),
    folio: t("cormorant", 9.5, { italique: true, couleur: "douce" }),
  },
  litteraire: {
    nom: "Littéraire",
    description: "Baskerville du titre à la légende, comme un roman.",
    titre: t("baskerville", 22, { interligne: 1.2 }),
    surtitre: t("baskerville", 9, { italique: true, couleur: "douce" }),
    corps: t("baskerville", 9.5, { interligne: 1.6 }),
    legende: t("baskerville", 8, { italique: true, couleur: "douce" }),
    folio: t("baskerville", 7.5, { couleur: "douce" }),
  },
  elegant: {
    nom: "Élégant",
    description: "Cormorant fin et légendes Playfair en italique.",
    titre: t("cormorant", 32, { interligne: 1.05 }),
    surtitre: t("inter", 7, { majuscules: true, suivi: 0.32, couleur: "douce" }),
    corps: t("cormorant", 12, { interligne: 1.4 }),
    legende: t("playfair", 8.5, { italique: true, couleur: "douce" }),
    folio: t("cormorant", 9.5, { couleur: "douce" }),
  },
  graphique: {
    nom: "Graphique",
    description: "Titres d’affiche en capitales, texte technique.",
    titre: t("bebas", 44, { suivi: 0.03, interligne: 0.95 }),
    surtitre: t("grotesk", 8, { majuscules: true, suivi: 0.15, couleur: "accent" }),
    corps: t("grotesk", 9.5, { interligne: 1.5 }),
    legende: t("grotesk", 7.5, { couleur: "douce" }),
    folio: t("grotesk", 7, { couleur: "douce" }),
  },
  retro: {
    nom: "Rétro",
    description: "Titres DM Serif et légendes dactylographiées.",
    titre: t("dmserif", 28, { interligne: 1.1 }),
    surtitre: t("courier", 8, { majuscules: true, suivi: 0.12, couleur: "accent" }),
    corps: t("baskerville", 9.5, { interligne: 1.6 }),
    legende: t("courier", 8, { couleur: "douce" }),
    folio: t("courier", 7.5, { couleur: "douce" }),
  },
  affiche: {
    nom: "Affiche",
    description: "Titres très gras, légendes en capitales fines.",
    titre: t("abril", 30, { interligne: 1.05 }),
    surtitre: t("josefin", 8, { majuscules: true, suivi: 0.25, couleur: "accent" }),
    corps: t("garamond", 10.5, { interligne: 1.45 }),
    legende: t("josefin", 7.5, { majuscules: true, suivi: 0.12, couleur: "douce" }),
    folio: t("josefin", 7.5, { suivi: 0.2, couleur: "douce" }),
  },
  craie: {
    nom: "Craie",
    description: "Lettres dessinées à la craie, joyeuses.",
    titre: t("amatic", 44, { interligne: 1 }),
    surtitre: t("amatic", 15, { couleur: "accent", suivi: 0.05 }),
    corps: t("kalam", 9.5, { interligne: 1.5 }),
    legende: t("amatic", 15, { interligne: 1 }),
    folio: t("amatic", 13, { couleur: "douce" }),
  },
  epure: {
    nom: "Épuré",
    description: "Inter partout, petit et aéré.",
    titre: t("inter", 20, { interligne: 1.15 }),
    surtitre: t("inter", 7, { majuscules: true, suivi: 0.2, couleur: "douce" }),
    corps: t("inter", 9, { interligne: 1.6 }),
    legende: t("inter", 7, { italique: true, couleur: "douce" }),
    folio: t("inter", 6.5, { couleur: "douce" }),
  },
} satisfies Record<string, StyleTypo>;
export type IdStyle = keyof typeof STYLES;
export const IDS_STYLES = Object.keys(STYLES) as IdStyle[];

export function styleTypo(id: string | undefined | null): StyleTypo {
  return (STYLES as Record<string, StyleTypo>)[id ?? ""] ?? STYLES.classique;
}

/** Interligne par défaut d'un rôle. */
export function interligne(t: Typo, role: RoleTypo): number {
  return t.interligne ?? (role === "corps" ? 1.45 : 1.2);
}

/** Fonds de page et leurs encres : identiques à l'écran et dans le PDF. */
export const FONDS = {
  blanc: { nom: "Blanc cassé", fond: "#fbf9f5", encre: "#1d1b18", douce: "#6f675d", accent: "#9a5b3c" },
  creme: { nom: "Crème", fond: "#f4ecdc", encre: "#2a241c", douce: "#76695a", accent: "#a0522d" },
  lin: { nom: "Lin", fond: "#e9e1d3", encre: "#2b2721", douce: "#6e655a", accent: "#7c5c3b" },
  sable: { nom: "Sable", fond: "#e6d3b3", encre: "#2e2418", douce: "#6d5a42", accent: "#8f3f22" },
  sauge: { nom: "Sauge", fond: "#dfe4d6", encre: "#1f2a22", douce: "#5b6a5c", accent: "#3f6b4b" },
  brume: { nom: "Brume", fond: "#e2e8ec", encre: "#1b2630", douce: "#5a6875", accent: "#2f5f86" },
  poudre: { nom: "Rose poudré", fond: "#f1e2dc", encre: "#2d1f1d", douce: "#7a615c", accent: "#b0524a" },
  terracotta: { nom: "Terracotta", fond: "#b9603f", encre: "#fff6ee", douce: "#f3d2c1", accent: "#ffe3a8" },
  ocean: { nom: "Bleu océan", fond: "#1f4e6b", encre: "#f2f6f8", douce: "#b4c9d6", accent: "#f2c46d" },
  foret: { nom: "Vert forêt", fond: "#24392d", encre: "#eef2ea", douce: "#adbfae", accent: "#e2b86b" },
  ardoise: { nom: "Ardoise", fond: "#2d3236", encre: "#eeeae4", douce: "#a8a39b", accent: "#d9a36a" },
  noir: { nom: "Noir", fond: "#151413", encre: "#f1ece4", douce: "#a49b8f", accent: "#d6a56b" },
} as const;
export type IdFond = keyof typeof FONDS;
export const IDS_FONDS = Object.keys(FONDS) as IdFond[];
export type Couleurs = (typeof FONDS)[IdFond];

export function couleursDe(id: string | undefined | null): Couleurs {
  return (FONDS as Record<string, Couleurs>)[id ?? ""] ?? FONDS.blanc;
}

/** Teintes des aplats et des textes posés sur les photos. */
export function teinte(c: Couleurs, t: "papier" | "blanc" | "encre" | "douce" | "accent" | "voile" | "clair" | "sombre"): string {
  switch (t) {
    case "papier":
      return c.fond;
    case "blanc":
      return "#ffffff";
    case "encre":
      return c.encre;
    case "douce":
      return c.douce;
    case "accent":
      return c.accent;
    case "voile":
      return "#000000";
    case "clair":
      return "#ffffff";
    case "sombre":
      return "#141414";
  }
}

/**
 * Configuration du site d'un voyage : thème, polices, couleurs, sections, affichage.
 * Partagée entre le serveur (validation, rendu) et le navigateur (éditeur, export .zip).
 */
import { z } from "zod";

export const THEMES = {
  "mer-et-iles": {
    nom: "Mer et îles",
    description: "Blanc chaulé, bleu égéen, beaucoup d’air.",
    couleurs: { fond: "#f7f6f2", fond2: "#e9eef0", encre: "#14262f", encreDouce: "#5b6e77", filet: "#d3dde1", accent: "#1f6f9a" },
    polices: "garamond-inter",
  },
  montagne: {
    nom: "Montagne",
    description: "Granit, forêt et ciel froid.",
    couleurs: { fond: "#f2f1ec", fond2: "#e2e3dc", encre: "#1d2421", encreDouce: "#56605a", filet: "#cfd3cb", accent: "#3d6b4f" },
    polices: "fraunces-worksans",
  },
  "ville-et-culture": {
    nom: "Ville et culture",
    description: "Éditorial, contrasté, comme un magazine.",
    couleurs: { fond: "#fbfaf8", fond2: "#efece6", encre: "#111111", encreDouce: "#5c5c5c", filet: "#dddad3", accent: "#b3261e" },
    polices: "playfair-source",
  },
  "desert-safari": {
    nom: "Désert ou safari",
    description: "Sable, ocre et terre brûlée.",
    couleurs: { fond: "#f6efe3", fond2: "#ecdfc9", encre: "#2b1d12", encreDouce: "#6e5645", filet: "#e0cfb3", accent: "#9e4a22" },
    polices: "dmserif-dmsans",
  },
  "road-trip": {
    nom: "Road-trip",
    description: "Nuit, bitume et néons.",
    couleurs: { fond: "#16171a", fond2: "#212328", encre: "#f1ede6", encreDouce: "#a39e95", filet: "#34363c", accent: "#f2a33a" },
    polices: "grotesk-inter",
  },
  "neutre-elegant": {
    nom: "Neutre élégant",
    description: "Papier ivoire et encre : la photo d’abord.",
    couleurs: { fond: "#f6f3ee", fond2: "#ece7df", encre: "#1d1b18", encreDouce: "#6f675d", filet: "#d9d2c7", accent: "#9a4a2b" },
    polices: "lora-nunito",
  },
} as const;

export type IdTheme = keyof typeof THEMES;
export const IDS_THEMES = Object.keys(THEMES) as IdTheme[];

export const POLICES = {
  "garamond-inter": { nom: "Garamond et Inter", titre: "EB Garamond", texte: "Inter" },
  "playfair-source": { nom: "Playfair et Source Sans", titre: "Playfair Display", texte: "Source Sans 3" },
  "fraunces-worksans": { nom: "Fraunces et Work Sans", titre: "Fraunces", texte: "Work Sans" },
  "dmserif-dmsans": { nom: "DM Serif et DM Sans", titre: "DM Serif Display", texte: "DM Sans" },
  "grotesk-inter": { nom: "Space Grotesk et Inter", titre: "Space Grotesk", texte: "Inter" },
  "lora-nunito": { nom: "Lora et Nunito Sans", titre: "Lora", texte: "Nunito Sans" },
} as const;

export type IdPolices = keyof typeof POLICES;
export const IDS_POLICES = Object.keys(POLICES) as IdPolices[];

export const SECTIONS = {
  couverture: "Couverture",
  presentation: "Présentation",
  carte: "Carte de l’itinéraire",
  episodes: "Carnet (chapitres)",
  galerie: "Galerie complète",
  chiffres: "Chiffres du voyage",
  participants: "Participants",
  fin: "Mot de la fin",
} as const;

export type IdSection = keyof typeof SECTIONS;
export const IDS_SECTIONS = Object.keys(SECTIONS) as IdSection[];

export const PRESENTATIONS = {
  carnet: "Carnet (mise en page automatique)",
  mosaique: "Mosaïque",
  "plein-ecran": "Plein écran",
  defilement: "Défilement horizontal",
  alterne: "Photo et texte alternés",
  vedette: "Photo vedette",
} as const;

export type Presentation = keyof typeof PRESENTATIONS;
export const IDS_PRESENTATIONS = Object.keys(PRESENTATIONS) as Presentation[];

const couleur = z.string().regex(/^#[0-9a-f]{6}$/i);

export const schemaConfigSite = z.object({
  theme: z.enum(IDS_THEMES as [IdTheme, ...IdTheme[]]),
  polices: z.enum(IDS_POLICES as [IdPolices, ...IdPolices[]]),
  // Couleurs personnalisées : remplacent celles du thème quand elles sont définies.
  couleurs: z.object({ fond: couleur.optional(), accent: couleur.optional() }).default({}),
  couvertureId: z.string().max(64).nullable().default(null),
  sousTitre: z.string().max(200).default(""),
  presentation: z.string().max(5000).default(""),
  motDeLaFin: z.string().max(5000).default(""),
  sections: z
    .array(z.object({ id: z.enum(IDS_SECTIONS as [IdSection, ...IdSection[]]), actif: z.boolean() }))
    .max(IDS_SECTIONS.length),
  afficher: z
    .object({
      legendes: z.boolean().default(true),
      auteurs: z.boolean().default(true),
      commentaires: z.boolean().default(true),
      reactions: z.boolean().default(true),
    })
    .default({ legendes: true, auteurs: true, commentaires: true, reactions: true }),
  // Chapitres du carnet : par jour, par épisode (étapes, lieux), ou « auto » (épisodes s'il y en a).
  organisation: z.enum(["auto", "jours", "episodes"]).default("auto"),
  // Journal en direct : « auto » l'active pendant les dates du voyage.
  journal: z.enum(["auto", "oui", "non"]).default("auto"),
});

export type ConfigSite = z.infer<typeof schemaConfigSite>;

export function configParDefaut(theme: IdTheme = "neutre-elegant"): ConfigSite {
  return {
    theme,
    polices: THEMES[theme].polices,
    couleurs: {},
    couvertureId: null,
    sousTitre: "",
    presentation: "",
    motDeLaFin: "",
    sections: IDS_SECTIONS.map((id) => ({ id, actif: id !== "galerie" })),
    afficher: { legendes: true, auteurs: true, commentaires: true, reactions: true },
    organisation: "auto",
    journal: "auto",
  };
}

/**
 * Lit une configuration enregistrée en tolérant les anciennes versions :
 * valeurs manquantes complétées, sections inconnues retirées, nouvelles sections ajoutées (inactives).
 */
export function lireConfig(brut: unknown): ConfigSite {
  const defaut = configParDefaut();
  if (!brut || typeof brut !== "object") return defaut;
  const o = brut as Record<string, unknown>;
  const sections = Array.isArray(o.sections)
    ? (o.sections as { id?: unknown; actif?: unknown }[]).filter(
        (s, i, t) => IDS_SECTIONS.includes(s?.id as IdSection) && t.findIndex((x) => x?.id === s.id) === i,
      )
    : defaut.sections;
  for (const id of IDS_SECTIONS) if (!sections.some((s) => s.id === id)) sections.push({ id, actif: false });
  const r = schemaConfigSite.safeParse({ ...defaut, ...o, sections });
  return r.success ? r.data : defaut;
}

function rvb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex([r, v, b]: number[]): string {
  return `#${[r, v, b].map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0")).join("")}`;
}

/** Luminance relative WCAG (0 noir, 1 blanc). */
export function luminance(couleur: string): number {
  const [r, v, b] = rvb(couleur).map((x) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function melange(a: string, b: string, t: number): string {
  const [x, y] = [rvb(a), rvb(b)];
  return hex(x.map((c, i) => c + (y[i] - c) * t));
}

/**
 * Couleurs effectives : celles du thème, éventuellement personnalisées.
 * Un fond personnalisé recalcule l'encre et les filets pour garder un texte lisible.
 */
export function couleursEffectives(c: ConfigSite) {
  const base: Record<"fond" | "fond2" | "encre" | "encreDouce" | "filet" | "accent", string> = THEMES[c.theme].couleurs;
  const fond = c.couleurs.fond ?? base.fond;
  let { encre, encreDouce, filet, fond2 } = base;
  if (c.couleurs.fond) {
    // L'encre la plus douce qui reste bien lisible (WCAG AA : 4,5).
    encre = ["#f3efe8", "#1a1816", "#ffffff", "#000000"].find((x) => contraste(x, fond) >= 4.5) ?? "#000000";
    let t = 0.38;
    encreDouce = melange(encre, fond, t);
    while (t > 0 && contraste(encreDouce, fond) < 4.5) encreDouce = melange(encre, fond, (t = Math.max(0, t - 0.04)));
    filet = melange(fond, encre, 0.16);
    fond2 = melange(fond, encre, 0.06);
  }
  let accent = c.couleurs.accent ?? base.accent;
  // Accent illisible sur ce fond : on le rapproche de l'encre jusqu'à un contraste suffisant.
  for (let i = 1; i <= 10 && contraste(accent, fond) < 3; i++) accent = melange(accent, encre, 0.1 * i);
  return { fond, fond2, encre, encreDouce, filet, accent };
}

/** Le journal est-il actif aujourd'hui ? */
export function journalActif(c: ConfigSite, debut: string | null, fin: string | null, aujourdhui: string): boolean {
  if (c.journal !== "auto") return c.journal === "oui";
  if (!debut) return false;
  return aujourdhui >= debut && (!fin || aujourdhui <= fin);
}

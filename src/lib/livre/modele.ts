/**
 * Modèle du livre, indépendant de l'imprimeur : des pages qui référencent un gabarit,
 * des photos avec leur recadrage dans le cadre, et des textes. Aucune coordonnée au pixel.
 */
import { z } from "zod";

export const schemaCellule = z.object({
  mediaId: z.string().max(64),
  /** Zoom supplémentaire dans le cadre (1 = la photo couvre juste le cadre). */
  zoom: z.number().min(1).max(4).default(1),
  /** Point de la photo placé au centre du cadre (0 à 1). */
  cx: z.number().min(0).max(1).default(0.5),
  cy: z.number().min(0).max(1).default(0.5),
});
export type Cellule = z.infer<typeof schemaCellule>;

export const schemaPage = z.object({
  id: z.string().max(64),
  gabarit: z.string().max(40),
  cellules: z.array(schemaCellule.nullable()).max(9),
  titre: z.string().max(200).optional(),
  surtitre: z.string().max(200).optional(),
  corps: z.string().max(6000).optional(),
  legende: z.string().max(600).optional(),
  episodeId: z.string().max(64).nullable().optional(),
});
export type PageLivre = z.infer<typeof schemaPage>;

export const RYTHMES = { dense: "Dense", equilibre: "Équilibré", aere: "Aéré" } as const;
export type Rythme = keyof typeof RYTHMES;

export const schemaLivre = z.object({
  version: z.literal(1),
  formatId: z.string().max(40),
  options: z.object({
    ciblePages: z.number().int().min(10).max(400),
    rythme: z.enum(["dense", "equilibre", "aere"]),
    fond: z.enum(["blanc", "noir"]),
    legendes: z.boolean(),
    commentaires: z.boolean(),
  }),
  couverture: z.object({
    titre: z.string().max(120),
    sousTitre: z.string().max(200),
    photo: schemaCellule.nullable(),
    quatrieme: z.string().max(1500),
  }),
  pages: z.array(schemaPage).max(400),
});
export type Livre = z.infer<typeof schemaLivre>;

/** Ce que le livre sait d'une photo (dimensions effectives après retouche). */
export type MediaLivre = {
  id: string;
  largeur: number;
  hauteur: number;
  episodeId: string | null;
  instant: string | null;
  legende: string | null;
  auteur: string | null;
  vedette: boolean;
  /** Retenue dans sa rafale ou bien notée : un peu plus d'importance. */
  qualite: number | null;
  vignette: string | null;
  moyenne: string | null;
  commentaires: string[];
};

export type EpisodeLivre = { id: string; titre: string; lieu: string | null; recit: string | null; debut: string | null; fin: string | null };

export function nouvelId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Couleurs des pages : identiques à l'écran et dans le PDF. */
export const FONDS = {
  blanc: { fond: "#fbf9f5", encre: "#1d1b18", douce: "#6f675d" },
  noir: { fond: "#151413", encre: "#f1ece4", douce: "#a49b8f" },
} as const;

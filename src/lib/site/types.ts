/** Données publiques du site d'un voyage : jamais de position précise, jamais d'adresse e-mail. */
import type { ConfigSite, Presentation } from "./config";

export type TailleSite = "s" | "m" | "l" | "affiche" | "video";

export type MediaSite = {
  id: string;
  type: "photo" | "video";
  largeur: number | null;
  hauteur: number | null;
  /** URL des versions disponibles (vignette, moyenne, grande, affiche, vidéo allégée). */
  urls: Partial<Record<TailleSite, string>>;
  legende: string | null;
  auteur: string | null;
  instant: string | null;
  vedette: boolean;
  reactions: { emoji: string; nb: number }[];
  commentaires: { auteur: string; texte: string }[];
};

export type EpisodeSite = {
  id: string;
  ordre: number;
  titre: string;
  lieu: string | null;
  recit: string | null;
  debut: string | null;
  fin: string | null;
  presentation: Presentation;
  medias: MediaSite[];
};

/** Étape de l'itinéraire, arrondie au dixième de degré (environ 10 km). */
export type PointCarte = { lat: number; lon: number; titre: string; episodeId: string; ordre: number };

export type ChiffresSite = {
  jours: number;
  photos: number;
  videos: number;
  episodes: number;
  participants: number;
  km: number;
  commentaires: number;
  reactions: number;
};

export type DonneesSite = {
  slug: string;
  nom: string;
  periode: string | null;
  fuseau: string;
  config: ConfigSite;
  couverture: MediaSite | null;
  episodes: EpisodeSite[];
  /** Photos du site pas encore rangées dans un épisode (visibles dans la galerie complète). */
  horsEpisodes: MediaSite[];
  carte: PointCarte[];
  chiffres: ChiffresSite;
  participants: string[];
  journal: boolean;
  majLe: string;
};

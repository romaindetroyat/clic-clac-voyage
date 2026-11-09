/**
 * Site public d'un voyage : configuration et assemblage des données servies aux lecteurs.
 * Règle RGPD : aucune coordonnée précise ne sort d'ici, seulement des étapes arrondies.
 */
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { periode } from "@/lib/dates";
import {
  IDS_PRESENTATIONS,
  journalActif,
  lireConfig,
  schemaConfigSite,
  type ConfigSite,
  type Presentation,
} from "@/lib/site/config";
import type { DonneesSite, EpisodeSite, MediaSite, PointCarte, TailleSite } from "@/lib/site/types";
import type { Db } from "../db/client";
import { appareil, commentaire, episode, media, participant, reaction, user, voyage, type VersionsWeb } from "../db/schema";
import { distanceKm, jourLocal } from "./decoupage";
import { instantCorrige, trierChronologiquement } from "./temps";
import { ErreurMetier } from "./voyages";

/** Précision publique des positions : un dixième de degré, soit une dizaine de kilomètres. */
export const PRECISION_DEGRES = 0.1;

export function arrondirPosition(x: number): number {
  const r = Number((Math.round(x / PRECISION_DEGRES) * PRECISION_DEGRES).toFixed(1));
  return r === 0 ? 0 : r; // pas de « -0 »
}

function mediane(xs: number[]): number {
  const t = [...xs].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/** Une étape par épisode : médiane des positions de ses photos, arrondie. */
export function etapes(
  episodes: { id: string; ordre: number; titre: string; lieu: string | null }[],
  positions: { episodeId: string | null; latitude: number | null; longitude: number | null }[],
): PointCarte[] {
  const points: PointCarte[] = [];
  for (const e of episodes) {
    const p = positions.filter((x) => x.episodeId === e.id && x.latitude != null && x.longitude != null);
    if (!p.length) continue;
    points.push({
      lat: arrondirPosition(mediane(p.map((x) => x.latitude!))),
      lon: arrondirPosition(mediane(p.map((x) => x.longitude!))),
      titre: e.lieu || e.titre,
      episodeId: e.id,
      ordre: e.ordre,
    });
  }
  return points;
}

export function longueurItineraire(points: { lat: number; lon: number }[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    km += distanceKm(
      { latitude: points[i - 1].lat, longitude: points[i - 1].lon },
      { latitude: points[i].lat, longitude: points[i].lon },
    );
  }
  return Math.round(km);
}

/** Clé de la version à servir pour une taille donnée (les versions retouchées d'abord). */
export function cleVersion(v: VersionsWeb, type: "photo" | "video", taille: TailleSite): string | undefined {
  switch (taille) {
    case "s":
      return v.rs ?? v.s;
    case "m":
      return v.rm ?? v.m ?? v.affiche;
    case "l":
      return v.rl ?? v.l ?? v.rm ?? v.m ?? v.affiche;
    case "affiche":
      return v.affiche ?? (type === "photo" ? (v.rm ?? v.m) : undefined);
    case "video":
      return type === "video" ? v.video : undefined;
  }
}

const TAILLES: TailleSite[] = ["s", "m", "l", "affiche", "video"];

/* --------------------------- Configuration --------------------------- */

export async function configSite(db: Db, voyageId: string): Promise<ConfigSite> {
  const v = await db.query.voyage.findFirst({ where: eq(voyage.id, voyageId), columns: { site: true } });
  return lireConfig(v?.site);
}

export async function enregistrerConfigSite(db: Db, voyageId: string, brut: unknown) {
  const r = schemaConfigSite.safeParse(brut);
  if (!r.success) throw new ErreurMetier("Réglages du site invalides.");
  // Ce que l'éditeur visuel règle (dispositions, recadrages, ouvertures) ne passe que par enregistrerEdition.
  const actuel = await configSite(db, voyageId);
  const c = { ...r.data, mise: actuel.mise, cadrages: actuel.cadrages, ouvertures: actuel.ouvertures };
  if (c.couvertureId) {
    const m = await db.query.media.findFirst({
      where: and(eq(media.id, c.couvertureId), eq(media.voyageId, voyageId), eq(media.type, "photo")),
      columns: { id: true },
    });
    if (!m) throw new ErreurMetier("Photo de couverture introuvable.");
  }
  await db.update(voyage).set({ site: c }).where(eq(voyage.id, voyageId));
}

const schemaEdition = schemaConfigSite.pick({ mise: true, cadrages: true, ouvertures: true });

/** Enregistre ce que règle l'éditeur visuel : dispositions des photos, recadrages, photos d'ouverture. */
export async function enregistrerEdition(db: Db, voyageId: string, brut: unknown) {
  const r = schemaEdition.safeParse(brut);
  if (!r.success) throw new ErreurMetier("Mise en page du site invalide.");
  const actuel = await configSite(db, voyageId);
  await db
    .update(voyage)
    .set({ site: { ...actuel, ...r.data } })
    .where(eq(voyage.id, voyageId));
}

/** Titre et récit d'un épisode, modifiés depuis l'éditeur visuel (le lieu est gardé). */
export async function modifierChapitre(db: Db, voyageId: string, episodeId: string, d: { titre?: string; recit?: string | null }) {
  const e = await db.query.episode.findFirst({ where: and(eq(episode.id, episodeId), eq(episode.voyageId, voyageId)) });
  if (!e) throw new ErreurMetier("Épisode introuvable.");
  const titre = d.titre === undefined ? e.titre : d.titre.trim();
  if (!titre) throw new ErreurMetier("Le titre est obligatoire.");
  await db
    .update(episode)
    .set({ titre, recit: d.recit === undefined ? e.recit : d.recit?.trim() || null })
    .where(eq(episode.id, episodeId));
}

export async function choisirPresentation(db: Db, voyageId: string, episodeId: string, p: string) {
  if (!(IDS_PRESENTATIONS as string[]).includes(p)) throw new ErreurMetier("Présentation inconnue.");
  const r = await db
    .update(episode)
    .set({ presentation: p })
    .where(and(eq(episode.id, episodeId), eq(episode.voyageId, voyageId)))
    .returning({ id: episode.id });
  if (!r.length) throw new ErreurMetier("Épisode introuvable.");
}

export async function mettreEnAvant(db: Db, voyageId: string, mediaId: string, vedette: boolean) {
  const r = await db
    .update(media)
    .set({ vedette })
    .where(and(eq(media.id, mediaId), eq(media.voyageId, voyageId)))
    .returning({ id: media.id });
  if (!r.length) throw new ErreurMetier("Photo introuvable.");
}

/* ------------------------------ Lecture ------------------------------ */

/** Clé de stockage d'un média publié sur le site, ou null s'il n'y est pas (ou plus). */
export async function cleMediaPublie(db: Db, voyageId: string, mediaId: string, taille: TailleSite) {
  return cleMedia(db, voyageId, mediaId, taille, true);
}

/** Clé de stockage d'une version web d'un média du voyage (jamais l'original). */
export async function cleMedia(db: Db, voyageId: string, mediaId: string, taille: TailleSite, publieSeulement = false) {
  const conditions = [eq(media.id, mediaId), eq(media.voyageId, voyageId), eq(media.statut, "pret")];
  if (publieSeulement) conditions.push(eq(media.dansSite, true), isNull(media.doublonDe), eq(media.masque, false));
  const m = await db.query.media.findFirst({ where: and(...conditions), columns: { versions: true, type: true } });
  return m ? (cleVersion(m.versions, m.type, taille) ?? null) : null;
}

/**
 * Toutes les données du site. `url` fabrique l'adresse d'une version
 * (route protégée du site en ligne, ou chemin relatif dans l'export .zip).
 */
export async function donneesSite(
  db: Db,
  voyageId: string,
  url: (mediaId: string, taille: TailleSite, cle: string) => string,
  maintenant = new Date(),
): Promise<DonneesSite> {
  const v = await db.query.voyage.findFirst({ where: eq(voyage.id, voyageId) });
  if (!v) throw new ErreurMetier("Voyage introuvable.");
  const config = lireConfig(v.site);

  const lignes = await db
    .select({
      id: media.id,
      nomFichier: media.nomFichier,
      type: media.type,
      largeur: media.largeur,
      hauteur: media.hauteur,
      versions: media.versions,
      legende: media.legende,
      auteur: user.name,
      priseUtc: media.priseUtc,
      decalage: appareil.decalageSecondes,
      episodeId: media.episodeId,
      vedette: media.vedette,
      latitude: media.latitude,
      longitude: media.longitude,
      rang: media.rang,
    })
    .from(media)
    .leftJoin(user, eq(user.id, media.auteurId))
    .leftJoin(appareil, eq(appareil.id, media.appareilId))
    .where(and(eq(media.voyageId, voyageId), eq(media.statut, "pret"), eq(media.dansSite, true), isNull(media.doublonDe), eq(media.masque, false)));

  const tries = trierChronologiquement(lignes.map((l) => ({ ...l, instant: instantCorrige(l.priseUtc, l.decalage ?? 0) })));
  const ids = tries.map((l) => l.id);

  const coms = ids.length
    ? await db
        .select({ mediaId: commentaire.mediaId, texte: commentaire.texte, auteur: user.name })
        .from(commentaire)
        .leftJoin(user, eq(user.id, commentaire.auteurId))
        .where(inArray(commentaire.mediaId, ids))
        .orderBy(asc(commentaire.createdAt))
    : [];
  const reacs = ids.length
    ? await db.select({ mediaId: reaction.mediaId, emoji: reaction.emoji }).from(reaction).where(inArray(reaction.mediaId, ids))
    : [];

  const comsPar = new Map<string, { auteur: string; texte: string }[]>();
  for (const c of coms) {
    const l = comsPar.get(c.mediaId) ?? [];
    l.push({ auteur: c.auteur ?? "Ancien participant", texte: c.texte });
    comsPar.set(c.mediaId, l);
  }
  const reacsPar = new Map<string, Map<string, number>>();
  for (const r of reacs) {
    const m = reacsPar.get(r.mediaId) ?? new Map<string, number>();
    m.set(r.emoji, (m.get(r.emoji) ?? 0) + 1);
    reacsPar.set(r.mediaId, m);
  }

  const versSite = (l: (typeof tries)[number]): MediaSite => {
    const urls: MediaSite["urls"] = {};
    for (const t of TAILLES) {
      const cle = cleVersion(l.versions, l.type, t);
      if (cle) urls[t] = url(l.id, t, cle);
    }
    return {
      id: l.id,
      type: l.type,
      largeur: l.largeur,
      hauteur: l.hauteur,
      urls,
      legende: config.afficher.legendes ? l.legende : null,
      auteur: config.afficher.auteurs ? l.auteur : null,
      instant: l.instant?.toISOString() ?? null,
      vedette: l.vedette,
      reactions: config.afficher.reactions
        ? [...(reacsPar.get(l.id) ?? new Map<string, number>())].map(([emoji, nb]) => ({ emoji, nb }))
        : [],
      commentaires: config.afficher.commentaires ? (comsPar.get(l.id) ?? []) : [],
    };
  };
  // Un média sans aucune version web ne s'affiche pas (vidéo pas encore traitée, par exemple).
  const publies = tries.filter((l) => cleVersion(l.versions, l.type, "m") || cleVersion(l.versions, l.type, "video"));
  const parId = new Map(publies.map((l) => [l.id, versSite(l)]));

  const eps = await db.query.episode.findMany({ where: eq(episode.voyageId, voyageId), orderBy: [asc(episode.ordre)] });
  const episodes: EpisodeSite[] = eps
    .map((e) => ({
      id: e.id,
      ordre: e.ordre,
      titre: e.titre,
      lieu: e.lieu,
      recit: e.recit,
      debut: e.debut?.toISOString() ?? null,
      fin: e.fin?.toISOString() ?? null,
      presentation: ((IDS_PRESENTATIONS as string[]).includes(e.presentation) ? e.presentation : "carnet") as Presentation,
      medias: publies.filter((l) => l.episodeId === e.id).map((l) => parId.get(l.id)!),
    }))
    .filter((e) => e.medias.length > 0 || e.recit);
  const horsEpisodes = publies.filter((l) => !l.episodeId || !eps.some((e) => e.id === l.episodeId)).map((l) => parId.get(l.id)!);

  const carte = etapes(episodes, publies);
  const membres = await db
    .select({ nom: user.name })
    .from(participant)
    .innerJoin(user, eq(user.id, participant.userId))
    .where(eq(participant.voyageId, voyageId))
    .orderBy(asc(user.name));

  const jours = new Set(publies.filter((l) => l.instant).map((l) => jourLocal(l.instant!, v.fuseau)));
  const tous = [...parId.values()];
  const couverture =
    (config.couvertureId ? parId.get(config.couvertureId) : undefined) ??
    tous.find((m) => m.vedette && m.type === "photo") ??
    tous.find((m) => m.type === "photo") ??
    null;

  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: v.fuseau }).format(maintenant);
  return {
    slug: v.slug,
    nom: v.nom,
    periode: periode(v.dateDebut, v.dateFin),
    fuseau: v.fuseau,
    config,
    couverture,
    episodes,
    horsEpisodes,
    carte,
    chiffres: {
      jours: jours.size,
      photos: tous.filter((m) => m.type === "photo").length,
      videos: tous.filter((m) => m.type === "video").length,
      episodes: episodes.length,
      participants: membres.length,
      km: longueurItineraire(carte),
      commentaires: coms.length,
      reactions: reacs.length,
    },
    participants: membres.map((m) => m.nom),
    journal: journalActif(config, v.dateDebut, v.dateFin, aujourdhui),
    majLe: maintenant.toISOString(),
  };
}

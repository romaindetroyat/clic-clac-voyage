/**
 * Récit du voyage : épisodes, sélection, légendes, commentaires, réactions.
 */
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { appareil, commentaire, episode, media, reaction, user, voyage } from "../db/schema";
import { genererId } from "./crypto";
import { decouper, titreAuto } from "./decoupage";
import { instantCorrige } from "./temps";
import { ErreurMetier } from "./voyages";

export const EMOJIS = ["❤️", "😍", "😂", "😮", "👏", "🔥"] as const;

/** Médias visibles du voyage avec leur instant corrigé (recalage d'horloge appliqué). */
async function mediasVisibles(db: Db, voyageId: string) {
  const lignes = await db
    .select({
      id: media.id,
      priseUtc: media.priseUtc,
      latitude: media.latitude,
      longitude: media.longitude,
      episodeId: media.episodeId,
      decalage: appareil.decalageSecondes,
    })
    .from(media)
    .leftJoin(appareil, eq(appareil.id, media.appareilId))
    .where(and(eq(media.voyageId, voyageId), eq(media.statut, "pret"), isNull(media.doublonDe), eq(media.masque, false)));
  return lignes.map((l) => ({ ...l, instant: instantCorrige(l.priseUtc, l.decalage ?? 0) }));
}

async function fuseau(db: Db, voyageId: string) {
  return (await db.query.voyage.findFirst({ where: eq(voyage.id, voyageId), columns: { fuseau: true } }))?.fuseau ?? "Europe/Paris";
}

/** Recalcule les dates de début et de fin d'un épisode d'après ses médias. */
async function majBornes(db: Db, voyageId: string, episodeIds: string[]) {
  if (!episodeIds.length) return;
  const tous = await mediasVisibles(db, voyageId);
  for (const id of episodeIds) {
    const instants = tous.filter((m) => m.episodeId === id && m.instant).map((m) => m.instant!.getTime());
    await db
      .update(episode)
      .set({
        debut: instants.length ? new Date(Math.min(...instants)) : null,
        fin: instants.length ? new Date(Math.max(...instants)) : null,
      })
      .where(eq(episode.id, id));
  }
}

/** Propose un découpage automatique ; remplace les épisodes existants (titres et récits perdus). */
export async function proposerDecoupage(db: Db, voyageId: string) {
  const tz = await fuseau(db, voyageId);
  const medias = await mediasVisibles(db, voyageId);
  const { groupes } = decouper(medias, tz);
  await db.transaction(async (tx) => {
    await tx.update(media).set({ episodeId: null }).where(eq(media.voyageId, voyageId));
    await tx.delete(episode).where(eq(episode.voyageId, voyageId));
    for (const [i, g] of groupes.entries()) {
      const id = genererId();
      await tx.insert(episode).values({ id, voyageId, ordre: i + 1, titre: titreAuto(g.debut, g.fin, tz), debut: g.debut, fin: g.fin });
      for (let k = 0; k < g.ids.length; k += 500) {
        await tx.update(media).set({ episodeId: id }).where(inArray(media.id, g.ids.slice(k, k + 500)));
      }
    }
  });
  return groupes.length;
}

/**
 * Range les médias pas encore classés (nouveaux imports) dans l'épisode qui couvre leur heure,
 * ou à défaut le plus proche dans le temps. Les médias sans date restent non classés.
 */
export async function rangerNonClasses(db: Db, voyageId: string) {
  const eps = await db.query.episode.findMany({ where: eq(episode.voyageId, voyageId) });
  if (!eps.length) return 0;
  const orphelins = (await mediasVisibles(db, voyageId)).filter((m) => !m.episodeId && m.instant);
  const touches = new Set<string>();
  for (const m of orphelins) {
    const t = m.instant!.getTime();
    let meilleur: { id: string; d: number } | null = null;
    for (const e of eps) {
      if (!e.debut || !e.fin) continue;
      const d = t < e.debut.getTime() ? e.debut.getTime() - t : t > e.fin.getTime() ? t - e.fin.getTime() : 0;
      if (!meilleur || d < meilleur.d) meilleur = { id: e.id, d };
    }
    if (!meilleur) continue;
    await db.update(media).set({ episodeId: meilleur.id }).where(eq(media.id, m.id));
    touches.add(meilleur.id);
  }
  await majBornes(db, voyageId, [...touches]);
  return orphelins.length;
}

export async function episodesDe(db: Db, voyageId: string) {
  const eps = await db.query.episode.findMany({ where: eq(episode.voyageId, voyageId), orderBy: [asc(episode.ordre)] });
  const comptes = await db
    .select({ episodeId: media.episodeId, n: sql<number>`count(*)::int` })
    .from(media)
    .where(and(eq(media.voyageId, voyageId), eq(media.statut, "pret"), isNull(media.doublonDe), eq(media.masque, false)))
    .groupBy(media.episodeId);
  const n = new Map(comptes.map((c) => [c.episodeId, c.n]));
  return { episodes: eps.map((e) => ({ ...e, nbMedias: n.get(e.id) ?? 0 })), nonClasses: n.get(null) ?? 0 };
}

async function episodeDuVoyage(db: Db, voyageId: string, episodeId: string) {
  const e = await db.query.episode.findFirst({ where: and(eq(episode.id, episodeId), eq(episode.voyageId, voyageId)) });
  if (!e) throw new ErreurMetier("Épisode introuvable.");
  return e;
}

export async function modifierEpisode(
  db: Db,
  voyageId: string,
  episodeId: string,
  d: { titre: string; lieu?: string | null; recit?: string | null },
) {
  await episodeDuVoyage(db, voyageId, episodeId);
  const titre = d.titre.trim();
  if (!titre) throw new ErreurMetier("Le titre est obligatoire.");
  await db
    .update(episode)
    .set({ titre, lieu: d.lieu?.trim() || null, recit: d.recit?.trim() || null })
    .where(eq(episode.id, episodeId));
}

async function renumeroter(db: Db, voyageId: string) {
  const eps = await db.query.episode.findMany({ where: eq(episode.voyageId, voyageId), orderBy: [asc(episode.ordre)] });
  for (const [i, e] of eps.entries()) if (e.ordre !== i + 1) await db.update(episode).set({ ordre: i + 1 }).where(eq(episode.id, e.id));
  return eps;
}

/** Fusionne un épisode avec le suivant (le titre et le récit du premier sont gardés, le récit du second ajouté). */
export async function fusionnerAvecSuivant(db: Db, voyageId: string, episodeId: string) {
  const eps = await renumeroter(db, voyageId);
  const i = eps.findIndex((e) => e.id === episodeId);
  if (i < 0) throw new ErreurMetier("Épisode introuvable.");
  const suivant = eps[i + 1];
  if (!suivant) throw new ErreurMetier("C'est le dernier épisode.");
  await db.transaction(async (tx) => {
    await tx.update(media).set({ episodeId }).where(eq(media.episodeId, suivant.id));
    const recit = [eps[i].recit, suivant.recit].filter(Boolean).join("\n\n") || null;
    await tx.update(episode).set({ recit }).where(eq(episode.id, episodeId));
    await tx.delete(episode).where(eq(episode.id, suivant.id));
  });
  await renumeroter(db, voyageId);
  await majBornes(db, voyageId, [episodeId]);
}

/** Scinde un épisode : le média choisi et tous ceux qui le suivent forment un nouvel épisode. */
export async function scinder(db: Db, voyageId: string, episodeId: string, aPartirDe: string) {
  const e = await episodeDuVoyage(db, voyageId, episodeId);
  const medias = (await mediasVisibles(db, voyageId))
    .filter((m) => m.episodeId === episodeId)
    .sort((a, b) => (a.instant?.getTime() ?? Infinity) - (b.instant?.getTime() ?? Infinity) || a.id.localeCompare(b.id));
  const k = medias.findIndex((m) => m.id === aPartirDe);
  if (k <= 0) throw new ErreurMetier("Choisissez une photo qui n'est pas la première de l'épisode.");
  const tz = await fuseau(db, voyageId);
  const suite = medias.slice(k);
  const debut = suite.find((m) => m.instant)?.instant ?? null;
  const fin = [...suite].reverse().find((m) => m.instant)?.instant ?? null;
  const id = genererId();
  await db.transaction(async (tx) => {
    await tx.update(episode).set({ ordre: sql`${episode.ordre} + 1` }).where(and(eq(episode.voyageId, voyageId), sql`${episode.ordre} > ${e.ordre}`));
    await tx.insert(episode).values({
      id,
      voyageId,
      ordre: e.ordre + 1,
      titre: debut && fin ? titreAuto(debut, fin, tz) : `${e.titre} (suite)`,
      debut,
      fin,
    });
    await tx.update(media).set({ episodeId: id }).where(inArray(media.id, suite.map((m) => m.id)));
  });
  await majBornes(db, voyageId, [episodeId, id]);
  return id;
}

export async function deplacerEpisode(db: Db, voyageId: string, episodeId: string, sens: -1 | 1) {
  const eps = await renumeroter(db, voyageId);
  const i = eps.findIndex((e) => e.id === episodeId);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= eps.length) return;
  await db.update(episode).set({ ordre: j + 1 }).where(eq(episode.id, eps[i].id));
  await db.update(episode).set({ ordre: i + 1 }).where(eq(episode.id, eps[j].id));
}

/** Supprime un épisode : ses médias redeviennent « non classés ». */
export async function supprimerEpisode(db: Db, voyageId: string, episodeId: string) {
  await episodeDuVoyage(db, voyageId, episodeId);
  await db.update(media).set({ episodeId: null }).where(eq(media.episodeId, episodeId));
  await db.delete(episode).where(eq(episode.id, episodeId));
  await renumeroter(db, voyageId);
}

/** Déplace des médias vers un autre épisode (ou les sort de tout épisode avec null). */
export async function deplacerMedias(db: Db, voyageId: string, mediaIds: string[], versEpisodeId: string | null) {
  if (!mediaIds.length) return;
  if (versEpisodeId) await episodeDuVoyage(db, voyageId, versEpisodeId);
  const avant = await db
    .select({ episodeId: media.episodeId })
    .from(media)
    .where(and(eq(media.voyageId, voyageId), inArray(media.id, mediaIds)));
  await db
    .update(media)
    .set({ episodeId: versEpisodeId })
    .where(and(eq(media.voyageId, voyageId), inArray(media.id, mediaIds)));
  const touches = new Set([...avant.map((a) => a.episodeId), versEpisodeId].filter((x): x is string => !!x));
  await majBornes(db, voyageId, [...touches]);
}

/* ---------------------------- Sélection ------------------------------ */

export async function cocher(
  db: Db,
  voyageId: string,
  mediaIds: string[],
  champ: "dansSite" | "dansLivre",
  valeur: boolean,
) {
  if (!mediaIds.length) return;
  await db
    .update(media)
    .set({ [champ]: valeur })
    .where(and(eq(media.voyageId, voyageId), inArray(media.id, mediaIds)));
}

/* --------------------- Légendes, commentaires, réactions --------------------- */

/** Seul l'auteur de la photo écrit sa légende (l'administrateur peut la corriger). */
export async function legender(
  db: Db,
  ctx: { voyageId: string; userId: string; estAdmin: boolean },
  mediaId: string,
  legende: string,
) {
  const m = await db.query.media.findFirst({ where: and(eq(media.id, mediaId), eq(media.voyageId, ctx.voyageId)) });
  if (!m) throw new ErreurMetier("Photo introuvable.");
  if (m.auteurId !== ctx.userId && !ctx.estAdmin) {
    throw new ErreurMetier("La légende est écrite par la personne qui a proposé la photo. Ajoutez plutôt un commentaire.");
  }
  if (legende.length > 1000) throw new ErreurMetier("Légende trop longue (1 000 caractères au maximum).");
  await db.update(media).set({ legende: legende.trim() || null }).where(eq(media.id, mediaId));
}

async function mediaDuVoyage(db: Db, voyageId: string, mediaId: string) {
  const m = await db.query.media.findFirst({ where: and(eq(media.id, mediaId), eq(media.voyageId, voyageId)), columns: { id: true } });
  if (!m) throw new ErreurMetier("Photo introuvable.");
}

export async function commenter(db: Db, ctx: { voyageId: string; userId: string }, mediaId: string, texte: string) {
  await mediaDuVoyage(db, ctx.voyageId, mediaId);
  const t = texte.trim();
  if (!t) throw new ErreurMetier("Le commentaire est vide.");
  if (t.length > 2000) throw new ErreurMetier("Commentaire trop long.");
  const id = genererId();
  await db.insert(commentaire).values({ id, mediaId, auteurId: ctx.userId, texte: t });
  return id;
}

export async function supprimerCommentaire(
  db: Db,
  ctx: { voyageId: string; userId: string; estAdmin: boolean },
  commentaireId: string,
) {
  const [c] = await db
    .select({ id: commentaire.id, auteurId: commentaire.auteurId })
    .from(commentaire)
    .innerJoin(media, eq(media.id, commentaire.mediaId))
    .where(and(eq(commentaire.id, commentaireId), eq(media.voyageId, ctx.voyageId)));
  if (!c) throw new ErreurMetier("Commentaire introuvable.");
  if (c.auteurId !== ctx.userId && !ctx.estAdmin) throw new ErreurMetier("Vous ne pouvez supprimer que vos commentaires.");
  await db.delete(commentaire).where(eq(commentaire.id, commentaireId));
}

/** Ajoute la réaction, ou la retire si elle existait déjà. */
export async function basculerReaction(db: Db, ctx: { voyageId: string; userId: string }, mediaId: string, emoji: string) {
  if (!(EMOJIS as readonly string[]).includes(emoji)) throw new ErreurMetier("Réaction inconnue.");
  await mediaDuVoyage(db, ctx.voyageId, mediaId);
  const cond = and(eq(reaction.mediaId, mediaId), eq(reaction.userId, ctx.userId), eq(reaction.emoji, emoji));
  const existe = await db.select({ e: reaction.emoji }).from(reaction).where(cond).limit(1);
  if (existe.length) {
    await db.delete(reaction).where(cond);
    return false;
  }
  await db.insert(reaction).values({ mediaId, userId: ctx.userId, emoji });
  return true;
}

export type DetailMedia = {
  id: string;
  legende: string | null;
  auteurId: string | null;
  auteur: string | null;
  dansSite: boolean;
  dansLivre: boolean;
  episodeId: string | null;
  commentaires: { id: string; texte: string; auteur: string | null; auteurId: string | null; le: string }[];
  reactions: { emoji: string; nb: number; moi: boolean; qui: string[] }[];
};

export async function detailMedia(db: Db, ctx: { voyageId: string; userId: string }, mediaId: string): Promise<DetailMedia> {
  const [m] = await db
    .select({
      id: media.id,
      legende: media.legende,
      auteurId: media.auteurId,
      auteur: user.name,
      dansSite: media.dansSite,
      dansLivre: media.dansLivre,
      episodeId: media.episodeId,
    })
    .from(media)
    .leftJoin(user, eq(user.id, media.auteurId))
    .where(and(eq(media.id, mediaId), eq(media.voyageId, ctx.voyageId)));
  if (!m) throw new ErreurMetier("Photo introuvable.");
  const coms = await db
    .select({ id: commentaire.id, texte: commentaire.texte, auteur: user.name, auteurId: commentaire.auteurId, le: commentaire.createdAt })
    .from(commentaire)
    .leftJoin(user, eq(user.id, commentaire.auteurId))
    .where(eq(commentaire.mediaId, mediaId))
    .orderBy(asc(commentaire.createdAt));
  const reacs = await db
    .select({ emoji: reaction.emoji, userId: reaction.userId, nom: user.name })
    .from(reaction)
    .innerJoin(user, eq(user.id, reaction.userId))
    .where(eq(reaction.mediaId, mediaId));
  const parEmoji = new Map<string, { nb: number; moi: boolean; qui: string[] }>();
  for (const r of reacs) {
    const e = parEmoji.get(r.emoji) ?? { nb: 0, moi: false, qui: [] };
    e.nb++;
    e.qui.push(r.nom);
    if (r.userId === ctx.userId) e.moi = true;
    parEmoji.set(r.emoji, e);
  }
  return {
    ...m,
    commentaires: coms.map((c) => ({ ...c, le: c.le.toISOString() })),
    reactions: EMOJIS.filter((e) => parEmoji.has(e)).map((e) => ({ emoji: e, ...parEmoji.get(e)! })),
  };
}

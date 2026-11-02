/**
 * Livre photo : lecture des photos retenues, enregistrement du livre (avec détection des
 * éditions simultanées) et historique des versions.
 */
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { schemaLivre, type EpisodeLivre, type Livre, type MediaLivre } from "@/lib/livre/modele";
import { geometrie, tailleSortie } from "@/lib/rendu/geometrie";
import { schemaRetouche } from "@/lib/rendu/parametres";
import type { Db } from "../db/client";
import { appareil, commentaire, episode, livre, media, user, versionLivre } from "../db/schema";
import { genererId } from "./crypto";
import type { UrlMedia } from "./medias";
import { instantCorrige, trierChronologiquement } from "./temps";
import { ErreurMetier } from "./voyages";

export const VERSIONS_MAX = 60;

/** Dimensions utiles d'une photo après retouche (recadrage, redressement). */
export function dimensionsEffectives(largeur: number, hauteur: number, retouche: unknown): [number, number] {
  const r = retouche ? schemaRetouche.safeParse(retouche) : null;
  if (!r?.success) return [largeur, hauteur];
  const g = geometrie(r.data, largeur, hauteur);
  const [l, h] = tailleSortie(g, Number.POSITIVE_INFINITY);
  // Le redressement agrandit l'image pour masquer les coins : autant de résolution en moins.
  return [Math.round(l / g.zoom), Math.round(h / g.zoom)];
}

/** Photos cochées pour le livre (jamais de vidéo), dans l'ordre chronologique. */
export async function mediasDuLivre(db: Db, url: UrlMedia, voyageId: string): Promise<MediaLivre[]> {
  const lignes = await db
    .select({
      id: media.id,
      nomFichier: media.nomFichier,
      largeur: media.largeur,
      hauteur: media.hauteur,
      retouche: media.retouche,
      versions: media.versions,
      episodeId: media.episodeId,
      legende: media.legende,
      auteur: user.name,
      vedette: media.vedette,
      nettete: media.nettete,
      priseUtc: media.priseUtc,
      decalage: appareil.decalageSecondes,
    })
    .from(media)
    .leftJoin(user, eq(user.id, media.auteurId))
    .leftJoin(appareil, eq(appareil.id, media.appareilId))
    .where(
      and(
        eq(media.voyageId, voyageId),
        eq(media.statut, "pret"),
        eq(media.type, "photo"),
        eq(media.dansLivre, true),
        isNull(media.doublonDe),
      ),
    );
  const tries = trierChronologiquement(lignes.map((l) => ({ ...l, instant: instantCorrige(l.priseUtc, l.decalage ?? 0) })));
  const ids = tries.map((l) => l.id);
  const coms = ids.length
    ? await db
        .select({ mediaId: commentaire.mediaId, texte: commentaire.texte })
        .from(commentaire)
        .where(inArray(commentaire.mediaId, ids))
        .orderBy(asc(commentaire.createdAt))
    : [];
  const comsPar = new Map<string, string[]>();
  for (const c of coms) comsPar.set(c.mediaId, [...(comsPar.get(c.mediaId) ?? []), c.texte]);
  return tries
      .filter((l) => l.largeur && l.hauteur)
      .map((l) => {
        const [largeur, hauteur] = dimensionsEffectives(l.largeur!, l.hauteur!, l.retouche);
        return {
          id: l.id,
          largeur,
          hauteur,
          episodeId: l.episodeId,
          instant: l.instant?.toISOString() ?? null,
          legende: l.legende,
          auteur: l.auteur,
          vedette: l.vedette,
          qualite: l.nettete,
          vignette: (l.versions.rs ?? l.versions.s) ? url(l.id, "s", (l.versions.rs ?? l.versions.s)!) : null,
          moyenne: (l.versions.rm ?? l.versions.m) ? url(l.id, "m", (l.versions.rm ?? l.versions.m)!) : null,
          commentaires: comsPar.get(l.id) ?? [],
        };
      });
}

export async function episodesDuLivre(db: Db, voyageId: string): Promise<EpisodeLivre[]> {
  const eps = await db.query.episode.findMany({ where: eq(episode.voyageId, voyageId), orderBy: [asc(episode.ordre)] });
  return eps.map((e) => ({
    id: e.id,
    titre: e.titre,
    lieu: e.lieu,
    recit: e.recit,
    debut: e.debut?.toISOString() ?? null,
    fin: e.fin?.toISOString() ?? null,
  }));
}

export async function livreDe(db: Db, voyageId: string): Promise<{ contenu: Livre; revision: number } | null> {
  const l = await db.query.livre.findFirst({ where: eq(livre.voyageId, voyageId) });
  if (!l) return null;
  const r = schemaLivre.safeParse(l.contenu);
  return r.success ? { contenu: r.data, revision: l.revision } : null;
}

async function verifierPhotos(db: Db, voyageId: string, l: Livre) {
  const ids = new Set(l.pages.flatMap((p) => p.cellules.filter((c) => !!c).map((c) => c!.mediaId)));
  if (l.couverture.photo) ids.add(l.couverture.photo.mediaId);
  if (!ids.size) return;
  const trouves = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.voyageId, voyageId), inArray(media.id, [...ids])));
  if (trouves.length !== ids.size) throw new ErreurMetier("Le livre contient une photo qui n’appartient pas à ce voyage.");
}

/**
 * Enregistre le livre. `revision` est celle que l'éditeur a chargée : si quelqu'un a enregistré
 * entre-temps, on refuse plutôt que d'écraser son travail.
 */
export async function enregistrerLivre(db: Db, ctx: { voyageId: string; userId: string }, brut: unknown, revision: number | null) {
  const r = schemaLivre.safeParse(brut);
  if (!r.success) throw new ErreurMetier("Livre invalide.");
  await verifierPhotos(db, ctx.voyageId, r.data);
  const actuel = await db.query.livre.findFirst({ where: eq(livre.voyageId, ctx.voyageId), columns: { revision: true } });
  if (!actuel) {
    await db.insert(livre).values({ voyageId: ctx.voyageId, contenu: r.data, revision: 1, modifiePar: ctx.userId });
    return 1;
  }
  if (revision !== actuel.revision) {
    throw new ErreurMetier("Le livre a été modifié par quelqu’un d’autre entre-temps : rechargez la page pour voir ses changements.");
  }
  const suivante = actuel.revision + 1;
  const maj = await db
    .update(livre)
    .set({ contenu: r.data, revision: suivante, modifiePar: ctx.userId, updatedAt: new Date() })
    .where(and(eq(livre.voyageId, ctx.voyageId), eq(livre.revision, actuel.revision)))
    .returning({ revision: livre.revision });
  if (!maj.length) throw new ErreurMetier("Le livre a été modifié par quelqu’un d’autre entre-temps : rechargez la page.");
  return suivante;
}

export async function creerVersion(db: Db, ctx: { voyageId: string; userId: string }, libelle: string) {
  const l = await db.query.livre.findFirst({ where: eq(livre.voyageId, ctx.voyageId) });
  if (!l) throw new ErreurMetier("Le livre n’existe pas encore.");
  const id = genererId();
  await db.insert(versionLivre).values({
    id,
    voyageId: ctx.voyageId,
    libelle: libelle.trim().slice(0, 120) || "Version",
    contenu: l.contenu,
    creePar: ctx.userId,
  });
  // On garde les plus récentes.
  const toutes = await db
    .select({ id: versionLivre.id })
    .from(versionLivre)
    .where(eq(versionLivre.voyageId, ctx.voyageId))
    .orderBy(desc(versionLivre.createdAt));
  const trop = toutes.slice(VERSIONS_MAX).map((v) => v.id);
  if (trop.length) await db.delete(versionLivre).where(inArray(versionLivre.id, trop));
  return id;
}

export async function versionsDe(db: Db, voyageId: string) {
  const v = await db
    .select({ id: versionLivre.id, libelle: versionLivre.libelle, le: versionLivre.createdAt, auteur: user.name, contenu: versionLivre.contenu })
    .from(versionLivre)
    .leftJoin(user, eq(user.id, versionLivre.creePar))
    .where(eq(versionLivre.voyageId, voyageId))
    .orderBy(desc(versionLivre.createdAt));
  return v.map(({ contenu, le, ...x }) => ({
    ...x,
    le: le.toISOString(),
    pages: Array.isArray((contenu as { pages?: unknown[] }).pages) ? (contenu as { pages: unknown[] }).pages.length : 0,
  }));
}

/** Revient à une version ; l'état courant est d'abord sauvegardé, on peut donc annuler. */
export async function restaurerVersion(db: Db, ctx: { voyageId: string; userId: string }, versionId: string) {
  const v = await db.query.versionLivre.findFirst({ where: and(eq(versionLivre.id, versionId), eq(versionLivre.voyageId, ctx.voyageId)) });
  if (!v) throw new ErreurMetier("Version introuvable.");
  await creerVersion(db, ctx, `Avant le retour à « ${v.libelle} »`);
  const actuel = await db.query.livre.findFirst({ where: eq(livre.voyageId, ctx.voyageId), columns: { revision: true } });
  const revision = (actuel?.revision ?? 0) + 1;
  await db.update(livre).set({ contenu: v.contenu, revision, modifiePar: ctx.userId, updatedAt: new Date() }).where(eq(livre.voyageId, ctx.voyageId));
  return revision;
}

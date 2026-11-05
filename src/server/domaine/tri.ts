/**
 * Écran « Trier » : les photos du voyage moment par moment, une décision par photo
 * (écartée, site seul, site et livre, coup de cœur), l'aide de l'IA pour choisir dans une série.
 */
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { media, rafaleIa } from "../db/schema";
import { enregistrerDepense, verifierBudget } from "../ia/budget";
import type { AppelIa } from "../ia/client";
import { CANDIDATES_MAX, ESTIMATION_USD, avisIa, demanderChoix } from "../ia/rafales";
import type { Stockage } from "../stockage/types";
import { galerie, type MediaGalerie, type UrlMedia } from "./medias";
import { ErreurMetier } from "./voyages";

export type MediaTri = MediaGalerie & {
  /** Grande version (retouchée si elle existe) pour juger la photo. */
  grande: string | null;
  dhash: string | null;
  rafaleId: string | null;
  nettete: number | null;
  exposition: number | null;
  trie: boolean;
  /** L'utilisateur peut la retoucher (auteur ou administrateur). */
  retouchable: boolean;
};

export async function donneesTri(db: Db, url: UrlMedia, ctx: { voyageId: string; userId: string; estAdmin: boolean }) {
  const base = await galerie(db, url, ctx.voyageId);
  const extra = base.length
    ? await db.query.media.findMany({
        where: and(eq(media.voyageId, ctx.voyageId), inArray(media.id, base.map((m) => m.id))),
        columns: { id: true, dhash: true, rafaleId: true, nettete: true, exposition: true, trie: true, auteurId: true, versions: true },
      })
    : [];
  const parId = new Map(extra.map((e) => [e.id, e]));
  const medias: MediaTri[] = base.map((m) => {
    const e = parId.get(m.id)!;
    const cleGrande = e.versions.rl ?? e.versions.l;
    return {
      ...m,
      grande: m.type === "photo" && cleGrande ? url(m.id, "l", cleGrande) : m.moyenne,
      dhash: e.dhash,
      rafaleId: e.rafaleId,
      nettete: e.nettete,
      exposition: e.exposition,
      trie: e.trie,
      retouchable: m.type === "photo" && (ctx.estAdmin || e.auteurId === ctx.userId),
    };
  });
  return { medias, avis: Object.fromEntries(await avisIa(db, ctx.voyageId)) as Record<string, string> };
}

export type DecisionTri = { id: string; dansSite: boolean; dansLivre: boolean; vedette?: boolean; trie: boolean };

/** Enregistre des décisions (ou les annule : on renvoie alors l'état d'avant, avec `trie: false`). */
export async function trier(db: Db, ctx: { voyageId: string; estAdmin: boolean }, decisions: DecisionTri[]) {
  if (!decisions.length) return;
  if (!ctx.estAdmin && decisions.some((d) => d.vedette !== undefined)) {
    throw new ErreurMetier("Seuls les administrateurs choisissent les coups de cœur du site.");
  }
  const ids = decisions.map((d) => d.id);
  const lignes = await db.query.media.findMany({
    where: and(eq(media.voyageId, ctx.voyageId), inArray(media.id, ids)),
    columns: { id: true, rafaleId: true },
  });
  if (lignes.length !== new Set(ids).size) throw new ErreurMetier("Photo introuvable.");
  const rafale = new Map(lignes.map((l) => [l.id, l.rafaleId]));
  await db.transaction(async (tx) => {
    for (const d of decisions) {
      await tx
        .update(media)
        .set({
          dansSite: d.dansSite,
          dansLivre: d.dansLivre,
          trie: d.trie,
          ...(d.vedette !== undefined ? { vedette: d.vedette } : {}),
          // Dans une rafale, un choix fait ici est un choix manuel : l'IA et la détection n'y reviennent pas.
          ...(rafale.get(d.id) ? { choixRafale: d.dansSite, choixManuel: d.trie } : {}),
        })
        .where(and(eq(media.id, d.id), eq(media.voyageId, ctx.voyageId)));
    }
  });
}

/** Demande à l'IA la meilleure photo d'une série. Ne change rien : la suggestion s'affiche, on décide. */
export async function avisIaMoment(db: Db, stockage: Stockage, appel: AppelIa, voyageId: string, ids: string[], o: { plafondEur?: number } = {}) {
  const lignes = await db.query.media.findMany({
    where: and(eq(media.voyageId, voyageId), inArray(media.id, ids), eq(media.type, "photo")),
    columns: { id: true, versions: true },
  });
  const ordre = new Map(ids.map((id, i) => [id, i]));
  const candidates = lignes
    .filter((l) => l.versions.m)
    .sort((a, b) => ordre.get(a.id)! - ordre.get(b.id)!)
    .slice(0, CANDIDATES_MAX);
  if (candidates.length < 2) throw new ErreurMetier("Il faut au moins deux photos à comparer.");
  await verifierBudget(db, ESTIMATION_USD, o.plafondEur);
  const images = await Promise.all(candidates.map(async (c) => ({ donnees: await stockage.lire(c.versions.m!) })));
  const { choix, usage } = await demanderChoix(appel, images);
  await enregistrerDepense(db, { voyageId, usage: "rafale", u: usage });
  if (!choix) return { mediaId: null, raison: "L’IA n’a pas su trancher : à vous de choisir." };
  const retenue = candidates[choix.index].id;
  // Gardé pour la prochaine visite (même table que les rafales, clé propre à la série).
  await db
    .insert(rafaleIa)
    .values({ voyageId, rafaleId: `serie:${candidates.map((c) => c.id).join(",")}`.slice(0, 500), mediaId: retenue, raison: choix.raison })
    .onConflictDoUpdate({ target: [rafaleIa.voyageId, rafaleIa.rafaleId], set: { mediaId: retenue, raison: choix.raison } });
  return { mediaId: retenue, raison: choix.raison, comparees: candidates.length };
}

/** Médias encore à trier (pour l'appel sur la page Photos). */
export async function compterATrier(db: Db, voyageId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(media)
    .where(and(eq(media.voyageId, voyageId), eq(media.statut, "pret"), isNull(media.doublonDe), eq(media.trie, false)));
  return r?.n ?? 0;
}

/**
 * Aperçus manquants : photos importées sans versions web (par exemple des HEIC d'iPhone quand
 * le décodage échouait dans le navigateur). Le navigateur relit l'original, recalcule les versions
 * et les envoie ; le serveur vérifie qu'elles sont arrivées. L'original n'est jamais modifié.
 */
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client";
import { media, type VersionsWeb } from "../db/schema";
import { cles, type Stockage } from "../stockage/types";
import { urlsVersions } from "./medias";
import { ErreurMetier } from "./voyages";

type Ctx = { voyageId: string; userId: string; estAdmin: boolean };
const NOMS = ["s", "m", "l"] as const;

const sansApercu = (ctx: Ctx) =>
  and(
    eq(media.voyageId, ctx.voyageId),
    eq(media.type, "photo"),
    eq(media.statut, "pret"),
    sql`${media.versions}->>'s' is null`,
    ctx.estAdmin ? undefined : eq(media.auteurId, ctx.userId),
  );

/** Photos sans aperçu que cette personne peut réparer (les siennes ; toutes pour un administrateur). */
export async function photosSansApercu(db: Db, stockage: Stockage, ctx: Ctx) {
  const l = await db.query.media.findMany({ where: sansApercu(ctx), columns: { id: true, nomFichier: true, cleOriginal: true, mime: true } });
  return Promise.all(l.map(async (m) => ({ id: m.id, nom: m.nomFichier, mime: m.mime, url: await stockage.urlLecture(m.cleOriginal, 3600) })));
}

export async function compterSansApercu(db: Db, ctx: Ctx) {
  return db.$count(media, sansApercu(ctx));
}

async function photo(db: Db, ctx: Ctx, mediaId: string) {
  const m = await db.query.media.findFirst({ where: and(eq(media.id, mediaId), sansApercu(ctx)) });
  if (!m) throw new ErreurMetier("Photo introuvable ou déjà pourvue d’un aperçu.");
  return m;
}

export async function preparerApercu(db: Db, stockage: Stockage, ctx: Ctx, mediaId: string) {
  await photo(db, ctx, mediaId);
  return { versions: await urlsVersions(stockage, ctx.voyageId, mediaId, [...NOMS]) };
}

export const schemaMesures = z.object({
  largeur: z.number().int().positive().max(100_000),
  hauteur: z.number().int().positive().max(100_000),
  dhash: z.string().regex(/^[0-9a-f]{16}$/).nullable(),
  nettete: z.number().min(0).max(1).nullable(),
  exposition: z.number().min(0).max(1).nullable(),
});

/** Enregistre les versions reçues (au moins la vignette) et les mesures de la photo. */
export async function enregistrerApercu(db: Db, stockage: Stockage, ctx: Ctx, mediaId: string, mesures: z.infer<typeof schemaMesures>) {
  const m = await photo(db, ctx, mediaId);
  const versions: VersionsWeb = { ...m.versions };
  for (const n of NOMS) {
    const cle = cles.version(ctx.voyageId, mediaId, n, "webp");
    if ((await stockage.taille(cle)) !== null) versions[n] = cle;
  }
  if (!versions.s) throw new ErreurMetier("La vignette n’a pas été reçue.");
  const v = schemaMesures.parse(mesures);
  await db
    .update(media)
    .set({ versions, largeur: v.largeur, hauteur: v.hauteur, dhash: m.dhash ?? v.dhash, nettete: v.nettete, exposition: v.exposition })
    .where(eq(media.id, mediaId));
}


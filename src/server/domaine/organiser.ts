/**
 * Organiser les photos une à une : les masquer (dossier « Photos masquées »), les remettre dans l'ordre
 * voulu à l'intérieur d'une journée.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { appareil, media } from "../db/schema";
import { instantCorrige } from "./temps";
import { ErreurMetier } from "./voyages";

type Ctx = { voyageId: string; userId: string; estAdmin: boolean };

/** Masque ou réaffiche des médias. L'administrateur masque tout ; un participant, ses propres photos. */
export async function masquer(db: Db, ctx: Ctx, ids: string[], valeur: boolean) {
  if (!ids.length) return 0;
  const lignes = await db.query.media.findMany({
    where: and(eq(media.voyageId, ctx.voyageId), inArray(media.id, ids)),
    columns: { id: true, auteurId: true },
  });
  if (lignes.length !== new Set(ids).size) throw new ErreurMetier("Photo introuvable.");
  if (!ctx.estAdmin && lignes.some((l) => l.auteurId !== ctx.userId)) {
    throw new ErreurMetier("Seuls l’auteur de la photo et l’administrateur peuvent la masquer.");
  }
  // Une photo masquée n'est plus mise en avant sur le site.
  await db
    .update(media)
    .set(valeur ? { masque: true, vedette: false } : { masque: false })
    .where(and(eq(media.voyageId, ctx.voyageId), inArray(media.id, ids)));
  return ids.length;
}

/**
 * Nouvel ordre d'une journée (tous ses médias, dans l'ordre voulu) : chacun reçoit comme rang une des heures
 * de la journée, redistribuées dans ce nouvel ordre. Les heures réelles ne changent pas, et une photo ajoutée
 * plus tard s'insère à sa place chronologique.
 */
export async function reordonner(db: Db, ctx: Ctx, ids: string[]) {
  if (!ctx.estAdmin) throw new ErreurMetier("Seul l’administrateur réordonne les photos.");
  if (ids.length < 2) return;
  if (new Set(ids).size !== ids.length) throw new ErreurMetier("Ordre invalide.");
  const lignes = await db
    .select({ id: media.id, priseUtc: media.priseUtc, rang: media.rang, decalage: appareil.decalageSecondes })
    .from(media)
    .leftJoin(appareil, eq(appareil.id, media.appareilId))
    .where(and(eq(media.voyageId, ctx.voyageId), inArray(media.id, ids)));
  if (lignes.length !== ids.length) throw new ErreurMetier("Photo introuvable.");
  const cles = lignes.map((l) => l.rang ?? instantCorrige(l.priseUtc, l.decalage ?? 0));
  if (cles.some((c) => !c)) throw new ErreurMetier("Datez d’abord ces photos.");
  const heures = (cles as Date[]).map((d) => d.getTime()).sort((a, b) => a - b);
  // Heures égales (rafales à la seconde près) : on les écarte d'une milliseconde pour garder l'ordre.
  for (let i = 1; i < heures.length; i++) if (heures[i] <= heures[i - 1]) heures[i] = heures[i - 1] + 1;
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx.update(media).set({ rang: new Date(heures[i]) }).where(and(eq(media.id, id), eq(media.voyageId, ctx.voyageId)));
    }
  });
}

/** Une nouvelle date efface la place choisie à la main (la photo change de journée). */
export async function oublierRang(db: Db, voyageId: string, ids: string[]) {
  if (ids.length) await db.update(media).set({ rang: null }).where(and(eq(media.voyageId, voyageId), inArray(media.id, ids)));
}

/**
 * Rafales : plusieurs photos de la même scène prises à quelques secondes d'écart.
 * On les regroupe, on propose la meilleure (netteté, exposition) et on écarte les autres
 * du site et du livre ; un clic suffit pour en préférer une autre.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { scoreQualite } from "../../lib/qualite";
import type { Db } from "../db/client";
import { media } from "../db/schema";
import { distanceHamming } from "./doublons";
import { ErreurMetier } from "./voyages";

export const ECART_RAFALE_MS = 10_000;
export const SEUIL_SCENE = 22;

export type PhotoRafale = {
  id: string;
  instant: Date | null;
  appareilId: string | null;
  dhash: string | null;
  nettete: number | null;
  exposition: number | null;
};

/** Groupes de 2 photos ou plus : même appareil, ≤ 10 s d'écart entre voisines, même scène. */
export function grouperRafales(photos: PhotoRafale[]): PhotoRafale[][] {
  const triees = photos
    .filter((p) => p.instant)
    .sort((a, b) => (a.appareilId ?? "").localeCompare(b.appareilId ?? "") || a.instant!.getTime() - b.instant!.getTime());
  const groupes: PhotoRafale[][] = [];
  let courant: PhotoRafale[] = [];
  for (const p of triees) {
    const prec = courant[courant.length - 1];
    const memeRafale =
      prec &&
      prec.appareilId === p.appareilId &&
      p.instant!.getTime() - prec.instant!.getTime() <= ECART_RAFALE_MS &&
      (!prec.dhash || !p.dhash || distanceHamming(prec.dhash, p.dhash) <= SEUIL_SCENE);
    if (!memeRafale) {
      if (courant.length > 1) groupes.push(courant);
      courant = [];
    }
    courant.push(p);
  }
  if (courant.length > 1) groupes.push(courant);
  return groupes;
}

/** La meilleure photo d'un groupe ; à égalité, la première. */
export function meilleurePhoto(groupe: PhotoRafale[]): PhotoRafale {
  return groupe.reduce((m, p) => (scoreQualite(p) > scoreQualite(m) ? p : m));
}

/**
 * (Re)détecte les rafales du voyage. Un choix déjà fait à la main est conservé ;
 * seules les photos nouvellement groupées voient leurs cases « site » et « livre » décochées.
 */
export async function detecterRafales(db: Db, voyageId: string) {
  const lignes = await db.query.media.findMany({
    where: and(eq(media.voyageId, voyageId), eq(media.type, "photo"), eq(media.statut, "pret"), isNull(media.doublonDe)),
    columns: { id: true, priseUtc: true, appareilId: true, dhash: true, nettete: true, exposition: true, rafaleId: true, choixRafale: true },
  });
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const groupes = grouperRafales(lignes.map((l) => ({ ...l, instant: l.priseUtc })));
  const dansUnGroupe = new Set(groupes.flat().map((p) => p.id));

  await db.transaction(async (tx) => {
    // Photos qui ne sont plus dans aucune rafale.
    const sorties = lignes.filter((l) => l.rafaleId && !dansUnGroupe.has(l.id)).map((l) => l.id);
    if (sorties.length) await tx.update(media).set({ rafaleId: null, choixRafale: false, choixManuel: false }).where(inArray(media.id, sorties));

    for (const g of groupes) {
      const rafaleId = g[0].id;
      const choixManuel = g.find((p) => parId.get(p.id)!.choixRafale && parId.get(p.id)!.rafaleId);
      const choix = choixManuel ?? meilleurePhoto(g);
      for (const p of g) {
        const avant = parId.get(p.id)!;
        const nouvelle = !avant.rafaleId;
        const retenue = p.id === choix.id;
        await tx
          .update(media)
          .set({
            rafaleId,
            choixRafale: retenue,
            ...(nouvelle ? { dansSite: retenue, dansLivre: retenue } : {}),
          })
          .where(eq(media.id, p.id));
      }
    }
  });
  return { rafales: groupes.length, photos: dansUnGroupe.size };
}

/** Préfère une autre photo de la rafale : elle passe dans le site et le livre, les autres en sortent. */
export async function choisirDansRafale(db: Db, voyageId: string, mediaId: string) {
  const m = await db.query.media.findFirst({ where: and(eq(media.id, mediaId), eq(media.voyageId, voyageId)) });
  if (!m?.rafaleId) throw new ErreurMetier("Cette photo ne fait pas partie d'une rafale.");
  await db.transaction(async (tx) => {
    await tx
      .update(media)
      .set({ choixRafale: false, choixManuel: false, dansSite: false, dansLivre: false })
      .where(and(eq(media.voyageId, voyageId), eq(media.rafaleId, m.rafaleId!)));
    await tx.update(media).set({ choixRafale: true, choixManuel: true, dansSite: true, dansLivre: true }).where(eq(media.id, mediaId));
  });
}

/** Rafales du voyage, pour l'écran de choix. */
export async function rafalesDe(db: Db, voyageId: string) {
  const lignes = await db.query.media.findMany({
    where: and(eq(media.voyageId, voyageId), eq(media.statut, "pret"), isNull(media.doublonDe)),
    columns: { id: true, rafaleId: true, choixRafale: true, nettete: true, exposition: true, versions: true, nomFichier: true, priseUtc: true },
  });
  const groupes = new Map<string, typeof lignes>();
  for (const l of lignes) if (l.rafaleId) groupes.set(l.rafaleId, [...(groupes.get(l.rafaleId) ?? []), l]);
  return {
    rafales: [...groupes.values()]
      .map((g) => g.sort((a, b) => (a.priseUtc?.getTime() ?? 0) - (b.priseUtc?.getTime() ?? 0)))
      .sort((a, b) => (a[0].priseUtc?.getTime() ?? 0) - (b[0].priseUtc?.getTime() ?? 0)),
    // Photos importées avant la mesure de qualité : à mesurer depuis le navigateur.
    aMesurer: lignes.filter((l) => l.nettete === null && l.versions.m).map((l) => ({ id: l.id, cle: l.versions.m! })),
  };
}

export async function enregistrerQualite(db: Db, voyageId: string, mesures: { id: string; nettete: number; exposition: number }[]) {
  for (const m of mesures) {
    await db
      .update(media)
      .set({ nettete: m.nettete, exposition: m.exposition })
      .where(and(eq(media.id, m.id), eq(media.voyageId, voyageId)));
  }
}

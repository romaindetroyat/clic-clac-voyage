/**
 * Photos et vidéos sans date de prise de vue : les relire, deviner leur date d'après leurs voisines
 * (même série de noms de fichiers, IMG_1233 → IMG_1236), ou la donner à la main.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client";
import { appareil, media, voyage } from "../db/schema";
import type { Stockage } from "../stockage/types";
import { trouverOuCreerAppareil, type UrlMedia } from "./medias";
import { rangerNonClasses } from "./recit";
import { heureLocale, instantCorrige, priseVersUtc } from "./temps";
import { ErreurMetier } from "./voyages";

type Ctx = { voyageId: string; userId: string; estAdmin: boolean };

/** Écart maximal de numéro pour proposer la date d'une seule voisine. */
export const ECART_UNE_VOISINE = 30;

export type Numerotee = { id: string; nomFichier: string; auteurId: string | null; instant: Date | null };
export type Suggestion = { id: string; instant: Date; raison: string };

/** « IMG_1234.HEIC » → { serie: "img_", numero: 1234 } ; null si le nom ne se termine pas par un numéro. */
export function numeroDeFichier(nom: string): { serie: string; numero: number } | null {
  const m = /^(.*?)(\d{2,})(?:\s*\(\d+\))?(?:\.[a-z0-9]+)?$/i.exec(nom.trim());
  return m ? { serie: m[1].toLowerCase(), numero: Number(m[2]) } : null;
}

/**
 * Date probable de chaque média sans date, d'après les médias datés de la même série (même début
 * de nom, même auteur) : entre deux voisines, on interpole selon le numéro ; avec une seule voisine
 * proche, on prend son heure (± 1 s par numéro d'écart).
 */
export function suggererDates(sansDate: Numerotee[], dates: Numerotee[]): Suggestion[] {
  const series = new Map<string, { numero: number; instant: Date; nom: string }[]>();
  const cle = (serie: string, auteur: string | null) => `${auteur ?? ""}|${serie}`;
  for (const d of dates) {
    const n = numeroDeFichier(d.nomFichier);
    if (!n || !d.instant) continue;
    const k = cle(n.serie, d.auteurId);
    series.set(k, [...(series.get(k) ?? []), { numero: n.numero, instant: d.instant, nom: d.nomFichier }]);
  }
  for (const l of series.values()) l.sort((a, b) => a.numero - b.numero);

  const res: Suggestion[] = [];
  for (const s of sansDate) {
    const n = numeroDeFichier(s.nomFichier);
    if (!n) continue;
    const l = series.get(cle(n.serie, s.auteurId));
    if (!l) continue;
    const avant = [...l].reverse().find((x) => x.numero < n.numero);
    const apres = l.find((x) => x.numero > n.numero);
    if (avant && apres && apres.instant >= avant.instant) {
      const f = (n.numero - avant.numero) / (apres.numero - avant.numero);
      const t = avant.instant.getTime() + f * (apres.instant.getTime() - avant.instant.getTime());
      res.push({ id: s.id, instant: new Date(Math.round(t / 1000) * 1000), raison: `entre ${avant.nom} et ${apres.nom}` });
    } else {
      const proche = [avant, apres]
        .filter((x): x is NonNullable<typeof x> => !!x && Math.abs(x.numero - n.numero) <= ECART_UNE_VOISINE)
        .sort((a, b) => Math.abs(a.numero - n.numero) - Math.abs(b.numero - n.numero))[0];
      if (proche) res.push({ id: s.id, instant: new Date(proche.instant.getTime() + (n.numero - proche.numero) * 1000), raison: `près de ${proche.nom}` });
    }
  }
  return res;
}

async function lignesVisibles(db: Db, voyageId: string) {
  const lignes = await db
    .select({
      id: media.id,
      type: media.type,
      nomFichier: media.nomFichier,
      auteurId: media.auteurId,
      priseUtc: media.priseUtc,
      versions: media.versions,
      cleOriginal: media.cleOriginal,
      mime: media.mime,
      decalage: appareil.decalageSecondes,
    })
    .from(media)
    .leftJoin(appareil, eq(appareil.id, media.appareilId))
    .where(and(eq(media.voyageId, voyageId), eq(media.statut, "pret"), isNull(media.doublonDe)));
  return lignes.map((l) => ({ ...l, instant: instantCorrige(l.priseUtc, l.decalage ?? 0) }));
}

const peutModifier = (ctx: Ctx, auteurId: string | null) => ctx.estAdmin || auteurId === ctx.userId;

/** Tout ce qu'il faut à l'écran « Dates à fixer ». */
export async function etatDates(db: Db, url: UrlMedia, ctx: Ctx) {
  const v = await db.query.voyage.findFirst({ where: eq(voyage.id, ctx.voyageId) });
  const toutes = await lignesVisibles(db, ctx.voyageId);
  const sansDate = toutes.filter((l) => !l.instant);
  const datees = toutes.filter((l) => l.instant);
  const suggestions = new Map(suggererDates(sansDate, datees).map((s) => [s.id, s]));

  // Jours proposés : ceux du voyage (dates de début et de fin), sinon ceux qui ont déjà des photos.
  const fuseau = v?.fuseau ?? "Europe/Paris";
  const jourDe = (d: Date) => heureLocale(d, fuseau).slice(0, 10);
  const comptes = new Map<string, number>();
  for (const d of datees) comptes.set(jourDe(d.instant!), (comptes.get(jourDe(d.instant!)) ?? 0) + 1);
  const jours = new Set(comptes.keys());
  if (v?.dateDebut && v.dateFin && v.dateDebut <= v.dateFin) {
    for (let d = new Date(`${v.dateDebut}T12:00:00Z`); d <= new Date(`${v.dateFin}T12:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
      jours.add(d.toISOString().slice(0, 10));
    }
  }
  return {
    fuseau,
    jours: [...jours].sort().map((j) => ({ jour: j, photos: comptes.get(j) ?? 0 })),
    sansDate: sansDate
      .sort((a, b) => a.nomFichier.localeCompare(b.nomFichier, "fr", { numeric: true }))
      .map((l) => {
        const s = suggestions.get(l.id);
        const cleVignette = l.versions.rs ?? l.versions.s ?? l.versions.affiche;
        return {
          id: l.id,
          type: l.type,
          nom: l.nomFichier,
          vignette: cleVignette ? url(l.id, "s", cleVignette) : null,
          modifiable: peutModifier(ctx, l.auteurId),
          suggestion: s ? { instant: s.instant.toISOString(), local: heureLocale(s.instant, fuseau), raison: s.raison } : null,
        };
      }),
  };
}

/** Originaux des photos sans date que cette personne peut relire (liens de lecture d'une heure). */
export async function originauxSansDate(db: Db, stockage: Stockage, ctx: Ctx) {
  const l = (await lignesVisibles(db, ctx.voyageId)).filter((m) => !m.instant && m.type === "photo" && peutModifier(ctx, m.auteurId));
  return Promise.all(l.map(async (m) => ({ id: m.id, nom: m.nomFichier, mime: m.mime, url: await stockage.urlLecture(m.cleOriginal, 3600) })));
}

export const schemaExifRelu = z.object({
  priseLocale: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
  decalageExifMinutes: z.number().int().min(-14 * 60).max(14 * 60).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  appareil: z.object({ cle: z.string().min(1).max(300), libelle: z.string().min(1).max(200) }).nullable(),
});

/** Enregistre la date (et la position, l'appareil) relues dans l'original d'une photo restée sans date. */
export async function enregistrerExifRelu(db: Db, ctx: Ctx, mediaId: string, exif: z.infer<typeof schemaExifRelu>) {
  const e = schemaExifRelu.parse(exif);
  const m = await db.query.media.findFirst({ where: and(eq(media.id, mediaId), eq(media.voyageId, ctx.voyageId)) });
  if (!m || !peutModifier(ctx, m.auteurId)) throw new ErreurMetier("Photo introuvable.");
  if (m.priseUtc) return { ok: true };
  const v = (await db.query.voyage.findFirst({ where: eq(voyage.id, ctx.voyageId) }))!;
  const priseUtc = priseVersUtc(e.priseLocale, e.decalageExifMinutes, v.fuseau);
  if (!priseUtc) throw new ErreurMetier("Date illisible.");
  const app = e.appareil ? await trouverOuCreerAppareil(db, ctx.voyageId, m.auteurId ?? ctx.userId, e.appareil) : null;
  await db
    .update(media)
    .set({
      priseLocale: e.priseLocale,
      decalageExifMinutes: e.decalageExifMinutes,
      priseUtc,
      dateEstimee: false,
      latitude: m.latitude ?? e.latitude,
      longitude: m.longitude ?? e.longitude,
      ...(app ? { appareilId: app.id } : {}),
    })
    .where(eq(media.id, mediaId));
  await rangerNonClasses(db, ctx.voyageId);
  return { ok: true };
}

/**
 * Donne une date (instant UTC voulu dans la galerie) à des médias : elle est marquée « estimée ».
 * Le recalage de leur appareil est compensé pour qu'ils tombent exactement à l'heure choisie.
 */
export async function fixerDates(db: Db, ctx: Ctx, choix: { id: string; instant: Date }[]) {
  if (!choix.length) return 0;
  const v = (await db.query.voyage.findFirst({ where: eq(voyage.id, ctx.voyageId) }))!;
  const lignes = await db
    .select({ id: media.id, auteurId: media.auteurId, decalage: appareil.decalageSecondes })
    .from(media)
    .leftJoin(appareil, eq(appareil.id, media.appareilId))
    .where(and(eq(media.voyageId, ctx.voyageId), inArray(media.id, choix.map((c) => c.id))));
  const parId = new Map(lignes.map((l) => [l.id, l]));
  let n = 0;
  for (const c of choix) {
    const l = parId.get(c.id);
    if (!l) continue;
    if (!peutModifier(ctx, l.auteurId)) throw new ErreurMetier("Seuls l’auteur et l’administrateur peuvent dater ce média.");
    const priseUtc = new Date(c.instant.getTime() - (l.decalage ?? 0) * 1000);
    await db
      .update(media)
      .set({ priseUtc, priseLocale: heureLocale(priseUtc, v.fuseau), decalageExifMinutes: null, dateEstimee: true })
      .where(eq(media.id, c.id));
    n++;
  }
  // Les médias datés rejoignent l'épisode le plus proche (s'il y a des épisodes).
  await rangerNonClasses(db, ctx.voyageId);
  return n;
}

/** Instant UTC d'un jour et d'une heure locale du voyage (« 2026-08-03 », « 14:30 »). */
export function instantDuJour(jour: string, heure: string, fuseau: string): Date {
  const d = priseVersUtc(`${jour}T${heure}:00`, null, fuseau);
  if (!d) throw new ErreurMetier("Jour ou heure invalide.");
  return d;
}

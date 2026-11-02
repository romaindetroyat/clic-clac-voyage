/**
 * Import des médias : préparation de l'envoi, reprise, finalisation, dédoublonnage, galerie.
 * Le navigateur calcule les métadonnées (EXIF, empreintes, versions web) et envoie les octets
 * directement au stockage ; le serveur ne fait que vérifier, signer et enregistrer.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client";
import { appareil, media, voyage, type Media, type VersionsWeb } from "../db/schema";
import { cles, SEUIL_MULTIPART, TAILLE_MORCEAU, type Morceau, type Stockage } from "../stockage/types";
import { genererId } from "./crypto";
import { deciderDoublon, type Empreinte } from "./doublons";
import { instantCorrige, priseVersUtc, trierChronologiquement } from "./temps";
import { ErreurMetier } from "./voyages";

export const TAILLE_MAX = 20 * 1024 * 1024 * 1024; // 20 Go par fichier (vidéos longues)
export const VERSIONS_PHOTO = ["s", "m", "l"] as const;
export const VERSIONS_VIDEO = ["s", "m", "affiche", "video"] as const;

const typesAcceptes = /^(image\/|video\/|application\/octet-stream$)/;

export const schemaDeclaration = z.object({
  nomFichier: z.string().trim().min(1).max(255),
  mime: z.string().max(100).regex(typesAcceptes, "Type de fichier non pris en charge."),
  type: z.enum(["photo", "video"]),
  taille: z.number().int().positive().max(TAILLE_MAX, "Fichier trop volumineux (20 Go au maximum)."),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  dhash: z.string().regex(/^[0-9a-f]{16}$/).nullish(),
  largeur: z.number().int().positive().max(100_000).nullish(),
  hauteur: z.number().int().positive().max(100_000).nullish(),
  dureeSecondes: z.number().nonnegative().max(86_400).nullish(),
  priseLocale: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).nullish(),
  decalageExifMinutes: z.number().int().min(-14 * 60).max(14 * 60).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  appareil: z
    .object({ cle: z.string().trim().min(1).max(200), libelle: z.string().trim().min(1).max(120) })
    .nullish(),
  source: z
    .enum(["fichier", "partage", "whatsapp", "google-photos", "google-drive", "dropbox", "onedrive", "raccourci-ios"])
    .default("fichier"),
  copieCompressee: z.boolean().default(false),
  // Versions web que le navigateur va envoyer (il les a déjà calculées).
  versions: z.array(z.enum(["s", "m", "l", "affiche", "video"])).max(5).default([]),
});
export type Declaration = z.infer<typeof schemaDeclaration>;

export type PlanEnvoi =
  | { statut: "doublon"; mediaId: string }
  | {
      statut: "a-envoyer";
      mediaId: string;
      original:
        | { mode: "simple"; url: string }
        | { mode: "multipart"; tailleMorceau: number; nbMorceaux: number };
      versions: Record<string, string>;
    };

const EXT_VERSION: Record<string, { ext: string; mime: string }> = {
  s: { ext: "webp", mime: "image/webp" },
  m: { ext: "webp", mime: "image/webp" },
  l: { ext: "webp", mime: "image/webp" },
  affiche: { ext: "webp", mime: "image/webp" },
  video: { ext: "mp4", mime: "video/mp4" },
};

async function urlsVersions(stockage: Stockage, voyageId: string, mediaId: string, noms: string[]) {
  const res: Record<string, string> = {};
  for (const n of noms) {
    const { ext, mime } = EXT_VERSION[n];
    res[n] = await stockage.urlEnvoi(cles.version(voyageId, mediaId, n, ext), mime);
  }
  return res;
}

async function trouverOuCreerAppareil(db: Db, voyageId: string, userId: string, a: Declaration["appareil"]) {
  // Sans EXIF d'appareil : un « appareil » par personne qui importe.
  const cle = a?.cle ?? `import:${userId}`;
  const libelle = a?.libelle ?? "Appareil inconnu";
  const existant = await db.query.appareil.findFirst({
    where: and(eq(appareil.voyageId, voyageId), eq(appareil.cle, cle)),
  });
  if (existant) return existant;
  const id = genererId();
  await db
    .insert(appareil)
    .values({ id, voyageId, cle, libelle, proprietaireId: userId })
    .onConflictDoNothing();
  return (await db.query.appareil.findFirst({ where: and(eq(appareil.voyageId, voyageId), eq(appareil.cle, cle)) }))!;
}

/** Déclare un fichier à envoyer et renvoie les URL signées (ou « doublon » s'il est déjà là). */
export async function preparerEnvoi(
  db: Db,
  stockage: Stockage,
  ctx: { voyageId: string; fuseau: string; userId: string },
  d: Declaration,
): Promise<PlanEnvoi> {
  const existant = await db.query.media.findFirst({
    where: and(eq(media.voyageId, ctx.voyageId), eq(media.sha256, d.sha256)),
    columns: { id: true, statut: true, auteurId: true, envoiId: true },
  });
  if (existant?.statut === "pret") return { statut: "doublon", mediaId: existant.id };

  let mediaId: string;
  if (existant) {
    // Envoi précédent interrompu du même fichier : on le reprend.
    mediaId = existant.id;
  } else {
    const app = await trouverOuCreerAppareil(db, ctx.voyageId, ctx.userId, d.appareil);
    mediaId = genererId();
    await db.insert(media).values({
      id: mediaId,
      voyageId: ctx.voyageId,
      auteurId: ctx.userId,
      appareilId: app.id,
      type: d.type,
      source: d.source,
      nomFichier: d.nomFichier,
      mime: d.mime,
      taille: d.taille,
      sha256: d.sha256,
      dhash: d.dhash ?? null,
      largeur: d.largeur ?? null,
      hauteur: d.hauteur ?? null,
      dureeSecondes: d.dureeSecondes ?? null,
      priseLocale: d.priseLocale ?? null,
      decalageExifMinutes: d.decalageExifMinutes ?? null,
      priseUtc: priseVersUtc(d.priseLocale, d.decalageExifMinutes, ctx.fuseau),
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      cleOriginal: cles.original(ctx.voyageId, mediaId),
      copieCompressee: d.copieCompressee,
    });
  }

  const cle = cles.original(ctx.voyageId, mediaId);
  const versions = await urlsVersions(stockage, ctx.voyageId, mediaId, d.versions);

  if (d.taille <= SEUIL_MULTIPART) {
    return { statut: "a-envoyer", mediaId, original: { mode: "simple", url: await stockage.urlEnvoi(cle, d.mime) }, versions };
  }
  if (!existant?.envoiId) {
    const envoiId = await stockage.creerMultipart(cle, d.mime);
    await db.update(media).set({ envoiId }).where(eq(media.id, mediaId));
  }
  return {
    statut: "a-envoyer",
    mediaId,
    original: { mode: "multipart", tailleMorceau: TAILLE_MORCEAU, nbMorceaux: Math.ceil(d.taille / TAILLE_MORCEAU) },
    versions,
  };
}

async function mediaEnCours(db: Db, voyageId: string, mediaId: string, userId: string) {
  const m = await db.query.media.findFirst({
    where: and(eq(media.id, mediaId), eq(media.voyageId, voyageId), eq(media.auteurId, userId)),
  });
  if (!m) throw new ErreurMetier("Envoi introuvable.");
  return m;
}

/** URL signées pour une série de morceaux. */
export async function signerMorceaux(
  db: Db,
  stockage: Stockage,
  ctx: { voyageId: string; userId: string },
  mediaId: string,
  numeros: number[],
) {
  const m = await mediaEnCours(db, ctx.voyageId, mediaId, ctx.userId);
  if (!m.envoiId) throw new ErreurMetier("Cet envoi ne se fait pas en plusieurs morceaux.");
  const max = Math.ceil(m.taille / TAILLE_MORCEAU);
  const urls: Record<number, string> = {};
  for (const n of numeros.slice(0, 100)) {
    if (!Number.isInteger(n) || n < 1 || n > max) throw new ErreurMetier("Numéro de morceau invalide.");
    urls[n] = await stockage.urlMorceau(m.cleOriginal, m.envoiId, n);
  }
  return urls;
}

/** Morceaux déjà reçus par le stockage, pour reprendre où l'on s'était arrêté. */
export async function morceauxRecus(db: Db, stockage: Stockage, ctx: { voyageId: string; userId: string }, mediaId: string) {
  const m = await mediaEnCours(db, ctx.voyageId, mediaId, ctx.userId);
  if (m.statut === "pret") return { termine: true as const, morceaux: [] as Morceau[] };
  if (!m.envoiId) return { termine: false as const, morceaux: [] as Morceau[] };
  return { termine: false as const, morceaux: await stockage.listerMorceaux(m.cleOriginal, m.envoiId) };
}

/**
 * Termine l'envoi : assemble les morceaux, vérifie la taille, enregistre les versions web,
 * puis applique le dédoublonnage perceptuel (copie WhatsApp ↔ original).
 */
export async function terminerEnvoi(
  db: Db,
  stockage: Stockage,
  ctx: { voyageId: string; userId: string },
  mediaId: string,
  donnees: { morceaux?: Morceau[]; versions: string[] },
): Promise<{ statut: "pret"; masque?: string; doublonDe?: string }> {
  const m = await mediaEnCours(db, ctx.voyageId, mediaId, ctx.userId);
  if (m.statut === "pret") return { statut: "pret" };

  if (m.envoiId) {
    if (!donnees.morceaux?.length) throw new ErreurMetier("Morceaux manquants.");
    await stockage.terminerMultipart(m.cleOriginal, m.envoiId, donnees.morceaux);
  }
  const taille = await stockage.taille(m.cleOriginal);
  if (taille !== m.taille) throw new ErreurMetier("Le fichier reçu est incomplet. L'envoi va reprendre.");

  const versions: VersionsWeb = {};
  for (const n of donnees.versions) {
    const ev = EXT_VERSION[n];
    if (!ev) continue;
    const cle = cles.version(ctx.voyageId, mediaId, n, ev.ext);
    if ((await stockage.taille(cle)) !== null) versions[n as keyof VersionsWeb] = cle;
  }

  await db.update(media).set({ statut: "pret", envoiId: null, versions }).where(eq(media.id, mediaId));
  return { statut: "pret", ...(await dedoublonner(db, { ...m, versions, statut: "pret" })) };
}

async function dedoublonner(db: Db, nouveau: Media): Promise<{ masque?: string; doublonDe?: string }> {
  if (nouveau.type !== "photo" || !nouveau.dhash) return {};
  const candidats = await db.query.media.findMany({
    where: and(eq(media.voyageId, nouveau.voyageId), eq(media.type, "photo"), eq(media.statut, "pret"), isNull(media.doublonDe)),
    columns: { id: true, dhash: true, largeur: true, hauteur: true, taille: true, priseUtc: true, copieCompressee: true },
  });
  const empreinte = (e: (typeof candidats)[number]): Empreinte => ({
    id: e.id,
    dhash: e.dhash,
    largeur: e.largeur,
    hauteur: e.hauteur,
    taille: e.taille,
    instant: e.priseUtc,
    copieCompressee: e.copieCompressee,
  });
  const decision = deciderDoublon(
    empreinte({ ...nouveau, priseUtc: nouveau.priseUtc }),
    candidats.filter((c) => c.id !== nouveau.id).map(empreinte),
  );
  if (decision.action === "masquer-nouveau") {
    await db.update(media).set({ doublonDe: decision.garde }).where(eq(media.id, nouveau.id));
    return { doublonDe: decision.garde };
  }
  if (decision.action === "remplacer") {
    // L'original remplace la copie : il hérite de sa date si lui n'en a pas.
    const ancien = await db.query.media.findFirst({ where: eq(media.id, decision.masque) });
    await db.update(media).set({ doublonDe: nouveau.id }).where(eq(media.id, decision.masque));
    if (ancien && !nouveau.priseUtc && ancien.priseUtc) {
      await db.update(media).set({ priseUtc: ancien.priseUtc }).where(eq(media.id, nouveau.id));
    }
    // Les doublons qui pointaient vers l'ancien pointent maintenant vers le nouveau.
    await db.update(media).set({ doublonDe: nouveau.id }).where(eq(media.doublonDe, decision.masque));
    return { masque: decision.masque };
  }
  return {};
}

export async function annulerEnvoi(db: Db, stockage: Stockage, ctx: { voyageId: string; userId: string }, mediaId: string) {
  const m = await mediaEnCours(db, ctx.voyageId, mediaId, ctx.userId);
  if (m.statut === "pret") return;
  if (m.envoiId) await stockage.annulerMultipart(m.cleOriginal, m.envoiId);
  await stockage.supprimer([m.cleOriginal, ...Object.values(m.versions)]);
  await db.delete(media).where(eq(media.id, m.id));
}

/* ------------------------------ Galerie ------------------------------ */

export type MediaGalerie = {
  id: string;
  type: "photo" | "video";
  nomFichier: string;
  instant: string | null;
  largeur: number | null;
  hauteur: number | null;
  auteur: string | null;
  appareil: string | null;
  copieCompressee: boolean;
  vignette: string | null;
  moyenne: string | null;
};

/** Médias visibles du voyage, dans l'ordre chronologique corrigé, avec des URL de lecture à durée limitée. */
export async function galerie(db: Db, stockage: Stockage, voyageId: string): Promise<MediaGalerie[]> {
  const lignes = await db.query.media.findMany({
    where: and(eq(media.voyageId, voyageId), eq(media.statut, "pret"), isNull(media.doublonDe)),
  });
  const apps = lignes.length
    ? await db.query.appareil.findMany({ where: inArray(appareil.id, [...new Set(lignes.map((l) => l.appareilId!).filter(Boolean))]) })
    : [];
  const parApp = new Map(apps.map((a) => [a.id, a]));
  const auteurs = lignes.length
    ? await db.query.user.findMany({ columns: { id: true, name: true }, where: (t, { inArray: dans }) => dans(t.id, [...new Set(lignes.map((l) => l.auteurId!).filter(Boolean))]) })
    : [];
  const nomAuteur = new Map(auteurs.map((a) => [a.id, a.name]));

  const tries = trierChronologiquement(
    lignes.map((l) => ({
      ...l,
      instant: instantCorrige(l.priseUtc, l.appareilId ? (parApp.get(l.appareilId)?.decalageSecondes ?? 0) : 0),
    })),
  );
  const DUREE = 6 * 3600;
  return Promise.all(
    tries.map(async (l) => ({
      id: l.id,
      type: l.type,
      nomFichier: l.nomFichier,
      instant: l.instant?.toISOString() ?? null,
      largeur: l.largeur,
      hauteur: l.hauteur,
      auteur: l.auteurId ? (nomAuteur.get(l.auteurId) ?? null) : null,
      appareil: l.appareilId ? (parApp.get(l.appareilId)?.libelle ?? null) : null,
      copieCompressee: l.copieCompressee,
      vignette: l.versions.s ? await stockage.urlLecture(l.versions.s, DUREE) : null,
      moyenne: (l.versions.m ?? l.versions.l) ? await stockage.urlLecture((l.versions.m ?? l.versions.l)!, DUREE) : null,
    })),
  );
}

/* ------------------------------ Appareils ----------------------------- */

export async function appareilsDe(db: Db, voyageId: string) {
  const apps = await db.query.appareil.findMany({ where: eq(appareil.voyageId, voyageId) });
  const comptes = await db
    .select({ appareilId: media.appareilId, id: media.id })
    .from(media)
    .where(and(eq(media.voyageId, voyageId), eq(media.statut, "pret"), isNull(media.doublonDe)));
  const n = new Map<string, number>();
  for (const c of comptes) if (c.appareilId) n.set(c.appareilId, (n.get(c.appareilId) ?? 0) + 1);
  return apps
    .map((a) => ({ ...a, nbMedias: n.get(a.id) ?? 0 }))
    .filter((a) => a.nbMedias > 0)
    .sort((a, b) => b.nbMedias - a.nbMedias);
}

/** Recalage d'horloge : l'administrateur ou le propriétaire de l'appareil. */
export async function reglerDecalage(
  db: Db,
  ctx: { voyageId: string; userId: string; estAdmin: boolean },
  appareilId: string,
  decalageSecondes: number,
) {
  const a = await db.query.appareil.findFirst({ where: and(eq(appareil.id, appareilId), eq(appareil.voyageId, ctx.voyageId)) });
  if (!a) throw new ErreurMetier("Appareil introuvable.");
  if (!ctx.estAdmin && a.proprietaireId !== ctx.userId) {
    throw new ErreurMetier("Seuls l'administrateur et le propriétaire de l'appareil peuvent le recaler.");
  }
  if (Math.abs(decalageSecondes) > 400 * 86400) throw new ErreurMetier("Décalage trop grand.");
  await db.update(appareil).set({ decalageSecondes }).where(eq(appareil.id, a.id));
}

export async function fuseauDuVoyage(db: Db, voyageId: string) {
  const v = await db.query.voyage.findFirst({ where: eq(voyage.id, voyageId), columns: { fuseau: true } });
  return v?.fuseau ?? "Europe/Paris";
}

/**
 * Retouches non destructives : paramètres en base, versions web retouchées « cuites » par le navigateur
 * avec le moteur de rendu partagé, original intact.
 */
import { and, eq } from "drizzle-orm";
import { empreinteRetouche, estNeutre, schemaRetouche, type Retouche } from "../../lib/rendu/parametres";
import type { Db } from "../db/client";
import { media, type VersionsWeb } from "../db/schema";
import { cles, type Stockage } from "../stockage/types";
import { ErreurMetier } from "./voyages";

export const TAILLES_RETOUCHE = { rs: 400, rm: 1200, rl: 2400 } as const;
type NomVersion = keyof typeof TAILLES_RETOUCHE;

async function mediaRetouchable(db: Db, ctx: { voyageId: string; userId: string; estAdmin: boolean }, mediaId: string) {
  const m = await db.query.media.findFirst({ where: and(eq(media.id, mediaId), eq(media.voyageId, ctx.voyageId)) });
  if (!m || m.type !== "photo") throw new ErreurMetier("Photo introuvable.");
  if (m.auteurId !== ctx.userId && !ctx.estAdmin) {
    throw new ErreurMetier("Seuls l'auteur de la photo et l'administrateur peuvent la retoucher.");
  }
  return m;
}

const cleVersion = (voyageId: string, mediaId: string, empreinte: string, nom: NomVersion) =>
  cles.version(voyageId, mediaId, `${nom}-${empreinte}`, "webp");

/** URL signées pour envoyer les versions retouchées calculées par le navigateur. */
export async function preparerRetouche(
  db: Db,
  stockage: Stockage,
  ctx: { voyageId: string; userId: string; estAdmin: boolean },
  mediaId: string,
  retouche: Retouche,
) {
  await mediaRetouchable(db, ctx, mediaId);
  const r = schemaRetouche.parse(retouche);
  const empreinte = empreinteRetouche(r);
  const urls: Partial<Record<NomVersion, string>> = {};
  for (const nom of Object.keys(TAILLES_RETOUCHE) as NomVersion[]) {
    urls[nom] = await stockage.urlEnvoi(cleVersion(ctx.voyageId, mediaId, empreinte, nom), "image/webp");
  }
  return { empreinte, urls, tailles: TAILLES_RETOUCHE };
}

/** Enregistre les paramètres et les versions retouchées (vérifiées sur le stockage). */
export async function enregistrerRetouche(
  db: Db,
  stockage: Stockage,
  ctx: { voyageId: string; userId: string; estAdmin: boolean },
  mediaId: string,
  retouche: Retouche,
) {
  const m = await mediaRetouchable(db, ctx, mediaId);
  const r = schemaRetouche.parse(retouche);
  const anciennes = (["rs", "rm", "rl"] as const).map((k) => m.versions[k]).filter((c): c is string => !!c);
  const versions: VersionsWeb = { ...m.versions };
  delete versions.rs;
  delete versions.rm;
  delete versions.rl;
  if (!estNeutre(r)) {
    const empreinte = empreinteRetouche(r);
    for (const nom of Object.keys(TAILLES_RETOUCHE) as NomVersion[]) {
      const cle = cleVersion(ctx.voyageId, mediaId, empreinte, nom);
      if ((await stockage.taille(cle)) === null) throw new ErreurMetier("Les images retouchées n'ont pas toutes été reçues.");
      versions[nom] = cle;
    }
  }
  await db
    .update(media)
    .set({ retouche: estNeutre(r) ? null : (r as Record<string, unknown>), versions, remplacee: false })
    .where(eq(media.id, mediaId));
  const aSupprimer = anciennes.filter((c) => !Object.values(versions).includes(c));
  if (aSupprimer.length) await stockage.supprimer(aSupprimer);
}

/* ------------- Remplacement par une image modifiée ailleurs (ChatGPT, Photoshop…) ------------- */

/** URL signées pour envoyer les versions web de l'image de remplacement (redimensionnées par le navigateur). */
export async function preparerRemplacement(db: Db, stockage: Stockage, ctx: { voyageId: string; userId: string; estAdmin: boolean }, mediaId: string) {
  await mediaRetouchable(db, ctx, mediaId);
  const empreinte = `remplacement-${crypto.randomUUID().slice(0, 8)}`;
  const urls: Partial<Record<NomVersion, string>> = {};
  for (const nom of Object.keys(TAILLES_RETOUCHE) as NomVersion[]) {
    urls[nom] = await stockage.urlEnvoi(cleVersion(ctx.voyageId, mediaId, empreinte, nom), "image/webp");
  }
  return { empreinte, urls, tailles: TAILLES_RETOUCHE };
}

/**
 * L'image modifiée remplace la photo partout (galerie, site, livre). L'original reste intact :
 * « Revenir à l'original » efface le remplacement.
 */
export async function enregistrerRemplacement(
  db: Db,
  stockage: Stockage,
  ctx: { voyageId: string; userId: string; estAdmin: boolean },
  mediaId: string,
  empreinte: string,
) {
  if (!/^remplacement-[0-9a-f]{8}$/.test(empreinte)) throw new ErreurMetier("Remplacement invalide.");
  const m = await mediaRetouchable(db, ctx, mediaId);
  const versions: VersionsWeb = { ...m.versions };
  for (const nom of Object.keys(TAILLES_RETOUCHE) as NomVersion[]) {
    const cle = cleVersion(ctx.voyageId, mediaId, empreinte, nom);
    if ((await stockage.taille(cle)) === null) throw new ErreurMetier("L'image de remplacement n'a pas été entièrement reçue.");
    versions[nom] = cle;
  }
  const anciennes = (["rs", "rm", "rl"] as const).map((k) => m.versions[k]).filter((c): c is string => !!c);
  await db
    .update(media)
    .set({ versions, retouche: null, remplacee: true })
    .where(eq(media.id, mediaId));
  if (anciennes.length) await stockage.supprimer(anciennes);
}

/** Revient à la photo d'origine (sans retouche ni remplacement). */
export async function revenirOriginal(db: Db, stockage: Stockage, ctx: { voyageId: string; userId: string; estAdmin: boolean }, mediaId: string) {
  const m = await mediaRetouchable(db, ctx, mediaId);
  const anciennes = (["rs", "rm", "rl"] as const).map((k) => m.versions[k]).filter((c): c is string => !!c);
  const versions: VersionsWeb = { ...m.versions };
  delete versions.rs;
  delete versions.rm;
  delete versions.rl;
  await db.update(media).set({ versions, retouche: null, remplacee: false }).where(eq(media.id, mediaId));
  if (anciennes.length) await stockage.supprimer(anciennes);
}

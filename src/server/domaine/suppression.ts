/**
 * Droit à l'effacement (RGPD) : suppression d'un voyage entier, ou d'un compte et de ses photos.
 * La base est nettoyée par cascades ; le stockage (originaux, versions, livre, exports) l'est ici.
 */
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { commentaire, invitation, media, participant, session, user, verification, voyage } from "../db/schema";
import type { Stockage } from "../stockage/types";
import { ErreurMetier } from "./voyages";

/** Supprime le voyage, tout ce qu'il contient et tous ses fichiers. */
export async function supprimerVoyage(db: Db, stockage: Stockage, voyageId: string) {
  const v = await db.query.voyage.findFirst({ where: eq(voyage.id, voyageId), columns: { id: true } });
  if (!v) throw new ErreurMetier("Voyage introuvable.");
  // Fichiers d'abord : si le stockage échoue, le voyage reste et l'on peut recommencer.
  const fichiers = await stockage.supprimerPrefixe(`voyages/${voyageId}/`);
  await db.delete(voyage).where(eq(voyage.id, voyageId));
  return { fichiers };
}

/** Voyages qui bloqueraient la suppression : la personne en est le seul administrateur et d'autres y participent. */
export async function voyagesABloquer(db: Db, userId: string) {
  const miens = await db
    .select({ voyageId: participant.voyageId, nom: voyage.nom, role: participant.role })
    .from(participant)
    .innerJoin(voyage, eq(voyage.id, participant.voyageId))
    .where(eq(participant.userId, userId));
  const bloquants: string[] = [];
  const seul: string[] = [];
  for (const m of miens) {
    const autres = await db
      .select({ role: participant.role, n: sql<number>`count(*)::int` })
      .from(participant)
      .where(and(eq(participant.voyageId, m.voyageId), ne(participant.userId, userId)))
      .groupBy(participant.role);
    const nAutres = autres.reduce((s, a) => s + a.n, 0);
    const autresAdmins = autres.find((a) => a.role === "admin")?.n ?? 0;
    if (nAutres === 0) seul.push(m.voyageId);
    else if (m.role === "admin" && autresAdmins === 0) bloquants.push(m.nom);
  }
  return { bloquants, seul };
}

/**
 * Supprime un compte : ses voyages où il est seul, ses photos et vidéos (fichiers compris),
 * ses commentaires, ses invitations, ses sessions, puis le compte lui-même.
 */
export async function supprimerCompte(db: Db, stockage: Stockage, userId: string) {
  const u = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { id: true, email: true } });
  if (!u) throw new ErreurMetier("Compte introuvable.");
  const { bloquants, seul } = await voyagesABloquer(db, userId);
  if (bloquants.length) {
    throw new ErreurMetier(
      `Vous êtes le seul administrateur de : ${bloquants.join(", ")}. Nommez d’abord un autre administrateur (onglet Participants) ou supprimez ces voyages.`,
    );
  }
  let fichiers = 0;
  for (const voyageId of seul) fichiers += (await supprimerVoyage(db, stockage, voyageId)).fichiers;

  // Ses photos dans les voyages partagés : fichiers puis lignes (commentaires et réactions suivent).
  const siens = await db.select({ id: media.id, cle: media.cleOriginal, versions: media.versions }).from(media).where(eq(media.auteurId, userId));
  const cles = siens.flatMap((m) => [m.cle, ...Object.values(m.versions)]).filter(Boolean);
  for (let i = 0; i < cles.length; i += 1000) await stockage.supprimer(cles.slice(i, i + 1000));
  fichiers += cles.length;
  for (let i = 0; i < siens.length; i += 500) {
    await db.delete(media).where(inArray(media.id, siens.slice(i, i + 500).map((m) => m.id)));
  }
  await db.delete(commentaire).where(eq(commentaire.auteurId, userId));
  await db.delete(invitation).where(eq(invitation.email, u.email));
  // Codes de connexion en attente (l'identifiant contient l'adresse ; pas de LIKE : « _ » est un joker).
  await db.delete(verification).where(sql`strpos(${verification.identifier}, ${u.email}) > 0`);
  await db.delete(session).where(eq(session.userId, userId));
  // Participations, comptes de connexion, réactions, commandes : en cascade.
  await db.delete(user).where(eq(user.id, userId));
  return { voyages: seul.length, photos: siens.length, fichiers };
}

/**
 * Règles métier des voyages, participants, invitations et liens secrets.
 * Fonctions pures vis-à-vis de Next.js : elles reçoivent la base en paramètre
 * pour être testées contre un vrai Postgres (pglite).
 */
import { and, asc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { invitation, lienSecret, participant, user, voyage, type Role } from "../db/schema";
import { empreinteJeton, genererId, genererJeton, hacherMotDePasse, verifierMotDePasse } from "./crypto";

export class ErreurMetier extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurMetier";
  }
}

const RANG: Record<Role, number> = { contributeur: 1, admin: 2 };

/** Vrai si `role` donne au moins les droits de `requis`. */
export function roleSuffisant(role: Role | null | undefined, requis: Role): boolean {
  return !!role && RANG[role] >= RANG[requis];
}

export function normaliserEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** « Été 2026 à Naxos ! » → « ete-2026-a-naxos ». */
export function slugifier(texte: string): string {
  const s = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "voyage";
}

export const DUREE_INVITATION_JOURS = 30;

/* ------------------------------ Voyages ------------------------------ */

export async function creerVoyage(
  db: Db,
  userId: string,
  donnees: { nom: string; dateDebut?: string | null; dateFin?: string | null },
) {
  const nom = donnees.nom.trim();
  if (!nom) throw new ErreurMetier("Le nom du voyage est obligatoire.");
  if (donnees.dateDebut && donnees.dateFin && donnees.dateFin < donnees.dateDebut) {
    throw new ErreurMetier("La date de fin précède la date de début.");
  }
  const base = slugifier(nom);
  let slug = base;
  for (let i = 2; ; i++) {
    const existe = await db.query.voyage.findFirst({ where: eq(voyage.slug, slug), columns: { id: true } });
    if (!existe) break;
    slug = `${base}-${i}`;
  }
  const id = genererId();
  await db.transaction(async (tx) => {
    await tx.insert(voyage).values({
      id,
      slug,
      nom,
      dateDebut: donnees.dateDebut || null,
      dateFin: donnees.dateFin || null,
      creePar: userId,
    });
    await tx.insert(participant).values({ voyageId: id, userId, role: "admin" });
  });
  return { id, slug };
}

export async function modifierVoyage(
  db: Db,
  voyageId: string,
  donnees: { nom: string; dateDebut?: string | null; dateFin?: string | null },
) {
  const nom = donnees.nom.trim();
  if (!nom) throw new ErreurMetier("Le nom du voyage est obligatoire.");
  if (donnees.dateDebut && donnees.dateFin && donnees.dateFin < donnees.dateDebut) {
    throw new ErreurMetier("La date de fin précède la date de début.");
  }
  await db
    .update(voyage)
    .set({ nom, dateDebut: donnees.dateDebut || null, dateFin: donnees.dateFin || null })
    .where(eq(voyage.id, voyageId));
}

/** Rôle de l'utilisateur dans le voyage, ou null s'il n'en fait pas partie. */
export async function roleDans(db: Db, userId: string, voyageId: string): Promise<Role | null> {
  const p = await db.query.participant.findFirst({
    where: and(eq(participant.userId, userId), eq(participant.voyageId, voyageId)),
    columns: { role: true },
  });
  return p?.role ?? null;
}

/** Le voyage désigné par son slug, seulement si l'utilisateur en fait partie. */
export async function voyagePourUtilisateur(db: Db, userId: string, slug: string) {
  const [ligne] = await db
    .select({ voyage, role: participant.role })
    .from(voyage)
    .innerJoin(participant, and(eq(participant.voyageId, voyage.id), eq(participant.userId, userId)))
    .where(eq(voyage.slug, slug))
    .limit(1);
  return ligne ?? null;
}

export async function voyagesDe(db: Db, userId: string) {
  return db
    .select({
      id: voyage.id,
      slug: voyage.slug,
      nom: voyage.nom,
      dateDebut: voyage.dateDebut,
      dateFin: voyage.dateFin,
      role: participant.role,
    })
    .from(participant)
    .innerJoin(voyage, eq(voyage.id, participant.voyageId))
    .where(eq(participant.userId, userId))
    .orderBy(sql`${voyage.dateDebut} desc nulls last`, asc(voyage.nom));
}

/* ---------------------------- Participants --------------------------- */

export async function participantsDe(db: Db, voyageId: string) {
  return db
    .select({ userId: user.id, nom: user.name, email: user.email, role: participant.role, depuis: participant.createdAt })
    .from(participant)
    .innerJoin(user, eq(user.id, participant.userId))
    .where(eq(participant.voyageId, voyageId))
    .orderBy(asc(user.name));
}

async function nombreAdmins(db: Db, voyageId: string, sauf?: string) {
  const conditions = [eq(participant.voyageId, voyageId), eq(participant.role, "admin")];
  if (sauf) conditions.push(ne(participant.userId, sauf));
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(participant)
    .where(and(...conditions));
  return n;
}

export async function retirerParticipant(db: Db, voyageId: string, userId: string) {
  const role = await roleDans(db, userId, voyageId);
  if (!role) throw new ErreurMetier("Cette personne ne participe pas à ce voyage.");
  if (role === "admin" && (await nombreAdmins(db, voyageId, userId)) === 0) {
    throw new ErreurMetier("Impossible de retirer le dernier administrateur du voyage.");
  }
  await db.delete(participant).where(and(eq(participant.voyageId, voyageId), eq(participant.userId, userId)));
}

export async function changerRole(db: Db, voyageId: string, userId: string, nouveau: Role) {
  const role = await roleDans(db, userId, voyageId);
  if (!role) throw new ErreurMetier("Cette personne ne participe pas à ce voyage.");
  if (role === "admin" && nouveau !== "admin" && (await nombreAdmins(db, voyageId, userId)) === 0) {
    throw new ErreurMetier("Le voyage doit garder au moins un administrateur.");
  }
  await db
    .update(participant)
    .set({ role: nouveau })
    .where(and(eq(participant.voyageId, voyageId), eq(participant.userId, userId)));
}

/* ----------------------------- Invitations --------------------------- */

export async function inviter(
  db: Db,
  donnees: { voyageId: string; email: string; role: Role; invitePar: string },
  maintenant = new Date(),
) {
  const email = normaliserEmail(donnees.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErreurMetier("Adresse e-mail invalide.");

  const dejaMembre = await db
    .select({ id: user.id })
    .from(user)
    .innerJoin(participant, and(eq(participant.userId, user.id), eq(participant.voyageId, donnees.voyageId)))
    .where(eq(user.email, email))
    .limit(1);
  if (dejaMembre.length) throw new ErreurMetier("Cette personne participe déjà au voyage.");

  const expireLe = new Date(maintenant.getTime() + DUREE_INVITATION_JOURS * 86_400_000);
  const existante = await db.query.invitation.findFirst({
    where: and(
      eq(invitation.voyageId, donnees.voyageId),
      eq(invitation.email, email),
      isNull(invitation.accepteeLe),
      isNull(invitation.annuleeLe),
    ),
  });
  if (existante) {
    // Relance : on prolonge et on met à jour le rôle.
    await db.update(invitation).set({ expireLe, role: donnees.role }).where(eq(invitation.id, existante.id));
    return { id: existante.id, email, relance: true };
  }
  const id = genererId();
  await db.insert(invitation).values({
    id,
    voyageId: donnees.voyageId,
    email,
    role: donnees.role,
    invitePar: donnees.invitePar,
    expireLe,
  });
  return { id, email, relance: false };
}

function conditionsInvitationValide(maintenant: Date) {
  return [isNull(invitation.accepteeLe), isNull(invitation.annuleeLe), gt(invitation.expireLe, maintenant)];
}

export async function invitationsEnAttente(db: Db, voyageId: string, maintenant = new Date()) {
  return db
    .select({ id: invitation.id, email: invitation.email, role: invitation.role, expireLe: invitation.expireLe })
    .from(invitation)
    .where(and(eq(invitation.voyageId, voyageId), ...conditionsInvitationValide(maintenant)))
    .orderBy(asc(invitation.email));
}

export async function invitationValide(db: Db, invitationId: string, maintenant = new Date()) {
  const [ligne] = await db
    .select({ id: invitation.id, email: invitation.email, nomVoyage: voyage.nom })
    .from(invitation)
    .innerJoin(voyage, eq(voyage.id, invitation.voyageId))
    .where(and(eq(invitation.id, invitationId), ...conditionsInvitationValide(maintenant)))
    .limit(1);
  return ligne ?? null;
}

export async function annulerInvitation(db: Db, voyageId: string, invitationId: string) {
  await db
    .update(invitation)
    .set({ annuleeLe: new Date() })
    .where(and(eq(invitation.id, invitationId), eq(invitation.voyageId, voyageId), isNull(invitation.accepteeLe)));
}

/** Une adresse peut créer un compte si elle a une invitation valide ou figure dans ADMIN_EMAILS. */
export async function peutCreerCompte(db: Db, email: string, adminEmails: string[], maintenant = new Date()) {
  const e = normaliserEmail(email);
  if (adminEmails.includes(e)) return true;
  const inv = await db.query.invitation.findFirst({
    where: and(eq(invitation.email, e), ...conditionsInvitationValide(maintenant)),
    columns: { id: true },
  });
  return !!inv;
}

/** Transforme les invitations valides de cette adresse en participations. */
export async function accepterInvitations(db: Db, userId: string, email: string, maintenant = new Date()) {
  const e = normaliserEmail(email);
  const enAttente = await db.query.invitation.findMany({
    where: and(eq(invitation.email, e), ...conditionsInvitationValide(maintenant)),
  });
  for (const inv of enAttente) {
    await db.transaction(async (tx) => {
      await tx
        .insert(participant)
        .values({ voyageId: inv.voyageId, userId, role: inv.role })
        .onConflictDoNothing();
      await tx.update(invitation).set({ accepteeLe: maintenant }).where(eq(invitation.id, inv.id));
    });
  }
  return enAttente.length;
}

/* ---------------------------- Liens secrets -------------------------- */

export async function creerLienSecret(
  db: Db,
  donnees: { voyageId: string; libelle: string; motDePasse?: string | null; creePar: string },
) {
  const libelle = donnees.libelle.trim() || "Lien de partage";
  const jeton = genererJeton();
  const id = genererId();
  await db.insert(lienSecret).values({
    id,
    voyageId: donnees.voyageId,
    libelle,
    jetonEmpreinte: empreinteJeton(jeton),
    motDePasse: donnees.motDePasse ? await hacherMotDePasse(donnees.motDePasse) : null,
    creePar: donnees.creePar,
  });
  return { id, jeton };
}

export async function liensSecretsDe(db: Db, voyageId: string) {
  return db
    .select({
      id: lienSecret.id,
      libelle: lienSecret.libelle,
      protege: sql<boolean>`${lienSecret.motDePasse} is not null`,
      revoqueLe: lienSecret.revoqueLe,
      creeLe: lienSecret.createdAt,
    })
    .from(lienSecret)
    .where(eq(lienSecret.voyageId, voyageId))
    .orderBy(asc(lienSecret.createdAt));
}

export async function revoquerLienSecret(db: Db, voyageId: string, lienId: string) {
  await db
    .update(lienSecret)
    .set({ revoqueLe: new Date() })
    .where(and(eq(lienSecret.id, lienId), eq(lienSecret.voyageId, voyageId)));
}

/**
 * Vérifie un accès lecteur : le jeton doit correspondre à un lien non révoqué
 * DU voyage demandé (un jeton d'un autre voyage ne donne rien).
 */
export async function verifierAccesLecteur(
  db: Db,
  slug: string,
  jeton: string,
  motDePasse?: string | null,
): Promise<{ statut: "ok"; voyage: { id: string; nom: string; slug: string } } | { statut: "refuse" } | { statut: "mot-de-passe" }> {
  if (!jeton) return { statut: "refuse" };
  const [ligne] = await db
    .select({ id: voyage.id, nom: voyage.nom, slug: voyage.slug, motDePasse: lienSecret.motDePasse })
    .from(lienSecret)
    .innerJoin(voyage, eq(voyage.id, lienSecret.voyageId))
    .where(and(eq(lienSecret.jetonEmpreinte, empreinteJeton(jeton)), eq(voyage.slug, slug), isNull(lienSecret.revoqueLe)))
    .limit(1);
  if (!ligne) return { statut: "refuse" };
  if (ligne.motDePasse) {
    if (!motDePasse || !(await verifierMotDePasse(motDePasse, ligne.motDePasse))) return { statut: "mot-de-passe" };
  }
  return { statut: "ok", voyage: { id: ligne.id, nom: ligne.nom, slug: ligne.slug } };
}

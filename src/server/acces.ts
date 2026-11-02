import "server-only";
import { notFound } from "next/navigation";
import { exigerUtilisateur, type Utilisateur } from "./auth";
import { getDb } from "./db";
import type { Role, Voyage } from "./db/schema";
import { ErreurMetier, roleSuffisant, voyagePourUtilisateur } from "./domaine/voyages";

export type AccesVoyage = { utilisateur: Utilisateur; voyage: Voyage; role: Role };

/**
 * Point de passage obligé de toute page ou action d'un voyage.
 * - non connecté : redirection vers /connexion ;
 * - pas membre du voyage : 404 (on ne révèle pas l'existence du voyage) ;
 * - rôle insuffisant : erreur explicite.
 */
export async function exigerVoyage(slug: string, roleRequis: Role = "contributeur"): Promise<AccesVoyage> {
  const utilisateur = await exigerUtilisateur();
  const db = await getDb();
  const ligne = await voyagePourUtilisateur(db, utilisateur.id, slug);
  if (!ligne) notFound();
  if (!roleSuffisant(ligne.role, roleRequis)) {
    throw new ErreurMetier("Cette action est réservée aux administrateurs du voyage.");
  }
  return { utilisateur, voyage: ligne.voyage, role: ligne.role };
}

/** Variante pour les pages : renvoie l'accès et indique si le rôle suffit, sans lever d'erreur. */
export async function accesVoyage(slug: string) {
  const utilisateur = await exigerUtilisateur();
  const db = await getDb();
  const ligne = await voyagePourUtilisateur(db, utilisateur.id, slug);
  if (!ligne) notFound();
  return { utilisateur, voyage: ligne.voyage, role: ligne.role, estAdmin: ligne.role === "admin" };
}

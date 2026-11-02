import "server-only";
import { cookies } from "next/headers";
import { utilisateurCourant } from "./auth";
import { getDb } from "./db";
import { signatureValide } from "./domaine/crypto";
import { verifierAccesLecteur, voyagePourUtilisateur } from "./domaine/voyages";
import { env } from "./env";

export type AccesSite =
  | { statut: "ok"; voyage: { id: string; nom: string; slug: string }; membre: boolean }
  | { statut: "mot-de-passe" }
  | { statut: "refuse" };

/**
 * Accès au site public d'un voyage :
 * - un lecteur avec un lien secret valide (et le mot de passe s'il y en a un) ;
 * - ou un membre connecté du voyage, qui voit le site sans lien.
 * Tout le reste reçoit « refuse » : on ne révèle pas que le voyage existe.
 */
export async function accesSite(slug: string): Promise<AccesSite> {
  const pot = await cookies();
  const jeton = pot.get("cc_lecteur")?.value ?? "";
  const db = await getDb();

  if (jeton) {
    const acces = await verifierAccesLecteur(db, slug, jeton);
    if (acces.statut === "ok") return { ...acces, membre: false };
    if (acces.statut === "mot-de-passe") {
      const sig = pot.get("cc_lecteur_mdp")?.value ?? "";
      if (sig && /^[0-9a-f]+$/.test(sig) && signatureValide(`${slug}:${jeton}`, sig, env().BETTER_AUTH_SECRET)) {
        const v = await db.query.voyage.findFirst({ where: (t, { eq }) => eq(t.slug, slug) });
        if (v) return { statut: "ok", voyage: { id: v.id, nom: v.nom, slug: v.slug }, membre: false };
      }
      // Un membre connecté n'a pas à saisir le mot de passe.
      const m = await membre(slug);
      return m ?? { statut: "mot-de-passe" };
    }
  }
  return (await membre(slug)) ?? { statut: "refuse" };
}

async function membre(slug: string): Promise<AccesSite | null> {
  const u = await utilisateurCourant();
  if (!u) return null;
  const ligne = await voyagePourUtilisateur(await getDb(), u.id, slug);
  if (!ligne) return null;
  return { statut: "ok", voyage: { id: ligne.voyage.id, nom: ligne.voyage.nom, slug: ligne.voyage.slug }, membre: true };
}

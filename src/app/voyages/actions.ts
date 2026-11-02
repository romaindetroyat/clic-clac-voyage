"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigerVoyage } from "@/server/acces";
import { exigerUtilisateur, getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { user } from "@/server/db/schema";
import {
  changerStatut,
  choisirImprimeur,
  definirPayeur,
  enregistrerMaCommande,
  EXEMPLAIRES_MAX,
  marquerCommandee,
  marquerPaye,
  type StatutCommande,
} from "@/server/domaine/commande";
import { reglerDecalage } from "@/server/domaine/medias";
import { supprimerCompte, supprimerVoyage } from "@/server/domaine/suppression";
import { getStockage } from "@/server/stockage";
import {
  deplacerEpisode,
  fusionnerAvecSuivant,
  modifierEpisode,
  proposerDecoupage,
  rangerNonClasses,
  scinder,
  supprimerEpisode,
} from "@/server/domaine/recit";
import { formaterDecalage, lireDecalage } from "@/server/domaine/temps";
import { courrielInvitation } from "@/server/email/modeles";
import { envoyerCourriel } from "@/server/email/envoi";
import { adminEmails, appUrl } from "@/server/env";
import { appelIa, iaActive } from "@/server/ia/client";
import { proposerMaj, rejeterMaj, validerMaj } from "@/server/ia/imprimeurs";
import {
  annulerInvitation,
  changerRole,
  creerLienSecret,
  creerVoyage,
  ErreurMetier,
  inviter,
  modifierVoyage,
  retirerParticipant,
  revoquerLienSecret,
} from "@/server/domaine/voyages";

export type EtatAction = { erreur?: string; message?: string; lien?: string } | undefined;

/** Exécute une action et transforme les erreurs métier en message affichable. */
async function proteger(fn: () => Promise<EtatAction>): Promise<EtatAction> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErreurMetier) return { erreur: e.message };
    if (e instanceof z.ZodError) return { erreur: e.issues[0]?.message ?? "Saisie invalide." };
    throw e;
  }
}

const dateFacultative = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
  .or(z.literal(""))
  .optional()
  .transform((v) => v || null);

const schemaVoyage = z.object({
  nom: z.string().trim().min(1, "Le nom du voyage est obligatoire.").max(120, "Nom trop long."),
  dateDebut: dateFacultative,
  dateFin: dateFacultative,
});

export async function actionCreerVoyage(_: EtatAction, form: FormData): Promise<EtatAction> {
  const u = await exigerUtilisateur();
  let slug = "";
  const r = await proteger(async () => {
    const d = schemaVoyage.parse(Object.fromEntries(form));
    slug = (await creerVoyage(await getDb(), u.id, d)).slug;
    return undefined;
  });
  if (r) return r;
  redirect(`/voyages/${slug}`);
}

export async function actionModifierVoyage(slug: string, _: EtatAction, form: FormData): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage } = await exigerVoyage(slug, "admin");
    const d = schemaVoyage.parse(Object.fromEntries(form));
    await modifierVoyage(await getDb(), voyage.id, d);
    revalidatePath(`/voyages/${slug}`, "layout");
    return { message: "Modifications enregistrées." };
  });
}

const schemaInvitation = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
  role: z.enum(["admin", "contributeur"]),
});

export async function actionInviter(slug: string, _: EtatAction, form: FormData): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage, utilisateur } = await exigerVoyage(slug, "admin");
    const d = schemaInvitation.parse(Object.fromEntries(form));
    const inv = await inviter(await getDb(), { voyageId: voyage.id, email: d.email, role: d.role, invitePar: utilisateur.id });
    const lien = `${appUrl()}/connexion?invitation=${inv.id}`;
    const m = courrielInvitation({ nomVoyage: voyage.nom, invitePar: utilisateur.nom, lien });
    await envoyerCourriel({ a: inv.email, ...m });
    revalidatePath(`/voyages/${slug}/participants`);
    return { message: inv.relance ? `Invitation renvoyée à ${inv.email}.` : `Invitation envoyée à ${inv.email}.` };
  });
}

export async function actionAnnulerInvitation(slug: string, invitationId: string): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage } = await exigerVoyage(slug, "admin");
    await annulerInvitation(await getDb(), voyage.id, invitationId);
    revalidatePath(`/voyages/${slug}/participants`);
    return { message: "Invitation annulée." };
  });
}

export async function actionRetirerParticipant(slug: string, userId: string): Promise<EtatAction> {
  let parti = false;
  const r = await proteger(async () => {
    // Chacun peut quitter un voyage ; retirer quelqu'un d'autre est réservé aux administrateurs.
    const acces = await exigerVoyage(slug, "contributeur");
    const soiMeme = userId === acces.utilisateur.id;
    if (!soiMeme) await exigerVoyage(slug, "admin");
    await retirerParticipant(await getDb(), acces.voyage.id, userId);
    parti = soiMeme;
    revalidatePath(`/voyages/${slug}/participants`);
    return { message: "Participant retiré du voyage." };
  });
  if (parti) redirect("/voyages");
  return r;
}

export async function actionChangerRole(slug: string, userId: string, role: "admin" | "contributeur"): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage } = await exigerVoyage(slug, "admin");
    await changerRole(await getDb(), voyage.id, userId, role);
    revalidatePath(`/voyages/${slug}/participants`);
    return { message: "Rôle modifié." };
  });
}

const schemaLien = z.object({
  libelle: z.string().trim().max(80, "Libellé trop long.").default(""),
  motDePasse: z.string().max(200).optional().transform((v) => v?.trim() || null),
});

export async function actionCreerLien(slug: string, _: EtatAction, form: FormData): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage, utilisateur } = await exigerVoyage(slug, "admin");
    const d = schemaLien.parse(Object.fromEntries(form));
    const { jeton } = await creerLienSecret(await getDb(), {
      voyageId: voyage.id,
      libelle: d.libelle,
      motDePasse: d.motDePasse,
      creePar: utilisateur.id,
    });
    revalidatePath(`/voyages/${slug}/partage`);
    return {
      message: "Lien créé. Copiez-le maintenant : il ne sera plus affiché.",
      lien: `${appUrl()}/v/${voyage.slug}?cle=${jeton}`,
    };
  });
}

export async function actionRevoquerLien(slug: string, lienId: string): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage } = await exigerVoyage(slug, "admin");
    await revoquerLienSecret(await getDb(), voyage.id, lienId);
    revalidatePath(`/voyages/${slug}/partage`);
    return { message: "Lien révoqué." };
  });
}

const schemaNom = z.object({ nom: z.string().trim().min(1, "Indiquez un nom.").max(80, "Nom trop long.") });

export async function actionModifierNom(_: EtatAction, form: FormData): Promise<EtatAction> {
  return proteger(async () => {
    const u = await exigerUtilisateur();
    const { nom } = schemaNom.parse(Object.fromEntries(form));
    await (await getDb()).update(user).set({ name: nom }).where(eq(user.id, u.id));
    revalidatePath("/", "layout");
    return { message: "Nom enregistré." };
  });
}

export async function actionDeconnexion() {
  const auth = await getAuth();
  await auth.api.signOut({ headers: await headers() });
  redirect("/connexion");
}

export async function actionRecalerAppareil(slug: string, appareilId: string, _: EtatAction, form: FormData): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage, utilisateur, role } = await exigerVoyage(slug, "contributeur");
    const secondes = lireDecalage(String(form.get("decalage") ?? ""));
    if (secondes === null) return { erreur: "Décalage illisible. Exemples : « +1 h 12 », « -3 min », « +00:45 »." };
    await reglerDecalage(await getDb(), { voyageId: voyage.id, userId: utilisateur.id, estAdmin: role === "admin" }, appareilId, secondes);
    revalidatePath(`/voyages/${slug}`, "layout");
    return { message: `Décalage enregistré : ${formaterDecalage(secondes)}.` };
  });
}

/* ------------------------------ Épisodes ------------------------------ */

async function surEpisodes(slug: string, fn: (voyageId: string) => Promise<EtatAction>) {
  return proteger(async () => {
    const { voyage } = await exigerVoyage(slug, "admin");
    const r = await fn(voyage.id);
    revalidatePath(`/voyages/${slug}`, "layout");
    return r;
  });
}

export async function actionProposerDecoupage(slug: string): Promise<EtatAction> {
  return surEpisodes(slug, async (id) => {
    const n = await proposerDecoupage(await getDb(), id);
    return { message: `${n} épisode${n > 1 ? "s" : ""} proposé${n > 1 ? "s" : ""}.` };
  });
}

export async function actionRangerNonClasses(slug: string): Promise<EtatAction> {
  return surEpisodes(slug, async (id) => {
    const n = await rangerNonClasses(await getDb(), id);
    return { message: `${n} photo${n > 1 ? "s" : ""} rangée${n > 1 ? "s" : ""}.` };
  });
}

const schemaEpisode = z.object({
  titre: z.string().trim().min(1, "Le titre est obligatoire.").max(120),
  lieu: z.string().max(120).optional(),
  recit: z.string().max(20_000).optional(),
});

export async function actionModifierEpisode(slug: string, episodeId: string, _: EtatAction, form: FormData): Promise<EtatAction> {
  return surEpisodes(slug, async (id) => {
    await modifierEpisode(await getDb(), id, episodeId, schemaEpisode.parse(Object.fromEntries(form)));
    return { message: "Épisode enregistré." };
  });
}

export async function actionFusionner(slug: string, episodeId: string): Promise<EtatAction> {
  return surEpisodes(slug, async (id) => {
    await fusionnerAvecSuivant(await getDb(), id, episodeId);
    return { message: "Épisodes fusionnés." };
  });
}

export async function actionDeplacerEpisode(slug: string, episodeId: string, sens: -1 | 1): Promise<EtatAction> {
  return surEpisodes(slug, async (id) => {
    await deplacerEpisode(await getDb(), id, episodeId, sens);
    return undefined;
  });
}

export async function actionSupprimerEpisode(slug: string, episodeId: string): Promise<EtatAction> {
  return surEpisodes(slug, async (id) => {
    await supprimerEpisode(await getDb(), id, episodeId);
    return { message: "Épisode supprimé : ses photos sont « à classer »." };
  });
}

export async function actionScinder(slug: string, episodeId: string, mediaId: string): Promise<EtatAction> {
  return surEpisodes(slug, async (id) => {
    await scinder(await getDb(), id, episodeId, mediaId);
    return { message: "Épisode scindé." };
  });
}

/* ------------------------- Imprimeur et commande ------------------------- */

export async function actionChoisirImprimeur(slug: string, imprimeurId: string, produitId: string): Promise<EtatAction> {
  const r = await proteger(async () => {
    const { voyage, utilisateur } = await exigerVoyage(slug, "admin");
    await choisirImprimeur(await getDb(), { voyageId: voyage.id, userId: utilisateur.id }, imprimeurId, produitId);
    return undefined;
  });
  if (r?.erreur) return r;
  redirect(`/voyages/${slug}/livre?imprimeur=1`);
}

const schemaCommande = z.object({
  exemplaires: z.coerce.number().int("Nombre d’exemplaires invalide.").min(0).max(EXEMPLAIRES_MAX, `${EXEMPLAIRES_MAX} exemplaires au plus.`),
  livraison: z.enum(["groupee", "domicile"]),
  adresse: z.string().max(500).optional(),
});

export async function actionMaCommande(slug: string, _: EtatAction, form: FormData): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage, utilisateur } = await exigerVoyage(slug);
    const d = schemaCommande.parse(Object.fromEntries(form));
    await enregistrerMaCommande(await getDb(), { voyageId: voyage.id, userId: utilisateur.id }, d);
    revalidatePath(`/voyages/${slug}/commande`);
    return { message: d.exemplaires ? "Votre commande est enregistrée." : "Vous ne commandez pas d’exemplaire." };
  });
}

export async function actionStatutCommande(slug: string, userId: string, statut: StatutCommande): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage } = await exigerVoyage(slug, "admin");
    await changerStatut(await getDb(), voyage.id, userId, statut);
    revalidatePath(`/voyages/${slug}/commande`);
    return { message: "Statut mis à jour." };
  });
}

export async function actionPaye(slug: string, userId: string, paye: boolean): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage } = await exigerVoyage(slug, "admin");
    await marquerPaye(await getDb(), voyage.id, userId, paye);
    revalidatePath(`/voyages/${slug}/commande`);
    return { message: paye ? "Remboursement noté." : "Remboursement annulé." };
  });
}

export async function actionPayeur(slug: string, _: EtatAction, form: FormData): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage } = await exigerVoyage(slug, "admin");
    await definirPayeur(await getDb(), voyage.id, String(form.get("payeur") ?? ""));
    revalidatePath(`/voyages/${slug}/commande`);
    return { message: "C’est noté." };
  });
}

export async function actionCommandePassee(slug: string): Promise<EtatAction> {
  return proteger(async () => {
    const { voyage, utilisateur } = await exigerVoyage(slug, "admin");
    await marquerCommandee(await getDb(), { voyageId: voyage.id, userId: utilisateur.id, estAdmin: true });
    revalidatePath(`/voyages/${slug}/commande`);
    return { message: "Commande notée comme passée : les montants sont figés." };
  });
}

/* ------------------------------ RGPD ------------------------------ */

export async function actionSupprimerVoyage(slug: string, _: EtatAction, form: FormData): Promise<EtatAction> {
  const r = await proteger(async () => {
    const { voyage } = await exigerVoyage(slug, "admin");
    if (String(form.get("confirmation") ?? "").trim() !== voyage.nom) {
      throw new ErreurMetier("Recopiez exactement le nom du voyage pour confirmer.");
    }
    await supprimerVoyage(await getDb(), getStockage(), voyage.id);
    return undefined;
  });
  if (r?.erreur) return r;
  revalidatePath("/voyages");
  redirect("/voyages");
}

export async function actionSupprimerCompte(_: EtatAction, form: FormData): Promise<EtatAction> {
  const r = await proteger(async () => {
    const u = await exigerUtilisateur();
    if (String(form.get("confirmation") ?? "").trim().toLowerCase() !== u.email.toLowerCase()) {
      throw new ErreurMetier("Recopiez votre adresse e-mail pour confirmer.");
    }
    await supprimerCompte(await getDb(), getStockage(), u.id);
    return undefined;
  });
  if (r?.erreur) return r;
  // La session n'existe plus en base ; on retire aussi les cookies du navigateur.
  const pot = await cookies();
  for (const c of pot.getAll()) if (c.name.includes("better-auth")) pot.delete(c.name);
  redirect("/?compte=supprime");
}

/* ------------------------------------------------------------------ */
/* Mise à jour des fiches imprimeurs par l'IA (administrateurs de l'app) */
/* ------------------------------------------------------------------ */

async function exigerAdminApp(slug: string) {
  const a = await exigerVoyage(slug);
  if (!adminEmails().includes(a.utilisateur.email.toLowerCase())) throw new ErreurMetier("Réservé aux administrateurs de l’application.");
  return a;
}

export async function actionMajImprimeurIa(slug: string, imprimeurId: string): Promise<EtatAction> {
  return proteger(async () => {
    const { utilisateur } = await exigerAdminApp(slug);
    if (!iaActive()) throw new ErreurMetier("L’IA n’est pas configurée (clé d’API absente).");
    const r = await proposerMaj(await getDb(), appelIa(), imprimeurId, utilisateur.id);
    revalidatePath(`/voyages/${slug}/imprimeurs`);
    return { message: r.propositions.length ? `${r.propositions.length} changement${r.propositions.length > 1 ? "s" : ""} proposé${r.propositions.length > 1 ? "s" : ""} : à valider ci-dessous.` : "Rien à changer d’après l’IA : validez pour dater la vérification." };
  });
}

export async function actionValiderMaj(slug: string, majId: string, _: EtatAction, form: FormData): Promise<EtatAction> {
  return proteger(async () => {
    await exigerAdminApp(slug);
    const acceptees = form.getAll("p").map(Number).filter(Number.isInteger);
    await validerMaj(await getDb(), majId, acceptees);
    revalidatePath(`/voyages/${slug}/imprimeurs`);
    return { message: "Fiche mise à jour." };
  });
}

export async function actionRejeterMaj(slug: string, majId: string): Promise<EtatAction> {
  return proteger(async () => {
    await exigerAdminApp(slug);
    await rejeterMaj(await getDb(), majId);
    revalidatePath(`/voyages/${slug}/imprimeurs`);
    return undefined;
  });
}

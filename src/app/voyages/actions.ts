"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigerVoyage } from "@/server/acces";
import { exigerUtilisateur, getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { user } from "@/server/db/schema";
import { reglerDecalage } from "@/server/domaine/medias";
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
import { appUrl } from "@/server/env";
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

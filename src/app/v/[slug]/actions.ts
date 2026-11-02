"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { signer } from "@/server/domaine/crypto";
import { verifierAccesLecteur } from "@/server/domaine/voyages";
import { env } from "@/server/env";

export async function actionMotDePasseLecteur(slug: string, _: string | undefined, form: FormData) {
  const pot = await cookies();
  const jeton = pot.get("cc_lecteur")?.value ?? "";
  const mdp = String(form.get("motDePasse") ?? "");
  const r = await verifierAccesLecteur(await getDb(), slug, jeton, mdp);
  if (r.statut !== "ok") return "Mot de passe incorrect.";
  pot.set("cc_lecteur_mdp", signer(`${slug}:${jeton}`, env().BETTER_AUTH_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/v/${slug}`,
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(`/v/${slug}`);
}

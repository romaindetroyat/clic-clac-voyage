import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { ErreurMetier, voyagePourUtilisateur } from "./domaine/voyages";

export type ContexteApi = {
  userId: string;
  voyageId: string;
  fuseau: string;
  estAdmin: boolean;
};

/** Authentifie la requête et vérifie l'appartenance au voyage ; 401/404 sinon. */
export async function contexteApi(slug: string): Promise<ContexteApi | NextResponse> {
  const h = await headers();
  const s = await (await getAuth()).api.getSession({ headers: h });
  if (!s) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  const ligne = await voyagePourUtilisateur(await getDb(), s.user.id, slug);
  if (!ligne) return NextResponse.json({ erreur: "Introuvable." }, { status: 404 });
  return { userId: s.user.id, voyageId: ligne.voyage.id, fuseau: ligne.voyage.fuseau, estAdmin: ligne.role === "admin" };
}

/** Transforme les erreurs métier et de validation en réponses JSON 400. */
export async function repondre<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof ErreurMetier) return NextResponse.json({ erreur: e.message }, { status: 400 });
    if (e instanceof z.ZodError) return NextResponse.json({ erreur: e.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
    if (e instanceof SyntaxError) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
    throw e;
  }
}

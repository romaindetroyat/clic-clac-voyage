import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { courrielCode } from "../email/modeles";
import { envoyerCourriel } from "../email/envoi";
import { adminEmails, appUrl, env } from "../env";
import { creerAuth, type Auth } from "./creer";

const g = globalThis as unknown as { __clicClacAuth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  if (!g.__clicClacAuth) {
    g.__clicClacAuth = (async () => {
      const e = env();
      return creerAuth({
        db: await getDb(),
        secret: e.BETTER_AUTH_SECRET,
        baseURL: appUrl(),
        adminEmails: adminEmails(),
        google:
          e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
            ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET }
            : undefined,
        envoyerCode: async ({ email, code, lien, minutes }) => {
          const m = courrielCode({ code, lien, minutes });
          await envoyerCourriel({ a: email, ...m });
        },
      });
    })();
  }
  return g.__clicClacAuth;
}

export type Utilisateur = { id: string; nom: string; email: string };

export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  return { id: s.user.id, nom: s.user.name, email: s.user.email };
}

/** Utilisateur connecté, sinon redirection vers la page de connexion. */
export async function exigerUtilisateur(): Promise<Utilisateur> {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  return u;
}

export function googleActif(): boolean {
  const e = env();
  return !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}

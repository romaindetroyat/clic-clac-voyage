import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import type { Db } from "../db/client";
import * as schema from "../db/schema";
import { accepterInvitations, normaliserEmail, peutCreerCompte } from "../domaine/voyages";

export const DUREE_CODE_MINUTES = 15;

export type OptionsAuth = {
  db: Db;
  secret: string;
  baseURL: string;
  adminEmails: string[];
  google?: { clientId: string; clientSecret: string };
  /** Limitation de débit (désactivée dans les tests unitaires). */
  limiterDebit?: boolean;
  /** Codes envoyés par minute et par adresse IP (10 par défaut). */
  codesParMinute?: number;
  envoyerCode: (args: { email: string; code: string; lien: string; minutes: number }) => Promise<void>;
};

/**
 * Authentification sans mot de passe :
 * - un code à 6 chiffres envoyé par e-mail, accompagné d'un lien qui le saisit à votre place
 *   (le « lien magique » réutilise donc le même mécanisme) ;
 * - Google en option.
 * Création de compte réservée aux adresses invitées (ou listées dans ADMIN_EMAILS).
 */
export function creerAuth(o: OptionsAuth) {
  return betterAuth({
    appName: "Clic-Clac Voyage",
    baseURL: o.baseURL,
    secret: o.secret,
    telemetry: { enabled: false },
    database: drizzleAdapter(o.db, {
      provider: "pg",
      transaction: true,
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    session: {
      expiresIn: 60 * 60 * 24 * 90, // 90 jours : on se connecte rarement sur ce genre d'app
      updateAge: 60 * 60 * 24,
    },
    socialProviders: o.google
      ? { google: { clientId: o.google.clientId, clientSecret: o.google.clientSecret, prompt: "select_account" } }
      : undefined,
    account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
    rateLimit: {
      enabled: o.limiterDebit ?? true,
      // En base : sur Vercel, chaque instance aurait sinon son propre compteur.
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        // Un groupe sur le même Wi-Fi partage une adresse IP : on laisse de la marge.
        "/email-otp/send-verification-otp": { window: 60, max: o.codesParMinute ?? 10 },
        // Deux essais de saisie par code envoyé (20 par minute en production, relevé avec la limite des codes pour les tests E2E).
        "/sign-in/email-otp": { window: 60, max: Math.max(20, 2 * (o.codesParMinute ?? 10)) },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => {
            const email = normaliserEmail(u.email);
            if (!(await peutCreerCompte(o.db, email, o.adminEmails))) {
              throw new APIError("FORBIDDEN", {
                message: "Cette adresse n'a pas été invitée. Demandez une invitation à l'organisateur du voyage.",
              });
            }
            const nom = u.name?.trim() || email.split("@")[0];
            return { data: { ...u, email, name: nom } };
          },
        },
      },
      session: {
        create: {
          after: async (s) => {
            // À chaque connexion, les invitations en attente deviennent des participations.
            const u = await o.db.query.user.findFirst({
              where: (t, { eq }) => eq(t.id, s.userId),
              columns: { email: true },
            });
            if (u) await accepterInvitations(o.db, s.userId, u.email);
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: DUREE_CODE_MINUTES * 60,
        allowedAttempts: 5,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in") return;
          const e = normaliserEmail(email);
          // Pas d'e-mail pour une adresse inconnue et non invitée (réponse identique côté client).
          const existe = await o.db.query.user.findFirst({ where: (t, { eq }) => eq(t.email, e), columns: { id: true } });
          if (!existe && !(await peutCreerCompte(o.db, e, o.adminEmails))) return;
          const lien = `${o.baseURL}/connexion/code?email=${encodeURIComponent(e)}&code=${otp}`;
          await o.envoyerCode({ email: e, code: otp, lien, minutes: DUREE_CODE_MINUTES });
        },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof creerAuth>;

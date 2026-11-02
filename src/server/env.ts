import "server-only";
import { z } from "zod";

/**
 * Variables d'environnement validées une seule fois.
 * Aucune valeur par défaut secrète : en production, tout doit venir de Vercel.
 */
const schema = z.object({
  // URL publique de l'app, sans barre finale. Sert à tous les liens absolus
  // (invitations, liens secrets, e-mails, manifeste). Ex. https://clic-clac-voyage.vercel.app
  APP_URL: z.string().url().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  // Postgres (Neon) ou « pglite:<dossier> » pour le développement et les tests.
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  // E-mails autorisés à se connecter sans invitation (amorçage), séparés par des virgules.
  ADMIN_EMAILS: z.string().default(""),
  // Envoi par Gmail (SMTP) : adresse Gmail + mot de passe d'application Google (16 caractères).
  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  // Ou envoi par Resend (nécessite un domaine vérifié).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  // Si défini, les e-mails sont écrits dans ce fichier au lieu d'être envoyés (dev, tests E2E).
  MAIL_OUTBOX_FILE: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const champs = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Variables d'environnement invalides ou manquantes : ${champs}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** URL de base de l'app, sans barre finale. */
export function appUrl(): string {
  const e = env();
  if (e.APP_URL) return e.APP_URL.replace(/\/+$/, "");
  if (e.VERCEL_PROJECT_PRODUCTION_URL) return `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function adminEmails(): string[] {
  return env()
    .ADMIN_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

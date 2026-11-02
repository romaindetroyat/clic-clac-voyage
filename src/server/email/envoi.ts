import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { env } from "../env";

export type Courriel = { a: string; sujet: string; texte: string; html: string };

/**
 * Envoie un e-mail via Resend. Sans clé Resend (ou si MAIL_OUTBOX_FILE est défini),
 * l'e-mail est écrit dans un fichier JSONL local : utile en développement et pour les tests E2E.
 * Aucune donnée n'est journalisée en production.
 */
export async function envoyerCourriel(c: Courriel): Promise<void> {
  const e = env();
  if (e.MAIL_OUTBOX_FILE || !e.RESEND_API_KEY) {
    const fichier = e.MAIL_OUTBOX_FILE ?? ".data/outbox.jsonl";
    if (process.env.NODE_ENV === "production" && !e.MAIL_OUTBOX_FILE) {
      throw new Error("RESEND_API_KEY manquante : impossible d'envoyer l'e-mail.");
    }
    await mkdir(path.dirname(fichier), { recursive: true });
    await appendFile(fichier, JSON.stringify({ ...c, envoyeLe: new Date().toISOString() }) + "\n");
    return;
  }
  const resend = new Resend(e.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: e.EMAIL_FROM, to: c.a, subject: c.sujet, text: c.texte, html: c.html });
  if (error) throw new Error(`Échec d'envoi de l'e-mail : ${error.message}`);
}

import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

export type Courriel = { a: string; sujet: string; texte: string; html: string };

/**
 * Envoi d'un e-mail, par ordre de priorité :
 * 1. MAIL_OUTBOX_FILE défini : écrit dans un fichier JSONL (développement, tests E2E) ;
 * 2. GMAIL_USER + GMAIL_APP_PASSWORD : Gmail en SMTP (quelques centaines d'e-mails par jour, gratuit) ;
 * 3. RESEND_API_KEY : Resend (domaine d'envoi vérifié nécessaire) ;
 * 4. sinon : fichier local en développement, erreur en production.
 * Aucun contenu d'e-mail n'est journalisé.
 */
export async function envoyerCourriel(c: Courriel): Promise<void> {
  const e = env();

  if (e.MAIL_OUTBOX_FILE) return ecrireDansFichier(e.MAIL_OUTBOX_FILE, c);

  if (e.GMAIL_USER && e.GMAIL_APP_PASSWORD) {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: e.GMAIL_USER, pass: e.GMAIL_APP_PASSWORD.replace(/\s+/g, "") },
    });
    await transport.sendMail({
      // Gmail impose l'adresse du compte comme expéditeur ; seul le nom affiché est libre.
      from: { name: "Clic-Clac Voyage", address: e.GMAIL_USER },
      to: c.a,
      subject: c.sujet,
      text: c.texte,
      html: c.html,
    });
    return;
  }

  if (e.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const { error } = await new Resend(e.RESEND_API_KEY).emails.send({
      from: e.EMAIL_FROM ?? "Clic-Clac Voyage <onboarding@resend.dev>",
      to: c.a,
      subject: c.sujet,
      text: c.texte,
      html: c.html,
    });
    if (error) throw new Error(`Échec d'envoi de l'e-mail : ${error.message}`);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Aucun moyen d'envoi d'e-mail configuré (GMAIL_USER/GMAIL_APP_PASSWORD ou RESEND_API_KEY).");
  }
  return ecrireDansFichier(".data/outbox.jsonl", c);
}

async function ecrireDansFichier(fichier: string, c: Courriel) {
  await mkdir(path.dirname(fichier), { recursive: true });
  await appendFile(fichier, JSON.stringify({ ...c, envoyeLe: new Date().toISOString() }) + "\n");
}

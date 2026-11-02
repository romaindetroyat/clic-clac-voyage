/** Modèles d'e-mails, en français, sobres, lisibles sans images. */

function echapper(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function gabarit(titre: string, corps: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f3ee;font-family:Georgia,'Times New Roman',serif;color:#1d1b18">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7a7268;margin:0 0 24px">Clic-Clac Voyage</p>
<h1 style="font-size:22px;font-weight:normal;margin:0 0 16px">${echapper(titre)}</h1>
${corps}
</div></body></html>`;
}

export function courrielCode(args: { code: string; lien: string; minutes: number }) {
  const sujet = `Votre code de connexion : ${args.code}`;
  const texte = `Votre code de connexion à Clic-Clac Voyage : ${args.code}

Ou ouvrez ce lien pour vous connecter directement :
${args.lien}

Ce code et ce lien sont valables ${args.minutes} minutes. Si vous n'avez rien demandé, ignorez cet e-mail.`;
  const html = gabarit(
    "Votre code de connexion",
    `<p style="font-size:34px;letter-spacing:.3em;font-family:'Courier New',monospace;margin:8px 0 24px">${echapper(args.code)}</p>
<p style="margin:0 0 24px"><a href="${echapper(args.lien)}" style="display:inline-block;background:#1d1b18;color:#f6f3ee;text-decoration:none;padding:12px 20px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px">Me connecter</a></p>
<p style="font-size:14px;color:#7a7268;font-family:Arial,sans-serif">Valable ${args.minutes} minutes. Si vous n'avez rien demandé, ignorez cet e-mail.</p>`,
  );
  return { sujet, texte, html };
}

export function courrielInvitation(args: { nomVoyage: string; invitePar: string; lien: string }) {
  const sujet = `${args.invitePar} vous invite au voyage « ${args.nomVoyage} »`;
  const texte = `${args.invitePar} vous invite à partager les photos du voyage « ${args.nomVoyage} » sur Clic-Clac Voyage.

Pour rejoindre le voyage, ouvrez ce lien et connectez-vous avec cette adresse e-mail (pas de mot de passe) :
${args.lien}`;
  const html = gabarit(
    `Rejoignez « ${args.nomVoyage} »`,
    `<p style="font-size:16px;line-height:1.5;margin:0 0 24px">${echapper(args.invitePar)} vous invite à partager les photos et les souvenirs de ce voyage. Pas de mot de passe : un code vous sera envoyé par e-mail.</p>
<p style="margin:0 0 24px"><a href="${echapper(args.lien)}" style="display:inline-block;background:#1d1b18;color:#f6f3ee;text-decoration:none;padding:12px 20px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px">Rejoindre le voyage</a></p>`,
  );
  return { sujet, texte, html };
}

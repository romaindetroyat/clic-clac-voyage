"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Etape = { nom: "email" } | { nom: "code"; email: string };

export function FormulaireConnexion({ emailInitial, google }: { emailInitial: string; google: boolean }) {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>({ nom: "email" });
  const [email, setEmail] = useState(emailInitial);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function envoyerCode(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    const adresse = email.trim().toLowerCase();
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: adresse, type: "sign-in" });
    setEnCours(false);
    if (error) {
      setErreur(error.status === 429 ? "Trop de demandes. Patientez une minute." : "Envoi impossible pour le moment.");
      return;
    }
    setEtape({ nom: "code", email: adresse });
  }

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    if (etape.nom !== "code") return;
    setErreur(null);
    setEnCours(true);
    const { error } = await authClient.signIn.emailOtp({ email: etape.email, otp: code.trim() });
    setEnCours(false);
    if (error) {
      setErreur(
        error.status === 403
          ? "Cette adresse n’a pas été invitée. Demandez une invitation à l’organisateur du voyage."
          : "Code incorrect ou expiré.",
      );
      return;
    }
    router.replace("/voyages");
    router.refresh();
  }

  if (etape.nom === "code") {
    return (
      <form onSubmit={verifier} className="space-y-4">
        <p className="text-sm text-encre-douce">
          Si l’adresse <strong className="text-encre">{etape.email}</strong> a été invitée, un e-mail vient de partir.
          Saisissez le code, ou ouvrez le lien de l’e-mail.
        </p>
        <label className="block space-y-1.5">
          <span className="etiquette">Code à 6 chiffres</span>
          <input
            className="champ text-center font-mono text-2xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        {erreur ? (
          <p role="alert" className="text-sm text-danger">
            {erreur}
          </p>
        ) : null}
        <button className="bouton w-full" disabled={enCours || code.length !== 6}>
          {enCours ? "Vérification…" : "Me connecter"}
        </button>
        <button type="button" className="lien text-sm" onClick={() => setEtape({ nom: "email" })}>
          Changer d’adresse ou renvoyer un code
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={envoyerCode} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="etiquette">Adresse e-mail</span>
          <input
            className="champ"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {erreur ? (
          <p role="alert" className="text-sm text-danger">
            {erreur}
          </p>
        ) : null}
        <button className="bouton w-full" disabled={enCours}>
          {enCours ? "Envoi…" : "Recevoir mon code"}
        </button>
      </form>
      {google ? (
        <>
          <div className="flex items-center gap-3 text-xs text-encre-douce">
            <span className="h-px flex-1 bg-filet" /> ou <span className="h-px flex-1 bg-filet" />
          </div>
          <button
            type="button"
            className="bouton-discret w-full"
            onClick={() =>
              authClient.signIn.social({ provider: "google", callbackURL: "/voyages", errorCallbackURL: "/connexion?erreur=google" })
            }
          >
            Continuer avec Google
          </button>
        </>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Le lien de l'e-mail mène ici : le code est saisi automatiquement.
 * La connexion n'a lieu qu'avec JavaScript, ce qui évite qu'un antivirus de messagerie
 * qui « visite » le lien ne consomme le code à la place de la personne.
 */
export function ConnexionParLien({ email, code }: { email: string; code: string }) {
  const router = useRouter();
  const lienValide = !!email && /^\d{6}$/.test(code);
  const [etat, setEtat] = useState<"encours" | "erreur">(lienValide ? "encours" : "erreur");
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;
    if (!lienValide) return;
    authClient.signIn.emailOtp({ email, otp: code }).then(({ error }) => {
      if (error) {
        setEtat("erreur");
        return;
      }
      router.replace("/voyages");
      router.refresh();
    });
  }, [email, code, router, lienValide]);

  if (etat === "erreur") {
    return (
      <div className="space-y-4">
        <h1 className="text-4xl">Lien expiré</h1>
        <p className="text-encre-douce">Ce lien n’est plus valable ou a déjà servi. Demandez un nouveau code.</p>
        <Link href="/connexion" className="bouton">
          Recevoir un nouveau code
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h1 className="text-4xl">Connexion en cours…</h1>
      <p className="text-encre-douce">Un instant.</p>
    </div>
  );
}

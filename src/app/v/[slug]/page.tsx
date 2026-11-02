import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db";
import { signatureValide } from "@/server/domaine/crypto";
import { verifierAccesLecteur } from "@/server/domaine/voyages";
import { env } from "@/server/env";
import { actionMotDePasseLecteur } from "./actions";
import { FormulaireMotDePasse } from "./mot-de-passe";

export const metadata = { title: "Le voyage", robots: { index: false, follow: false } };

export default async function SiteVoyage({ params }: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  const pot = await cookies();
  const jeton = pot.get("cc_lecteur")?.value ?? "";
  const db = await getDb();

  let acces = await verifierAccesLecteur(db, slug, jeton);
  if (acces.statut === "mot-de-passe") {
    const sig = pot.get("cc_lecteur_mdp")?.value ?? "";
    if (sig && /^[0-9a-f]+$/.test(sig) && signatureValide(`${slug}:${jeton}`, sig, env().BETTER_AUTH_SECRET)) {
      // Mot de passe déjà vérifié pour ce jeton : on ne le redemande pas.
      const ligne = await db.query.voyage.findFirst({ where: (t, { eq }) => eq(t.slug, slug) });
      if (ligne) acces = { statut: "ok", voyage: { id: ligne.id, nom: ligne.nom, slug: ligne.slug } };
    }
  }

  // Lien absent, faux ou révoqué : on ne révèle pas que le voyage existe.
  if (acces.statut === "refuse") notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="etiquette">Clic-Clac Voyage</p>
      {acces.statut === "mot-de-passe" ? (
        <>
          <h1 className="text-4xl">Ce voyage est protégé</h1>
          <p className="text-encre-douce">Saisissez le mot de passe transmis avec le lien.</p>
          <FormulaireMotDePasse action={actionMotDePasseLecteur.bind(null, slug)} />
        </>
      ) : (
        <>
          <h1 className="text-5xl">{acces.voyage.nom}</h1>
          <p className="text-encre-douce">Le site de ce voyage est en préparation. Revenez bientôt : ce lien restera valable.</p>
        </>
      )}
    </main>
  );
}

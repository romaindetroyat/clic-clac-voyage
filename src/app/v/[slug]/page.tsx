import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Site } from "@/components/site/site";
import { getDb } from "@/server/db";
import { donneesSite } from "@/server/domaine/site";
import { accesSite } from "@/server/lecteur";
import { classesPolices } from "../polices";
import { actionMotDePasseLecteur } from "./actions";
import { FormulaireMotDePasse } from "./mot-de-passe";
import { ActivationSite, BoutonHorsLigne } from "./outils";

export async function generateMetadata({ params }: PageProps<"/v/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const acces = await accesSite(slug);
  return {
    title: acces.statut === "ok" ? { absolute: acces.voyage.nom } : "Le voyage",
    robots: { index: false, follow: false },
    // Installé sur l'écran d'accueil, le site s'ouvre directement (et non sur l'app).
    manifest: `/v/${slug}/manifest.webmanifest`,
    referrer: "no-referrer",
  };
}

export default async function SiteVoyage({ params }: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  const acces = await accesSite(slug);

  // Lien absent, faux ou révoqué : on ne révèle pas que le voyage existe.
  if (acces.statut === "refuse") notFound();

  if (acces.statut === "mot-de-passe") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
        <p className="etiquette">Clic-Clac Voyage</p>
        <h1 className="text-4xl">Ce voyage est protégé</h1>
        <p className="text-encre-douce">Saisissez le mot de passe transmis avec le lien.</p>
        <FormulaireMotDePasse action={actionMotDePasseLecteur.bind(null, slug)} />
      </main>
    );
  }

  const d = await donneesSite(await getDb(), acces.voyage.id, (id, t) => `/v/${slug}/m/${id}/${t}`);
  const urls = [...d.episodes.flatMap((e) => e.medias), ...d.horsEpisodes].flatMap((m) =>
    [m.urls.s, m.urls.m ?? m.urls.affiche].filter((u): u is string => !!u),
  );

  return (
    <div className={`${classesPolices} flex flex-1 flex-col`}>
      {acces.membre ? (
        <p className="bg-encre px-4 py-2 text-center text-sm text-papier">
          Vous voyez le site tel que vos lecteurs le verront.{" "}
          <Link href={`/voyages/${slug}/site`} className="underline underline-offset-4">
            Régler le site
          </Link>
        </p>
      ) : null}
      <Site d={d} pied={<BoutonHorsLigne urls={urls} />} />
      <ActivationSite journal={d.journal} />
    </div>
  );
}

import { Entete } from "@/components/entete";
import { Onglets } from "@/components/onglets";
import { SelecteurVoyage } from "@/components/selecteur-voyage";
import { periode } from "@/lib/dates";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { voyagesDe } from "@/server/domaine/voyages";

export default async function LayoutVoyage({ children, params }: LayoutProps<"/voyages/[slug]">) {
  const { slug } = await params;
  const { utilisateur, voyage, estAdmin } = await accesVoyage(slug);
  const mesVoyages = await voyagesDe(await getDb(), utilisateur.id);
  const base = `/voyages/${voyage.slug}`;
  const liens = [
    { href: base, libelle: "Le voyage" },
    { href: `${base}/photos`, libelle: "Photos" },
    { href: `${base}/recit`, libelle: "Récit" },
    { href: `${base}/importer`, libelle: "Importer" },
    { href: `${base}/appareils`, libelle: "Appareils" },
    { href: `${base}/participants`, libelle: "Participants" },
    ...(estAdmin
      ? [
          { href: `${base}/site`, libelle: "Site" },
          { href: `${base}/partage`, libelle: "Partage" },
          { href: `${base}/reglages`, libelle: "Réglages" },
        ]
      : []),
  ];

  return (
    <>
      <Entete nom={utilisateur.nom}>
        <SelecteurVoyage voyages={mesVoyages} actuel={voyage.slug} />
      </Entete>
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <div className="space-y-1">
          <h1 className="text-4xl sm:text-5xl">{voyage.nom}</h1>
          {periode(voyage.dateDebut, voyage.dateFin) ? (
            <p className="text-encre-douce">{periode(voyage.dateDebut, voyage.dateFin)}</p>
          ) : null}
        </div>
        <Onglets liens={liens} />
        <main>{children}</main>
      </div>
    </>
  );
}

import Link from "next/link";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { participantsDe } from "@/server/domaine/voyages";

export async function generateMetadata({ params }: PageProps<"/voyages/[slug]">) {
  const { slug } = await params;
  const { voyage } = await accesVoyage(slug);
  return { title: voyage.nom };
}

const A_VENIR = [
  { titre: "Import des photos et vidéos", texte: "Depuis le téléphone, l’ordinateur, Google Photos, WhatsApp… même avec un réseau capricieux." },
  { titre: "Épisodes et récit", texte: "Découpage automatique du voyage, légendes, commentaires, réactions et retouches." },
  { titre: "Le site du voyage", texte: "Un beau site à partager par lien secret, consultable hors ligne et exportable." },
  { titre: "Le livre photo", texte: "Mis en page automatiquement, retouché page par page, prêt pour l’imprimeur choisi." },
];

export default async function PageVoyage({ params }: PageProps<"/voyages/[slug]">) {
  const { slug } = await params;
  const { voyage, estAdmin } = await accesVoyage(slug);
  const participants = await participantsDe(await getDb(), voyage.id);

  return (
    <div className="space-y-10">
      <section className="carte flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <strong>{participants.length}</strong> participant{participants.length > 1 ? "s" : ""} :{" "}
          <span className="text-encre-douce">{participants.map((p) => p.nom).join(", ")}</span>
        </p>
        {estAdmin ? (
          <Link href={`/voyages/${voyage.slug}/participants`} className="bouton-discret">
            Inviter quelqu’un
          </Link>
        ) : null}
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl">Bientôt dans ce voyage</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {A_VENIR.map((a) => (
            <li key={a.titre} className="carte">
              <h3 className="text-xl">{a.titre}</h3>
              <p className="mt-1 text-sm text-encre-douce">{a.texte}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import Link from "next/link";
import { accesVoyage } from "@/server/acces";

export const metadata = { title: "Importer : mode d’emploi" };

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl">{titre}</h2>
      <div className="space-y-3 text-encre-douce [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_strong]:text-encre">
        {children}
      </div>
    </section>
  );
}

export default async function Aide({ params }: PageProps<"/voyages/[slug]/importer/aide">) {
  const { slug } = await params;
  const { voyage } = await accesVoyage(slug);
  return (
    <div className="max-w-2xl space-y-10">
      <Link href={`/voyages/${voyage.slug}/importer`} className="lien text-sm">
        ← Retour à l’import
      </Link>

      <Bloc titre="Depuis un iPhone">
        <p>
          <strong>Le plus simple :</strong> bouton « Choisir des photos et vidéos », puis sélectionnez-les dans la
          photothèque. Selon la version d’iOS, l’iPhone peut convertir les photos en JPEG au passage : pour garder
          à coup sûr l’original (HEIC, avec la date et le lieu), préférez la méthode « Enregistrer dans Fichiers »
          ci-dessous.
        </p>
        <p>
          <strong>Beaucoup de photos d’un coup :</strong> dans Photos, sélectionnez-les, touchez Partager puis{" "}
          <strong>Enregistrer dans Fichiers</strong> (option « Toutes les données de la photo » activée). Dans l’app, «
          Choisir des photos et vidéos » puis <strong>Parcourir</strong> et prenez le dossier.
        </p>
        <p>Gardez l’app ouverte pendant l’envoi : l’iPhone met en pause les envois des apps en arrière-plan. S’il est interrompu, il reprend à la réouverture.</p>
      </Bloc>

      <Bloc titre="Depuis un téléphone Android">
        <ol>
          <li>Installez l’app sur l’écran d’accueil (menu ⋮ de Chrome, « Installer l’application »).</li>
          <li>
            Dans Google Photos ou la Galerie, sélectionnez des photos, touchez <strong>Partager</strong> puis{" "}
            <strong>Clic-Clac</strong>.
          </li>
          <li>Choisissez le voyage : l’envoi démarre.</li>
        </ol>
      </Bloc>

      <Bloc titre="Depuis iCloud">
        <p>
          Les <strong>albums partagés iCloud</strong> ne contiennent que des versions réduites, trop petites pour un livre
          imprimé : ne les utilisez pas comme source.
        </p>
        <ol>
          <li>
            Sur Mac : app Photos, sélectionnez les photos, menu Fichier → <strong>Exporter</strong> →{" "}
            <strong>Exporter l’original non modifié</strong>, puis glissez le dossier sur la page d’import.
          </li>
          <li>Sur iPhone : suivez la méthode « Enregistrer dans Fichiers » ci-dessus.</li>
          <li>Sur PC : icloud.com/photos, sélectionnez et téléchargez (« Original non modifié »), puis glissez le dossier.</li>
        </ol>
      </Bloc>

      <Bloc titre="Depuis WhatsApp">
        <ol>
          <li>Ouvrez la discussion du groupe, touchez son nom puis <strong>Exporter la discussion</strong>.</li>
          <li>
            Choisissez <strong>Joindre les médias</strong>, puis enregistrez le fichier .zip (dans Fichiers, ou envoyez-le
            vous par e-mail).
          </li>
          <li>Sur la page d’import, choisissez ce fichier .zip.</li>
        </ol>
        <p>
          WhatsApp compresse les photos. L’app les garde en attendant mieux : quand quelqu’un envoie l’original, il
          remplace automatiquement la copie WhatsApp.
        </p>
      </Bloc>

      <Bloc titre="Depuis un ordinateur ou une carte SD">
        <p>
          Glissez le dossier entier (par exemple DCIM de la carte SD) sur la page d’import. Les sous-dossiers sont
          parcourus, les fichiers RAW sont conservés et leur aperçu sert à l’affichage.
        </p>
      </Bloc>
    </div>
  );
}

import Link from "next/link";
import { Marque } from "@/components/marque";

export const metadata = { title: "Confidentialité et droit à l’image" };

export default function Confidentialite() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-6 py-12">
      <Marque href="/" />
      <h1 className="text-4xl">Confidentialité et droit à l’image</h1>

      <section className="space-y-3">
        <h2 className="text-2xl">Le droit à l’image</h2>
        <p>
          Les photos d’un voyage montrent souvent d’autres personnes. N’envoyez que des photos que les personnes reconnaissables accepteraient
          de voir partagées dans le groupe, et a fortiori dans le site ou le livre.
        </p>
        <p>
          Toute personne qui ne veut pas apparaître peut le demander : l’auteur de la photo ou un organisateur la retire du site ou du livre
          (cases « Dans le site » et « Dans le livre »), ou la supprime. Le site n’est jamais public : on n’y accède qu’avec un lien secret,
          que les organisateurs peuvent révoquer à tout moment.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Ce qui est conservé, et où</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Votre adresse e-mail et votre nom affiché, pour vous connecter et signer vos légendes et commentaires.</li>
          <li>Les photos et vidéos envoyées, en version originale et en versions allégées pour l’écran.</li>
          <li>Le récit, les commentaires, les réactions, le livre, et pour la commande : le nombre d’exemplaires et, si vous choisissez la livraison à domicile, votre adresse (visible par vous et les organisateurs seulement).</li>
        </ul>
        <p>
          L’application est hébergée par Vercel ; la base de données par Neon ; les photos et vidéos par Cloudflare R2, dans des centres de
          données d’Amérique du Nord. Les e-mails de connexion partent d’une adresse Gmail.
        </p>
        <p>
          La position GPS précise des photos n’est jamais montrée hors du voyage : le site et ses exports n’affichent que des étapes arrondies
          à une dizaine de kilomètres, et les images servies ne contiennent plus leurs métadonnées.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Ce qui n’existe pas ici</h2>
        <p>Aucune publicité, aucun traçage publicitaire, aucun outil de mesure d’audience, aucun cookie autre que celui de connexion. Aucun paiement en ligne.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Vos droits</h2>
        <p>
          Vous pouvez supprimer à tout moment votre compte, avec toutes les photos que vous avez envoyées et vos commentaires (page{" "}
          <Link href="/compte" className="lien">
            Mon compte
          </Link>
          ). Les organisateurs peuvent supprimer un voyage entier, fichiers compris. Pour toute autre demande, écrivez à l’organisateur de votre
          voyage.
        </p>
      </section>
    </main>
  );
}

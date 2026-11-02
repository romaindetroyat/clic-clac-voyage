import Link from "next/link";
import { Marque } from "@/components/marque";

export default function Introuvable() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Marque />
      <h1 className="text-4xl">Page introuvable</h1>
      <p className="text-encre-douce">Cette page n’existe pas, ou vous n’y avez pas accès.</p>
      <Link href="/voyages" className="lien">
        Retour à mes voyages
      </Link>
    </main>
  );
}

import { Marque } from "@/components/marque";

export const metadata = { title: "Hors ligne" };

export default function HorsLigne() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Marque href="/" />
      <h1 className="text-4xl">Pas de réseau pour l’instant</h1>
      <p className="text-encre-douce">
        Cette page n’est pas encore disponible hors ligne. Elle s’affichera dès que la connexion reviendra.
      </p>
    </main>
  );
}

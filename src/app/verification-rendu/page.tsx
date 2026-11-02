import { Marque } from "@/components/marque";
import { Verification } from "./verification";

export const metadata = { title: "Vérification du rendu" };

/**
 * Compare le rendu GPU (WebGL2) des retouches au rendu de référence (CPU) sur cet appareil.
 * Sert aux tests automatiques et à une vérification ponctuelle sur de vrais téléphones.
 */
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <Marque href="/" />
      <h1 className="text-3xl">Vérification du rendu des retouches</h1>
      <p className="text-encre-douce">
        Cette page vérifie que les retouches s’affichent sur cet appareil exactement comme dans le site et le livre. Un
        écart (ΔE) inférieur à 1 est invisible à l’œil.
      </p>
      <Verification />
    </main>
  );
}

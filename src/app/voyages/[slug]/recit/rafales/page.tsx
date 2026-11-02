import Link from "next/link";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { rafalesDe } from "@/server/domaine/rafales";
import { getStockage } from "@/server/stockage";
import { ChoixRafales } from "./choix-rafales";

export const metadata = { title: "Rafales" };

export default async function Rafales({ params }: PageProps<"/voyages/[slug]/recit/rafales">) {
  const { slug } = await params;
  const { voyage } = await accesVoyage(slug);
  const { rafales, aMesurer } = await rafalesDe(await getDb(), voyage.id);
  const stockage = getStockage();
  const DUREE = 6 * 3600;
  const groupes = await Promise.all(
    rafales.map(async (g) =>
      Promise.all(
        g.map(async (m) => ({
          id: m.id,
          choix: m.choixRafale,
          score: m.nettete === null ? null : Math.round(((m.nettete ?? 0.5) * 0.65 + (m.exposition ?? 0.5) * 0.35) * 100),
          vignette: m.versions.m ? await stockage.urlLecture(m.versions.m, DUREE) : null,
          nom: m.nomFichier,
        })),
      ),
    ),
  );
  const mesures = await Promise.all(aMesurer.map(async (m) => ({ id: m.id, url: await stockage.urlLecture(m.cle, DUREE) })));
  return (
    <div className="space-y-6">
      <Link href={`/voyages/${voyage.slug}/recit`} className="lien text-sm">
        ← Récit
      </Link>
      <div className="space-y-2">
        <h2 className="text-3xl">Rafales</h2>
        <p className="max-w-2xl text-encre-douce">
          Quand plusieurs photos de la même scène ont été prises à quelques secondes d’écart, l’app propose la plus nette
          et la mieux exposée : elle seule va dans le site et le livre. Touchez une autre photo pour la préférer.
        </p>
      </div>
      <ChoixRafales slug={voyage.slug} groupes={groupes} aMesurer={mesures} />
    </div>
  );
}

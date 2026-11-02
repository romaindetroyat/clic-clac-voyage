import Link from "next/link";
import { Entete } from "@/components/entete";
import { FormulaireAction } from "@/components/formulaires";
import { periode } from "@/lib/dates";
import { exigerUtilisateur } from "@/server/auth";
import { getDb } from "@/server/db";
import { voyagesDe } from "@/server/domaine/voyages";
import { actionCreerVoyage } from "./actions";

export const metadata = { title: "Mes voyages" };

export default async function MesVoyages() {
  const u = await exigerUtilisateur();
  const voyages = await voyagesDe(await getDb(), u.id);

  return (
    <>
      <Entete nom={u.nom} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-12 px-4 py-8 sm:px-6 sm:py-12">
        <section className="space-y-6">
          <h1 className="text-4xl sm:text-5xl">Mes voyages</h1>
          {voyages.length === 0 ? (
            <p className="text-encre-douce">
              Aucun voyage pour l’instant. Créez-en un ci-dessous, ou ouvrez le lien d’invitation reçu par e-mail.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {voyages.map((v) => (
                <li key={v.id}>
                  <Link href={`/voyages/${v.slug}`} className="carte block h-full transition-colors hover:bg-papier-2">
                    <p className="etiquette">{v.role === "admin" ? "Administrateur" : "Contributeur"}</p>
                    <h2 className="mt-2 text-2xl">{v.nom}</h2>
                    {periode(v.dateDebut, v.dateFin) ? (
                      <p className="mt-1 text-sm text-encre-douce">{periode(v.dateDebut, v.dateFin)}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="max-w-lg space-y-4">
          <h2 className="text-2xl">Nouveau voyage</h2>
          <FormulaireAction action={actionCreerVoyage} bouton="Créer le voyage">
            <label className="block space-y-1.5">
              <span className="etiquette">Nom</span>
              <input name="nom" className="champ" required maxLength={120} placeholder="Les Cyclades, été 2026" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="etiquette">Début</span>
                <input name="dateDebut" type="date" className="champ" />
              </label>
              <label className="block space-y-1.5">
                <span className="etiquette">Fin</span>
                <input name="dateFin" type="date" className="champ" />
              </label>
            </div>
          </FormulaireAction>
        </section>
      </main>
    </>
  );
}

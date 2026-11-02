import Link from "next/link";
import { BoutonAction, FormulaireAction } from "@/components/formulaires";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { galerie } from "@/server/domaine/medias";
import { episodesDe } from "@/server/domaine/recit";
import { getStockage } from "@/server/stockage";
import {
  actionDeplacerEpisode,
  actionFusionner,
  actionModifierEpisode,
  actionProposerDecoupage,
  actionRangerNonClasses,
  actionSupprimerEpisode,
} from "../../actions";

export const metadata = { title: "Récit" };

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default async function Recit({ params }: PageProps<"/voyages/[slug]/recit">) {
  const { slug } = await params;
  const { voyage, estAdmin } = await accesVoyage(slug);
  const db = await getDb();
  const [{ episodes, nonClasses }, medias] = await Promise.all([episodesDe(db, voyage.id), galerie(db, getStockage(), voyage.id)]);
  const vignettes = new Map<string, string[]>();
  for (const m of medias) {
    if (!m.episodeId || !m.vignette) continue;
    const l = vignettes.get(m.episodeId) ?? [];
    if (l.length < 6) l.push(m.vignette);
    vignettes.set(m.episodeId, l);
  }
  const base = `/voyages/${voyage.slug}/recit`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-encre-douce">
          Le voyage se raconte en épisodes : un jour, une étape, un événement. Chacun a un titre, un lieu et un texte.
        </p>
        {estAdmin && medias.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <BoutonAction
              libelle={episodes.length ? "Refaire le découpage automatique" : "Proposer un découpage en épisodes"}
              confirmation={
                episodes.length
                  ? "Refaire le découpage remplace tous les épisodes : titres et textes seront perdus. Continuer ?"
                  : undefined
              }
              action={actionProposerDecoupage.bind(null, slug)}
            />
            {episodes.length && nonClasses ? (
              <BoutonAction libelle={`Ranger les ${nonClasses} photos à classer`} action={actionRangerNonClasses.bind(null, slug)} />
            ) : null}
          </div>
        ) : null}
      </div>

      {medias.length === 0 ? (
        <p className="text-encre-douce">Importez d’abord des photos.</p>
      ) : episodes.length === 0 ? (
        <p className="text-encre-douce">
          Aucun épisode pour l’instant.{" "}
          {estAdmin ? "Laissez l’app proposer un découpage, puis ajustez-le." : "L’administrateur va structurer le voyage."}
        </p>
      ) : (
        <ol className="space-y-6">
          {episodes.map((e, i) => (
            <li key={e.id} className="carte space-y-4" data-testid="episode">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="etiquette">Épisode {i + 1}</p>
                  <h2 className="text-2xl">
                    <Link href={`${base}/${e.id}`} className="hover:underline">
                      {e.titre}
                    </Link>
                  </h2>
                  <p className="text-sm text-encre-douce">
                    {e.lieu ? `${e.lieu} · ` : ""}
                    {e.nbMedias} photo{e.nbMedias > 1 ? "s" : ""}
                    {e.debut && e.fin ? ` · ${fmt.format(e.debut)} → ${fmt.format(e.fin)}` : ""}
                  </p>
                </div>
                {estAdmin ? (
                  <div className="flex flex-wrap">
                    {i > 0 ? <BoutonAction libelle="Monter" action={actionDeplacerEpisode.bind(null, slug, e.id, -1)} /> : null}
                    {i < episodes.length - 1 ? (
                      <>
                        <BoutonAction libelle="Descendre" action={actionDeplacerEpisode.bind(null, slug, e.id, 1)} />
                        <BoutonAction
                          libelle="Fusionner avec le suivant"
                          confirmation="Fusionner cet épisode avec le suivant ?"
                          action={actionFusionner.bind(null, slug, e.id)}
                        />
                      </>
                    ) : null}
                    <BoutonAction
                      variante="danger"
                      libelle="Supprimer"
                      confirmation="Supprimer cet épisode ? Ses photos restent dans le voyage, « à classer »."
                      action={actionSupprimerEpisode.bind(null, slug, e.id)}
                    />
                  </div>
                ) : null}
              </div>
              <Link href={`${base}/${e.id}`} className="grid grid-cols-6 gap-1" aria-label={`Voir les photos de ${e.titre}`}>
                {(vignettes.get(e.id) ?? []).map((v, k) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={k} src={v} alt="" loading="lazy" className="aspect-square w-full rounded-sm object-cover" />
                ))}
              </Link>
              {estAdmin ? (
                <details>
                  <summary className="cursor-pointer text-sm text-encre-douce">Titre, lieu et récit</summary>
                  <FormulaireAction
                    action={actionModifierEpisode.bind(null, slug, e.id)}
                    bouton="Enregistrer"
                    reinitialiser={false}
                    className="mt-3 space-y-3"
                  >
                    <label className="block space-y-1.5">
                      <span className="etiquette">Titre</span>
                      <input name="titre" className="champ" defaultValue={e.titre} required maxLength={120} />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="etiquette">Lieu (facultatif)</span>
                      <input name="lieu" className="champ" defaultValue={e.lieu ?? ""} maxLength={120} />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="etiquette">Récit</span>
                      <textarea name="recit" className="champ min-h-32" defaultValue={e.recit ?? ""} maxLength={20000} />
                    </label>
                  </FormulaireAction>
                </details>
              ) : e.recit ? (
                <p className="whitespace-pre-line text-encre-douce">{e.recit}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <Link href={`${base}/rafales`} className="lien block text-sm">
        Rafales : choisir la meilleure photo de chaque série
      </Link>
      {episodes.length > 0 && nonClasses > 0 ? (
        <Link href={`${base}/a-classer`} className="lien text-sm">
          {nonClasses} photo{nonClasses > 1 ? "s" : ""} à classer
        </Link>
      ) : null}
    </div>
  );
}

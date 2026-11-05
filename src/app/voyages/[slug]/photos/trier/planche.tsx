"use client";

import { useMemo, useState } from "react";
import { defauts, groupesPlanche, suggestion, type Decision, type Regroupement } from "@/lib/tri/moments";
import type { MediaTri } from "@/server/domaine/tri";
import { Boutons, etat } from "./boutons";

const fmtJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

const anneau = (m: MediaTri) => {
  if (!m.trie) return "ring-1 ring-filet";
  if (m.dansSite && m.dansLivre) return "ring-4 ring-emerald-600";
  if (m.dansSite) return "ring-4 ring-sky-600";
  if (m.dansLivre) return "ring-4 ring-violet-600";
  return "ring-4 ring-red-600";
};

/** Les photos groupées par heure de prise de vue, chacune avec ses quatre boutons. */
export function Planche({
  medias,
  avis,
  regroupement,
  seulementATrier,
  decider,
  ouvrir,
  ia,
  iaEnCours,
}: {
  medias: MediaTri[];
  avis: Record<string, string>;
  regroupement: Regroupement;
  seulementATrier: boolean;
  decider: (ids: string[], d: Decision | ((m: MediaTri) => Decision)) => void;
  ouvrir: (id: string) => void;
  /** Demander à l'IA la meilleure photo d'une série (administrateurs, si l'IA est active). */
  ia: ((ids: string[]) => void) | null;
  iaEnCours: string | null;
}) {
  const parAvis = useMemo(() => new Map(Object.entries(avis)), [avis]);
  // Les groupes dépendent de l'ordre et des dates, que le tri ne change pas.
  const ordre = useMemo(() => medias.map((m) => m.id).join(","), [medias]);
  const groupesIds = useMemo(
    () =>
      groupesPlanche(medias, regroupement, (iso) => (iso ? fmtJour.format(new Date(iso)) : "")).map((g) => ({ ids: g.medias.map((m) => m.id), serie: g.serie })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcul seulement si l'ordre ou le regroupement change
    [ordre, regroupement],
  );
  const parId = useMemo(() => new Map(medias.map((m) => [m.id, m])), [medias]);
  const groupes = groupesIds.map((g) => ({ medias: g.ids.map((id) => parId.get(id)!), serie: g.serie }));
  const visibles = seulementATrier ? groupes.filter((g) => g.medias.some((m) => !m.trie)) : groupes;
  const [limite, setLimite] = useState(30);

  return (
    <div className="space-y-5" data-testid="planche">
      {visibles.slice(0, limite).map(({ medias: g, serie }) => {
        const debut = g[0].instant ? new Date(g[0].instant) : null;
        const fin = g.at(-1)!.instant ? new Date(g.at(-1)!.instant!) : null;
        const aTrier = g.filter((m) => !m.trie).length;
        const comparable = g.length > 1 && (serie || regroupement !== "serie");
        const meilleure = comparable ? suggestion(g, parAvis) : null;
        const ids = g.map((m) => m.id);
        return (
          <section key={g[0].id} className="space-y-3 border-t border-filet pt-4" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 420px" }} data-testid="groupe">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">
                {debut ? (
                  <>
                    <span className="first-letter:uppercase">{fmtJour.format(debut)}</span>, {fmtHeure.format(debut)}
                    {fin && fmtHeure.format(fin) !== fmtHeure.format(debut) ? ` – ${fmtHeure.format(fin)}` : ""}
                  </>
                ) : (
                  "Sans date"
                )}
                <span className="text-sm text-encre-douce">
                  {" "}
                  · {g.length} photo{g.length > 1 ? "s" : ""}
                  {aTrier ? `, ${aTrier} à trier` : ", triées"}
                </span>
              </h2>
              <div className="flex flex-wrap gap-1.5 text-sm">
                <button type="button" className="min-h-9 rounded-md border-2 border-emerald-600 px-3 font-medium text-emerald-700 dark:text-emerald-400" onClick={() => decider(ids, "garder")}>
                  ✓ Tout garder
                </button>
                <button type="button" className="min-h-9 rounded-md border-2 border-red-600 px-3 font-medium text-red-700 dark:text-red-400" onClick={() => decider(ids, "ecarter")}>
                  ✕ Tout écarter
                </button>
                {meilleure ? (
                  <button
                    type="button"
                    className="min-h-9 rounded-md border-2 border-filet px-3"
                    title={parAvis.get(meilleure.id) ?? "La plus nette et la mieux exposée"}
                    onClick={() => decider(ids, (m) => (m.id === meilleure.id ? "garder" : "ecarter"))}
                  >
                    ★ Garder seulement la meilleure
                  </button>
                ) : null}
                {meilleure && ia ? (
                  <button type="button" className="min-h-9 rounded-md border-2 border-filet px-3" disabled={iaEnCours !== null} onClick={() => ia(ids)}>
                    {iaEnCours === ids[0] ? "L’IA regarde…" : "Demander à l’IA"}
                  </button>
                ) : null}
              </div>
            </div>
            {meilleure && parAvis.get(meilleure.id) ? <p className="text-sm">★ L’IA : « {parAvis.get(meilleure.id)} »</p> : null}
            <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
              {g.map((m) => {
                const e = etat(m);
                return (
                  <li key={m.id} className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => ouvrir(m.id)}
                      aria-label={`Agrandir ${m.nomFichier}`}
                      className={`relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-papier-2 ${anneau(m)}`}
                    >
                      {m.vignette ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
                        <img
                          src={m.vignette}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          className={`h-full w-full object-cover ${m.trie && !m.dansSite && !m.dansLivre ? "opacity-40 grayscale" : ""}`}
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center p-1 text-xs text-encre-douce">{m.nomFichier}</span>
                      )}
                      <span className={`absolute left-1.5 top-1.5 rounded px-1.5 text-xs ${e.ton}`} data-testid="etat-media">
                        {e.libelle}
                      </span>
                      {meilleure?.id === m.id ? <span className="absolute bottom-1.5 left-1.5 rounded bg-accent px-1.5 text-xs text-white">★ La meilleure</span> : null}
                      {defauts(m).length ? <span className="absolute bottom-1.5 right-1.5 rounded bg-amber-400 px-1.5 text-xs text-black">{defauts(m)[0]}</span> : null}
                      {m.type === "video" ? <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 text-xs text-white">▶ vidéo</span> : null}
                    </button>
                    <Boutons m={m} decider={(d) => decider([m.id], d)} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {visibles.length > limite ? (
        <button type="button" className="bouton-discret w-full" onClick={() => setLimite((l) => l + 40)}>
          Voir la suite ({visibles.length - limite} groupes)
        </button>
      ) : null}
    </div>
  );
}

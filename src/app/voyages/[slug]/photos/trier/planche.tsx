"use client";

import { useMemo, useState } from "react";
import { defauts, effet, groupesPlanche, REGROUPEMENTS, suggestion, type Decision, type Regroupement } from "@/lib/tri/moments";
import type { DecisionTri, MediaTri } from "@/server/domaine/tri";

const fmtJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function bordure(m: MediaTri) {
  if (!m.trie) return "";
  if (!m.dansSite) return "opacity-35 grayscale";
  if (m.vedette) return "ring-4 ring-inset ring-accent";
  if (m.dansLivre) return "ring-4 ring-inset ring-emerald-600";
  return "ring-4 ring-inset ring-sky-600";
}
function badge(m: MediaTri) {
  if (!m.trie) return null;
  if (!m.dansSite) return "Écartée";
  if (m.vedette) return "♥";
  if (m.dansLivre) return "✓";
  return "Site";
}

/**
 * Vue « par groupes » : une planche de vignettes, groupées par rafale ou par écart d'heure de prise de vue.
 * Un toucher garde ou écarte une photo ; chaque groupe se règle d'un bouton (tout garder, la meilleure…).
 */
export function Planche({
  medias,
  avis,
  estAdmin,
  regroupement,
  seulementATrier,
  decider,
  ouvrir,
  agrandir,
}: {
  medias: MediaTri[];
  avis: Record<string, string>;
  estAdmin: boolean;
  regroupement: Regroupement;
  seulementATrier: boolean;
  /** Envoie des décisions (l'appelant gère l'annulation). */
  decider: (decisions: DecisionTri[]) => void;
  /** Ouvre la photo dans la vue « une par une ». */
  ouvrir: (id: string) => void;
  agrandir: (id: string) => void;
}) {
  const parAvis = useMemo(() => new Map(Object.entries(avis)), [avis]);
  // Les groupes se calculent sur l'ordre et les dates, que le tri ne change pas.
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
  const [limite, setLimite] = useState(40);

  const vers = (m: MediaTri, d: Decision): DecisionTri => {
    const e = effet(d);
    return { id: m.id, dansSite: e.dansSite, dansLivre: e.dansLivre, trie: true, ...(estAdmin && e.vedette !== undefined ? { vedette: e.vedette } : {}) };
  };

  if (!visibles.length) return null;

  return (
    <div className="space-y-4" data-testid="planche">
      {visibles.slice(0, limite).map(({ medias: g, serie }) => {
        const debut = g[0].instant ? new Date(g[0].instant) : null;
        const fin = g.at(-1)!.instant ? new Date(g.at(-1)!.instant!) : null;
        const gardees = g.filter((m) => m.trie && m.dansSite).length;
        const aTrier = g.filter((m) => !m.trie).length;
        // « La meilleure » n'a de sens que dans une série ou un groupe par heure, pas pour des photos seules réunies.
        const meilleure = g.length > 1 && (serie || regroupement !== "serie") ? suggestion(g, parAvis) : null;
        return (
          <section key={g[0].id} className="carte space-y-2" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 320px" }} data-testid="groupe">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base">
                {debut ? (
                  <>
                    <span className="first-letter:uppercase">{fmtJour.format(debut)}</span> · {fmtHeure.format(debut)}
                    {fin && fmtHeure.format(fin) !== fmtHeure.format(debut) ? ` → ${fmtHeure.format(fin)}` : ""}
                  </>
                ) : (
                  "Sans date"
                )}
                <span className="text-sm text-encre-douce">
                  {" "}
                  {regroupement === "serie" ? (serie ? "· série " : "· photos seules ") : ""}· {g.length} photo{g.length > 1 ? "s" : ""}
                  {gardees ? ` · ${gardees} gardée${gardees > 1 ? "s" : ""}` : ""}
                  {aTrier ? ` · ${aTrier} à trier` : ""}
                </span>
              </h2>
              <div className="flex flex-wrap gap-1.5 text-sm">
                {meilleure ? (
                  <button
                    type="button"
                    className="bouton-discret px-2.5 py-1"
                    onClick={() => decider(g.map((m) => vers(m, m.id === meilleure.id ? "livre" : "ecarter")))}
                    title={parAvis.get(meilleure.id) ?? "La plus nette et la mieux exposée"}
                  >
                    ★ Garder la meilleure
                  </button>
                ) : null}
                {aTrier && aTrier < g.length ? (
                  <button type="button" className="bouton-discret px-2.5 py-1" onClick={() => decider(g.filter((m) => !m.trie).map((m) => vers(m, "livre")))}>
                    Garder le reste
                  </button>
                ) : null}
                <button type="button" className="bouton-discret px-2.5 py-1" onClick={() => decider(g.map((m) => vers(m, "livre")))}>
                  Tout garder
                </button>
                <button type="button" className="bouton-discret px-2.5 py-1" onClick={() => decider(g.map((m) => vers(m, "ecarter")))}>
                  Tout écarter
                </button>
              </div>
            </div>
            <ul className="grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-6">
              {g.map((m) => {
                const garde = m.trie && m.dansSite;
                const b = badge(m);
                return (
                  <li key={m.id} className="relative">
                    <button
                      type="button"
                      onClick={() => decider([vers(m, garde ? "ecarter" : "livre")])}
                      onDoubleClick={() => agrandir(m.id)}
                      aria-pressed={garde}
                      aria-label={`${m.type === "video" ? "Vidéo" : "Photo"} ${m.nomFichier}${garde ? " (gardée)" : m.trie ? " (écartée)" : ""}`}
                      className={`relative block aspect-square w-full overflow-hidden rounded-sm bg-papier-2 transition ${bordure(m)}`}
                    >
                      {m.vignette ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
                        <img src={m.vignette} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} />
                      ) : (
                        <span className="flex h-full items-center justify-center p-1 text-[10px] text-encre-douce">{m.nomFichier}</span>
                      )}
                      {b ? <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">{b}</span> : null}
                      {meilleure?.id === m.id && !m.trie ? (
                        <span className="absolute bottom-1 left-1 rounded bg-accent px-1 text-[10px] text-white">★</span>
                      ) : null}
                      {defauts(m).length ? <span className="absolute bottom-1 right-1 rounded bg-amber-500 px-1 text-[10px] text-black">{defauts(m)[0]}</span> : null}
                      {m.type === "video" ? <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">▶</span> : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => ouvrir(m.id)}
                      className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-xs text-black"
                      aria-label={`Ouvrir ${m.nomFichier} en grand`}
                      title="Ouvrir en grand (retouche, coup de cœur…)"
                    >
                      ⤢
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {visibles.length > limite ? (
        <button type="button" className="bouton-discret w-full" onClick={() => setLimite((l) => l + 60)}>
          Afficher les groupes suivants ({visibles.length - limite} restants)
        </button>
      ) : null}
      <p className="text-xs text-encre-douce">
        Touchez une photo pour la garder (site et livre) ou l’écarter ; double-cliquez pour l’agrandir. {REGROUPEMENTS[regroupement].libelle}.
      </p>
    </div>
  );
}

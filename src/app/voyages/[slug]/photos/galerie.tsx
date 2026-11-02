"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { Visionneuse } from "@/components/visionneuse";
import type { MediaGalerie } from "@/server/domaine/medias";

const fmtJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

type Ligne = { type: "jour"; libelle: string } | { type: "medias"; medias: MediaGalerie[] };

function useMesures(ref: React.RefObject<HTMLDivElement | null>) {
  const [m, setM] = useState({ colonnes: 3, largeur: 360, haut: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) =>
      setM({
        colonnes: Math.max(3, Math.floor(e.contentRect.width / 140)),
        largeur: e.contentRect.width,
        haut: el.getBoundingClientRect().top + window.scrollY,
      }),
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return m;
}

/** Galerie de milliers de photos : seules les lignes visibles sont dans la page. */
export function Galerie({
  medias,
  slug,
  utilisateurId,
  estAdmin,
  selection,
}: {
  medias: MediaGalerie[];
  slug: string;
  utilisateurId: string;
  estAdmin: boolean;
  /** Mode sélection : cocher plusieurs photos (pour les déplacer, les retirer du livre…). */
  selection?: { choisis: Set<string>; basculer: (id: string) => void };
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const { colonnes, largeur, haut } = useMesures(conteneur);
  const [liste, setListe] = useState(medias);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const indexDe = useMemo(() => new Map(liste.map((m, i) => [m.id, i])), [liste]);

  const lignes = useMemo(() => {
    const res: Ligne[] = [];
    let jour: string | null = "-";
    let paquet: MediaGalerie[] = [];
    const vider = () => {
      for (let i = 0; i < paquet.length; i += colonnes) res.push({ type: "medias", medias: paquet.slice(i, i + colonnes) });
      paquet = [];
    };
    for (const m of liste) {
      const j = m.instant ? fmtJour.format(new Date(m.instant)) : "Sans date";
      if (j !== jour) {
        vider();
        res.push({ type: "jour", libelle: j });
        jour = j;
      }
      paquet.push(m);
    }
    vider();
    return res;
  }, [liste, colonnes]);

  const v = useWindowVirtualizer({
    count: lignes.length,
    estimateSize: (i) => (lignes[i].type === "jour" ? 48 : largeur / colonnes),
    overscan: 6,
    scrollMargin: haut,
  });

  return (
    <>
      <div ref={conteneur} className="relative w-full" style={{ height: v.getTotalSize() }}>
        {v.getVirtualItems().map((it) => {
          const l = lignes[it.index];
          return (
            <div
              key={it.key}
              data-index={it.index}
              ref={v.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${it.start - v.options.scrollMargin}px)` }}
            >
              {l.type === "jour" ? (
                <h3 className="pb-2 pt-5 text-lg first-letter:uppercase">{l.libelle}</h3>
              ) : (
                <div className="grid gap-1 pb-1" style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}>
                  {l.medias.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => (selection ? selection.basculer(m.id) : setOuvert(indexDe.get(m.id)!))}
                      aria-pressed={selection ? selection.choisis.has(m.id) : undefined}
                      className={`relative aspect-square overflow-hidden rounded-sm bg-papier-2 ${
                        selection?.choisis.has(m.id) ? "ring-4 ring-accent ring-inset" : ""
                      } ${!m.dansSite && !m.dansLivre ? "opacity-40" : ""}`}
                      aria-label={`${m.type === "video" ? "Vidéo" : "Photo"} ${m.nomFichier}`}
                    >
                      {m.vignette ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage, pas d'optimisation Vercel
                        <img src={m.vignette} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center p-1 text-[10px] text-encre-douce">{m.nomFichier}</span>
                      )}
                      {!m.dansLivre && m.dansSite ? (
                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white" title="Pas dans le livre">
                          site
                        </span>
                      ) : null}
                      {m.legende ? (
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white" aria-hidden>
                          ✎
                        </span>
                      ) : null}
                      {m.type === "video" ? (
                        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">▶</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {ouvert !== null ? (
        <Visionneuse
          slug={slug}
          medias={liste}
          index={ouvert}
          utilisateurId={utilisateurId}
          estAdmin={estAdmin}
          onIndex={setOuvert}
          onFermer={() => setOuvert(null)}
          onMaj={(id, maj) => setListe((l) => l.map((x) => (x.id === id ? { ...x, ...maj } : x)))}
        />
      ) : null}
    </>
  );
}

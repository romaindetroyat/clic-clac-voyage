"use client";

import { useEffect, useRef, useState } from "react";
import { doublesPages, PageVue, pageDeCouverture } from "@/components/livre/page-livre";
import type { Format } from "@/lib/livre/formats";
import type { Livre, MediaLivre } from "@/lib/livre/modele";

/** Aperçu feuilletable plein écran : couverture, puis double page par double page. */
export function Feuilleter({ livre, format, medias, onFermer, fond }: { livre: Livre; format: Format; medias: Map<string, MediaLivre>; onFermer: () => void; fond: string }) {
  const doubles = doublesPages(livre.pages.length);
  const [i, setI] = useState(0); // 0 = couverture
  const [taille, setTaille] = useState({ l: 800, h: 600 });
  const debut = useRef<number | null>(null);
  const total = doubles.length + 1;

  useEffect(() => {
    const maj = () => setTaille({ l: window.innerWidth, h: window.innerHeight });
    maj();
    window.addEventListener("resize", maj);
    return () => window.removeEventListener("resize", maj);
  }, []);
  useEffect(() => {
    function clavier(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setI((x) => Math.min(total - 1, x + 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      else if (e.key === "Escape") onFermer();
    }
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  }, [total, onFermer]);

  // Deux pages côte à côte tiennent dans l'écran (marges comprises).
  const largeur = Math.floor(Math.min((taille.l - 32) / 2, ((taille.h - 140) * format.largeur) / format.hauteur));
  const paire = i === 0 ? null : doubles[i - 1];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Feuilleter le livre"
      className="fixed inset-0 z-50 flex flex-col bg-[#2b2925] text-white"
      onTouchStart={(e) => (debut.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (debut.current == null) return;
        const dx = e.changedTouches[0].clientX - debut.current;
        if (Math.abs(dx) > 50) setI((x) => Math.min(total - 1, Math.max(0, x + (dx < 0 ? 1 : -1))));
        debut.current = null;
      }}
    >
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <span>
          {i === 0 ? "Couverture" : `Pages ${paire!.filter((x) => x != null).map((x) => x! + 1).join(" – ")}`} · {i + 1} / {total}
        </span>
        <button type="button" className="min-h-11 px-3" onClick={onFermer}>
          Fermer
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        {i === 0 ? (
          <div className="shadow-2xl" style={{ background: fond }}>
            <PageVue page={pageDeCouverture(livre.couverture)} numero={0} format={format} fond={livre.options.fond} medias={medias} largeur={largeur} />
          </div>
        ) : (
          <div className="flex shadow-2xl">
            {paire!.map((j, k) =>
              j == null ? (
                <div key={k} style={{ width: largeur }} />
              ) : (
                <PageVue key={k} page={livre.pages[j]} numero={j + 1} format={format} fond={livre.options.fond} medias={medias} largeur={largeur} className={k === 0 ? "border-r border-black/10" : ""} />
              ),
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-4 pb-4">
        <button type="button" className="min-h-11 rounded-full bg-white/10 px-5" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label="Double page précédente">
          ‹
        </button>
        <button type="button" className="min-h-11 rounded-full bg-white/10 px-5" onClick={() => setI((x) => Math.min(total - 1, x + 1))} disabled={i === total - 1} aria-label="Double page suivante">
          ›
        </button>
      </div>
    </div>
  );
}

"use client";

/**
 * Éditeur visuel du site : la vraie maquette, avec des outils posés dessus.
 * - un bloc : changer sa disposition, son côté, le déplacer (flèches ou glisser), le scinder, le fusionner ;
 * - une photo : la recadrer et la zoomer (glisser dans l'image, molette ou curseur, formats), la déplacer
 *   (flèches, ou glisser sur une autre photo pour échanger), la mettre en avant, en ouverture du chapitre,
 *   la retoucher, la retirer du site ;
 * - une légende : l'écrire sur place, ou la faire proposer par l'IA ;
 * - un chapitre : titre et récit ; disposition proposée par l'IA, variantes, retour à l'automatique.
 * Tout se défait (Ctrl+Z) et s'enregistre tout seul.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as PE } from "react";
import type { Edition } from "@/components/site/edition";
import { Site } from "@/components/site/site";
import { avecCadrages, chapitres, mediasDuBloc, ratioDe, versStocke, type Chapitre, type SousPartie } from "@/lib/site/carnet";
import { FORMATS_RECADRAGE, IDS_TYPES_BLOCS, TYPES_BLOCS, type BlocSite, type Cadrage, type ConfigSite, type FormatRecadrage, type TypeBloc } from "@/lib/site/config";
import { changerCote, changerType, deplacerBloc, deplacerPhoto, echanger, fusionner, isoler, mettreDansBloc, NB_VARIANTES, scinder, variante } from "@/lib/site/edition";
import type { DonneesSite, MediaSite } from "@/lib/site/types";

type Reglages = Pick<ConfigSite, "mise" | "cadrages" | "ouvertures">;
type Selection = { type: "media"; id: string } | { type: "bloc"; cle: string; index: number } | null;
type Glisse = { type: "media"; id: string; cle: string } | { type: "bloc"; cle: string; index: number } | null;

async function poster<T = { ok: true }>(url: string, corps: object): Promise<T> {
  const rep = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
  const json = (await rep.json()) as T & { erreur?: string };
  if (json.erreur) throw new Error(json.erreur);
  return json;
}

/* --------------------------------- Petits éléments --------------------------------- */

const bouton = "inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-40";
const actif = "!bg-white !text-[#1d1b18]";
const barre = "flex flex-wrap items-center gap-0.5 rounded-lg bg-[#1d1b18]/90 p-1 shadow-lg backdrop-blur";

/** Pictogramme d'une disposition (petits rectangles). */
function Picto({ type }: { type: TypeBloc }) {
  const r = (x: number, y: number, l: number, h: number, k: string | number) => <rect key={k} x={x} y={y} width={l} height={h} rx={0.6} fill="currentColor" />;
  const formes: Record<TypeBloc, ReactNode[]> = {
    grande: [r(1, 2, 18, 10, 0)],
    centree: [r(5, 2, 10, 10, 0), r(16, 9, 3, 1, 1)],
    note: [r(1, 2, 11, 10, 0), r(13, 4, 6, 1.2, 1), r(13, 7, 5, 1.2, 2)],
    rangee: [r(1, 3, 8, 8, 0), r(10, 3, 9, 8, 1)],
    duo: [r(1, 1, 11, 8, 0), r(13, 5, 6, 8, 1)],
    mosaique: [r(1, 2, 10, 10, 0), r(12, 2, 3, 3, 1), r(16, 2, 3, 3, 2), r(12, 6, 3, 3, 3), r(16, 6, 3, 3, 4)],
    defilement: [r(0, 3, 6, 8, 0), r(7, 3, 6, 8, 1), r(14, 3, 6, 8, 2)],
  };
  return (
    <svg viewBox="0 0 20 14" width={22} height={15} aria-hidden>
      {formes[type]}
    </svg>
  );
}

/* --------------------------------- Recadrage --------------------------------- */

function Recadreur({ m, cadrage, onChange, onDebut, onFin }: { m: MediaSite; cadrage: Cadrage; onChange: (c: Cadrage) => void; onDebut: () => void; onFin: () => void }) {
  const zone = useRef<HTMLDivElement>(null);
  const depart = useRef<{ x: number; y: number; c: Cadrage } | null>(null);

  // Sensibilité : un glissement de toute la largeur parcourt toute la partie cachée de la photo.
  function deplacer(e: PE<HTMLDivElement>) {
    const d = depart.current;
    const el = zone.current;
    if (!d || !el) return;
    const { width: W, height: H } = el.getBoundingClientRect();
    const rp = m.largeur && m.hauteur ? m.largeur / m.hauteur : 1.5;
    const rc = W / H;
    // Part cachée (en fraction du cadre) dans chaque direction, zoom compris.
    const cacheX = Math.max(0.15, (rp > rc ? rp / rc : 1) * d.c.zoom - 1);
    const cacheY = Math.max(0.15, (rp > rc ? 1 : rc / rp) * d.c.zoom - 1);
    const cx = Math.min(1, Math.max(0, d.c.cx - (e.clientX - d.x) / W / cacheX));
    const cy = Math.min(1, Math.max(0, d.c.cy - (e.clientY - d.y) / H / cacheY));
    onChange({ ...d.c, cx, cy });
  }

  return (
    <div
      ref={zone}
      className="absolute inset-0 z-20 cursor-move touch-none ring-4 ring-inset ring-[#2f7cf6]"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onDebut();
        depart.current = { x: e.clientX, y: e.clientY, c: cadrage };
      }}
      onPointerMove={deplacer}
      onPointerUp={() => {
        depart.current = null;
        onFin();
      }}
      onWheel={(e) => {
        e.preventDefault();
        onChange({ ...cadrage, zoom: Math.min(4, Math.max(1, cadrage.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))) });
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      data-testid="recadreur"
      aria-label="Glissez pour déplacer la photo dans son cadre, molette pour zoomer"
    >
      {/* Grille des tiers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33.1%,rgba(255,255,255,.55)_33.3%,transparent_33.5%,transparent_66.4%,rgba(255,255,255,.55)_66.6%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.1%,rgba(255,255,255,.55)_33.3%,transparent_33.5%,transparent_66.4%,rgba(255,255,255,.55)_66.6%,transparent_66.8%)]" />
    </div>
  );
}

function PanneauRecadrage({
  cadrage,
  onChange,
  onDebut,
  onFin,
  onReinit,
}: {
  cadrage: Cadrage;
  onChange: (c: Cadrage, historique?: boolean) => void;
  /** Début d'un réglage continu (curseur) : une seule étape d'annulation pour tout le geste. */
  onDebut: () => void;
  onFin: () => void;
  onReinit: () => void;
}) {
  return (
    <div data-outils className={`${barre} pointer-events-auto max-w-[min(30rem,92vw)] gap-1 p-2 text-white`} onClick={(e) => e.stopPropagation()}>
      <label className="flex min-h-9 items-center gap-2 px-1 text-xs">
        Zoom
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={cadrage.zoom}
          onPointerDown={onDebut}
          onKeyDown={onDebut}
          onChange={(e) => onChange({ ...cadrage, zoom: Number(e.target.value) }, false)}
          aria-label="Zoom"
          className="w-28"
        />
      </label>
      <div role="radiogroup" aria-label="Format" className="flex flex-wrap gap-0.5">
        {(Object.keys(FORMATS_RECADRAGE) as FormatRecadrage[]).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={cadrage.format === f}
            onClick={() => onChange({ ...cadrage, format: f })}
            className={`${bouton} ${cadrage.format === f ? actif : ""}`}
          >
            {f === "original" ? "Original" : f}
          </button>
        ))}
      </div>
      <button type="button" className={bouton} onClick={onReinit}>
        Réinitialiser
      </button>
      <button type="button" className={`${bouton} bg-[#2f7cf6] hover:bg-[#2f7cf6]/80`} onClick={onFin}>
        Terminé
      </button>
    </div>
  );
}

/* ---------------------------------- Éditeur ---------------------------------- */

export function EditeurSite({ slug, initial, ia }: { slug: string; initial: DonneesSite; ia: boolean }) {
  const [d, setD] = useState(initial);
  const [r, setR] = useState<Reglages>({ mise: initial.config.mise, cadrages: initial.config.cadrages, ouvertures: initial.config.ouvertures });
  const rRef = useRef(r);
  const [passe, setPasse] = useState<Reglages[]>([]);
  const [futur, setFutur] = useState<Reglages[]>([]);
  const aEnregistrer = useRef(false);
  const [etat, setEtat] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const [recadrage, setRecadrage] = useState<string | null>(null);
  const [glisse, setGlisse] = useState<Glisse>(null);
  const [legende, setLegende] = useState<{ id: string; texte: string; suggestion?: boolean } | null>(null);
  const [chapitreOuvert, setChapitreOuvert] = useState<{ episodeId: string; titre: string; recit: string } | null>(null);
  const [apercu, setApercu] = useState(false);
  const [occupe, setOccupe] = useState<string | null>(null);
  const variantes = useRef(new Map<string, number>());

  useEffect(() => {
    rRef.current = r;
  }, [r]);

  /** Toute modification de la mise en page passe par ici (annulable, enregistrée automatiquement). */
  const changer = useCallback((fn: (x: Reglages) => Reglages, o: { historique?: boolean } = {}) => {
    const avant = rRef.current;
    const apres = fn(structuredClone(avant));
    rRef.current = apres;
    if (o.historique !== false) {
      setPasse((p) => [...p.slice(-80), avant]);
      setFutur([]);
    }
    aEnregistrer.current = true;
    setR(apres);
  }, []);

  function annuler() {
    const p = passe.at(-1);
    if (!p) return;
    setPasse(passe.slice(0, -1));
    setFutur([rRef.current, ...futur]);
    rRef.current = p;
    aEnregistrer.current = true;
    setR(p);
  }
  function retablir() {
    const f = futur[0];
    if (!f) return;
    setFutur(futur.slice(1));
    setPasse([...passe, rRef.current]);
    rRef.current = f;
    aEnregistrer.current = true;
    setR(f);
  }

  // Enregistrement automatique.
  useEffect(() => {
    if (!aEnregistrer.current) return;
    const t = setTimeout(async () => {
      aEnregistrer.current = false;
      setEtat({ texte: "Enregistrement…" });
      try {
        await poster(`/api/voyages/${slug}/site`, { action: "edition", edition: r });
        setEtat({ texte: "Enregistré" });
      } catch (e) {
        setEtat({ texte: (e as Error).message, erreur: true });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [r, slug]);

  // Clavier : annuler, rétablir, Échap.
  useEffect(() => {
    function clavier(e: KeyboardEvent) {
      const champ = (e.target as HTMLElement).closest("input, textarea, select");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !champ) {
        e.preventDefault();
        if (e.shiftKey) retablir();
        else annuler();
      } else if (e.key === "Escape") {
        setRecadrage(null);
        setSel(null);
      }
    }
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  });

  const dEff = useMemo<DonneesSite>(() => ({ ...d, config: { ...d.config, ...r } }), [d, r]);
  const liste = useMemo(() => chapitres(avecCadrages(dEff), dEff.config.organisation), [dEff]);
  const parties = useMemo(() => {
    const m = new Map<string, { c: Chapitre; p: SousPartie }>();
    for (const c of liste) for (const p of c.parties) m.set(p.cle, { c, p });
    return m;
  }, [liste]);
  const partieDe = useCallback((id: string) => [...parties.values()].find(({ p }) => p.blocs.some((b) => mediasDuBloc(b).some((m) => m.id === id))), [parties]);
  const tous = useMemo(() => new Map([...d.episodes.flatMap((e) => e.medias), ...d.horsEpisodes].map((m) => [m.id, m])), [d]);

  /** Modifie la disposition d'une partie (la disposition automatique devient manuelle). */
  function modifierPartie(cle: string, fn: (b: BlocSite[]) => BlocSite[]) {
    const p = parties.get(cle)?.p;
    if (!p) return;
    const courant = p.blocs.map(versStocke);
    changer((x) => ({ ...x, mise: { ...x.mise, [cle]: fn(courant) } }));
  }

  function majMedia(id: string, fn: (m: MediaSite) => MediaSite | null) {
    const f = (l: MediaSite[]) => l.flatMap((m) => (m.id === id ? (fn(m) ?? []) : [m]));
    setD((x) => ({ ...x, episodes: x.episodes.map((e) => ({ ...e, medias: f(e.medias) })), horsEpisodes: f(x.horsEpisodes) }));
  }

  async function action<T>(texte: string, fn: () => Promise<T>): Promise<T | undefined> {
    setOccupe(texte);
    setEtat({ texte });
    try {
      const res = await fn();
      setEtat({ texte: "Enregistré" });
      return res;
    } catch (e) {
      setEtat({ texte: (e as Error).message, erreur: true });
    } finally {
      setOccupe(null);
    }
  }

  /* ------------------------------- Actions sur une photo ------------------------------- */

  const cadrageDe = (id: string): Cadrage => r.cadrages[id] ?? { zoom: 1, cx: 0.5, cy: 0.5, format: "original" };

  function changerCadrage(id: string, c: Cadrage, historique = true) {
    changer((x) => ({ ...x, cadrages: { ...x.cadrages, [id]: c } }), { historique });
  }

  async function enregistrerLegende(id: string, texte: string) {
    const res = await action("Enregistrement de la légende…", () => poster(`/api/voyages/${slug}/medias/${id}`, { action: "legende", texte }));
    if (res !== undefined) {
      majMedia(id, (m) => ({ ...m, legende: texte.trim() || null }));
      setLegende(null);
    }
  }

  async function suggererLegendes(ids: string[], c: Chapitre | undefined) {
    const res = await action("L’IA regarde les photos…", () =>
      poster<{ legendes: { id: string; texte: string }[] }>(`/api/voyages/${slug}/site`, {
        action: "ia-legendes",
        ids: ids.slice(0, 8),
        contexte: { titre: c?.titre ?? null, lieu: c?.lieu ?? null, dates: c?.dates ?? null },
      }),
    );
    if (!res) return;
    if (!res.legendes.length) {
      setEtat({ texte: "L’IA n’a rien proposé : réessayez.", erreur: true });
      return;
    }
    if (ids.length === 1) setLegende({ id: ids[0], texte: res.legendes[0].texte, suggestion: true });
    else {
      // Plusieurs photos : les légendes proposées sont enregistrées (modifiables ensuite d'un clic).
      for (const l of res.legendes) {
        await poster(`/api/voyages/${slug}/medias/${l.id}`, { action: "legende", texte: l.texte });
        majMedia(l.id, (m) => ({ ...m, legende: l.texte }));
      }
      setEtat({ texte: `${res.legendes.length} légende${res.legendes.length > 1 ? "s" : ""} écrite${res.legendes.length > 1 ? "s" : ""} par l’IA : cliquez sur une légende pour la modifier.` });
    }
  }

  async function vedette(m: MediaSite) {
    const res = await action("Enregistrement…", () => poster(`/api/voyages/${slug}/site`, { action: "vedette", mediaId: m.id, valeur: !m.vedette }));
    if (res) majMedia(m.id, (x) => ({ ...x, vedette: !m.vedette }));
  }

  async function retirer(m: MediaSite) {
    if (!confirm("Retirer cette photo du site ? Elle reste dans les photos du voyage (et peut y être recochée).")) return;
    const res = await action("Retrait de la photo…", () => poster(`/api/voyages/${slug}/medias/${m.id}`, { action: "cocher", champ: "dansSite", valeur: false }));
    if (res) {
      majMedia(m.id, () => null);
      setSel(null);
    }
  }

  /* ------------------------------- Accroches pour le site ------------------------------- */

  const edition: Edition = {
    media: (m, rendu, o) => {
      const choisie = sel?.type === "media" && sel.id === m.id;
      const enRecadrage = recadrage === m.id;
      const info = partieDe(m.id);
      const cle = info?.p.cle;
      const survol = glisse?.type === "media" && glisse.id !== m.id && glisse.cle === cle;
      return (
        <div
          className={`group/media ${o.ouverture ? "absolute inset-0 -z-10" : "relative h-full"} ${choisie ? "z-10 outline outline-[3px] outline-offset-2 outline-[#2f7cf6]" : "hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-[#2f7cf6]/60"} ${survol ? "outline-dashed outline-2 outline-[#2f7cf6]" : ""}`}
          data-edition-media={m.id}
          draggable={!enRecadrage && !o.ouverture && !!cle}
          onDragStart={(e) => {
            if (!cle) return;
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", m.id);
            setGlisse({ type: "media", id: m.id, cle });
          }}
          onDragEnd={() => setGlisse(null)}
          onDragOver={(e) => {
            if (glisse?.type === "media" && glisse.cle === cle && glisse.id !== m.id) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onDrop={(e) => {
            if (glisse?.type !== "media" || glisse.cle !== cle || !cle) return;
            e.preventDefault();
            e.stopPropagation();
            modifierPartie(cle, (b) => echanger(b, glisse.id, m.id));
            setGlisse(null);
          }}
          onClickCapture={(e) => {
            // Les outils (barre, panneau de recadrage) gardent leur propre comportement.
            if ((e.target as HTMLElement).closest("[data-outils]")) return;
            e.preventDefault();
            if (!enRecadrage) {
              e.stopPropagation();
              setSel({ type: "media", id: m.id });
            }
          }}
        >
          {rendu}
          {enRecadrage ? (
            <Recadreur
              m={m}
              cadrage={cadrageDe(m.id)}
              onDebut={() => changerCadrage(m.id, cadrageDe(m.id))}
              onChange={(c) => changerCadrage(m.id, c, false)}
              onFin={() => undefined}
            />
          ) : null}
          {choisie || enRecadrage ? (
            <div
              className={`pointer-events-none absolute left-0 right-0 z-30 flex flex-col items-start gap-1 ${o.ouverture ? "top-20 px-2" : enRecadrage ? "top-full mt-2" : "top-2 px-2"}`}
            >
              {enRecadrage ? (
                <PanneauRecadrage
                  cadrage={cadrageDe(m.id)}
                  onChange={(c, h) => changerCadrage(m.id, c, h)}
                  onDebut={() => changerCadrage(m.id, cadrageDe(m.id))}
                  onFin={() => setRecadrage(null)}
                  onReinit={() => changer((x) => {
                    const c = { ...x.cadrages };
                    delete c[m.id];
                    return { ...x, cadrages: c };
                  })}
                />
              ) : (
                <div data-outils className={`${barre} pointer-events-auto`} role="toolbar" aria-label="Outils de la photo" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className={bouton} onClick={() => setRecadrage(m.id)}>
                    ✂︎ Recadrer
                  </button>
                  {cle ? (
                    <>
                      <button type="button" className={bouton} aria-label="Avancer la photo" title="Vers le début" onClick={() => modifierPartie(cle, (b) => deplacerPhoto(b, m.id, -1))}>
                        ←
                      </button>
                      <button type="button" className={bouton} aria-label="Reculer la photo" title="Vers la fin" onClick={() => modifierPartie(cle, (b) => deplacerPhoto(b, m.id, 1))}>
                        →
                      </button>
                      <button type="button" className={bouton} title="Sortir la photo de son groupe, en grand" onClick={() => modifierPartie(cle, (b) => isoler(b, m.id))}>
                        ⤢ Seule
                      </button>
                    </>
                  ) : null}
                  <button type="button" className={bouton} aria-pressed={m.vedette} onClick={() => vedette(m)}>
                    {m.vedette ? "★ En avant" : "☆ Mettre en avant"}
                  </button>
                  {info && !o.ouverture && m.type === "photo" ? (
                    <button type="button" className={bouton} onClick={() => changer((x) => ({ ...x, ouvertures: { ...x.ouvertures, [info.c.cle]: m.id } }))}>
                      ▣ En ouverture
                    </button>
                  ) : null}
                  {m.type === "photo" ? (
                    <a className={bouton} href={`/voyages/${slug}/photos/${m.id}/retouche?retour=${encodeURIComponent(`/voyages/${slug}/site/editer`)}`}>
                      ✎ Retoucher
                    </a>
                  ) : null}
                  {ia && m.type === "photo" ? (
                    <button type="button" className={bouton} disabled={!!occupe} onClick={() => suggererLegendes([m.id], info?.c)}>
                      ✨ Légende
                    </button>
                  ) : null}
                  <button type="button" className={`${bouton} text-[#ffb4a8]`} onClick={() => retirer(m)}>
                    Retirer
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      );
    },

    legende: (m, rendu) => {
      if (legende?.id === m.id) {
        return (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <textarea
              autoFocus
              className="w-full rounded-md border border-s-filet bg-s-fond p-2 text-sm text-s-encre"
              rows={2}
              maxLength={1000}
              value={legende.texte}
              aria-label="Légende de la photo"
              onChange={(e) => setLegende({ ...legende, texte: e.target.value, suggestion: false })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enregistrerLegende(m.id, legende.texte);
                }
                if (e.key === "Escape") setLegende(null);
              }}
            />
            {legende.suggestion ? <p className="text-xs text-s-douce">Proposée par l’IA : gardez-la, modifiez-la ou annulez.</p> : null}
            <div className="flex flex-wrap gap-2 text-xs">
              <button type="button" className="rounded-md bg-s-accent px-3 py-1.5 font-medium text-s-fond" onClick={() => enregistrerLegende(m.id, legende.texte)}>
                Enregistrer
              </button>
              {ia && m.type === "photo" ? (
                <button type="button" className="rounded-md border border-s-filet px-3 py-1.5" disabled={!!occupe} onClick={() => suggererLegendes([m.id], partieDe(m.id)?.c)}>
                  ✨ Proposer
                </button>
              ) : null}
              <button type="button" className="rounded-md px-3 py-1.5 text-s-douce" onClick={() => setLegende(null)}>
                Annuler
              </button>
            </div>
          </div>
        );
      }
      return (
        <div
          role="button"
          tabIndex={0}
          aria-label={m.legende ? `Modifier la légende : ${m.legende}` : "Ajouter une légende"}
          className="cursor-text rounded-sm hover:bg-s-fond2"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLegende({ id: m.id, texte: m.legende ?? "" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") setLegende({ id: m.id, texte: m.legende ?? "" });
          }}
        >
          {rendu ?? <span className="text-sm italic text-s-douce opacity-70">＋ Ajouter une légende</span>}
        </div>
      );
    },

    bloc: (info, rendu) => {
      const { partie, index, bloc } = info;
      const cle = partie.cle;
      const choisi = sel?.type === "bloc" && sel.cle === cle && sel.index === index;
      const zoneDepot = glisse?.type === "bloc" && glisse.cle === cle && glisse.index !== index && glisse.index !== index - 1;
      const depotPhoto = glisse?.type === "media" && glisse.cle === cle && !mediasDuBloc(bloc).some((m) => m.id === glisse.id);
      // Photos que ce bloc peut réunir : les siennes et celles des blocs suivants de la partie.
      const disponibles = partie.blocs.slice(index).reduce((n, b) => n + mediasDuBloc(b).length, 0);
      return (
        <div
          className={`group/bloc relative rounded-md ${choisi ? "outline outline-2 outline-offset-8 outline-[#2f7cf6]" : "hover:outline hover:outline-1 hover:outline-offset-8 hover:outline-dashed hover:outline-[#2f7cf6]/50"} ${depotPhoto ? "bg-[#2f7cf6]/5" : ""}`}
          data-edition-bloc={`${cle}#${index}`}
          onClick={(e) => {
            e.stopPropagation();
            setSel({ type: "bloc", cle, index });
          }}
          onDragOver={(e) => {
            if (depotPhoto) e.preventDefault();
          }}
          onDrop={(e) => {
            if (glisse?.type !== "media" || !depotPhoto) return;
            e.preventDefault();
            modifierPartie(cle, (b) => mettreDansBloc(b, glisse.id, index));
            setGlisse(null);
          }}
        >
          {/* Zone de dépôt d'un bloc, avant celui-ci */}
          <ZoneDepot
            active={zoneDepot}
            onDrop={() => {
              if (glisse?.type !== "bloc") return;
              modifierPartie(cle, (b) => deplacerBloc(b, glisse.index, glisse.index < index ? index - 1 : index));
              setGlisse(null);
            }}
          />
          <div
            className={`absolute -top-12 left-0 z-30 ${choisi ? "flex" : "hidden group-hover/bloc:flex"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={barre} role="toolbar" aria-label="Disposition du bloc">
              <span
                className={`${bouton} cursor-grab`}
                draggable
                title="Glisser pour déplacer le bloc"
                aria-label="Glisser pour déplacer le bloc"
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", `${cle}#${index}`);
                  setGlisse({ type: "bloc", cle, index });
                }}
                onDragEnd={() => setGlisse(null)}
              >
                ⠿
              </span>
              {IDS_TYPES_BLOCS.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={TYPES_BLOCS[t].min > disponibles}
                  className={`${bouton} ${bloc.type === t ? actif : ""}`}
                  aria-pressed={bloc.type === t}
                  aria-label={`Disposition : ${TYPES_BLOCS[t].nom}`}
                  title={TYPES_BLOCS[t].nom}
                  onClick={() => modifierPartie(cle, (b) => changerType(b, index, t))}
                >
                  <Picto type={t} />
                </button>
              ))}
              <span className="px-1.5 text-xs text-white/80">{TYPES_BLOCS[bloc.type].nom}</span>
              {"cote" in bloc ? (
                <button type="button" className={bouton} title="Inverser les côtés" aria-label="Inverser les côtés" onClick={() => modifierPartie(cle, (b) => changerCote(b, index))}>
                  ⇄
                </button>
              ) : null}
              <button type="button" className={bouton} aria-label="Monter le bloc" disabled={index === 0} onClick={() => modifierPartie(cle, (b) => deplacerBloc(b, index, index - 1))}>
                ↑
              </button>
              <button type="button" className={bouton} aria-label="Descendre le bloc" disabled={index === partie.blocs.length - 1} onClick={() => modifierPartie(cle, (b) => deplacerBloc(b, index, index + 1))}>
                ↓
              </button>
              {mediasDuBloc(bloc).length > 1 ? (
                <button type="button" className={bouton} title="Une photo par bloc" onClick={() => modifierPartie(cle, (b) => scinder(b, index))}>
                  Scinder
                </button>
              ) : null}
              {index < partie.blocs.length - 1 ? (
                <button type="button" className={bouton} title="Réunir avec le bloc suivant" onClick={() => modifierPartie(cle, (b) => fusionner(b, index))}>
                  Réunir ↓
                </button>
              ) : null}
            </div>
          </div>
          {rendu}
        </div>
      );
    },

    chapitre: (c, rendu) => {
      const photos = c.medias.filter((m) => m.type === "photo");
      const sansLegende = photos.filter((m) => !m.legende).map((m) => m.id);
      const auto = c.parties.every((p) => !r.mise[p.cle]) && !r.ouvertures[c.cle];
      return (
        <div className="relative">
          {rendu}
          <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
            <div className={barre} role="toolbar" aria-label={`Outils du chapitre ${c.titre}`}>
              {c.episodeId ? (
                <button
                  type="button"
                  className={bouton}
                  onClick={() => {
                    const ep = d.episodes.find((e) => e.id === c.episodeId);
                    setChapitreOuvert({ episodeId: c.episodeId!, titre: ep?.titre ?? c.titre, recit: ep?.recit ?? "" });
                  }}
                >
                  ✎ Titre et récit
                </button>
              ) : null}
              {ia && sansLegende.length ? (
                <button type="button" className={bouton} disabled={!!occupe} onClick={() => suggererLegendes(sansLegende, c)}>
                  ✨ Légender ({Math.min(8, sansLegende.length)})
                </button>
              ) : null}
              {!auto ? (
                <button
                  type="button"
                  className={bouton}
                  onClick={() =>
                    changer((x) => {
                      const mise = { ...x.mise };
                      for (const p of c.parties) delete mise[p.cle];
                      const ouvertures = { ...x.ouvertures };
                      delete ouvertures[c.cle];
                      return { ...x, mise, ouvertures };
                    })
                  }
                >
                  ↺ Mise en page automatique
                </button>
              ) : null}
            </div>
            {chapitreOuvert?.episodeId === c.episodeId && c.episodeId ? (
              <form
                className="w-[min(28rem,90vw)] space-y-2 rounded-lg bg-s-fond p-3 text-s-encre shadow-xl"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const o = chapitreOuvert;
                  const res = await action("Enregistrement du chapitre…", () => poster(`/api/voyages/${slug}/site`, { action: "chapitre", episodeId: o.episodeId, titre: o.titre, recit: o.recit }));
                  if (res) {
                    setD((x) => ({ ...x, episodes: x.episodes.map((ep) => (ep.id === o.episodeId ? { ...ep, titre: o.titre.trim(), recit: o.recit.trim() || null } : ep)) }));
                    setChapitreOuvert(null);
                  }
                }}
              >
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Titre du chapitre</span>
                  <input className="w-full rounded-md border border-s-filet bg-s-fond p-2" value={chapitreOuvert.titre} maxLength={200} onChange={(e) => setChapitreOuvert({ ...chapitreOuvert, titre: e.target.value })} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Récit</span>
                  <textarea className="w-full rounded-md border border-s-filet bg-s-fond p-2" rows={6} value={chapitreOuvert.recit} onChange={(e) => setChapitreOuvert({ ...chapitreOuvert, recit: e.target.value })} />
                </label>
                <div className="flex gap-2 text-sm">
                  <button type="submit" className="rounded-md bg-s-accent px-3 py-1.5 font-medium text-s-fond">
                    Enregistrer
                  </button>
                  <button type="button" className="rounded-md px-3 py-1.5 text-s-douce" onClick={() => setChapitreOuvert(null)}>
                    Annuler
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      );
    },

    finPartie: (c, p) => {
      const medias = p.blocs.flatMap(mediasDuBloc);
      const n = variantes.current.get(p.cle) ?? 0;
      return (
        <div className="space-y-2">
          <ZoneDepot
            active={glisse?.type === "bloc" && glisse.cle === p.cle && glisse.index !== p.blocs.length - 1}
            onDrop={() => {
              if (glisse?.type !== "bloc") return;
              modifierPartie(p.cle, (b) => deplacerBloc(b, glisse.index, b.length));
              setGlisse(null);
            }}
          />
          {medias.length > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-dashed border-s-filet pt-3 text-sm">
              <button
                type="button"
                className="rounded-full border border-s-filet px-3 py-1.5 hover:bg-s-fond2"
                title="Une autre façon de disposer ces photos"
                onClick={() => {
                  variantes.current.set(p.cle, n + 1);
                  changer((x) => ({ ...x, mise: { ...x.mise, [p.cle]: variante(medias.map((m) => ({ id: m.id, ratio: ratioDe(m) })), n) } }));
                  setEtat({ texte: `Variante ${(n % NB_VARIANTES) + 1} sur ${NB_VARIANTES} : recliquez pour une autre, Ctrl+Z pour revenir.` });
                }}
              >
                🔀 Autre disposition
              </button>
              {ia ? (
                <button
                  type="button"
                  className="rounded-full border border-s-filet px-3 py-1.5 hover:bg-s-fond2 disabled:opacity-50"
                  disabled={!!occupe}
                  onClick={async () => {
                    const res = await action("L’IA compose la mise en page…", () =>
                      poster<{ blocs: BlocSite[]; idee: string | null }>(`/api/voyages/${slug}/site`, { action: "ia-disposition", ids: medias.slice(0, 30).map((m) => m.id) }),
                    );
                    if (res) {
                      changer((x) => ({ ...x, mise: { ...x.mise, [p.cle]: res.blocs } }));
                      setEtat({ texte: res.idee ? `Idée de l’IA : ${res.idee} (Ctrl+Z pour revenir)` : "Disposition proposée par l’IA (Ctrl+Z pour revenir)." });
                    }
                  }}
                >
                  ✨ Mise en page par l’IA
                </button>
              ) : null}
              {r.mise[p.cle] ? (
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-s-douce hover:bg-s-fond2"
                  onClick={() =>
                    changer((x) => {
                      const mise = { ...x.mise };
                      delete mise[p.cle];
                      return { ...x, mise };
                    })
                  }
                >
                  ↺ Automatique
                </button>
              ) : null}
              <span className="sr-only">{c.titre}</span>
            </div>
          ) : null}
        </div>
      );
    },
  };

  const nbPhotos = tous.size;

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-40 -mx-4 flex flex-wrap items-center gap-2 border-b border-filet bg-papier/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <button type="button" className="bouton-discret" onClick={annuler} disabled={!passe.length}>
          ↶ Annuler
        </button>
        <button type="button" className="bouton-discret" onClick={retablir} disabled={!futur.length}>
          ↷ Rétablir
        </button>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={apercu} onChange={(e) => setApercu(e.target.checked)} />
          Aperçu sans les outils
        </label>
        <span role="status" className={`ml-auto text-sm ${etat?.erreur ? "text-danger" : "text-encre-douce"}`}>
          {occupe ?? etat?.texte ?? `${nbPhotos} photo${nbPhotos > 1 ? "s" : ""} sur le site`}
        </span>
      </div>
      {!apercu ? (
        <p className="text-sm text-encre-douce">
          Touchez une photo pour la recadrer, la déplacer ou la mettre en avant ; touchez un bloc pour changer sa disposition. Glissez une photo sur une autre pour les
          échanger, ou un bloc (poignée ⠿) pour le déplacer. Cliquez sur une légende pour l’écrire. Ctrl+Z annule.
        </p>
      ) : null}
      {/* Le site en pleine largeur, comme le verront les lecteurs. */}
      <div
        className="overflow-x-clip border-y border-filet"
        style={{ marginInline: "calc(50% - 50vw)" }}
        onClick={() => {
          setSel(null);
          setRecadrage(null);
        }}
      >
        <Site d={dEff} edition={apercu ? undefined : edition} />
      </div>
    </div>
  );
}

function ZoneDepot({ active, onDrop }: { active: boolean; onDrop: () => void }) {
  const [dessus, setDessus] = useState(false);
  if (!active) return null;
  return (
    <div
      className={`-mt-4 mb-2 flex h-10 items-center justify-center rounded-md border-2 border-dashed text-xs ${dessus ? "border-[#2f7cf6] bg-[#2f7cf6]/10 text-[#2f7cf6]" : "border-[#2f7cf6]/40 text-s-douce"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDessus(true);
      }}
      onDragLeave={() => setDessus(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDessus(false);
        onDrop();
      }}
    >
      Déposer le bloc ici
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defauts, effet, REGROUPEMENTS, type Decision, type Regroupement } from "@/lib/tri/moments";
import type { DecisionTri, MediaTri } from "@/server/domaine/tri";
import { Boutons, etat } from "./boutons";
import { Planche } from "./planche";

const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
type Filtre = "a-trier" | "tout";

/** Préférence d'affichage gardée dans ce navigateur (sans conséquence si le stockage est indisponible). */
function lirePref<T extends string>(cle: string, permis: readonly T[], defaut: T): T {
  try {
    const v = localStorage.getItem(cle) as T | null;
    return v && permis.includes(v) ? v : defaut;
  } catch {
    return defaut;
  }
}
function ecrirePref(cle: string, v: string) {
  try {
    localStorage.setItem(cle, v);
  } catch {
    // stockage indisponible : la préférence n'est simplement pas retenue
  }
}

/**
 * Tri des photos : toutes les photos, groupées par heure de prise de vue, chacune avec quatre boutons
 * (vert : on garde ; rouge : on ne garde pas ; site seulement ; livre seulement). Toucher une photo l'agrandit.
 */
export function Trieuse({
  slug,
  medias: initiales,
  avis: avisInitial,
  estAdmin,
  ia,
  depart,
}: {
  slug: string;
  medias: MediaTri[];
  avis: Record<string, string>;
  estAdmin: boolean;
  ia: boolean;
  depart: string | null;
}) {
  const [medias, setMedias] = useState(initiales);
  const parId = useMemo(() => new Map(medias.map((m) => [m.id, m])), [medias]);
  const [filtre, setFiltre] = useState<Filtre>("a-trier");
  const [regroupement, setRegroupement] = useState<Regroupement>("30min");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- préférence du navigateur, lue après l'affichage
    setRegroupement(lirePref<Regroupement>("tri-regroupement-2", Object.keys(REGROUPEMENTS) as Regroupement[], "30min"));
  }, []);
  const [historique, setHistorique] = useState<DecisionTri[][]>([]);
  const [avis, setAvis] = useState(avisInitial);
  const [iaEnCours, setIaEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(depart);

  const restants = useMemo(() => medias.filter((m) => !m.trie).length, [medias]);
  const bilan = useMemo(() => {
    const b = { garder: 0, site: 0, livre: 0, ecarter: 0 };
    for (const m of medias) {
      if (!m.trie) continue;
      if (m.dansSite && m.dansLivre) b.garder++;
      else if (m.dansSite) b.site++;
      else if (m.dansLivre) b.livre++;
      else b.ecarter++;
    }
    return b;
  }, [medias]);

  const appliquer = useCallback((decisions: DecisionTri[]) => {
    const parDecision = new Map(decisions.map((d) => [d.id, d]));
    setMedias((l) =>
      l.map((m) => {
        const d = parDecision.get(m.id);
        return d ? { ...m, dansSite: d.dansSite, dansLivre: d.dansLivre, trie: d.trie, ...(d.vedette !== undefined ? { vedette: d.vedette } : {}) } : m;
      }),
    );
  }, []);

  const photographie = useCallback(
    (ids: string[]): DecisionTri[] =>
      ids.map((id) => {
        const m = parId.get(id)!;
        return { id, dansSite: m.dansSite, dansLivre: m.dansLivre, trie: m.trie, ...(estAdmin ? { vedette: m.vedette } : {}) };
      }),
    [estAdmin, parId],
  );

  /** Envoie des décisions : affichées tout de suite, annulées si le serveur refuse. */
  const envoyer = useCallback(
    async (decisions: DecisionTri[], memoriser = true) => {
      const avant = photographie(decisions.map((d) => d.id));
      appliquer(decisions);
      if (memoriser) setHistorique((h) => [...h.slice(-99), avant]);
      setErreur(null);
      try {
        const rep = await fetch(`/api/voyages/${slug}/selection`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "trier", decisions }),
        });
        if (!rep.ok) throw new Error((await rep.json().catch(() => null))?.erreur ?? "Enregistrement impossible.");
      } catch (e) {
        appliquer(avant);
        if (memoriser) setHistorique((h) => h.slice(0, -1));
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    },
    [appliquer, photographie, slug],
  );

  const decider = useCallback(
    (ids: string[], d: Decision | ((m: MediaTri) => Decision)) => {
      const decisions = ids.map((id) => {
        const m = parId.get(id)!;
        const e = effet(typeof d === "function" ? d(m) : d);
        return { id, dansSite: e.dansSite, dansLivre: e.dansLivre, trie: true, ...(estAdmin && e.vedette !== undefined ? { vedette: e.vedette } : {}) };
      });
      void envoyer(decisions);
    },
    [envoyer, estAdmin, parId],
  );

  const annuler = useCallback(() => {
    const avant = historique.at(-1);
    if (!avant) return;
    setHistorique((h) => h.slice(0, -1));
    void envoyer(avant, false);
  }, [historique, envoyer]);

  const demanderIa = useCallback(
    async (ids: string[]) => {
      setIaEnCours(ids[0]);
      setErreur(null);
      try {
        // Les mieux notées d'abord : l'IA compare quatre photos au plus.
        const note = (m: MediaTri) => (m.nettete ?? 0.5) * 0.65 + (m.exposition ?? 0.5) * 0.35;
        const tries = [...ids].sort((a, b) => note(parId.get(b)!) - note(parId.get(a)!));
        const rep = await fetch(`/api/voyages/${slug}/selection`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "ia-serie", ids: tries }),
        });
        const r = await rep.json();
        if (!rep.ok) throw new Error(r.erreur ?? "L’IA n’a pas répondu.");
        if (r.mediaId) setAvis((a) => ({ ...a, [r.mediaId]: r.raison }));
        else setErreur(r.raison);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "L’IA n’a pas répondu.");
      } finally {
        setIaEnCours(null);
      }
    },
    [parId, slug],
  );

  // Raccourci global : Z annule.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select") || ouverte) return;
      if (e.key.toLowerCase() === "z" && !e.metaKey && !e.altKey) {
        e.preventDefault();
        annuler();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [annuler, ouverte]);

  if (!medias.length) return <p className="text-encre-douce">Aucune photo à trier pour l’instant.</p>;
  const progression = (medias.length - restants) / medias.length;

  return (
    <div className="space-y-5" data-testid="trieuse">
      <div className="carte space-y-3">
        <div className="space-y-1" data-testid="progression">
          <p>
            <strong>{restants}</strong> photo{restants > 1 ? "s" : ""} à trier sur {medias.length}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-papier-2" aria-hidden>
            <div className="h-full bg-emerald-600 transition-[width]" style={{ width: `${progression * 100}%` }} />
          </div>
        </div>
        <p className="text-sm text-encre-douce">
          Sous chaque photo : <strong className="text-emerald-700 dark:text-emerald-400">✓ Garder</strong> la met sur le site et dans le livre,{" "}
          <strong className="text-red-700 dark:text-red-400">✕ Non</strong> l’écarte. Les cases <strong>Site</strong> et <strong>Livre</strong> montrent par une
          coche verte où elle va ; touchez-en une pour l’ajouter ou l’enlever. Touchez la photo pour l’agrandir.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-encre-douce">Grouper les photos</span>
            <select
              className="champ py-1"
              value={regroupement}
              onChange={(e) => {
                setRegroupement(e.target.value as Regroupement);
                ecrirePref("tri-regroupement-2", e.target.value);
              }}
            >
              {(Object.keys(REGROUPEMENTS) as Regroupement[]).map((r) => (
                <option key={r} value={r}>
                  {REGROUPEMENTS[r].libelle}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-encre-douce">Afficher</span>
            <select className="champ py-1" value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)}>
              <option value="a-trier">les photos à trier</option>
              <option value="tout">toutes les photos</option>
            </select>
          </label>
          <button type="button" className="bouton-discret" onClick={annuler} disabled={!historique.length}>
            ↶ Annuler
          </button>
        </div>
      </div>

      {erreur ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {erreur}
        </p>
      ) : null}

      {filtre === "a-trier" && restants === 0 ? (
        <section className="carte space-y-3 text-center" data-testid="tri-fini">
          <h2 className="text-2xl">Tout est trié !</h2>
          <p className="text-encre-douce">
            {bilan.garder} gardée{bilan.garder > 1 ? "s" : ""} · {bilan.site} sur le site seulement · {bilan.livre} dans le livre seulement · {bilan.ecarter} pas gardée
            {bilan.ecarter > 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="bouton-discret" onClick={() => setFiltre("tout")}>
              Revoir toutes les photos
            </button>
            <Link href={`/voyages/${slug}/site`} className="bouton-discret">
              Voir le site
            </Link>
            <Link href={`/voyages/${slug}/livre`} className="bouton">
              Passer au livre
            </Link>
          </div>
        </section>
      ) : (
        <Planche
          medias={medias}
          avis={avis}
          regroupement={regroupement}
          seulementATrier={filtre === "a-trier"}
          decider={decider}
          ouvrir={setOuverte}
          ia={ia && estAdmin ? (ids) => void demanderIa(ids) : null}
          iaEnCours={iaEnCours}
        />
      )}

      {ouverte && parId.get(ouverte) ? (
        <Agrandie
          slug={slug}
          medias={medias}
          id={ouverte}
          estAdmin={estAdmin}
          seulementATrier={filtre === "a-trier"}
          decider={decider}
          annuler={annuler}
          aller={setOuverte}
        />
      ) : null}
    </div>
  );
}

/** Une photo en grand, avec les mêmes boutons ; après un choix, on passe à la suivante. */
function Agrandie({
  slug,
  medias,
  id,
  estAdmin,
  seulementATrier,
  decider,
  annuler,
  aller,
}: {
  slug: string;
  medias: MediaTri[];
  id: string;
  estAdmin: boolean;
  seulementATrier: boolean;
  decider: (ids: string[], d: Decision) => void;
  annuler: () => void;
  aller: (id: string | null) => void;
}) {
  const i = medias.findIndex((m) => m.id === id);
  const m = medias[i];
  const precedente = i > 0 ? medias[i - 1].id : null;
  const suivante = i < medias.length - 1 ? medias[i + 1].id : null;
  // Après un choix : la prochaine photo à trier (ou simplement la suivante quand on revoit tout).
  const prochaine = useCallback(() => {
    for (let k = i + 1; k < medias.length; k++) if (!seulementATrier || !medias[k].trie) return medias[k].id;
    return null;
  }, [i, medias, seulementATrier]);
  // Garder ou Non : on passe à la photo suivante à trier ; cocher Site ou Livre : on reste (pour cocher l'autre).
  const choisir = useCallback(
    (d: Decision, avancer = true) => {
      decider([id], d);
      if (avancer) aller(prochaine());
    },
    [decider, id, aller, prochaine],
  );

  // Les photos suivantes se chargent à l'avance.
  useEffect(() => {
    for (const s of medias.slice(i + 1, i + 4)) if (s.moyenne) new Image().src = s.moyenne;
  }, [i, medias]);

  const actions = useRef({ choisir, annuler, aller, precedente, suivante });
  useEffect(() => {
    actions.current = { choisir, annuler, aller, precedente, suivante };
  });
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.metaKey || e.altKey || e.ctrlKey) return;
      const a = actions.current;
      const k = e.key.toLowerCase();
      if (k === "escape") a.aller(null);
      else if (k === "arrowright" && a.suivante) a.aller(a.suivante);
      else if (k === "arrowleft" && a.precedente) a.aller(a.precedente);
      else if (k === "g" || k === "enter") a.choisir("garder");
      else if (k === "n" || k === "x" || k === "delete") a.choisir("ecarter");
      else if (k === "s") a.choisir("site", false);
      else if (k === "l") a.choisir("livre", false);
      else if (k === "z") a.annuler();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  // Glisser à gauche ou à droite : photo suivante ou précédente.
  const debut = useRef<number | null>(null);
  const e = etat(m);
  const lien = (auto: boolean) =>
    `/voyages/${slug}/photos/${m.id}/retouche?retour=${encodeURIComponent(`/voyages/${slug}/photos/trier?m=${m.id}`)}${auto ? "&auto=1" : ""}`;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Photo ${m.nomFichier}`} className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <span>
          {i + 1} / {medias.length}
          <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${e.ton}`} data-testid="etat-agrandie">
            {e.libelle}
          </span>
        </span>
        <button type="button" onClick={() => aller(null)} className="min-h-10 rounded-md px-3 hover:bg-white/10" aria-label="Fermer">
          ✕ Fermer
        </button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-2"
        onPointerDown={(ev) => {
          if (ev.pointerType !== "mouse") debut.current = ev.clientX;
        }}
        onPointerUp={(ev) => {
          const d = debut.current;
          debut.current = null;
          if (d === null) return;
          if (ev.clientX - d < -70 && suivante) aller(suivante);
          else if (ev.clientX - d > 70 && precedente) aller(precedente);
        }}
      >
        {m.type === "video" && m.video ? (
          <video key={m.id} src={m.video} poster={m.moyenne ?? undefined} controls playsInline className="max-h-full max-w-full" />
        ) : m.moyenne ?? m.grande ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
          <img key={m.id} src={m.moyenne ?? m.grande ?? undefined} alt={m.legende ?? ""} className="max-h-full max-w-full object-contain" draggable={false} />
        ) : (
          <span className="text-white/70">{m.nomFichier}</span>
        )}
        {precedente ? (
          <button type="button" onClick={() => aller(precedente)} aria-label="Photo précédente" className="absolute left-1 top-1/2 hidden h-14 w-10 -translate-y-1/2 rounded bg-white/15 text-2xl hover:bg-white/30 sm:block">
            ‹
          </button>
        ) : null}
        {suivante ? (
          <button type="button" onClick={() => aller(suivante)} aria-label="Photo suivante" className="absolute right-1 top-1/2 hidden h-14 w-10 -translate-y-1/2 rounded bg-white/15 text-2xl hover:bg-white/30 sm:block">
            ›
          </button>
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-2 px-3 pb-4 pt-2">
        <p className="text-center text-xs text-white/70">
          {m.instant ? <span className="first-letter:uppercase">{fmt.format(new Date(m.instant))}</span> : "Sans date"}
          {m.auteur ? ` · ${m.auteur}` : ""} · {m.nomFichier}
          {defauts(m).length ? ` · semble ${defauts(m).join(" et ")}` : ""}
        </p>
        <Boutons m={m} decider={choisir} grand />
        <div className="flex justify-center">
          <button type="button" className="min-h-10 rounded-md px-3 text-sm text-white/80 underline-offset-4 hover:underline" onClick={() => aller(prochaine())}>
            Photo suivante à trier →
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          {estAdmin ? (
            <button type="button" className="min-h-10 rounded-md border border-white/30 px-3 hover:bg-white/10" onClick={() => choisir("coeur")}>
              ♥ Coup de cœur
            </button>
          ) : null}
          {m.retouchable ? (
            <>
              <Link href={lien(false)} className="inline-flex min-h-10 items-center rounded-md border border-white/30 px-3 hover:bg-white/10">
                Retoucher
              </Link>
              <Link href={lien(true)} className="inline-flex min-h-10 items-center rounded-md border border-white/30 px-3 hover:bg-white/10">
                ✨ Retouche auto
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

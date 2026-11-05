"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defauts, effet, moments, suggestion, type Decision } from "@/lib/tri/moments";
import type { DecisionTri, MediaTri } from "@/server/domaine/tri";

const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

type Filtre = "a-trier" | "tout";
type Etape = { avant: DecisionTri[]; position: number };

function etatDe(m: MediaTri): { libelle: string; ton: string } {
  if (!m.trie) return { libelle: "À trier", ton: "bg-white/85 text-black" };
  if (m.vedette && m.dansSite) return { libelle: "♥ Coup de cœur", ton: "bg-accent text-white" };
  if (m.dansLivre) return { libelle: "Site et livre", ton: "bg-emerald-700 text-white" };
  if (m.dansSite) return { libelle: "Site seulement", ton: "bg-sky-700 text-white" };
  return { libelle: "Écartée", ton: "bg-black/75 text-white" };
}

function Touche({ k }: { k: string }) {
  return <kbd className="ml-1.5 hidden rounded border border-current/30 px-1 text-[11px] opacity-70 sm:inline">{k}</kbd>;
}

/** Tri des photos, moment par moment : une décision par photo, la meilleure d'une série en un geste. */
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
  // Les moments se calculent une fois : trier ne change ni les dates ni les empreintes.
  const groupes = useMemo(() => moments(initiales).map((g) => g.map((m) => m.id)), [initiales]);
  const [filtre, setFiltre] = useState<Filtre>("a-trier");
  const nonTrie = useCallback((i: number) => groupes[i].some((id) => !parId.get(id)?.trie), [groupes, parId]);
  const [position, setPosition] = useState(() => {
    const ici = depart ? groupes.findIndex((g) => g.includes(depart)) : -1;
    if (ici >= 0) return ici;
    const premier = groupes.findIndex((g) => g.some((id) => !initiales.find((m) => m.id === id)?.trie));
    return premier >= 0 ? premier : 0;
  });
  const [fini, setFini] = useState(() => !depart && initiales.length > 0 && initiales.every((m) => m.trie));
  const [historique, setHistorique] = useState<Etape[]>([]);
  const [avis, setAvis] = useState(avisInitial);
  const [iaEnCours, setIaEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aide, setAide] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const groupe = useMemo(() => (groupes[position] ?? []).map((id) => parId.get(id)!).filter(Boolean), [groupes, position, parId]);
  const serie = groupe.length > 1;
  const conseil = useMemo(() => (serie ? suggestion(groupe, new Map(Object.entries(avis))) : null), [serie, groupe, avis]);

  // Sélection dans une série : ce qui est déjà gardé si on y revient, sinon la suggestion.
  const cleGroupe = groupes[position]?.join(",") ?? "";
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const choisis = useMemo(() => {
    if (selections[cleGroupe]) return selections[cleGroupe];
    if (!serie) return new Set<string>();
    return new Set(groupe.every((m) => m.trie) ? groupe.filter((m) => m.dansSite).map((m) => m.id) : [conseil!.id]);
  }, [selections, cleGroupe, serie, groupe, conseil]);
  const setChoisis = useCallback((f: (s: Set<string>) => Set<string>) => setSelections((x) => ({ ...x, [cleGroupe]: f(choisis) })), [cleGroupe, choisis]);

  const restants = useMemo(() => medias.filter((m) => !m.trie).length, [medias]);
  const bilan = useMemo(() => {
    const b = { livre: 0, site: 0, ecartees: 0, coeurs: 0 };
    for (const m of medias) {
      if (!m.trie) continue;
      if (m.vedette && m.dansSite) b.coeurs++;
      if (m.dansLivre) b.livre++;
      else if (m.dansSite) b.site++;
      else b.ecartees++;
    }
    return b;
  }, [medias]);

  const suivant = useCallback(
    (depuis: number, f: Filtre = filtre) => {
      for (let i = depuis + 1; i < groupes.length; i++) if (f === "tout" || nonTrie(i)) return i;
      return -1;
    },
    [groupes.length, filtre, nonTrie],
  );
  const avancer = useCallback(() => {
    const i = suivant(position);
    if (i < 0) setFini(true);
    else setPosition(i);
  }, [suivant, position]);
  const reculer = useCallback(() => {
    setFini(false);
    setPosition((p) => Math.max(0, p - 1));
  }, []);

  const appliquer = useCallback((decisions: DecisionTri[]) => {
    setMedias((l) => l.map((m) => {
      const d = decisions.find((x) => x.id === m.id);
      return d ? { ...m, dansSite: d.dansSite, dansLivre: d.dansLivre, trie: d.trie, ...(d.vedette !== undefined ? { vedette: d.vedette } : {}) } : m;
    }));
  }, []);

  const envoyer = useCallback(
    async (decisions: DecisionTri[], etape?: Etape) => {
      const avant = decisions.map((d) => parId.get(d.id)!);
      appliquer(decisions);
      if (etape) setHistorique((h) => [...h.slice(-49), etape]);
      setErreur(null);
      try {
        const rep = await fetch(`/api/voyages/${slug}/selection`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "trier", decisions }),
        });
        if (!rep.ok) throw new Error((await rep.json().catch(() => null))?.erreur ?? "Enregistrement impossible.");
      } catch (e) {
        // On revient en arrière : rien n'a été enregistré.
        appliquer(avant.map((m) => ({ id: m.id, dansSite: m.dansSite, dansLivre: m.dansLivre, trie: m.trie, ...(estAdmin ? { vedette: m.vedette } : {}) })));
        if (etape) setHistorique((h) => h.slice(0, -1));
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    },
    [appliquer, estAdmin, parId, slug],
  );

  const photographie = useCallback(
    (ids: string[]): DecisionTri[] =>
      ids.map((id) => {
        const m = parId.get(id)!;
        return { id, dansSite: m.dansSite, dansLivre: m.dansLivre, trie: m.trie, ...(estAdmin ? { vedette: m.vedette } : {}) };
      }),
    [estAdmin, parId],
  );
  const vers = useCallback(
    (id: string, d: Decision): DecisionTri => {
      const e = effet(d);
      return { id, dansSite: e.dansSite, dansLivre: e.dansLivre, trie: true, ...(estAdmin && e.vedette !== undefined ? { vedette: e.vedette } : {}) };
    },
    [estAdmin],
  );

  const decider = useCallback(
    (d: Decision) => {
      if (!groupe.length || (d === "coeur" && !estAdmin)) return;
      const ids = groupe.map((m) => m.id);
      void envoyer(ids.map((id) => vers(id, d)), { avant: photographie(ids), position });
      avancer();
    },
    [groupe, estAdmin, envoyer, vers, photographie, position, avancer],
  );

  const garderSelection = useCallback(
    (garder: Set<string>) => {
      const ids = groupe.map((m) => m.id);
      void envoyer(ids.map((id) => vers(id, garder.has(id) ? "livre" : "ecarter")), { avant: photographie(ids), position });
      avancer();
    },
    [groupe, envoyer, vers, photographie, position, avancer],
  );

  const annuler = useCallback(() => {
    const e = historique.at(-1);
    if (!e) return;
    setHistorique((h) => h.slice(0, -1));
    void envoyer(e.avant);
    setFini(false);
    setPosition(e.position);
  }, [historique, envoyer]);

  const basculer = useCallback(
    (id: string) =>
      setChoisis((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [setChoisis],
  );

  const demanderIa = useCallback(async () => {
    if (!serie || iaEnCours) return;
    setIaEnCours(true);
    setErreur(null);
    try {
      // Les mieux notées d'abord : l'IA compare quatre photos au plus.
      const ids = [...groupe].sort((a, b) => (b.nettete ?? 0.5) * 0.65 + (b.exposition ?? 0.5) * 0.35 - ((a.nettete ?? 0.5) * 0.65 + (a.exposition ?? 0.5) * 0.35)).map((m) => m.id);
      const rep = await fetch(`/api/voyages/${slug}/selection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "ia-serie", ids }),
      });
      const r = await rep.json();
      if (!rep.ok) throw new Error(r.erreur ?? "L’IA n’a pas répondu.");
      if (r.mediaId) {
        setAvis((a) => ({ ...a, [r.mediaId]: r.raison }));
        setChoisis(() => new Set([r.mediaId]));
      } else setErreur(r.raison);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L’IA n’a pas répondu.");
    } finally {
      setIaEnCours(false);
    }
  }, [serie, iaEnCours, groupe, slug, setChoisis]);

  const retour = (id: string) => encodeURIComponent(`/voyages/${slug}/photos/trier?m=${id}`);
  const lienRetouche = (id: string, auto = false) => `/voyages/${slug}/photos/${id}/retouche?retour=${retour(id)}${auto ? "&auto=1" : ""}`;
  const unique = !serie ? groupe[0] : null;

  // Clavier : tout se fait sans souris.
  const actions = useRef({ decider, garderSelection, annuler, avancer, reculer, basculer, demanderIa });
  useEffect(() => {
    actions.current = { decider, garderSelection, annuler, avancer, reculer, basculer, demanderIa };
  });
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (cible.closest("input, textarea, select") || e.altKey || e.metaKey) return;
      const a = actions.current;
      const k = e.key.toLowerCase();
      if (k === "z" || (k === "backspace" && !e.ctrlKey)) a.annuler();
      else if (e.ctrlKey) return;
      else if (k === "?") setAide((x) => !x);
      else if (k === "escape") setZoom(null);
      else if (k === "j" || k === "pagedown") a.avancer();
      else if (k === "k" || k === "pageup") a.reculer();
      else if (serie) {
        if (/^[1-9]$/.test(k) && groupe[Number(k) - 1]) a.basculer(groupe[Number(k) - 1].id);
        else if (k === "enter" || k === "arrowright" || k === "l") a.garderSelection(choisis);
        else if (k === "x" || k === "arrowleft") a.decider("ecarter");
        else if (k === "g") a.garderSelection(new Set(groupe.map((m) => m.id)));
        else if (k === "i" && ia && estAdmin) void a.demanderIa();
        else return;
      } else if (k === "x" || k === "arrowleft") a.decider("ecarter");
      else if (k === "s" || k === "arrowdown") a.decider("site");
      else if (k === "l" || k === "arrowright" || k === "enter") a.decider("livre");
      else if (k === "f" || k === "arrowup") a.decider("coeur");
      else if (k === "r" && unique?.retouchable) window.location.assign(lienRetouche(unique.id));
      else if (k === "a" && unique?.retouchable) window.location.assign(lienRetouche(unique.id, true));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
    // lienRetouche ne dépend que du slug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serie, groupe, choisis, ia, estAdmin, unique]);

  // Glisser sur téléphone : à droite on garde, à gauche on écarte, vers le haut coup de cœur.
  const depart_ = useRef<{ x: number; y: number } | null>(null);
  const [decalage, setDecalage] = useState(0);
  const glisser = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      depart_.current = { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (depart_.current) setDecalage(e.clientX - depart_.current.x);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = depart_.current;
      depart_.current = null;
      setDecalage(0);
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (dy < -90 && Math.abs(dx) < 60 && estAdmin) decider("coeur");
      else if (dx > 90) decider("livre");
      else if (dx < -90) decider("ecarter");
    },
    onPointerCancel: () => {
      depart_.current = null;
      setDecalage(0);
    },
  };

  if (!medias.length) return <p className="text-encre-douce">Aucune photo à trier pour l’instant.</p>;

  const progression = medias.length ? (medias.length - restants) / medias.length : 1;

  return (
    <div className="space-y-4" data-testid="trieuse">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-48 flex-1 space-y-1" data-testid="progression">
          <p className="text-sm">
            <strong>{restants}</strong> photo{restants > 1 ? "s" : ""} à trier sur {medias.length}
            {!fini ? (
              <span className="text-encre-douce">
                {" "}
                · moment {position + 1} / {groupes.length}
              </span>
            ) : null}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-papier-2" aria-hidden>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${progression * 100}%` }} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-encre-douce">Afficher</span>
          <select
            className="champ py-1"
            value={filtre}
            onChange={(e) => {
              const f = e.target.value as Filtre;
              setFiltre(f);
              if (f === "a-trier" && !nonTrie(position)) {
                const i = suivant(-1, f);
                if (i < 0) setFini(true);
                else setPosition(i);
              } else setFini(false);
            }}
          >
            <option value="a-trier">les photos à trier</option>
            <option value="tout">toutes les photos (revoir)</option>
          </select>
        </label>
        <button type="button" className="bouton-discret" onClick={annuler} disabled={!historique.length}>
          ↶ Annuler
          <Touche k="Z" />
        </button>
        <button type="button" className="bouton-discret" onClick={() => setAide((x) => !x)} aria-expanded={aide}>
          Raccourcis
        </button>
      </div>

      {aide ? (
        <div className="carte grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <p>
            <strong>→</strong> ou <strong>L</strong> : site et livre · <strong>↓</strong> ou <strong>S</strong> : site seulement
          </p>
          <p>
            <strong>←</strong> ou <strong>X</strong> : écarter{estAdmin ? <> · <strong>↑</strong> ou <strong>F</strong> : coup de cœur</> : null}
          </p>
          <p>
            Série : <strong>1</strong> à <strong>9</strong> choisir, <strong>Entrée</strong> garder la sélection, <strong>G</strong> tout garder
          </p>
          <p>
            <strong>R</strong> retoucher · <strong>A</strong> retouche auto · <strong>J</strong>/<strong>K</strong> passer/revenir · <strong>Z</strong> annuler
          </p>
          <p className="text-encre-douce sm:col-span-2">Sur téléphone : glissez la photo à droite pour la garder, à gauche pour l’écarter{estAdmin ? ", vers le haut pour un coup de cœur" : ""}.</p>
        </div>
      ) : null}

      {erreur ? (
        <p role="alert" className="text-sm text-accent">
          {erreur}
        </p>
      ) : null}

      {fini ? (
        <section className="carte space-y-3 text-center" data-testid="tri-fini">
          <h2 className="text-2xl">{restants ? "Fin de la liste" : "Tout est trié !"}</h2>
          <p className="text-encre-douce">
            {bilan.livre} dans le livre (et le site){bilan.coeurs ? `, dont ${bilan.coeurs} coup${bilan.coeurs > 1 ? "s" : ""} de cœur` : ""} · {bilan.site} sur le site seulement · {bilan.ecartees} écartée
            {bilan.ecartees > 1 ? "s" : ""}
            {restants ? ` · ${restants} encore à trier` : ""}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="bouton-discret"
              onClick={() => {
                setFiltre("tout");
                setFini(false);
                setPosition(0);
              }}
            >
              Tout revoir
            </button>
            <Link href={`/voyages/${slug}/site`} className="bouton-discret">
              Voir le site
            </Link>
            <Link href={`/voyages/${slug}/livre`} className="bouton">
              Passer au livre
            </Link>
          </div>
        </section>
      ) : unique ? (
        <section className="space-y-3">
          <figure
            className="relative flex min-h-48 touch-pan-y select-none items-center justify-center overflow-hidden rounded-md bg-neutral-950 sm:h-[min(62vh,720px)]"
            {...glisser}
          >
            {unique.type === "video" && unique.video ? (
              <video key={unique.id} src={unique.video} poster={unique.moyenne ?? undefined} controls playsInline className="max-h-[70vh] max-w-full sm:max-h-full" />
            ) : (unique.grande ?? unique.moyenne) ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage, pas d'optimisation Vercel
              <img
                key={unique.id}
                src={unique.grande ?? unique.moyenne ?? undefined}
                alt={unique.legende ?? `Photo ${unique.nomFichier}`}
                className="max-h-[70vh] max-w-full object-contain transition-transform sm:max-h-full"
                style={{ transform: decalage ? `translateX(${decalage}px) rotate(${decalage / 40}deg)` : undefined }}
                draggable={false}
              />
            ) : (
              <span className="text-white/70">{unique.nomFichier}</span>
            )}
            <span className={`absolute left-2 top-2 rounded px-2 py-0.5 text-xs ${etatDe(unique).ton}`} data-testid="etat-media">
              {etatDe(unique).libelle}
            </span>
            {defauts(unique).length ? (
              <span className="absolute right-2 top-2 rounded bg-amber-500 px-2 py-0.5 text-xs text-black">Semble {defauts(unique).join(" et ")}</span>
            ) : null}
            {decalage > 40 ? <span className="absolute inset-y-0 left-0 flex items-center bg-emerald-700/70 px-4 text-white">Garder</span> : null}
            {decalage < -40 ? <span className="absolute inset-y-0 right-0 flex items-center bg-black/70 px-4 text-white">Écarter</span> : null}
          </figure>
          <p className="text-sm text-encre-douce">
            {unique.instant ? <span className="first-letter:uppercase">{fmt.format(new Date(unique.instant))}</span> : "Sans date"}
            {unique.auteur ? ` · ${unique.auteur}` : ""} · {unique.nomFichier}
            {unique.retouchee ? " · retouchée" : ""}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" className="bouton-discret justify-center py-3" onClick={() => decider("ecarter")}>
              ✕ Écarter
              <Touche k="←" />
            </button>
            <button type="button" className="bouton-discret justify-center py-3" onClick={() => decider("site")}>
              Site seulement
              <Touche k="↓" />
            </button>
            <button type="button" className="bouton justify-center py-3" onClick={() => decider("livre")}>
              ✓ Site et livre
              <Touche k="→" />
            </button>
            {estAdmin ? (
              <button type="button" className="bouton-discret justify-center py-3" onClick={() => decider("coeur")}>
                ♥ Coup de cœur
                <Touche k="↑" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" className="bouton-discret" onClick={reculer} disabled={position === 0}>
              ← Précédente
            </button>
            <button type="button" className="bouton-discret" onClick={avancer}>
              Passer →
            </button>
            {unique.retouchable ? (
              <>
                <Link href={lienRetouche(unique.id)} className="bouton-discret">
                  Retoucher
                  <Touche k="R" />
                </Link>
                <Link href={lienRetouche(unique.id, true)} className="bouton-discret">
                  ✨ Retouche auto
                  <Touche k="A" />
                </Link>
              </>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-xl">{groupe.length} photos semblables</h2>
            <p className="text-sm text-encre-douce">
              Touchez celles à garder (la suggestion est cochée), puis « Garder la sélection » : les autres sont écartées.
            </p>
          </div>
          <ul className={`grid gap-2 ${groupe.length > 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-2"}`}>
            {groupe.map((m, i) => {
              const garde = choisis.has(m.id);
              const estConseil = conseil?.id === m.id;
              const score = Math.round(((m.nettete ?? 0.5) * 0.65 + (m.exposition ?? 0.5) * 0.35) * 100);
              return (
                <li key={m.id} className="relative">
                  <button
                    type="button"
                    onClick={() => basculer(m.id)}
                    aria-pressed={garde}
                    aria-label={`Photo ${i + 1}${estConseil ? " (suggérée)" : ""}`}
                    className={`relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-neutral-950 ${garde ? "ring-4 ring-emerald-600" : "opacity-60 hover:opacity-90"}`}
                  >
                    {m.moyenne ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
                      <img src={m.moyenne} alt="" className="h-full w-full object-contain" draggable={false} />
                    ) : null}
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 text-xs text-white">{i + 1}</span>
                    {garde ? <span className="absolute right-1.5 top-1.5 rounded bg-emerald-600 px-1.5 text-xs text-white">Gardée</span> : null}
                    {estConseil ? (
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-accent px-1.5 text-xs text-white" data-testid="suggestion">
                        ★ {avis[m.id] ? "Choix de l’IA" : "Suggestion"}
                      </span>
                    ) : null}
                    {defauts(m).length ? (
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-amber-500 px-1.5 text-xs text-black">{defauts(m).join(", ")}</span>
                    ) : null}
                  </button>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-encre-douce">
                    <span title="Netteté et exposition mesurées sur la photo">Qualité {m.nettete == null ? "non mesurée" : `${score} / 100`}</span>
                    <span className="flex gap-2">
                      <button type="button" className="lien" onClick={() => setZoom(m.id)}>
                        Agrandir
                      </button>
                      {m.retouchable ? (
                        <Link href={lienRetouche(m.id)} className="lien">
                          Retoucher
                        </Link>
                      ) : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {conseil && avis[conseil.id] ? <p className="text-sm">★ L’IA : « {avis[conseil.id]} »</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="bouton" onClick={() => garderSelection(choisis)} disabled={!choisis.size}>
              Garder la sélection ({choisis.size})
              <Touche k="Entrée" />
            </button>
            <button type="button" className="bouton-discret" onClick={() => garderSelection(new Set(groupe.map((m) => m.id)))}>
              Tout garder
              <Touche k="G" />
            </button>
            <button type="button" className="bouton-discret" onClick={() => decider("ecarter")}>
              Tout écarter
              <Touche k="X" />
            </button>
            {ia && estAdmin ? (
              <button type="button" className="bouton-discret" onClick={() => void demanderIa()} disabled={iaEnCours}>
                {iaEnCours ? "L’IA regarde…" : "Demander à l’IA"}
                <Touche k="I" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" className="bouton-discret" onClick={reculer} disabled={position === 0}>
              ← Précédent
            </button>
            <button type="button" className="bouton-discret" onClick={avancer}>
              Passer →
            </button>
          </div>
        </section>
      )}

      {zoom && parId.get(zoom) ? (
        <div role="dialog" aria-label="Photo agrandie" className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage */}
          <img src={parId.get(zoom)?.grande ?? parId.get(zoom)?.moyenne ?? undefined} alt="" className="max-h-full max-w-full object-contain" />
          <button type="button" className="absolute right-3 top-3 rounded bg-white/90 px-3 py-1 text-black" onClick={() => setZoom(null)}>
            Fermer
          </button>
        </div>
      ) : null}
    </div>
  );
}

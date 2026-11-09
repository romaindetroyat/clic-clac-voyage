"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doublesPages, FONDS, PageVue, pageDeCouverture } from "@/components/livre/page-livre";
import { dpiEffectif } from "@/lib/livre/cadrage";
import { controler, type Probleme } from "@/lib/livre/controles";
import { epaisseurDos, FORMATS, formatParId, pagesValides } from "@/lib/livre/formats";
import { AMBIANCES, GABARITS, gabaritParId, geometriePage, IDS_AMBIANCES, legendesParPhoto, type Ambiance } from "@/lib/livre/gabarits";
import { legendeAuto, mettreEnPage } from "@/lib/livre/mise-en-page";
import { nouvelId, RYTHMES, type Cellule, type EpisodeLivre, type Livre, type MediaLivre, type PageLivre } from "@/lib/livre/modele";
import { FONDS as PALETTE, POLICES, IDS_FONDS, IDS_STYLES, STYLES, type IdFond, type IdStyle } from "@/lib/livre/styles";
import { classesPolicesLivre } from "@/components/livre/polices-livre";
import { ExportPdf } from "./export-pdf";
import { Feuilleter } from "./feuilleter";

export type VersionResume = { id: string; libelle: string; le: string; auteur: string | null; pages: number };

type Selection = { page: number; cellule: number | null } | null;
type Etat = { texte: string; erreur?: boolean } | null;

const fmtVersion = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function appeler<T>(slug: string, corps: object): Promise<T> {
  const rep = await fetch(`/api/voyages/${slug}/livre`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps),
  });
  const json = (await rep.json()) as T & { erreur?: string };
  if (json.erreur) throw new Error(json.erreur);
  return json;
}

function Miniature({ id, formatId }: { id: string; formatId: string }) {
  // Aperçu schématique d'un gabarit, dans le format du livre.
  const f = formatParId(formatId);
  const geo = geometriePage(f, id, 1);
  const L = 44;
  const s = L / f.largeur;
  const H = f.hauteur * s;
  const r = (x: { x: number; y: number; l: number; h: number }, rotation?: number) => ({
    left: x.x * s,
    top: x.y * s,
    width: x.l * s,
    height: x.h * s,
    ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}),
  });
  return (
    <span className="relative block overflow-hidden bg-white" style={{ width: L, height: H }} aria-hidden>
      {geo.formes
        .filter((x) => !x.trait && x.rect.l * s > 1.5 && x.rect.h * s > 1.5)
        .map((x, i) => (
          <span key={`f${i}`} className="absolute" style={{ ...r(x.rect, x.rotation), background: x.teinte === "sombre" ? "#333" : x.teinte === "blanc" ? "#fff" : x.teinte === "voile" ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.08)", boxShadow: x.teinte === "blanc" ? "0 0 0 0.5px rgba(0,0,0,.35)" : undefined }} />
        ))}
      {geo.photos.map((x, i) => (
        <span key={i} className="absolute bg-encre-douce/60" style={r(x, x.rotation)} />
      ))}
      {geo.textes
        .filter((t) => t.role !== "folio")
        .map((t, i) => (
          <span key={`t${i}`} className="absolute border-t border-encre-douce/60" style={{ ...r(t.rect, t.rotation), height: Math.min(t.rect.h * s, t.role === "corps" ? 10 : 2) }} />
        ))}
    </span>
  );
}

const policeCss = (id: keyof typeof POLICES) => `${POLICES[id].css}, Georgia, serif`;

/** Gabarits proposés pour une page, groupés par nombre de photos. */
function groupesGabarits(actuel: string) {
  const groupes = new Map<string, typeof GABARITS>();
  for (const g of GABARITS) {
    if (g.famille === "titre" && !gabaritParId(actuel).famille.startsWith("titre")) continue;
    const cle = g.famille === "photos" ? (g.n === 1 ? "1 photo" : `${g.n} photos`) : g.famille === "ouverture" ? "Ouvertures d’épisode" : g.famille === "titre" ? "Titre" : "Textes et pages blanches";
    groupes.set(cle, [...(groupes.get(cle) ?? []), g]);
  }
  return [...groupes.entries()];
}

export function EditeurLivre({
  slug,
  nom,
  periode,
  fuseau,
  episodes,
  medias,
  fin,
  initial,
  revisionInitiale,
  versionsInitiales,
}: {
  slug: string;
  nom: string;
  periode: string | null;
  fuseau: string;
  episodes: EpisodeLivre[];
  medias: MediaLivre[];
  fin: { titre: string; corps: string } | null;
  initial: Livre | null;
  revisionInitiale: number | null;
  versionsInitiales: VersionResume[];
}) {
  const [livre, setLivreBrut] = useState<Livre | null>(initial);
  const [revision, setRevision] = useState(revisionInitiale);
  const revisionRef = useRef(revisionInitiale);
  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);
  const [historique, setHistorique] = useState<Livre[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [echange, setEchange] = useState<{ page: number; cellule: number } | null>(null);
  const [choixPhoto, setChoixPhoto] = useState(false);
  const [versions, setVersions] = useState(versionsInitiales);
  const [etat, setEtat] = useState<Etat>(null);
  const [rapport, setRapport] = useState<string | null>(null);
  const [feuilleter, setFeuilleter] = useState(false);
  const [exporter, setExporter] = useState(false);
  const [voirProblemes, setVoirProblemes] = useState(false);
  const [reglages, setReglages] = useState<Livre["options"] & { formatId: string }>(
    initial ? { ...initial.options, formatId: initial.formatId } : { formatId: FORMATS[0].id, ciblePages: 40, rythme: "equilibre", fond: "blanc", style: "classique", ambiance: "melange", legendes: true, commentaires: false },
  );
  const [largeurPage, setLargeurPage] = useState(220);
  const zone = useRef<HTMLDivElement>(null);
  const aEnregistrer = useRef(false);

  const parId = useMemo(() => new Map(medias.map((m) => [m.id, m])), [medias]);
  const format = formatParId(livre?.formatId ?? reglages.formatId);
  const problemes: Probleme[] = useMemo(() => (livre ? controler(livre, format, parId) : []), [livre, format, parId]);
  const bloquants = problemes.filter((p) => p.niveau === "bloquant");
  const utilisees = useMemo(() => new Set(livre?.pages.flatMap((p) => p.cellules.map((c) => c?.mediaId)) ?? []), [livre]);

  // Taille des pages : deux pages côte à côte remplissent la largeur disponible.
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargeurPage(Math.max(120, Math.min(420, Math.floor((e.contentRect.width - 8) / 2)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Copie synchrone de l'état, pour calculer une modification sans effet de bord dans un « updater ».
  const courant = useRef(livre);
  const pile = useRef<Livre[]>([]);
  useEffect(() => {
    courant.current = livre;
  }, [livre]);

  /** Toute modification passe par ici : annulation possible et enregistrement automatique. */
  const modifier = useCallback((fn: (l: Livre) => Livre) => {
    const avant = courant.current;
    if (!avant) return;
    const apres = fn(structuredClone(avant));
    courant.current = apres;
    pile.current = [...pile.current.slice(-49), avant];
    setHistorique(pile.current);
    aEnregistrer.current = true;
    setLivreBrut(apres);
  }, []);

  function annuler() {
    const precedent = pile.current.at(-1);
    if (!precedent) return;
    pile.current = pile.current.slice(0, -1);
    setHistorique(pile.current);
    courant.current = precedent;
    aEnregistrer.current = true;
    setLivreBrut(precedent);
  }

  /** Enregistre tout de suite ce qui ne l'est pas encore (avant un export). */
  async function enregistrerMaintenant() {
    if (!courant.current || !aEnregistrer.current) return;
    aEnregistrer.current = false;
    const r = await appeler<{ revision: number }>(slug, { action: "enregistrer", contenu: courant.current, revision: revisionRef.current });
    revisionRef.current = r.revision;
    setRevision(r.revision);
    setEtat({ texte: "Enregistré" });
  }

  // Enregistrement automatique, une seconde après la dernière modification.
  useEffect(() => {
    if (!livre || !aEnregistrer.current) return;
    const t = setTimeout(async () => {
      if (!aEnregistrer.current) return; // déjà enregistré (avant un export, par exemple)
      aEnregistrer.current = false;
      setEtat({ texte: "Enregistrement…" });
      try {
        const r = await appeler<{ revision: number }>(slug, { action: "enregistrer", contenu: livre, revision: revisionRef.current });
        revisionRef.current = r.revision;
        setRevision(r.revision);
        setEtat({ texte: "Enregistré" });
      } catch (e) {
        setEtat({ texte: (e as Error).message, erreur: true });
      }
    }, 900);
    return () => clearTimeout(t);
  }, [livre, revision, slug]);

  useEffect(() => {
    function clavier(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !(e.target as HTMLElement).closest("input, textarea")) {
        e.preventDefault();
        annuler();
      }
    }
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  });

  async function generer() {
    if (livre && !confirm("Refaire toute la mise en page ? La version actuelle est gardée dans l’historique.")) return;
    try {
      if (livre && revision) {
        const r = await appeler<{ versions: VersionResume[] }>(slug, { action: "version", libelle: "Avant une nouvelle mise en page automatique" });
        setVersions(r.versions);
      }
      const { livre: nouveau, rapport: r } = mettreEnPage({
        nom,
        periode,
        fuseau,
        format: formatParId(reglages.formatId),
        options: {
          ciblePages: reglages.ciblePages,
          rythme: reglages.rythme,
          fond: reglages.fond,
          style: reglages.style,
          ambiance: reglages.ambiance,
          legendes: reglages.legendes,
          commentaires: reglages.commentaires,
        },
        episodes,
        medias,
        couverture: livre?.couverture,
        fin,
      });
      setRapport(r.message ?? `Mise en page faite : ${r.pages} pages, ${r.photos} photos.`);
      if (livre) pile.current = [...pile.current.slice(-49), livre];
      setHistorique(pile.current);
      courant.current = nouveau;
      aEnregistrer.current = true;
      setLivreBrut(nouveau);
      setSelection(null);
    } catch (e) {
      setEtat({ texte: (e as Error).message, erreur: true });
    }
  }

  async function enregistrerVersion() {
    const libelle = prompt("Nom de cette version :", `Version du ${fmtVersion.format(new Date())}`);
    if (libelle == null) return;
    try {
      const r = await appeler<{ versions: VersionResume[] }>(slug, { action: "version", libelle });
      setVersions(r.versions);
      setEtat({ texte: "Version enregistrée." });
    } catch (e) {
      setEtat({ texte: (e as Error).message, erreur: true });
    }
  }

  async function restaurer(v: VersionResume) {
    if (!confirm(`Revenir à « ${v.libelle} » ? L’état actuel est gardé dans l’historique.`)) return;
    try {
      const r = await appeler<{ revision: number; livre: Livre; versions: VersionResume[] }>(slug, { action: "restaurer", versionId: v.id });
      courant.current = r.livre;
      pile.current = [];
      setLivreBrut(r.livre);
      setRevision(r.revision);
      setVersions(r.versions);
      setReglages({ ...r.livre.options, formatId: r.livre.formatId });
      setHistorique([]);
      setSelection(null);
      setEtat({ texte: `Retour à « ${v.libelle} ».` });
    } catch (e) {
      setEtat({ texte: (e as Error).message, erreur: true });
    }
  }

  /* --------------------------- Actions sur les pages --------------------------- */

  function cliquerCellule(page: number, cellule: number) {
    if (echange) {
      const a = echange;
      setEchange(null);
      if (a.page === page && a.cellule === cellule) return;
      modifier((l) => {
        const ca = l.pages[a.page].cellules[a.cellule] ?? null;
        const cb = l.pages[page].cellules[cellule] ?? null;
        l.pages[a.page].cellules[a.cellule] = cb ? { ...cb, zoom: 1, cx: 0.5, cy: 0.5 } : null;
        l.pages[page].cellules[cellule] = ca ? { ...ca, zoom: 1, cx: 0.5, cy: 0.5 } : null;
        return l;
      });
      setSelection({ page, cellule });
      return;
    }
    setSelection({ page, cellule });
  }

  function majCellule(fn: (c: Cellule) => Cellule) {
    if (!selection || selection.cellule == null) return;
    const { page, cellule } = selection;
    modifier((l) => {
      const c = l.pages[page].cellules[cellule];
      if (c) l.pages[page].cellules[cellule] = fn(c);
      return l;
    });
  }

  function majPage(fn: (p: PageLivre) => PageLivre) {
    if (!selection) return;
    modifier((l) => {
      l.pages[selection.page] = fn(l.pages[selection.page]);
      return l;
    });
  }

  function changerGabarit(id: string) {
    majPage((p) => {
      const n = gabaritParId(id).n;
      const cellules = [...p.cellules];
      while (cellules.length < n) cellules.push(null);
      // Gabarit qui légende chaque photo : on reprend les légendes des photos qui n'en ont pas.
      if (legendesParPhoto(id) && livre?.options.legendes) {
        for (const [i, c] of cellules.entries()) if (c && !c.legende) cellules[i] = { ...c, legende: legendeAuto([parId.get(c.mediaId)], livre.options.commentaires) || undefined };
      }
      return { ...p, gabarit: id, cellules };
    });
    setSelection((s) => (s ? { ...s, cellule: null } : s));
  }

  function inserer(apres: number, gabarit: string) {
    modifier((l) => {
      l.pages.splice(apres + 1, 0, { id: nouvelId(), gabarit, cellules: Array(gabaritParId(gabarit).n).fill(null), episodeId: l.pages[apres]?.episodeId ?? null });
      return l;
    });
    setSelection({ page: apres + 1, cellule: null });
  }

  function supprimerPage(i: number) {
    modifier((l) => {
      l.pages.splice(i, 1);
      return l;
    });
    setSelection(null);
  }

  function deplacerPage(i: number, sens: -1 | 1) {
    const j = i + sens;
    if (!livre || j < 0 || j >= livre.pages.length) return;
    modifier((l) => {
      [l.pages[i], l.pages[j]] = [l.pages[j], l.pages[i]];
      return l;
    });
    setSelection({ page: j, cellule: null });
  }

  function choisirPhoto(m: MediaLivre) {
    setChoixPhoto(false);
    if (selection?.page === -1) {
      modifier((l) => ({ ...l, couverture: { ...l.couverture, photo: { mediaId: m.id, zoom: 1, cx: 0.5, cy: 0.5 } } }));
      return;
    }
    if (!selection || selection.cellule == null) return;
    const { page, cellule } = selection;
    modifier((l) => {
      l.pages[page].cellules[cellule] = { mediaId: m.id, zoom: 1, cx: 0.5, cy: 0.5 };
      return l;
    });
  }

  function legendesAuto() {
    const com = livre?.options.commentaires ?? false;
    majPage((p) =>
      legendesParPhoto(p.gabarit)
        ? { ...p, cellules: p.cellules.map((c) => (c ? { ...c, legende: legendeAuto([parId.get(c.mediaId)], com) } : c)) }
        : { ...p, legende: legendeAuto(p.cellules.map((c) => (c ? parId.get(c.mediaId) : undefined)), com) },
    );
  }

  function appliquerReglages() {
    if (!livre) return;
    modifier((l) => ({
      ...l,
      formatId: reglages.formatId,
      options: {
        ...l.options,
        fond: reglages.fond,
        style: reglages.style,
        ambiance: reglages.ambiance,
        legendes: reglages.legendes,
        commentaires: reglages.commentaires,
        ciblePages: reglages.ciblePages,
        rythme: reglages.rythme,
      },
    }));
  }

  /* ---------------------------------- Rendu ---------------------------------- */

  const pageSel = selection && selection.page >= 0 && livre ? livre.pages[selection.page] : null;
  const celluleSel = pageSel && selection?.cellule != null ? (pageSel.cellules[selection.cellule] ?? null) : null;
  const geoSel = pageSel && selection ? geometriePage(format, pageSel.gabarit, selection.page + 1) : null;
  const roles = new Set(geoSel?.textes.filter((t) => !(t.role === "legende" && t.photo != null)).map((t) => t.role));
  const legendePhoto = !!geoSel && selection?.cellule != null && geoSel.textes.some((t) => t.role === "legende" && t.photo === selection.cellule);
  const mediaSel = celluleSel ? parId.get(celluleSel.mediaId) : undefined;
  const cadreSel = geoSel && selection?.cellule != null ? geoSel.photos[selection.cellule] : null;
  const dpiSel = mediaSel && cadreSel && celluleSel ? dpiEffectif(mediaSel.largeur, mediaSel.hauteur, cadreSel.l, cadreSel.h, celluleSel) : null;
  const modifieReglages =
    !!livre &&
    (reglages.formatId !== livre.formatId ||
      reglages.fond !== livre.options.fond ||
      (reglages.style ?? "classique") !== (livre.options.style ?? "classique") ||
      (reglages.ambiance ?? "melange") !== (livre.options.ambiance ?? "melange") ||
      reglages.legendes !== livre.options.legendes ||
      reglages.commentaires !== livre.options.commentaires ||
      reglages.ciblePages !== livre.options.ciblePages ||
      reglages.rythme !== livre.options.rythme);

  return (
    <div className={`space-y-6 ${classesPolicesLivre}`}>
      {/* Réglages généraux */}
      <section className="space-y-3 rounded-lg border border-filet p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="etiquette">Format</span>
            <select className="champ" value={reglages.formatId} onChange={(e) => setReglages({ ...reglages, formatId: e.target.value })}>
              {/* Format de l'imprimeur choisi (onglet Imprimeurs), en tête. */}
              {[...(FORMATS.some((x) => x.id === reglages.formatId) ? [] : [formatParId(reglages.formatId)]), ...FORMATS].map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="etiquette">Nombre de pages visé</span>
            <input
              type="number"
              className="champ"
              min={formatParId(reglages.formatId).pagesMin}
              max={formatParId(reglages.formatId).pagesMax}
              step={2}
              value={reglages.ciblePages}
              onChange={(e) => setReglages({ ...reglages, ciblePages: Number(e.target.value) || 0 })}
              onBlur={() => setReglages((r) => ({ ...r, ciblePages: pagesValides(formatParId(r.formatId), r.ciblePages) }))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="etiquette">Rythme</span>
            <select className="champ" value={reglages.rythme} onChange={(e) => setReglages({ ...reglages, rythme: e.target.value as Livre["options"]["rythme"] })}>
              {Object.entries(RYTHMES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="etiquette">Fond des pages</span>
            <select className="champ" value={reglages.fond} onChange={(e) => setReglages({ ...reglages, fond: e.target.value as IdFond })}>
              {IDS_FONDS.map((id) => (
                <option key={id} value={id}>
                  {PALETTE[id].nom}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="etiquette">Ambiance de la mise en page</span>
            <select className="champ" value={reglages.ambiance ?? "melange"} onChange={(e) => setReglages({ ...reglages, ambiance: e.target.value as Ambiance })}>
              {IDS_AMBIANCES.map((id) => (
                <option key={id} value={id}>
                  {AMBIANCES[id].nom}
                </option>
              ))}
            </select>
            <span className="block text-xs text-encre-douce">{AMBIANCES[reglages.ambiance ?? "melange"].description}</span>
          </label>
          <div className="space-y-1.5">
            <span className="etiquette" id="etiquette-style">
              Style des titres et des légendes
            </span>
            <div role="radiogroup" aria-labelledby="etiquette-style" className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {IDS_STYLES.map((id) => {
                const st = STYLES[id];
                const choisi = (reglages.style ?? "classique") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={choisi}
                    aria-label={`Style ${st.nom}`}
                    onClick={() => setReglages({ ...reglages, style: id as IdStyle })}
                    className={`rounded border p-2 text-left ${choisi ? "border-encre ring-2 ring-encre" : "border-filet hover:bg-papier-2"}`}
                  >
                    <span className="block truncate" style={{ fontFamily: policeCss(st.titre.police), fontSize: 18, lineHeight: 1.1, fontStyle: st.titre.italique ? "italic" : undefined, textTransform: st.titre.majuscules ? "uppercase" : undefined }}>
                      {st.nom}
                    </span>
                    <span className="block truncate text-encre-douce" style={{ fontFamily: policeCss(st.legende.police), fontSize: 13, fontStyle: st.legende.italique ? "italic" : undefined, textTransform: st.legende.majuscules ? "uppercase" : undefined }}>
                      Coucher de soleil à Oia
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={reglages.legendes} onChange={(e) => setReglages({ ...reglages, legendes: e.target.checked })} />
            Légendes
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={reglages.commentaires} onChange={(e) => setReglages({ ...reglages, commentaires: e.target.checked })} />
            Un commentaire sous les photos
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="bouton" onClick={generer} disabled={!medias.length}>
            {livre ? "Refaire la mise en page automatique" : "Créer le livre automatiquement"}
          </button>
          {modifieReglages ? (
            <button type="button" className="bouton-discret" onClick={appliquerReglages}>
              Appliquer sans refaire la mise en page
            </button>
          ) : null}
          <span className="text-sm text-encre-douce">
            {medias.length} photo{medias.length > 1 ? "s" : ""} cochée{medias.length > 1 ? "s" : ""} « Dans le livre »
          </span>
        </div>
        {rapport ? (
          <p role="status" className="text-sm">
            {rapport}
          </p>
        ) : null}
        {!medias.length ? <p className="text-sm text-encre-douce">Cochez d’abord des photos « Dans le livre » (onglet Photos).</p> : null}
      </section>

      {livre ? (
        <>
          {/* Barre d'état : contrôles, annulation, feuilletage, versions */}
          <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-filet bg-papier/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
            <span className="text-sm">
              {livre.pages.length} pages · dos {epaisseurDos(format, livre.pages.length).toString().replace(".", ",")} mm
            </span>
            <button
              type="button"
              onClick={() => setVoirProblemes((v) => !v)}
              aria-expanded={voirProblemes}
              className={`min-h-11 rounded-full border px-3 text-sm ${bloquants.length ? "border-danger text-danger" : problemes.length ? "border-accent text-accent" : "border-succes text-succes"}`}
            >
              {bloquants.length
                ? `${bloquants.length} problème${bloquants.length > 1 ? "s" : ""} bloquant${bloquants.length > 1 ? "s" : ""}`
                : problemes.length
                  ? `${problemes.length} alerte${problemes.length > 1 ? "s" : ""}`
                  : "Prêt pour l’impression"}
            </button>
            <button type="button" className="bouton-discret" onClick={annuler} disabled={!historique.length}>
              Annuler
            </button>
            <button type="button" className="bouton-discret" onClick={() => setFeuilleter(true)}>
              Feuilleter
            </button>
            <button type="button" className="bouton-discret" onClick={enregistrerVersion}>
              Enregistrer une version
            </button>
            <button type="button" className="bouton-discret" onClick={() => setExporter(true)}>
              Exporter le PDF
            </button>
            <span role="status" className={`ml-auto text-sm ${etat?.erreur ? "text-danger" : "text-encre-douce"}`}>
              {echange ? "Touchez la photo à échanger…" : etat?.texte}
            </span>
          </div>

          {voirProblemes && problemes.length ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-filet p-3 text-sm">
              {problemes.map((p, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => {
                      if (p.page && p.page > 0) {
                        setSelection({ page: p.page - 1, cellule: p.cellule ?? null });
                        document.querySelector(`[data-page="${p.page}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }}
                  >
                    <span className={p.niveau === "bloquant" ? "text-danger" : "text-accent"}>{p.niveau === "bloquant" ? "Bloquant" : "Alerte"}</span>
                    {p.page ? ` · page ${p.page}` : ""} : {p.message}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            {/* Doubles pages */}
            <div ref={zone} className="min-w-0 space-y-6">
              <section aria-label="Couverture" className="space-y-2">
                <p className="etiquette">Couverture</p>
                <div className="flex justify-end">
                  <div className="shadow-md" style={{ marginRight: 0 }}>
                    <PageVue
                      page={pageDeCouverture(livre.couverture)}
                      numero={0}
                      format={format}
                      fond={livre.options.fond}
                      style={livre.options.style}
                      medias={parId}
                      largeur={largeurPage}
                      selection={selection?.page === -1 ? { cellule: 0 } : null}
                      onPage={() => setSelection({ page: -1, cellule: 0 })}
                      onCellule={() => setSelection({ page: -1, cellule: 0 })}
                    />
                  </div>
                  <div style={{ width: largeurPage }} />
                </div>
              </section>
              {doublesPages(livre.pages.length).map((paire, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-center">
                    {paire.map((j, k) =>
                      j == null ? (
                        <div key={k} style={{ width: largeurPage }} />
                      ) : (
                        <div key={k} className={`shadow-md ${selection?.page === j ? "ring-2 ring-[#2f7cf6]" : ""}`}>
                          <PageVue
                            page={livre.pages[j]}
                            numero={j + 1}
                            format={format}
                            fond={livre.options.fond}
                            style={livre.options.style}
                            medias={parId}
                            largeur={largeurPage}
                            selection={selection?.page === j ? { cellule: selection.cellule } : null}
                            onPage={() => setSelection({ page: j, cellule: null })}
                            onCellule={(c) => cliquerCellule(j, c)}
                          />
                        </div>
                      ),
                    )}
                  </div>
                  <p className="text-center text-xs text-encre-douce">{paire.filter((x) => x != null).map((x) => x! + 1).join(" – ")}</p>
                </div>
              ))}
            </div>

            {/* Panneau de la page choisie */}
            <aside className="lg:sticky lg:top-16 lg:self-start">
              {selection?.page === -1 ? (
                <div className="space-y-3 rounded-lg border border-filet p-4">
                  <h2 className="text-xl">Couverture</h2>
                  <label className="block space-y-1.5">
                    <span className="etiquette">Titre</span>
                    <input className="champ" maxLength={120} value={livre.couverture.titre} onChange={(e) => modifier((l) => ({ ...l, couverture: { ...l.couverture, titre: e.target.value } }))} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="etiquette">Sous-titre</span>
                    <input className="champ" maxLength={200} value={livre.couverture.sousTitre} onChange={(e) => modifier((l) => ({ ...l, couverture: { ...l.couverture, sousTitre: e.target.value } }))} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="etiquette">Quatrième de couverture</span>
                    <textarea className="champ" rows={4} maxLength={1500} value={livre.couverture.quatrieme} onChange={(e) => modifier((l) => ({ ...l, couverture: { ...l.couverture, quatrieme: e.target.value } }))} />
                  </label>
                  <button type="button" className="bouton-discret w-full" onClick={() => setChoixPhoto(true)}>
                    Choisir la photo de couverture
                  </button>
                  <p className="text-sm text-encre-douce">
                    Dos : {epaisseurDos(format, livre.pages.length).toString().replace(".", ",")} mm
                    {epaisseurDos(format, livre.pages.length) >= format.dosTitreMin ? ", assez épais pour y écrire le titre." : ", trop fin pour un titre."}
                  </p>
                </div>
              ) : pageSel && selection ? (
                <div className="space-y-4 rounded-lg border border-filet p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl">Page {selection.page + 1}</h2>
                    <button type="button" className="text-sm text-encre-douce hover:text-encre" onClick={() => setSelection(null)}>
                      Fermer
                    </button>
                  </div>

                  {celluleSel !== undefined && selection.cellule != null ? (
                    <div className="space-y-2 rounded-md bg-papier-2 p-3">
                      <p className="etiquette">Photo choisie</p>
                      {celluleSel ? (
                        <>
                          <label className="block text-sm">
                            Agrandir ({celluleSel.zoom.toFixed(1).replace(".", ",")}×)
                            <input type="range" min={1} max={3} step={0.05} value={celluleSel.zoom} onChange={(e) => majCellule((c) => ({ ...c, zoom: Number(e.target.value) }))} className="w-full" />
                          </label>
                          <label className="block text-sm">
                            Gauche ↔ droite
                            <input type="range" min={0} max={1} step={0.01} value={celluleSel.cx} onChange={(e) => majCellule((c) => ({ ...c, cx: Number(e.target.value) }))} className="w-full" />
                          </label>
                          <label className="block text-sm">
                            Haut ↕ bas
                            <input type="range" min={0} max={1} step={0.01} value={celluleSel.cy} onChange={(e) => majCellule((c) => ({ ...c, cy: Number(e.target.value) }))} className="w-full" />
                          </label>
                          {dpiSel != null ? (
                            <p className={`text-sm ${dpiSel < 150 ? "text-danger" : dpiSel < 250 ? "text-accent" : "text-encre-douce"}`}>Résolution : {dpiSel} dpi</p>
                          ) : null}
                          {legendePhoto ? (
                            <label className="block space-y-1.5">
                              <span className="etiquette">Légende de cette photo</span>
                              <textarea
                                className="champ"
                                rows={2}
                                maxLength={300}
                                value={celluleSel.legende ?? ""}
                                onChange={(e) => majCellule((c) => ({ ...c, legende: e.target.value }))}
                              />
                            </label>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-encre-douce">Cadre vide.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="bouton-discret" onClick={() => setChoixPhoto(true)}>
                          {celluleSel ? "Remplacer" : "Choisir une photo"}
                        </button>
                        {celluleSel ? (
                          <>
                            <button type="button" className="bouton-discret" onClick={() => setEchange({ page: selection.page, cellule: selection.cellule! })}>
                              Échanger
                            </button>
                            <button
                              type="button"
                              className="bouton-discret"
                              onClick={() =>
                                modifier((l) => {
                                  l.pages[selection.page].cellules[selection.cellule!] = null;
                                  return l;
                                })
                              }
                            >
                              Retirer
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-encre-douce">Touchez une photo de la page pour la recadrer, l’échanger ou la remplacer.</p>
                  )}

                  <div className="space-y-1.5">
                    <p className="etiquette">Gabarit</p>
                    <div role="radiogroup" aria-label="Gabarit" className="max-h-96 space-y-2 overflow-y-auto pr-1">
                      {groupesGabarits(pageSel.gabarit).map(([groupe, liste]) => (
                        <div key={groupe}>
                          <p className="text-xs text-encre-douce">{groupe}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {liste.map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                role="radio"
                                aria-checked={pageSel.gabarit === g.id}
                                title={g.nom}
                                aria-label={g.nom}
                                onClick={() => changerGabarit(g.id)}
                                className={`rounded p-1 ${pageSel.gabarit === g.id ? "bg-encre/10 ring-2 ring-encre" : "hover:bg-papier-2"}`}
                              >
                                <Miniature id={g.id} formatId={livre.formatId} />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-encre-douce">{gabaritParId(pageSel.gabarit).nom}</p>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="etiquette">Fond de cette page</span>
                    <select
                      className="champ"
                      value={pageSel.fond ?? ""}
                      onChange={(e) => majPage((p) => ({ ...p, fond: (e.target.value || undefined) as IdFond | undefined }))}
                    >
                      <option value="">Comme le livre ({PALETTE[livre.options.fond].nom})</option>
                      {IDS_FONDS.map((id) => (
                        <option key={id} value={id}>
                          {PALETTE[id].nom}
                        </option>
                      ))}
                    </select>
                  </label>

                  {roles.has("surtitre") ? (
                    <label className="block space-y-1.5">
                      <span className="etiquette">Surtitre</span>
                      <input className="champ" maxLength={200} value={pageSel.surtitre ?? ""} onChange={(e) => majPage((p) => ({ ...p, surtitre: e.target.value }))} />
                    </label>
                  ) : null}
                  {roles.has("titre") ? (
                    <label className="block space-y-1.5">
                      <span className="etiquette">Titre</span>
                      <input className="champ" maxLength={200} value={pageSel.titre ?? ""} onChange={(e) => majPage((p) => ({ ...p, titre: e.target.value }))} />
                    </label>
                  ) : null}
                  {roles.has("corps") ? (
                    <label className="block space-y-1.5">
                      <span className="etiquette">Texte</span>
                      <textarea className="champ" rows={6} maxLength={6000} value={pageSel.corps ?? ""} onChange={(e) => majPage((p) => ({ ...p, corps: e.target.value }))} />
                    </label>
                  ) : null}
                  {roles.has("legende") ? (
                    <div className="space-y-1.5">
                      <label className="block space-y-1.5">
                        <span className="etiquette">Légende de la page</span>
                        <textarea className="champ" rows={2} maxLength={600} value={pageSel.legende ?? ""} onChange={(e) => majPage((p) => ({ ...p, legende: e.target.value }))} />
                      </label>
                      <button type="button" className="text-sm text-encre-douce underline underline-offset-4" onClick={legendesAuto}>
                        Reprendre les légendes des photos
                      </button>
                    </div>
                  ) : null}

                  {!roles.has("legende") && legendesParPhoto(pageSel.gabarit) ? (
                    <p className="text-sm text-encre-douce">
                      Chaque photo a sa légende : touchez une photo pour l’écrire, ou{" "}
                      <button type="button" className="underline underline-offset-4" onClick={legendesAuto}>
                        reprenez les légendes des photos
                      </button>
                      .
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t border-filet pt-3">
                    <button type="button" className="bouton-discret" onClick={() => deplacerPage(selection.page, -1)} disabled={selection.page === 0} aria-label="Déplacer la page vers le début">
                      ← Déplacer
                    </button>
                    <button type="button" className="bouton-discret" onClick={() => deplacerPage(selection.page, 1)} disabled={selection.page === livre.pages.length - 1} aria-label="Déplacer la page vers la fin">
                      Déplacer →
                    </button>
                    <button type="button" className="bouton-discret" onClick={() => inserer(selection.page, "une")}>
                      Ajouter une page après
                    </button>
                    <button type="button" className="bouton-discret" onClick={() => inserer(selection.page, "texte")}>
                      Ajouter une page de texte
                    </button>
                    <button type="button" className="bouton-discret text-danger" onClick={() => supprimerPage(selection.page)}>
                      Supprimer la page
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-lg border border-filet p-4 text-sm">
                  <p className="text-encre-douce">Touchez une page pour la modifier : gabarit, photos, recadrage, textes.</p>
                  <div className="space-y-2">
                    <p className="etiquette">Versions</p>
                    {versions.length === 0 ? <p className="text-encre-douce">Aucune version enregistrée.</p> : null}
                    <ul className="max-h-80 divide-y divide-filet overflow-y-auto">
                      {versions.map((v) => (
                        <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                          <span>
                            {v.libelle}
                            <span className="block text-xs text-encre-douce">
                              {fmtVersion.format(new Date(v.le))} · {v.pages} pages{v.auteur ? ` · ${v.auteur}` : ""}
                            </span>
                          </span>
                          <button type="button" className="shrink-0 underline underline-offset-4" onClick={() => restaurer(v)}>
                            Revenir
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      ) : null}

      {choixPhoto ? (
        <div role="dialog" aria-modal="true" aria-label="Choisir une photo" className="fixed inset-0 z-50 flex flex-col bg-papier">
          <div className="flex items-center justify-between border-b border-filet px-4 py-2">
            <h2 className="text-xl">Choisir une photo</h2>
            <button type="button" className="bouton-discret" onClick={() => setChoixPhoto(false)}>
              Fermer
            </button>
          </div>
          <div className="grid flex-1 grid-cols-3 content-start gap-1 overflow-y-auto p-2 sm:grid-cols-6 lg:grid-cols-8">
            {medias.map((m) => (
              <button key={m.id} type="button" onClick={() => choisirPhoto(m)} className="relative aspect-square overflow-hidden bg-papier-2" aria-label={`Photo ${m.legende ?? ""}`.trim()}>
                {m.vignette ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
                  <img src={m.vignette} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
                {utilisees.has(m.id) ? <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white">dans le livre</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {exporter && livre ? (
        <ExportPdf slug={slug} revision={revision} enregistrer={enregistrerMaintenant} bloquants={bloquants.length} onFermer={() => setExporter(false)} />
      ) : null}

      {feuilleter && livre ? <Feuilleter livre={livre} format={format} medias={parId} onFermer={() => setFeuilleter(false)} fond={FONDS[livre.options.fond].fond} /> : null}
    </div>
  );
}

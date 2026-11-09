"use client";

import { useState } from "react";
import {
  couleursEffectives,
  IDS_POLICES,
  IDS_PRESENTATIONS,
  IDS_THEMES,
  POLICES,
  PRESENTATIONS,
  SECTIONS,
  THEMES,
  type ConfigSite,
  type IdTheme,
} from "@/lib/site/config";
import type { ProgresExport } from "@/lib/site/export";

type EpisodeReglage = { id: string; titre: string; presentation: string; nbMedias: number };
type PhotoReglage = { id: string; vignette: string; vedette: boolean };

async function appeler(slug: string, corps: object) {
  const rep = await fetch(`/api/voyages/${slug}/site`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps),
  });
  const json = (await rep.json()) as { ok?: true; erreur?: string };
  if (json.erreur) throw new Error(json.erreur);
}

function Groupe({ titre, children, aide }: { titre: string; children: React.ReactNode; aide?: string }) {
  return (
    <fieldset className="space-y-3 border-t border-filet pt-6">
      <legend className="float-left mb-3 w-full text-xl" style={{ fontFamily: "var(--font-titre)" }}>
        {titre}
      </legend>
      {aide ? <p className="clear-both text-sm text-encre-douce">{aide}</p> : null}
      <div className="clear-both space-y-3">{children}</div>
    </fieldset>
  );
}

export function ReglagesSite({
  slug,
  initial,
  episodes,
  photos,
  classesPolices,
}: {
  slug: string;
  initial: ConfigSite;
  episodes: EpisodeReglage[];
  photos: PhotoReglage[];
  classesPolices: string;
}) {
  const [c, setC] = useState(initial);
  const [enregistre, setEnregistre] = useState(JSON.stringify(initial));
  const [etat, setEtat] = useState<{ erreur?: string; message?: string }>({});
  const [enCours, setEnCours] = useState(false);
  const [presentations, setPresentations] = useState(() => new Map(episodes.map((e) => [e.id, e.presentation])));
  const [videos, setVideos] = useState(false);
  const [progres, setProgres] = useState<ProgresExport | null>(null);

  const modifie = JSON.stringify(c) !== enregistre;
  const maj = (p: Partial<ConfigSite>) => setC((x) => ({ ...x, ...p }));
  const couleurs = couleursEffectives(c);

  async function enregistrer() {
    setEnCours(true);
    setEtat({});
    try {
      await appeler(slug, { action: "config", config: c });
      setEnregistre(JSON.stringify(c));
      setEtat({ message: "Réglages enregistrés." });
    } catch (e) {
      setEtat({ erreur: (e as Error).message });
    } finally {
      setEnCours(false);
    }
  }

  async function changerPresentation(id: string, p: string) {
    const avant = presentations.get(id)!;
    setPresentations((m) => new Map(m).set(id, p));
    try {
      await appeler(slug, { action: "presentation", episodeId: id, presentation: p });
    } catch (e) {
      setPresentations((m) => new Map(m).set(id, avant));
      setEtat({ erreur: (e as Error).message });
    }
  }

  function deplacerSection(i: number, sens: -1 | 1) {
    const s = [...c.sections];
    const j = i + sens;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
    maj({ sections: s });
  }

  async function exporter() {
    setEtat({});
    try {
      const { exporterSite } = await import("@/lib/site/export");
      const r = await exporterSite(slug, { videos, classesPolices, onProgres: setProgres });
      if (r) {
        setEtat({
          message: r.manquants
            ? `Archive créée, mais ${r.manquants} fichier(s) sur ${r.total} n’ont pas pu être téléchargés.`
            : "Archive créée : ouvrez index.html après l’avoir décompressée.",
        });
      }
    } catch (e) {
      setEtat({ erreur: `L’export a échoué : ${(e as Error).message}` });
    } finally {
      setProgres(null);
    }
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-encre-douce">
          Le site se met à jour tout seul avec les photos cochées « Dans le site ». Choisissez ici son allure et ce
          qu’il montre.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`/voyages/${slug}/site/editer`} className="bouton">
            Modifier le site visuellement
          </a>
          <a href={`/v/${slug}`} target="_blank" className="bouton-discret">
            Ouvrir le site ↗
          </a>
        </div>
      </div>

      <Groupe titre="Thème">
        <div role="radiogroup" aria-label="Thème" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IDS_THEMES.map((id) => {
            const t = THEMES[id];
            const actif = c.theme === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => maj({ theme: id as IdTheme, polices: t.polices })}
                className={`rounded-lg border p-3 text-left transition ${actif ? "border-encre ring-2 ring-encre" : "border-filet hover:border-encre-douce"}`}
              >
                <span className="flex h-14 overflow-hidden rounded-md border border-filet" aria-hidden>
                  <span className="flex-[3]" style={{ background: t.couleurs.fond }} />
                  <span className="flex-1" style={{ background: t.couleurs.fond2 }} />
                  <span className="flex-1" style={{ background: t.couleurs.accent }} />
                  <span className="flex-1" style={{ background: t.couleurs.encre }} />
                </span>
                <span className="mt-2 block font-medium">{t.nom}</span>
                <span className="block text-sm text-encre-douce">{t.description}</span>
              </button>
            );
          })}
        </div>
      </Groupe>

      <Groupe titre="Polices et couleurs">
        <label className="block space-y-1.5">
          <span className="etiquette">Polices</span>
          <select className="champ" value={c.polices} onChange={(e) => maj({ polices: e.target.value as ConfigSite["polices"] })}>
            {IDS_POLICES.map((id) => (
              <option key={id} value={id}>
                {POLICES[id].nom}
              </option>
            ))}
          </select>
        </label>
        <div
          className={`site rounded-lg border border-filet p-5 ${classesPolices}`}
          data-polices={c.polices}
          style={
            {
              "--s-fond": couleurs.fond,
              "--s-encre": couleurs.encre,
              "--s-accent": couleurs.accent,
              "--s-encre-douce": couleurs.encreDouce,
            } as React.CSSProperties
          }
        >
          <p className="text-sm uppercase tracking-[0.14em]" style={{ color: "var(--s-accent)" }}>
            Épisode 3 · 14 août
          </p>
          <h3 className="mt-1 text-3xl">Arrivée à Naxos, la mer à perte de vue</h3>
          <p className="mt-2" style={{ color: "var(--s-encre-douce)" }}>
            Le ferry accoste en fin d’après-midi ; on dîne sur le port, les pieds presque dans l’eau.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5">
            <span className="etiquette block">Fond</span>
            <input type="color" value={couleurs.fond} onChange={(e) => maj({ couleurs: { ...c.couleurs, fond: e.target.value } })} className="h-11 w-20 rounded-md border border-filet" />
          </label>
          <label className="space-y-1.5">
            <span className="etiquette block">Accent</span>
            <input type="color" value={couleurs.accent} onChange={(e) => maj({ couleurs: { ...c.couleurs, accent: e.target.value } })} className="h-11 w-20 rounded-md border border-filet" />
          </label>
          {c.couleurs.fond || c.couleurs.accent ? (
            <button type="button" className="bouton-discret" onClick={() => maj({ couleurs: {} })}>
              Couleurs du thème
            </button>
          ) : null}
        </div>
      </Groupe>

      <Groupe titre="Couverture et textes">
        <div className="space-y-1.5">
          <span className="etiquette block">Photo de couverture</span>
          <div role="radiogroup" aria-label="Photo de couverture" className="flex gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              role="radio"
              aria-checked={!c.couvertureId}
              onClick={() => maj({ couvertureId: null })}
              className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-md border p-1 text-center text-xs ${!c.couvertureId ? "border-encre ring-2 ring-encre" : "border-filet"}`}
            >
              Automatique
            </button>
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={c.couvertureId === p.id}
                aria-label="Choisir cette photo"
                onClick={() => maj({ couvertureId: p.id })}
                className={`h-20 w-20 shrink-0 overflow-hidden rounded-md border ${c.couvertureId === p.id ? "border-encre ring-2 ring-encre" : "border-filet"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage */}
                <img src={p.vignette} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          {photos.length === 0 ? <p className="text-sm text-encre-douce">Aucune photo dans le site pour l’instant.</p> : null}
        </div>
        <label className="block space-y-1.5">
          <span className="etiquette">Sous-titre</span>
          <input className="champ" maxLength={200} value={c.sousTitre} onChange={(e) => maj({ sousTitre: e.target.value })} placeholder="Deux semaines dans les Cyclades" />
        </label>
        <label className="block space-y-1.5">
          <span className="etiquette">Texte de présentation</span>
          <textarea className="champ" rows={4} maxLength={5000} value={c.presentation} onChange={(e) => maj({ presentation: e.target.value })} placeholder="Quelques lignes pour ouvrir le site." />
        </label>
        <label className="block space-y-1.5">
          <span className="etiquette">Mot de la fin</span>
          <textarea className="champ" rows={4} maxLength={5000} value={c.motDeLaFin} onChange={(e) => maj({ motDeLaFin: e.target.value })} />
        </label>
      </Groupe>

      <Groupe titre="Carnet de voyage" aide="Le carnet raconte le voyage en chapitres : une grande photo d’ouverture, le récit, puis les photos mises en page avec leurs légendes et vos commentaires.">
        <label className="block space-y-1.5">
          <span className="etiquette">Un chapitre par…</span>
          <select className="champ" value={c.organisation} onChange={(e) => maj({ organisation: e.target.value as ConfigSite["organisation"] })}>
            <option value="auto">Automatique : épisode s’il y en a, sinon jour</option>
            <option value="jours">Jour (Jour 1, Jour 2…)</option>
            <option value="episodes">Épisode (étapes, lieux), avec ses jours</option>
          </select>
        </label>
      </Groupe>

      <Groupe titre="Sections" aide="Cochez les sections à afficher et choisissez leur ordre.">
        <ol className="divide-y divide-filet rounded-lg border border-filet">
          {c.sections.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-1.5">
              <label className="flex min-h-11 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={s.actif}
                  onChange={(e) => maj({ sections: c.sections.map((x) => (x.id === s.id ? { ...x, actif: e.target.checked } : x)) })}
                />
                {SECTIONS[s.id]}
              </label>
              <button type="button" className="min-h-11 min-w-11 rounded-md hover:bg-papier-2 disabled:opacity-30" disabled={i === 0} onClick={() => deplacerSection(i, -1)} aria-label={`Monter « ${SECTIONS[s.id]} »`}>
                ↑
              </button>
              <button type="button" className="min-h-11 min-w-11 rounded-md hover:bg-papier-2 disabled:opacity-30" disabled={i === c.sections.length - 1} onClick={() => deplacerSection(i, 1)} aria-label={`Descendre « ${SECTIONS[s.id]} »`}>
                ↓
              </button>
            </li>
          ))}
        </ol>
      </Groupe>

      <Groupe titre="Visionneuse et journal">
        <div className="flex flex-wrap gap-x-6">
          {(
            [
              ["legendes", "Légendes"],
              ["auteurs", "Auteurs des photos"],
              ["commentaires", "Commentaires"],
              ["reactions", "Réactions"],
            ] as const
          ).map(([k, libelle]) => (
            <label key={k} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={c.afficher[k]} onChange={(e) => maj({ afficher: { ...c.afficher, [k]: e.target.checked } })} />
              {libelle}
            </label>
          ))}
        </div>
        <label className="block max-w-md space-y-1.5">
          <span className="etiquette">Journal en direct</span>
          <select className="champ" value={c.journal} onChange={(e) => maj({ journal: e.target.value as ConfigSite["journal"] })}>
            <option value="auto">Pendant les dates du voyage</option>
            <option value="oui">Toujours</option>
            <option value="non">Jamais</option>
          </select>
          <span className="block text-sm text-encre-douce">
            En mode journal, les derniers épisodes s’affichent en premier et la page se met à jour toute seule.
          </span>
        </label>
      </Groupe>

      <Groupe titre="Présentation des épisodes" aide="Les changements sont enregistrés aussitôt. Pour mettre une photo en avant, ouvrez-la dans l’onglet Photos.">
        {episodes.length === 0 ? <p className="text-sm text-encre-douce">Aucun épisode : préparez d’abord le récit.</p> : null}
        <ul className="divide-y divide-filet rounded-lg border border-filet">
          {episodes.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                {e.titre} <span className="text-sm text-encre-douce">· {e.nbMedias} photo{e.nbMedias > 1 ? "s" : ""}</span>
              </span>
              <select
                aria-label={`Présentation de « ${e.titre} »`}
                className="champ w-auto"
                value={presentations.get(e.id)}
                onChange={(ev) => changerPresentation(e.id, ev.target.value)}
              >
                {IDS_PRESENTATIONS.map((p) => (
                  <option key={p} value={p}>
                    {PRESENTATIONS[p]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </Groupe>

      <Groupe
        titre="Archive hors ligne"
        aide="Une copie complète du site dans un fichier .zip, qui s’ouvre sans connexion et sans serveur. À faire de préférence depuis un ordinateur."
      >
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={videos} onChange={(e) => setVideos(e.target.checked)} />
          Inclure les vidéos (archive plus lourde)
        </label>
        {progres ? (
          <div role="status" className="space-y-1.5">
            <p className="text-sm">
              {progres.etape}… {progres.total > 1 ? `${progres.fait} / ${progres.total}` : ""}
            </p>
            <progress className="w-full" max={progres.total} value={progres.fait} />
          </div>
        ) : (
          <button type="button" className="bouton-discret" onClick={exporter} disabled={modifie}>
            Exporter le site en .zip
          </button>
        )}
        {modifie ? <p className="text-sm text-encre-douce">Enregistrez vos réglages avant d’exporter.</p> : null}
      </Groupe>

      <div className="sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center gap-3 border-t border-filet bg-papier/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <button type="button" className="bouton" onClick={enregistrer} disabled={!modifie || enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {modifie ? (
          <button type="button" className="bouton-discret" onClick={() => setC(JSON.parse(enregistre) as ConfigSite)}>
            Annuler les changements
          </button>
        ) : null}
        <p role="status" className={`text-sm ${etat.erreur ? "text-danger" : "text-encre-douce"}`}>
          {etat.erreur ?? etat.message ?? (modifie ? "Modifications non enregistrées." : "")}
        </p>
      </div>
    </div>
  );
}

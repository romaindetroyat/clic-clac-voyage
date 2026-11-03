"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type SansDate = {
  id: string;
  type: "photo" | "video";
  nom: string;
  vignette: string | null;
  modifiable: boolean;
  suggestion: { instant: string; local: string; raison: string } | null;
};

const fmtJour = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
const libelleJour = (j: string) => fmtJour.format(new Date(`${j}T12:00:00Z`));
const libelleLocal = (local: string) => `${libelleJour(local.slice(0, 10))}, ${local.slice(11, 13)} h ${local.slice(14, 16)}`;

async function poster(slug: string, corps: object) {
  const rep = await fetch(`/api/voyages/${slug}/dates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
  const r = await rep.json().catch(() => ({}));
  if (!rep.ok || r.erreur) throw new Error(r.erreur ?? `Erreur ${rep.status}`);
  return r;
}

export function DatesAFixer({ slug, jours, sansDate }: { slug: string; fuseau: string; jours: { jour: string; photos: number }[]; sansDate: SansDate[] }) {
  const router = useRouter();
  const [enCours, lancer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [choisies, setChoisies] = useState<Set<string>>(new Set());
  const [heure, setHeure] = useState("12:00");
  const avecSuggestion = sansDate.filter((m) => m.suggestion && m.modifiable);
  const [suggestionsCochees, setSuggestionsCochees] = useState<Set<string>>(() => new Set(avecSuggestion.map((m) => m.id)));
  const modifiables = sansDate.filter((m) => m.modifiable);

  const action = (fn: () => Promise<string>) =>
    lancer(async () => {
      try {
        setMessage(await fn());
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Erreur");
      }
      setChoisies(new Set());
      router.refresh();
    });

  function relire() {
    action(async () => {
      const rep = await fetch(`/api/voyages/${slug}/dates`);
      const { photos } = (await rep.json()) as { photos: { id: string; nom: string; mime: string; url: string }[] };
      const { lireExif } = await import("@/lib/import/analyse");
      let trouvees = 0;
      for (const [i, p] of photos.entries()) {
        setMessage(`Lecture des fichiers d’origine : ${i} / ${photos.length}…`);
        try {
          const exif = await lireExif(new Blob([await (await fetch(p.url)).blob()], { type: p.mime }));
          if (!exif.priseLocale) continue;
          await poster(slug, { action: "relire", mediaId: p.id, exif });
          trouvees++;
        } catch {
          // Fichier illisible : il reste à dater à la main.
        }
      }
      return `${trouvees} date${trouvees > 1 ? "s" : ""} retrouvée${trouvees > 1 ? "s" : ""} dans les fichiers d’origine sur ${photos.length}.`;
    });
  }

  function appliquerSuggestions() {
    const choix = avecSuggestion.filter((m) => suggestionsCochees.has(m.id)).map((m) => ({ id: m.id, instant: m.suggestion!.instant }));
    action(async () => {
      const r = await poster(slug, { action: "suggestions", choix });
      return `${r.datees} date${r.datees > 1 ? "s" : ""} appliquée${r.datees > 1 ? "s" : ""}.`;
    });
  }

  function attribuer(jour: string) {
    const ids = modifiables.filter((m) => choisies.has(m.id)).map((m) => m.id);
    action(async () => {
      const r = await poster(slug, { action: "jour", ids, jour, heure });
      return `${r.datees} média${r.datees > 1 ? "s" : ""} placé${r.datees > 1 ? "s" : ""} au ${libelleJour(jour)}.`;
    });
  }

  const basculer = (ens: Set<string>, id: string) => {
    const n = new Set(ens);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };

  if (!sansDate.length) {
    return (
      <p className="text-encre-douce" role="status">
        {message ? `${message} ` : ""}Toutes les photos et vidéos ont une date.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {message ? (
        <p role="status" className="text-sm text-encre-douce">
          {message}
        </p>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-xl">1. Relire les fichiers d’origine</h3>
        <p className="max-w-2xl text-sm text-encre-douce">
          Les photos d’iPhone (HEIC) importées avant le 3 novembre ont perdu leur date à l’import : elle est pourtant dans le fichier. Ce bouton la
          relit, avec la position et l’appareil.
        </p>
        <button type="button" className="bouton-discret" disabled={enCours} onClick={relire}>
          Relire les dates des fichiers d’origine
        </button>
      </section>

      {avecSuggestion.length ? (
        <section className="space-y-3" aria-labelledby="titre-suggestions">
          <h3 id="titre-suggestions" className="text-xl">
            2. Dates déduites des photos voisines
          </h3>
          <p className="max-w-2xl text-sm text-encre-douce">
            Les appareils numérotent leurs fichiers dans l’ordre : une photo sans date entre IMG_1233 et IMG_1236 a été prise entre les deux.
          </p>
          <ul className="space-y-2">
            {avecSuggestion.map((m) => (
              <li key={m.id}>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={suggestionsCochees.has(m.id)} onChange={() => setSuggestionsCochees((s) => basculer(s, m.id))} />
                  {m.vignette ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.vignette} alt="" className="size-12 rounded object-cover" />
                  ) : (
                    <span className="size-12 rounded bg-papier-2" />
                  )}
                  <span>
                    <strong>{m.nom}</strong> : {libelleLocal(m.suggestion!.local)}
                    <span className="text-encre-douce"> ({m.suggestion!.raison})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="bouton" disabled={enCours || !suggestionsCochees.size} onClick={appliquerSuggestions}>
            Appliquer les {suggestionsCochees.size} date{suggestionsCochees.size > 1 ? "s" : ""} cochée{suggestionsCochees.size > 1 ? "s" : ""}
          </button>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="titre-manuel">
        <h3 id="titre-manuel" className="text-xl">
          {avecSuggestion.length ? "3." : "2."} Choisir le jour à la main
        </h3>
        <p className="max-w-2xl text-sm text-encre-douce">Touchez les photos d’un même jour, puis le jour. L’heure sert à les placer dans la journée.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="bouton-discret" onClick={() => setChoisies(choisies.size ? new Set() : new Set(modifiables.map((m) => m.id)))}>
            {choisies.size ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <span>Heure</span>
            <input type="time" className="champ w-32" value={heure} onChange={(e) => setHeure(e.target.value || "12:00")} />
          </label>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8" aria-label="Médias sans date">
          {sansDate.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={!m.modifiable || enCours}
                aria-pressed={choisies.has(m.id)}
                aria-label={`${m.type === "video" ? "Vidéo" : "Photo"} ${m.nom}`}
                title={m.modifiable ? m.nom : `${m.nom} : seul son auteur ou l’administrateur peut la dater`}
                onClick={() => setChoisies((s) => basculer(s, m.id))}
                className={`relative block w-full overflow-hidden rounded-md border-4 ${choisies.has(m.id) ? "border-accent" : "border-transparent"} ${m.modifiable ? "" : "opacity-50"}`}
              >
                {m.vignette ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.vignette} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <span className="flex aspect-square w-full items-center justify-center bg-papier-2 p-1 text-[10px]">{m.nom}</span>
                )}
                {choisies.has(m.id) ? <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 text-xs text-white">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="sticky bottom-0 space-y-2 border-t border-filet bg-papier py-3">
          <p className="text-sm">
            {choisies.size ? `${choisies.size} sélectionné${choisies.size > 1 ? "s" : ""} : placer au…` : "Sélectionnez des photos, puis choisissez le jour."}
          </p>
          {jours.length ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Jours du voyage">
              {jours.map((j) => (
                <button key={j.jour} type="button" className="rounded-full border border-filet px-3 py-1.5 text-sm hover:bg-papier-2 disabled:opacity-40" disabled={!choisies.size || enCours} onClick={() => attribuer(j.jour)}>
                  {libelleJour(j.jour)}
                  {j.photos ? <span className="text-encre-douce"> · {j.photos}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-encre-douce">Indiquez les dates du voyage dans les Réglages pour proposer ses jours.</p>
          )}
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { encoderWebp } from "@/lib/import/analyse";
import type { MediaTri } from "@/server/domaine/tri";

const TAILLES = { rs: 400, rm: 1200, rl: 2400 } as const;

/** Jour (AAAA-MM-JJ) et heure (HH:MM) d'un instant, dans le fuseau du voyage. */
function jourHeure(iso: string | null, fuseau: string) {
  if (!iso) return { jour: "", heure: "12:00" };
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: fuseau, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}
const titreJour = (jour: string) =>
  jour
    ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`))
    : "Sans date";

async function poster(url: string, corps: unknown) {
  const rep = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
  const r = await rep.json().catch(() => ({}));
  if (!rep.ok || r.erreur) throw new Error(r.erreur ?? `Erreur ${rep.status}`);
  return r;
}

/**
 * Toutes les photos, journée par journée, avec pour chacune : sa date (modifiable), site et livre,
 * masquer, sa place dans la journée (glisser-déposer ou flèches), retoucher, exporter et remplacer.
 */
export function Organiseur({
  slug,
  medias: initiales,
  fuseau,
  estAdmin,
  masquees,
  depart,
}: {
  slug: string;
  medias: MediaTri[];
  fuseau: string;
  estAdmin: boolean;
  masquees: boolean;
  depart: string | null;
}) {
  const router = useRouter();
  const [medias, setMedias] = useState(initiales);
  // Données fraîches du serveur (après une retouche, un remplacement…) : on les reprend.
  const [source, setSource] = useState(initiales);
  if (source !== initiales) {
    setSource(initiales);
    setMedias(initiales);
  }
  const [message, setMessage] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [glisse, setGlisse] = useState<string | null>(null);

  // Journées dans l'ordre d'affichage (celui du serveur, qui tient compte de l'ordre choisi à la main).
  const jours = useMemo(() => {
    const parJour = new Map<string, MediaTri[]>();
    for (const m of medias) {
      const j = jourHeure(m.instant, fuseau).jour;
      parJour.set(j, [...(parJour.get(j) ?? []), m]);
    }
    return [...parJour.entries()].sort(([a], [b]) => (a && b ? a.localeCompare(b) : a ? -1 : 1));
  }, [medias, fuseau]);

  useEffect(() => {
    if (depart) document.getElementById(`photo-${depart}`)?.scrollIntoView({ block: "center" });
  }, [depart]);

  const maj = (id: string, o: Partial<MediaTri>) => setMedias((l) => l.map((m) => (m.id === id ? { ...m, ...o } : m)));
  const afficher = (texte: string, erreur = false) => setMessage({ texte, erreur });

  async function changerDate(m: MediaTri, jour: string, heure: string) {
    try {
      await poster(`/api/voyages/${slug}/dates`, { action: "jour", ids: [m.id], jour, heure });
      afficher(`${m.nomFichier} : date enregistrée.`);
      router.refresh();
    } catch (e) {
      afficher(e instanceof Error ? e.message : "Erreur", true);
    }
  }

  async function destinations(m: MediaTri, site: boolean, livre: boolean) {
    const avant = { dansSite: m.dansSite, dansLivre: m.dansLivre, trie: m.trie };
    maj(m.id, { dansSite: site, dansLivre: livre, trie: true });
    try {
      await poster(`/api/voyages/${slug}/selection`, { action: "trier", decisions: [{ id: m.id, dansSite: site, dansLivre: livre, trie: true }] });
    } catch (e) {
      maj(m.id, avant);
      afficher(e instanceof Error ? e.message : "Erreur", true);
    }
  }

  async function masquer(m: MediaTri, valeur: boolean) {
    try {
      await poster(`/api/voyages/${slug}/selection`, { action: "masquer", ids: [m.id], valeur });
      setMedias((l) => l.filter((x) => x.id !== m.id));
      afficher(valeur ? `${m.nomFichier} est masquée (dossier « Photos masquées »).` : `${m.nomFichier} est de nouveau visible.`);
    } catch (e) {
      afficher(e instanceof Error ? e.message : "Erreur", true);
    }
  }

  /** Déplace `id` avant `cible` (ou à la fin de la journée), puis enregistre l'ordre de la journée. */
  async function deplacer(jour: string, id: string, cible: string | null) {
    const liste = jours.find(([j]) => j === jour)?.[1];
    if (!liste || id === cible) return;
    const ids = liste.map((m) => m.id).filter((x) => x !== id);
    const i = cible ? ids.indexOf(cible) : ids.length;
    ids.splice(i < 0 ? ids.length : i, 0, id);
    const avant = medias;
    // Nouvel ordre affiché tout de suite : les médias de la journée, dans l'ordre voulu, à leur place dans la liste.
    setMedias((l) => {
      const parId = new Map(l.map((m) => [m.id, m]));
      const places = l.map((m, k) => (ids.includes(m.id) ? k : -1)).filter((k) => k >= 0);
      const res = [...l];
      places.forEach((k, n) => (res[k] = parId.get(ids[n])!));
      return res;
    });
    try {
      await poster(`/api/voyages/${slug}/selection`, { action: "reordonner", ids });
    } catch (e) {
      setMedias(avant);
      afficher(e instanceof Error ? e.message : "Erreur", true);
    }
  }

  async function telecharger(m: MediaTri) {
    const url = m.grande ?? m.moyenne;
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${m.nomFichier.replace(/\.[^.]+$/, "")}.${blob.type === "image/jpeg" ? "jpg" : "webp"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  async function remplacer(m: MediaTri, fichier: File) {
    try {
      afficher(`Remplacement de ${m.nomFichier}…`);
      const bitmap = await createImageBitmap(fichier);
      const prep = await poster(`/api/voyages/${slug}/medias/${m.id}/retouche`, { action: "preparer-remplacement" });
      for (const [nom, cote] of Object.entries(TAILLES)) {
        const k = Math.min(1, cote / Math.max(bitmap.width, bitmap.height));
        const c = new OffscreenCanvas(Math.round(bitmap.width * k), Math.round(bitmap.height * k));
        c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
        const rep = await fetch(prep.urls[nom], { method: "PUT", body: await encoderWebp(c, 0.88) });
        if (!rep.ok) throw new Error("Envoi de l’image impossible.");
      }
      await poster(`/api/voyages/${slug}/medias/${m.id}/retouche`, { action: "remplacer", empreinte: prep.empreinte });
      afficher(`${m.nomFichier} est remplacée par l’image modifiée.`);
      router.refresh();
    } catch (e) {
      afficher(e instanceof Error ? e.message : "Remplacement impossible (format d’image non lu par ce navigateur ?).", true);
    }
  }

  async function original(m: MediaTri) {
    try {
      await poster(`/api/voyages/${slug}/medias/${m.id}/retouche`, { action: "original" });
      afficher(`${m.nomFichier} : retour à la photo d’origine.`);
      router.refresh();
    } catch (e) {
      afficher(e instanceof Error ? e.message : "Erreur", true);
    }
  }

  if (!medias.length) return <p className="text-encre-douce">{masquees ? "Aucune photo masquée." : "Aucune photo pour l’instant."}</p>;

  return (
    <div className="space-y-6" data-testid="organiseur">
      <p className="text-sm text-encre-douce">
        Pour chaque photo : corrigez sa date, cochez Site et Livre, masquez-la, ou changez sa place dans la journée en la faisant glisser par la poignée ⠿
        (ou avec les flèches). « Télécharger » puis « Remplacer » permet de la modifier dans une autre application (ChatGPT…).
      </p>
      {message ? (
        <p role={message.erreur ? "alert" : "status"} className={`sticky top-2 z-20 rounded-md px-3 py-2 text-sm shadow ${message.erreur ? "bg-red-600 text-white" : "bg-encre text-papier"}`}>
          {message.texte}
        </p>
      ) : null}

      {jours.map(([jour, liste]) => (
        <section key={jour || "sans-date"} className="space-y-3" data-testid="journee">
          <h2 className="sticky top-0 z-10 bg-papier py-2 text-xl first-letter:uppercase">
            {titreJour(jour)} <span className="text-sm text-encre-douce">· {liste.length} photo{liste.length > 1 ? "s" : ""}</span>
          </h2>
          <ol
            className="space-y-3"
            onDragOver={(e) => {
              if (glisse && liste.some((m) => m.id === glisse)) e.preventDefault();
            }}
            onDrop={(e) => {
              if (glisse && e.target === e.currentTarget) void deplacer(jour, glisse, null);
              setGlisse(null);
            }}
          >
            {liste.map((m, i) => (
              <Fiche
                key={m.id}
                m={m}
                slug={slug}
                fuseau={fuseau}
                estAdmin={estAdmin}
                masquees={masquees}
                reordonnable={estAdmin && !!jour && liste.length > 1}
                enGlisse={glisse === m.id}
                commencerGlisse={() => setGlisse(m.id)}
                deposerSur={() => {
                  if (glisse && glisse !== m.id && liste.some((x) => x.id === glisse)) void deplacer(jour, glisse, m.id);
                  setGlisse(null);
                }}
                accepteDepot={!!glisse && glisse !== m.id && liste.some((x) => x.id === glisse)}
                monter={i > 0 ? () => void deplacer(jour, m.id, liste[i - 1].id) : null}
                descendre={i < liste.length - 1 ? () => void deplacer(jour, m.id, liste[i + 2]?.id ?? null) : null}
                changerDate={(j, h) => void changerDate(m, j, h)}
                destinations={(site, livre) => void destinations(m, site, livre)}
                masquer={(v) => void masquer(m, v)}
                telecharger={() => void telecharger(m)}
                remplacer={(f) => void remplacer(m, f)}
                original={() => void original(m)}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Fiche({
  m,
  slug,
  fuseau,
  masquees,
  reordonnable,
  enGlisse,
  commencerGlisse,
  deposerSur,
  accepteDepot,
  monter,
  descendre,
  changerDate,
  destinations,
  masquer,
  telecharger,
  remplacer,
  original,
}: {
  m: MediaTri;
  slug: string;
  fuseau: string;
  estAdmin: boolean;
  masquees: boolean;
  reordonnable: boolean;
  enGlisse: boolean;
  commencerGlisse: () => void;
  deposerSur: () => void;
  accepteDepot: boolean;
  monter: (() => void) | null;
  descendre: (() => void) | null;
  changerDate: (jour: string, heure: string) => void;
  destinations: (site: boolean, livre: boolean) => void;
  masquer: (valeur: boolean) => void;
  telecharger: () => void;
  remplacer: (f: File) => void;
  original: () => void;
}) {
  const actuelle = jourHeure(m.instant, fuseau);
  const [jour, setJour] = useState(actuelle.jour);
  const [heure, setHeure] = useState(actuelle.heure);
  const [vue, setVue] = useState({ ...actuelle, id: m.instant });
  if (vue.id !== m.instant) {
    setVue({ ...actuelle, id: m.instant });
    setJour(actuelle.jour);
    setHeure(actuelle.heure);
  }
  const dateModifiee = jour !== actuelle.jour || heure !== actuelle.heure;
  const fichier = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  const site = m.trie ? m.dansSite : false;
  const livre = m.trie ? m.dansLivre : false;
  const retour = encodeURIComponent(`/voyages/${slug}/photos/organiser?m=${m.id}`);

  return (
    <li
      id={`photo-${m.id}`}
      data-testid="fiche-photo"
      aria-label={`Photo ${m.nomFichier}`}
      className={`carte flex flex-col gap-3 sm:flex-row ${enGlisse ? "opacity-40" : ""} ${survol && accepteDepot ? "ring-2 ring-accent" : ""}`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 260px" }}
      onDragOver={(e) => {
        if (accepteDepot) {
          e.preventDefault();
          setSurvol(true);
        }
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        deposerSur();
      }}
    >
      <div className="flex gap-2 sm:w-72 sm:shrink-0">
        {reordonnable ? (
          <div className="flex flex-col items-center gap-1">
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", m.id);
                commencerGlisse();
              }}
              className="flex h-10 w-8 cursor-grab items-center justify-center rounded text-xl text-encre-douce hover:bg-papier-2"
              title="Faire glisser pour changer la place dans la journée"
              aria-hidden
            >
              ⠿
            </span>
            <button type="button" className="h-9 w-8 rounded hover:bg-papier-2 disabled:opacity-30" onClick={() => monter?.()} disabled={!monter} aria-label={`Monter ${m.nomFichier}`}>
              ↑
            </button>
            <button type="button" className="h-9 w-8 rounded hover:bg-papier-2 disabled:opacity-30" onClick={() => descendre?.()} disabled={!descendre} aria-label={`Descendre ${m.nomFichier}`}>
              ↓
            </button>
          </div>
        ) : null}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-papier-2">
          {m.type === "video" && m.video ? (
            <video src={m.video} poster={m.moyenne ?? undefined} controls preload="none" className="h-full w-full object-contain" />
          ) : m.moyenne ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
            <img src={m.moyenne} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-contain" />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-encre-douce">{m.nomFichier}</span>
          )}
          {m.retouchee || m.remplacee ? (
            <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 text-xs text-white">{m.remplacee ? "Remplacée" : "Retouchée"}</span>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <p className="truncate text-sm">
          <strong>{m.nomFichier}</strong>
          {m.auteur ? <span className="text-encre-douce"> · {m.auteur}</span> : null}
          {m.dateEstimee ? <span className="text-encre-douce"> · date estimée</span> : null}
        </p>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (jour) changerDate(jour, heure || "12:00");
          }}
        >
          <label className="space-y-1">
            <span className="etiquette block">Jour</span>
            <input type="date" className="champ py-1" value={jour} onChange={(e) => setJour(e.target.value)} aria-label={`Jour de ${m.nomFichier}`} />
          </label>
          <label className="space-y-1">
            <span className="etiquette block">Heure</span>
            <input type="time" className="champ py-1" value={heure} onChange={(e) => setHeure(e.target.value)} aria-label={`Heure de ${m.nomFichier}`} />
          </label>
          {dateModifiee && jour ? (
            <button className="bouton py-1.5" type="submit">
              Enregistrer la date
            </button>
          ) : null}
        </form>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["Site", site, () => destinations(!site, livre)],
              ["Livre", livre, () => destinations(site, !livre)],
            ] as const
          ).map(([libelle, coche, basculer]) => (
            <button
              key={libelle}
              type="button"
              role="checkbox"
              aria-checked={coche}
              aria-label={`${libelle} : ${m.nomFichier}`}
              onClick={basculer}
              className={`flex min-h-10 items-center gap-2 rounded-md border-2 px-3 text-sm font-medium ${coche ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "border-filet text-encre-douce"}`}
            >
              <span aria-hidden className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 ${coche ? "border-emerald-600 bg-emerald-600 text-white" : "border-encre-douce/60"}`}>
                {coche ? "✓" : ""}
              </span>
              {libelle}
            </button>
          ))}
          <button type="button" className="bouton-discret min-h-10" onClick={() => masquer(!masquees)}>
            {masquees ? "Réafficher" : "Masquer"}
          </button>
        </div>

        {m.retouchable ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={`/voyages/${slug}/photos/${m.id}/retouche?retour=${retour}`} className="bouton-discret">
              Retoucher
            </Link>
            <button type="button" className="bouton-discret" onClick={telecharger}>
              Télécharger
            </button>
            <button type="button" className="bouton-discret" onClick={() => fichier.current?.click()}>
              Remplacer par une image modifiée…
            </button>
            <input
              ref={fichier}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-label={`Image modifiée pour ${m.nomFichier}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) remplacer(f);
              }}
            />
            {m.retouchee || m.remplacee ? (
              <button type="button" className="bouton-discret" onClick={original}>
                Revenir à l’original
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

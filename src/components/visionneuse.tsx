"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { jourHeure, libelleJour } from "@/lib/jours";
import type { MediaGalerie } from "@/server/domaine/medias";
import type { DetailMedia } from "@/server/domaine/recit";

const EMOJIS = ["❤️", "😍", "😂", "😮", "👏", "🔥"];
const fmtJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

async function appel(slug: string, id: string, corps?: object): Promise<DetailMedia | { erreur: string }> {
  const rep = await fetch(`/api/voyages/${slug}/medias/${id}`, {
    method: corps ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  return rep.json();
}

/**
 * Visionneuse plein écran : balayage (ou flèches) pour passer d'une photo à l'autre,
 * légende, cases « site » et « livre », réactions et commentaires signés.
 */
export function Visionneuse({
  slug,
  medias,
  index,
  utilisateurId,
  estAdmin,
  onIndex,
  onFermer,
  onMaj,
  dates,
}: {
  slug: string;
  medias: MediaGalerie[];
  index: number;
  utilisateurId: string;
  estAdmin: boolean;
  onIndex: (i: number) => void;
  onFermer: () => void;
  onMaj?: (id: string, maj: Partial<MediaGalerie>) => void;
  /** Pour changer la date d'une photo : fuseau et jours du voyage ; `apres` est appelé une fois la date enregistrée. */
  dates?: { fuseau: string; jours: string[]; apres: () => void };
}) {
  const m = medias[index];
  const [detail, setDetail] = useState<DetailMedia | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [panneau, setPanneau] = useState(true);
  const [commentaire, setCommentaire] = useState("");
  const [legende, setLegende] = useState("");
  // Mise en avant modifiée pendant cette ouverture (la liste du parent peut ne pas suivre).
  const [vedettes, setVedettes] = useState<Record<string, boolean>>({});
  const vedette = vedettes[m.id] ?? m.vedette;
  const debutToucher = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let actif = true;
    appel(slug, m.id).then((d) => {
      if (!actif || "erreur" in d) return;
      setDetail(d);
      setLegende(d.legende ?? "");
    });
    return () => {
      actif = false;
    };
  }, [slug, m.id]);

  const aller = useCallback(
    (sens: number) => {
      const j = index + sens;
      if (j >= 0 && j < medias.length) {
        setDetail(null);
        setErreur(null);
        onIndex(j);
      }
    },
    [index, medias.length, onIndex],
  );

  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight") aller(1);
      else if (e.key === "ArrowLeft") aller(-1);
      else if (e.key === "Escape") onFermer();
    }
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [aller, onFermer]);

  async function agir(corps: object) {
    setErreur(null);
    const d = await appel(slug, m.id, corps);
    if ("erreur" in d) return setErreur(d.erreur);
    setDetail(d);
    onMaj?.(m.id, { legende: d.legende, dansSite: d.dansSite, dansLivre: d.dansLivre });
  }

  async function basculerVedette(valeur: boolean) {
    setErreur(null);
    setVedettes((v) => ({ ...v, [m.id]: valeur }));
    const rep = await fetch(`/api/voyages/${slug}/site`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "vedette", mediaId: m.id, valeur }),
    });
    const json = (await rep.json()) as { erreur?: string };
    if (json.erreur) {
      setVedettes((v) => ({ ...v, [m.id]: !valeur }));
      return setErreur(json.erreur);
    }
    onMaj?.(m.id, { vedette: valeur });
  }

  const peutLegender = detail && (detail.auteurId === utilisateurId || estAdmin);

  return (
    <div role="dialog" aria-modal="true" aria-label={m.nomFichier} className="fixed inset-0 z-50 flex flex-col bg-black text-white lg:flex-row">
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        onTouchStart={(e) => (debutToucher.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const d = debutToucher.current;
          if (!d) return;
          const dx = e.changedTouches[0].clientX - d.x;
          const dy = e.changedTouches[0].clientY - d.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) aller(dx < 0 ? 1 : -1);
          else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onFermer();
          debutToucher.current = null;
        }}
      >
        <div className="flex items-center justify-between gap-3 p-3 text-sm">
          <span className="truncate first-letter:uppercase">
            {m.instant ? `${fmtJour.format(new Date(m.instant))}, ${fmtHeure.format(new Date(m.instant))}${m.dateEstimee ? " (date estimée)" : ""}` : "Sans date"}
            {m.auteur ? ` · ${m.auteur}` : ""}
          </span>
          <div className="flex shrink-0 items-center">
            <button type="button" className="min-h-11 px-3 lg:hidden" onClick={() => setPanneau((p) => !p)}>
              {panneau ? "Masquer" : "Détails"}
            </button>
            <button type="button" className="min-h-11 px-3" onClick={onFermer}>
              Fermer
            </button>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
          {m.type === "video" && m.video ? (
            <video key={m.id} src={m.video} poster={m.moyenne ?? undefined} controls playsInline className="max-h-full max-w-full" />
          ) : m.moyenne ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
            <img key={m.id} src={m.moyenne} alt={m.legende ?? ""} className="max-h-full max-w-full object-contain" />
          ) : (
            <p>Aperçu indisponible pour {m.nomFichier}</p>
          )}
          {index > 0 ? (
            <button type="button" aria-label="Photo précédente" onClick={() => aller(-1)} className="absolute left-1 top-1/2 hidden min-h-11 -translate-y-1/2 rounded-full bg-white/10 px-3 text-2xl sm:block">
              ‹
            </button>
          ) : null}
          {index < medias.length - 1 ? (
            <button type="button" aria-label="Photo suivante" onClick={() => aller(1)} className="absolute right-1 top-1/2 hidden min-h-11 -translate-y-1/2 rounded-full bg-white/10 px-3 text-2xl sm:block">
              ›
            </button>
          ) : null}
        </div>
        <p className="pb-2 text-center text-xs text-white/50">
          {index + 1} / {medias.length}
        </p>
      </div>

      {panneau ? (
        <aside className="max-h-[45vh] shrink-0 space-y-4 overflow-y-auto border-t border-white/15 bg-[#151412] p-4 text-sm lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">
          {!detail ? (
            <p className="text-white/60">Chargement…</p>
          ) : (
            <>
              {peutLegender ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    agir({ action: "legende", texte: legende });
                  }}
                >
                  <label className="block space-y-1">
                    <span className="text-xs uppercase tracking-widest text-white/50">Légende</span>
                    <textarea
                      value={legende}
                      onChange={(e) => setLegende(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1.5"
                      placeholder="Ce qu’on voit, ce qu’on a vécu…"
                    />
                  </label>
                  {legende !== (detail.legende ?? "") ? (
                    <button className="min-h-11 rounded-md bg-white px-3 text-black">Enregistrer la légende</button>
                  ) : null}
                </form>
              ) : detail.legende ? (
                <p className="font-titre text-lg leading-snug">{detail.legende}</p>
              ) : null}

              {dates && peutLegender ? <ChoixDate key={`${m.id}-${m.instant}`} slug={slug} m={m} dates={dates} onErreur={setErreur} /> : null}

              {m.type === "photo" && peutLegender ? (
                <a href={`/voyages/${slug}/photos/${m.id}/retouche`} className="inline-flex min-h-11 items-center rounded-md border border-white/20 px-3">
                  {m.retouchee ? "Modifier la retouche" : "Retoucher"}
                </a>
              ) : null}

              <div className="flex flex-wrap gap-4">
                {(["dansSite", "dansLivre"] as const).map((champ) => (
                  <label key={champ} className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" checked={detail[champ]} onChange={(e) => {
                        // Mise à jour immédiate, confirmée par le serveur.
                        setDetail({ ...detail, [champ]: e.target.checked });
                        agir({ action: "cocher", champ, valeur: e.target.checked });
                      }} />
                    {champ === "dansSite" ? "Dans le site" : "Dans le livre"}
                  </label>
                ))}
                {estAdmin ? (
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" checked={vedette} onChange={(e) => basculerVedette(e.target.checked)} />
                    Mise en avant
                  </label>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5" aria-label="Réactions">
                {EMOJIS.map((e) => {
                  const r = detail.reactions.find((x) => x.emoji === e);
                  return (
                    <button
                      key={e}
                      type="button"
                      title={r?.qui.join(", ")}
                      aria-pressed={!!r?.moi}
                      onClick={() => agir({ action: "reaction", emoji: e })}
                      className={`min-h-11 rounded-full border px-2.5 ${r?.moi ? "border-white bg-white/15" : "border-white/20"}`}
                    >
                      {e}
                      {r ? <span className="ml-1 text-xs">{r.nb}</span> : null}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <h3 className="font-sans text-xs uppercase tracking-widest text-white/50">Commentaires</h3>
                {detail.commentaires.length === 0 ? <p className="text-white/50">Aucun commentaire.</p> : null}
                <ul className="space-y-2">
                  {detail.commentaires.map((c) => (
                    <li key={c.id} className="group">
                      <span className="font-medium">{c.auteur ?? "Ancien participant"}</span> {c.texte}
                      {c.auteurId === utilisateurId || estAdmin ? (
                        <button
                          type="button"
                          className="ml-2 text-xs text-white/40 hover:text-white"
                          onClick={() => agir({ action: "supprimer-commentaire", commentaireId: c.id })}
                        >
                          supprimer
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!commentaire.trim()) return;
                    await agir({ action: "commenter", texte: commentaire });
                    setCommentaire("");
                  }}
                >
                  <input
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    maxLength={2000}
                    placeholder="Ajouter un commentaire"
                    aria-label="Ajouter un commentaire"
                    className="min-h-11 min-w-0 flex-1 rounded-md border border-white/20 bg-transparent px-2"
                  />
                  <button className="min-h-11 rounded-md bg-white px-3 text-black">Publier</button>
                </form>
              </div>
              {erreur ? (
                <p role="alert" className="text-[#e0655b]">
                  {erreur}
                </p>
              ) : null}
            </>
          )}
        </aside>
      ) : null}
    </div>
  );
}

/** Date de la photo : un des jours du voyage (ou une autre date) et l'heure. */
function ChoixDate({
  slug,
  m,
  dates,
  onErreur,
}: {
  slug: string;
  m: MediaGalerie;
  dates: { fuseau: string; jours: string[]; apres: () => void };
  onErreur: (e: string | null) => void;
}) {
  const actuelle = jourHeure(m.instant, dates.fuseau);
  const [jour, setJour] = useState(actuelle.jour);
  const [heure, setHeure] = useState(actuelle.heure);
  const [autre, setAutre] = useState(!!actuelle.jour && !dates.jours.includes(actuelle.jour));
  const [enCours, setEnCours] = useState(false);
  const modifiee = !!jour && (jour !== actuelle.jour || heure !== actuelle.heure);

  async function enregistrer() {
    setEnCours(true);
    onErreur(null);
    try {
      const rep = await fetch(`/api/voyages/${slug}/dates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "jour", ids: [m.id], jour, heure: heure || "12:00" }),
      });
      const r = (await rep.json()) as { erreur?: string };
      if (!rep.ok || r.erreur) throw new Error(r.erreur ?? "Date non enregistrée.");
      dates.apres();
    } catch (e) {
      onErreur(e instanceof Error ? e.message : "Date non enregistrée.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      className="space-y-2"
      data-testid="choix-date"
      onSubmit={(e) => {
        e.preventDefault();
        void enregistrer();
      }}
    >
      <span className="text-xs uppercase tracking-widest text-white/50">Date de la photo</span>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Jour de la photo"
          className="min-h-11 rounded-md border border-white/20 bg-[#151412] px-2"
          value={autre ? "autre" : jour}
          onChange={(e) => {
            if (e.target.value === "autre") setAutre(true);
            else {
              setAutre(false);
              setJour(e.target.value);
            }
          }}
        >
          {!jour ? <option value="">Choisir un jour…</option> : null}
          {dates.jours.map((j) => (
            <option key={j} value={j}>
              {libelleJour(j)}
            </option>
          ))}
          <option value="autre">Autre date…</option>
        </select>
        {autre ? (
          <input
            type="date"
            aria-label="Autre date"
            className="min-h-11 rounded-md border border-white/20 bg-transparent px-2 [color-scheme:dark]"
            value={jour}
            onChange={(e) => setJour(e.target.value)}
          />
        ) : null}
        <input
          type="time"
          aria-label="Heure de la photo"
          className="min-h-11 rounded-md border border-white/20 bg-transparent px-2 [color-scheme:dark]"
          value={heure}
          onChange={(e) => setHeure(e.target.value)}
        />
      </div>
      {modifiee ? (
        <button className="min-h-11 rounded-md bg-white px-3 text-black disabled:opacity-60" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer la date"}
        </button>
      ) : null}
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionScinder } from "@/app/voyages/actions";
import type { MediaGalerie } from "@/server/domaine/medias";
import { Galerie } from "../../photos/galerie";

/** Galerie d'un épisode avec un mode sélection : cocher pour le livre, déplacer, scinder. */
export function OutilsEpisode({
  slug,
  episodeId,
  medias,
  episodes,
  utilisateurId,
  estAdmin,
}: {
  slug: string;
  episodeId: string | null;
  medias: MediaGalerie[];
  episodes: { id: string; titre: string }[];
  utilisateurId: string;
  estAdmin: boolean;
}) {
  const router = useRouter();
  const [enSelection, setEnSelection] = useState(false);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [destination, setDestination] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, lancer] = useTransition();

  function basculer(id: string) {
    setChoisis((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function agir(corps: object, ok: string) {
    lancer(async () => {
      const rep = await fetch(`/api/voyages/${slug}/selection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...corps, ids: [...choisis] }),
      });
      const r = await rep.json();
      setMessage(r.erreur ?? ok);
      if (!r.erreur) {
        setChoisis(new Set());
        router.refresh();
      }
    });
  }

  const n = choisis.size;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="bouton-discret" onClick={() => (setEnSelection((x) => !x), setChoisis(new Set()))}>
          {enSelection ? "Terminer la sélection" : "Sélectionner des photos"}
        </button>
        {message ? (
          <p role="status" className="text-sm text-encre-douce">
            {message}
          </p>
        ) : null}
      </div>

      {enSelection ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-filet bg-papier p-2 text-sm">
          <span className="px-1">
            {n} sélectionnée{n > 1 ? "s" : ""}
          </span>
          <button type="button" disabled={!n || enCours} className="bouton-discret" onClick={() => agir({ action: "cocher", champ: "dansLivre", valeur: false }, "Retirées du livre.")}>
            Retirer du livre
          </button>
          <button type="button" disabled={!n || enCours} className="bouton-discret" onClick={() => agir({ action: "cocher", champ: "dansLivre", valeur: true }, "Ajoutées au livre.")}>
            Mettre dans le livre
          </button>
          <button type="button" disabled={!n || enCours} className="bouton-discret" onClick={() => agir({ action: "cocher", champ: "dansSite", valeur: false }, "Retirées du site.")}>
            Retirer du site
          </button>
          {estAdmin ? (
            <>
              <select className="min-h-11 rounded-md border border-filet bg-papier px-2" value={destination} onChange={(e) => setDestination(e.target.value)} aria-label="Épisode de destination">
                <option value="">Déplacer vers…</option>
                {episodes
                  .filter((e) => e.id !== episodeId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.titre}
                    </option>
                  ))}
              </select>
              <button type="button" disabled={!n || !destination || enCours} className="bouton-discret" onClick={() => agir({ action: "deplacer", episodeId: destination }, "Photos déplacées.")}>
                Déplacer
              </button>
              {episodeId && n === 1 ? (
                <button
                  type="button"
                  disabled={enCours}
                  className="bouton-discret"
                  onClick={() =>
                    lancer(async () => {
                      const r = await actionScinder(slug, episodeId, [...choisis][0]);
                      setMessage(r?.erreur ?? r?.message ?? null);
                      if (!r?.erreur) router.push(`/voyages/${slug}/recit`);
                    })
                  }
                >
                  Commencer un nouvel épisode ici
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {medias.length ? (
        <Galerie
          medias={medias}
          slug={slug}
          utilisateurId={utilisateurId}
          estAdmin={estAdmin}
          selection={enSelection ? { choisis, basculer } : undefined}
        />
      ) : (
        <p className="text-encre-douce">Aucune photo dans cet épisode.</p>
      )}
    </div>
  );
}

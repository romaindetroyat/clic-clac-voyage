"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { analyserDansWorker } from "@/lib/import/file-envoi";

type Photo = { id: string; nom: string; mime: string; url: string };

async function json<T>(rep: Response): Promise<T> {
  const r = await rep.json();
  if (!rep.ok || r.erreur) throw new Error(r.erreur ?? `Erreur ${rep.status}`);
  return r;
}

/** Recalcule dans le navigateur les aperçus des photos qui n'en ont pas (HEIC importés avant le correctif). */
export function ApercusManquants({ slug, nombre }: { slug: string; nombre: number }) {
  const router = useRouter();
  const [enCours, lancer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function reparer() {
    lancer(async () => {
      const { photos } = await json<{ photos: Photo[] }>(await fetch(`/api/voyages/${slug}/apercus`));
      let faites = 0;
      const echecs: string[] = [];
      const file = [...photos];
      const unePhoto = async (p: Photo) => {
        try {
          const original = await (await fetch(p.url)).blob();
          const a = await analyserDansWorker(`apercu-${p.id}`, new Blob([original], { type: p.mime }), p.nom, () => {});
          if (!a.versions.s || !a.largeur || !a.hauteur) throw new Error(a.avertissement ?? "Aperçu impossible");
          const { versions } = await json<{ versions: Record<string, string> }>(
            await fetch(`/api/voyages/${slug}/apercus`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preparer", mediaId: p.id }) }),
          );
          for (const [nom, url] of Object.entries(versions)) {
            const v = a.versions[nom as "s" | "m" | "l"];
            if (v && !(await fetch(url, { method: "PUT", body: v })).ok) throw new Error("Envoi refusé");
          }
          await json(
            await fetch(`/api/voyages/${slug}/apercus`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                action: "enregistrer",
                mediaId: p.id,
                mesures: { largeur: a.largeur, hauteur: a.hauteur, dhash: a.dhash, nettete: a.nettete ?? null, exposition: a.exposition ?? null },
              }),
            }),
          );
          faites++;
        } catch {
          echecs.push(p.nom);
        }
        setMessage(`Aperçus : ${faites + echecs.length} / ${photos.length}…`);
      };
      // Deux à la fois : le navigateur décode, le réseau envoie.
      await Promise.all(
        [0, 1].map(async () => {
          for (let p = file.shift(); p; p = file.shift()) await unePhoto(p);
        }),
      );
      setMessage(
        `${faites} aperçu${faites > 1 ? "s" : ""} créé${faites > 1 ? "s" : ""}.` +
          (echecs.length ? ` ${echecs.length} fichier${echecs.length > 1 ? "s" : ""} illisible${echecs.length > 1 ? "s" : ""} : ${echecs.slice(0, 5).join(", ")}${echecs.length > 5 ? "…" : ""}` : ""),
      );
      router.refresh();
    });
  }

  return (
    <div className="carte flex flex-wrap items-center gap-3" data-testid="apercus-manquants">
      <p className="text-sm">
        {nombre} photo{nombre > 1 ? "s" : ""} sans aperçu (souvent des HEIC d’iPhone). L’original est bien conservé : l’aperçu peut être recalculé
        depuis ce navigateur.
      </p>
      <button type="button" className="bouton-discret" disabled={enCours} onClick={reparer}>
        {enCours ? "Calcul en cours…" : "Créer les aperçus manquants"}
      </button>
      {message ? (
        <p role="status" className="w-full text-sm text-encre-douce">
          {message}
        </p>
      ) : null}
    </div>
  );
}

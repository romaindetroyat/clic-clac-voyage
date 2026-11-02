"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { exposition, gris, nettete } from "@/lib/qualite";

type Photo = { id: string; choix: boolean; score: number | null; vignette: string | null; nom: string };

async function poster(slug: string, corps: object) {
  const rep = await fetch(`/api/voyages/${slug}/selection`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps),
  });
  return rep.json();
}

/** Mesure netteté et exposition d'une version web (photos importées avant cette fonction). */
async function mesurer(url: string) {
  const image = await createImageBitmap(await (await fetch(url)).blob());
  const e = Math.min(1, 512 / Math.max(image.width, image.height));
  const l = Math.max(3, Math.round(image.width * e));
  const h = Math.max(3, Math.round(image.height * e));
  const c = new OffscreenCanvas(l, h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(image, 0, 0, l, h);
  const g = gris(ctx.getImageData(0, 0, l, h).data);
  return { nettete: nettete(g, l, h), exposition: exposition(g) };
}

export function ChoixRafales({ slug, groupes, aMesurer }: { slug: string; groupes: Photo[][]; aMesurer: { id: string; url: string }[] }) {
  const router = useRouter();
  const [enCours, lancer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function detecter() {
    lancer(async () => {
      // D'abord mesurer la qualité des photos qui n'ont pas encore de score.
      for (let i = 0; i < aMesurer.length; i += 20) {
        setMessage(`Mesure de la qualité : ${i} / ${aMesurer.length}`);
        const lot = await Promise.all(
          aMesurer.slice(i, i + 20).map(async (m) => ({ id: m.id, ...(await mesurer(m.url).catch(() => ({ nettete: 0.5, exposition: 0.5 }))) })),
        );
        await poster(slug, { action: "qualite", mesures: lot });
      }
      const r = await poster(slug, { action: "detecter-rafales" });
      setMessage(r.erreur ?? `${r.rafales} rafale${r.rafales > 1 ? "s" : ""} trouvée${r.rafales > 1 ? "s" : ""}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="bouton" disabled={enCours} onClick={detecter}>
          {enCours ? "Analyse…" : groupes.length ? "Rechercher à nouveau les rafales" : "Rechercher les rafales"}
        </button>
        {message ? (
          <p role="status" className="text-sm text-encre-douce">
            {message}
          </p>
        ) : null}
      </div>
      {groupes.length === 0 ? (
        <p className="text-encre-douce">Aucune rafale pour l’instant.</p>
      ) : (
        <ul className="space-y-6" aria-label="Rafales">
          {groupes.map((g) => (
            <li key={g[0].id} className="space-y-2" data-testid="rafale">
              <p className="text-sm text-encre-douce">{g.length} photos</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {g.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={enCours}
                    aria-pressed={p.choix}
                    aria-label={`${p.nom}${p.choix ? " (retenue)" : ""}`}
                    onClick={() =>
                      lancer(async () => {
                        await poster(slug, { action: "choisir-rafale", mediaId: p.id });
                        router.refresh();
                      })
                    }
                    className={`relative w-36 shrink-0 overflow-hidden rounded-md border-4 ${p.choix ? "border-accent" : "border-transparent opacity-60"}`}
                  >
                    {p.vignette ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.vignette} alt="" className="aspect-square w-full object-cover" />
                    ) : (
                      <span className="block aspect-square bg-papier-2" />
                    )}
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      {p.choix ? "Retenue" : p.score !== null ? `qualité ${p.score}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

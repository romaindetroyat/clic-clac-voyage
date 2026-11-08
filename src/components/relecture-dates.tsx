"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Relit automatiquement, sur le serveur, la date des médias qui n'en ont pas
 * (originaux HEIC importés avant le correctif, vidéos…), un lot après l'autre,
 * puis range les médias sans date ou datés hors de la période du voyage d'après leurs voisins.
 */
export function RelectureDates({ slug, aRelire, aRanger = 0 }: { slug: string; aRelire: number; aRanger?: number }) {
  const router = useRouter();
  const [etat, setEtat] = useState<string | null>(null);
  const lance = useRef(false);

  useEffect(() => {
    if ((!aRelire && !aRanger) || lance.current) return;
    lance.current = true;
    (async () => {
      let trouvees = 0;
      let restantes = aRelire;
      try {
        while (restantes > 0) {
          setEtat(`Recherche des dates dans les fichiers d’origine… (${restantes} restant${restantes > 1 ? "s" : ""})`);
          const rep = await fetch(`/api/voyages/${slug}/dates`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "relire-serveur" }),
          });
          const r = await rep.json();
          if (!rep.ok || r.erreur) throw new Error(r.erreur ?? `Erreur ${rep.status}`);
          trouvees += r.trouvees;
          if (!r.essayees) break;
          restantes = r.restantes;
        }
        setEtat("Rangement des photos sans date ou datées hors du voyage…");
        const rep = await fetch(`/api/voyages/${slug}/dates`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "ranger" }),
        });
        const r = await rep.json();
        if (!rep.ok || r.erreur) throw new Error(r.erreur ?? `Erreur ${rep.status}`);
        const n = trouvees + r.placees;
        setEtat(
          (n ? `${n} photo${n > 1 ? "s rangées à leur" : " rangée à sa"} date` : "Aucune date retrouvée") +
            (r.sansDate ? ` ; ${r.sansDate} à dater à la main.` : "."),
        );
      } catch (e) {
        setEtat(`Recherche des dates interrompue : ${e instanceof Error ? e.message : "erreur"}.`);
      }
      router.refresh();
    })();
  }, [aRelire, aRanger, slug, router]);

  return etat ? (
    <p role="status" className="text-sm text-encre-douce" data-testid="relecture-dates">
      {etat}
    </p>
  ) : null;
}

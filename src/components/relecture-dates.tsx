"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Relit automatiquement, sur le serveur, la date des médias qui n'en ont pas
 * (originaux HEIC importés avant le correctif, vidéos…), un lot après l'autre.
 */
export function RelectureDates({ slug, aRelire }: { slug: string; aRelire: number }) {
  const router = useRouter();
  const [etat, setEtat] = useState<string | null>(null);
  const lance = useRef(false);

  useEffect(() => {
    if (!aRelire || lance.current) return;
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
        setEtat(`${trouvees} date${trouvees > 1 ? "s" : ""} retrouvée${trouvees > 1 ? "s" : ""} dans les fichiers d’origine.`);
      } catch (e) {
        setEtat(`Recherche des dates interrompue : ${e instanceof Error ? e.message : "erreur"}.`);
      }
      router.refresh();
    })();
  }, [aRelire, slug, router]);

  return etat ? (
    <p role="status" className="text-sm text-encre-douce" data-testid="relecture-dates">
      {etat}
    </p>
  ) : null;
}

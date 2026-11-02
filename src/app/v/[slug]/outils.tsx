"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { installerVisionneuse } from "@/lib/site/visionneuse";

/** Active la visionneuse et, en mode journal, recharge le site toutes les deux minutes. */
export function ActivationSite({ journal }: { journal: boolean }) {
  const router = useRouter();
  useEffect(() => installerVisionneuse(document), []);
  useEffect(() => {
    if (!journal) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine && !document.querySelector(".sv")) router.refresh();
    }, 120_000);
    return () => clearInterval(t);
  }, [journal, router]);
  return null;
}

/** Télécharge tout le site dans le cache du service worker pour le lire sans réseau. */
export function BoutonHorsLigne({ urls }: { urls: string[] }) {
  const [etat, setEtat] = useState<{ fait: number; total: number } | "fini" | "erreur" | null>(null);

  async function garder() {
    const sw = await navigator.serviceWorker?.ready;
    if (!sw?.active) return setEtat("erreur");
    const canal = new MessageChannel();
    canal.port1.onmessage = (e: MessageEvent<{ fait: number; total: number; fini?: boolean }>) => {
      setEtat(e.data.fini ? "fini" : { fait: e.data.fait, total: e.data.total });
    };
    setEtat({ fait: 0, total: urls.length });
    sw.active.postMessage({ type: "garder-hors-ligne", urls: [location.pathname, ...urls] }, [canal.port2]);
  }

  if (typeof navigator !== "undefined" && !("serviceWorker" in navigator)) return null;
  return (
    <p>
      {etat === "fini" ? (
        "Le site est disponible hors ligne sur cet appareil."
      ) : etat === "erreur" ? (
        "La lecture hors ligne n’est pas disponible dans ce navigateur."
      ) : etat ? (
        <span role="status">
          Téléchargement… {etat.fait} / {etat.total}
        </span>
      ) : (
        <button type="button" onClick={garder} className="min-h-11 rounded-full border border-s-filet px-4 text-s-encre hover:bg-s-fond2">
          Garder ce site pour le lire hors ligne
        </button>
      )}
    </p>
  );
}

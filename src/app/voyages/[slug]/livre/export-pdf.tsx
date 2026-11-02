"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageAPreparer } from "@/lib/livre/preparation";

type Fichier = { suffixe: string; titre: string; taille: number; feuilles: number; largeurMm: number; hauteurMm: number };
type Resultat = {
  export: { revision: number; le: string; pages: number; imprimeur: string | null; dosMm: number; fichiers: Fichier[]; avertissements: string[] } | null;
  liens?: Record<string, string>;
};

type Etape = { nom: "attente" } | { nom: "plan" } | { nom: "preparation"; fait: number; total: number; deja: number } | { nom: "assemblage" } | { nom: "erreur"; message: string };

async function appel<T>(slug: string, action: string): Promise<T> {
  const rep = await fetch(`/api/voyages/${slug}/livre/impression`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const json = (await rep.json().catch(() => ({ erreur: `Erreur du serveur (${rep.status}).` }))) as T & { erreur?: string };
  if (json.erreur) throw new Error(json.erreur);
  return json;
}

const mo = (n: number) => `${(n / 1048576).toFixed(n > 10485760 ? 0 : 1).replace(".", ",")} Mo`;
const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Export PDF : préparation des photos dans ce navigateur, puis assemblage sur le serveur. */
export function ExportPdf({ slug, revision, enregistrer, bloquants, onFermer }: { slug: string; revision: number | null; enregistrer: () => Promise<void>; bloquants: number; onFermer: () => void }) {
  const [etape, setEtape] = useState<Etape>({ nom: "attente" });
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const arret = useRef<AbortController | null>(null);

  useEffect(() => {
    appel<Resultat>(slug, "liens").then(setResultat, () => {});
    return () => arret.current?.abort();
  }, [slug]);

  async function exporter() {
    arret.current = new AbortController();
    try {
      await enregistrer();
      setEtape({ nom: "plan" });
      const plan = await appel<{ total: number; prets: number; images: ImageAPreparer[] }>(slug, "plan");
      if (plan.images.length) {
        setEtape({ nom: "preparation", fait: 0, total: plan.images.length, deja: plan.prets });
        const { preparerImages } = await import("@/lib/livre/preparation");
        await preparerImages(plan.images, (fait) => setEtape({ nom: "preparation", fait, total: plan.images.length, deja: plan.prets }), arret.current.signal);
      }
      setEtape({ nom: "assemblage" });
      setResultat(await appel<Resultat>(slug, "assembler"));
      setEtape({ nom: "attente" });
    } catch (e) {
      if ((e as Error).name === "AbortError") return setEtape({ nom: "attente" });
      setEtape({ nom: "erreur", message: (e as Error).message });
    }
  }

  const enCours = etape.nom === "plan" || etape.nom === "preparation" || etape.nom === "assemblage";
  const r = resultat?.export;

  return (
    <div role="dialog" aria-modal="true" aria-label="Exporter le livre en PDF" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-xl bg-papier p-5 sm:rounded-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl">PDF d’impression</h2>
          <button type="button" className="min-h-11 px-2 text-encre-douce hover:text-encre" onClick={onFermer} disabled={etape.nom === "assemblage"}>
            Fermer
          </button>
        </div>
        <p className="text-sm text-encre-douce">
          Les fichiers attendus par l’imprimeur choisi (sinon l’intérieur et la couverture d’un seul tenant), avec fonds perdus,
          photos à 300 dpi et polices intégrées. Les photos sont préparées dans ce navigateur avec leurs retouches : gardez la
          page ouverte. Si l’export est interrompu, il reprendra où il s’était arrêté.
        </p>

        {bloquants ? (
          <p className="text-sm text-danger">Le livre a {bloquants} problème(s) bloquant(s) : corrigez-les avant d’exporter.</p>
        ) : null}

        {etape.nom === "plan" ? <p role="status">Vérification du livre…</p> : null}
        {etape.nom === "preparation" ? (
          <div role="status" className="space-y-1.5">
            <p>
              Préparation des photos : {etape.fait} / {etape.total}
              {etape.deja ? ` (${etape.deja} déjà prêtes)` : ""}
            </p>
            <progress className="w-full" max={etape.total} value={etape.fait} />
          </div>
        ) : null}
        {etape.nom === "assemblage" ? <p role="status">Assemblage du PDF… (jusqu’à quelques minutes pour un gros livre)</p> : null}
        {etape.nom === "erreur" ? (
          <p role="alert" className="text-sm text-danger">
            {etape.message}
          </p>
        ) : null}

        {enCours ? (
          etape.nom === "preparation" ? (
            <button type="button" className="bouton-discret" onClick={() => arret.current?.abort()}>
              Interrompre
            </button>
          ) : null
        ) : (
          <button type="button" className="bouton" onClick={exporter} disabled={bloquants > 0}>
            {r ? "Refaire le PDF" : "Créer le PDF"}
          </button>
        )}

        {r && resultat?.liens && !enCours ? (
          <div className="space-y-2 border-t border-filet pt-4">
            <p className="text-sm">
              PDF du {fmt.format(new Date(r.le))} · {r.pages} pages
              {revision != null && r.revision !== revision ? (
                <span className="block text-accent">Le livre a changé depuis : refaites le PDF avant de commander.</span>
              ) : null}
            </p>
            <ul className="space-y-2">
              {r.fichiers.map((x) => (
                <li key={x.suffixe}>
                  <a className="lien" href={resultat.liens?.[x.suffixe]}>
                    Télécharger {x.suffixe === "livre" ? "le livre complet" : x.suffixe === "couverture" ? "la couverture" : "l’intérieur"} ({mo(x.taille)})
                  </a>
                  <span className="block text-xs text-encre-douce">
                    {x.titre}, {x.feuilles} page{x.feuilles > 1 ? "s" : ""} PDF de {x.largeurMm.toFixed(1).replace(".", ",")} × {x.hauteurMm.toFixed(1).replace(".", ",")} mm
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-encre-douce">
              {r.imprimeur ? `Préparé selon les règles de ${r.imprimeur}. ` : "Format générique. "}Dos de {r.dosMm.toString().replace(".", ",")} mm.
            </p>
            {r.avertissements.length ? (
              <ul className="text-sm text-accent">
                {r.avertissements.slice(0, 5).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

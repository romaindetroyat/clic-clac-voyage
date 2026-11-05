"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { encoderWebp } from "@/lib/import/analyse";
import { retoucheAuto } from "@/lib/rendu/auto";
import { NEUTRE, RATIOS, rectangleCadrage, type Retouche } from "@/lib/rendu/parametres";
import { MoteurRendu } from "@/lib/rendu/webgl";

type Curseur = { cle: keyof Retouche; libelle: string };
const LUMIERE: Curseur[] = [
  { cle: "lumiere", libelle: "Lumière" },
  { cle: "contraste", libelle: "Contraste" },
  { cle: "hautesLumieres", libelle: "Hautes lumières" },
  { cle: "ombres", libelle: "Ombres" },
  { cle: "blancs", libelle: "Blancs" },
  { cle: "noirs", libelle: "Noirs" },
];
const COULEUR: Curseur[] = [
  { cle: "temperature", libelle: "Température" },
  { cle: "teinte", libelle: "Teinte" },
  { cle: "saturation", libelle: "Saturation" },
];
const FILTRES: { val: Retouche["filtre"]; libelle: string }[] = [
  { val: "aucun", libelle: "Aucun" },
  { val: "noir-et-blanc", libelle: "Noir et blanc" },
  { val: "argentique", libelle: "Argentique doux" },
  { val: "chaud", libelle: "Chaud" },
  { val: "froid", libelle: "Froid" },
];

function Glissiere({ libelle, valeur, min = -1, max = 1, pas = 0.01, onChange }: { libelle: string; valeur: number; min?: number; max?: number; pas?: number; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="flex justify-between text-sm">
        <span>{libelle}</span>
        <span className="tabular-nums text-encre-douce">{Math.round(valeur * (max <= 1 ? 100 : 1))}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(min < 0 ? 0 : min)}
        className="w-full accent-[var(--encre)]"
        aria-label={libelle}
      />
    </label>
  );
}

/** Petite version de la photo (160 px) pour les statistiques de la retouche automatique. */
function petiteImage(bitmap: ImageBitmap) {
  const k = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
  const l = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  const c = new OffscreenCanvas(l, h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, l, h);
  return { donnees: ctx.getImageData(0, 0, l, h).data, largeur: l, hauteur: h };
}

export function Editeur({
  slug,
  mediaId,
  source,
  nom,
  initiale,
  retour,
  auto = false,
}: {
  slug: string;
  mediaId: string;
  source: string;
  nom: string;
  initiale: Retouche;
  retour: string;
  /** Appliquer la retouche automatique dès l'ouverture. */
  auto?: boolean;
}) {
  const router = useRouter();
  const canevas = useRef<HTMLCanvasElement>(null);
  const moteur = useRef<MoteurRendu | null>(null);
  const [r, setR] = useState<Retouche>(initiale);
  const [image, setImage] = useState<{ l: number; h: number } | null>(null);
  const [avant, setAvant] = useState(false);
  const [etat, setEtat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const petite = useRef<ReturnType<typeof petiteImage> | null>(null);
  const ui = r.cadrageUi ?? { ratio: "original", zoom: 1, px: 0.5, py: 0.5 };

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const bitmap = await createImageBitmap(await (await fetch(source)).blob(), { colorSpaceConversion: "none" });
        if (!actif || !canevas.current) return;
        moteur.current = new MoteurRendu(canevas.current);
        moteur.current.charger(bitmap);
        petite.current = petiteImage(bitmap);
        setImage({ l: bitmap.width, h: bitmap.height });
        if (auto) appliquerAuto();
      } catch (e) {
        setErreur(e instanceof Error && e.message.includes("WebGL") ? "Cet appareil ne permet pas la retouche (WebGL2 indisponible)." : "Impossible de charger la photo.");
      }
    })();
    return () => {
      actif = false;
    };
  }, [source, auto]);

  useEffect(() => {
    if (!moteur.current || !image) return;
    const id = requestAnimationFrame(() => moteur.current!.rendre(avant ? NEUTRE : r, 1200));
    return () => cancelAnimationFrame(id);
  }, [r, avant, image]);

  const maj = (o: Partial<Retouche>) => setR((x) => ({ ...x, ...o }));

  /** Lumière et couleur proposées d'après la photo ; le cadrage et le filtre choisis sont gardés. */
  function appliquerAuto() {
    if (!petite.current) return;
    const a = retoucheAuto(petite.current);
    setR((x) => ({ ...a, rotation: x.rotation, redressement: x.redressement, recadrage: x.recadrage, cadrageUi: x.cadrageUi, filtre: x.filtre, intensite: x.intensite }));
  }

  /** Recalcule le rectangle de recadrage d'après proportions, zoom et position. */
  function cadrer(o: Partial<typeof ui>, base: Retouche = r) {
    if (!image) return;
    const u = { ...ui, ...o };
    const quart = base.rotation === 90 || base.rotation === 270;
    const ratioCadre = quart ? image.h / image.l : image.l / image.h;
    setR({ ...base, cadrageUi: u, recadrage: rectangleCadrage(ratioCadre, RATIOS[u.ratio] ?? null, u.zoom, u.px, u.py) });
  }

  async function enregistrer() {
    if (!moteur.current) return;
    setErreur(null);
    try {
      setEtat("Préparation…");
      const prep = await fetch(`/api/voyages/${slug}/medias/${mediaId}/retouche`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preparer", retouche: r }),
      }).then((x) => x.json());
      if (prep.erreur) throw new Error(prep.erreur);
      for (const [nomVersion, cote] of Object.entries(prep.tailles as Record<string, number>)) {
        setEtat(`Calcul de la version ${nomVersion === "rs" ? "vignette" : nomVersion === "rm" ? "moyenne" : "grande"}…`);
        const [l, h] = moteur.current.rendre(r, cote);
        const pixels = moteur.current.lirePixels(l, h);
        const c = new OffscreenCanvas(l, h);
        c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels), l, h), 0, 0);
        const blob = await encoderWebp(c, 0.85);
        const rep = await fetch(prep.urls[nomVersion], { method: "PUT", body: blob });
        if (!rep.ok) throw new Error("Envoi de l’image retouchée impossible.");
      }
      setEtat("Enregistrement…");
      const fin = await fetch(`/api/voyages/${slug}/medias/${mediaId}/retouche`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "enregistrer", retouche: r }),
      }).then((x) => x.json());
      if (fin.erreur) throw new Error(fin.erreur);
      router.push(retour);
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur");
      setEtat(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Sur téléphone, l'aperçu reste visible en haut pendant qu'on fait défiler les réglages. */}
      <div className="sticky top-0 z-20 -mx-4 space-y-2 bg-papier px-4 pb-2 pt-1 lg:static lg:mx-0 lg:px-0">
        <div className="flex min-h-48 items-center justify-center rounded-lg bg-[#151412] p-2">
          <canvas ref={canevas} className="max-h-[36vh] max-w-full lg:max-h-[60vh]" aria-label={`Aperçu de ${nom}`} data-testid="apercu-retouche" />
          {!image && !erreur ? <p className="absolute text-sm text-white/60">Chargement…</p> : null}
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className="min-h-11 flex-1 rounded-md border border-filet px-3"
            onPointerDown={() => setAvant(true)}
            onPointerUp={() => setAvant(false)}
            onPointerLeave={() => setAvant(false)}
          >
            Maintenir : original
          </button>
          <button type="button" className="min-h-11 flex-1 rounded-md border border-filet px-3" onClick={appliquerAuto} disabled={!image}>
            ✨ Retouche auto
          </button>
          <button type="button" className="min-h-11 flex-1 rounded-md border border-filet px-3" onClick={() => setR(NEUTRE)}>
            Tout réinitialiser
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="etiquette">Cadrage</h2>
          <div className="flex gap-2">
            <button type="button" className="bouton-discret flex-1" aria-label="Tourner à gauche" onClick={() => cadrer({}, { ...r, rotation: ((r.rotation + 270) % 360) as Retouche["rotation"] })}>
              ⟲
            </button>
            <button type="button" className="bouton-discret flex-1" aria-label="Tourner à droite" onClick={() => cadrer({}, { ...r, rotation: ((r.rotation + 90) % 360) as Retouche["rotation"] })}>
              ⟳
            </button>
          </div>
          <Glissiere libelle="Redressement (degrés)" valeur={r.redressement} min={-45} max={45} pas={0.5} onChange={(v) => maj({ redressement: v })} />
          <label className="block space-y-1">
            <span className="text-sm">Proportions</span>
            <select className="champ" value={ui.ratio} onChange={(e) => cadrer({ ratio: e.target.value })}>
              {Object.keys(RATIOS).map((k) => (
                <option key={k} value={k}>
                  {k === "original" ? "D’origine" : k}
                </option>
              ))}
            </select>
          </label>
          <Glissiere libelle="Zoom" valeur={ui.zoom} min={1} max={3} pas={0.01} onChange={(v) => cadrer({ zoom: v })} />
          <Glissiere libelle="Position horizontale" valeur={ui.px} min={0} max={1} pas={0.01} onChange={(v) => cadrer({ px: v })} />
          <Glissiere libelle="Position verticale" valeur={ui.py} min={0} max={1} pas={0.01} onChange={(v) => cadrer({ py: v })} />
        </section>

        <section className="space-y-3">
          <h2 className="etiquette">Lumière</h2>
          {LUMIERE.map((c) => (
            <Glissiere key={c.cle} libelle={c.libelle} valeur={r[c.cle] as number} onChange={(v) => maj({ [c.cle]: v })} />
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="etiquette">Couleur</h2>
          {COULEUR.map((c) => (
            <Glissiere key={c.cle} libelle={c.libelle} valeur={r[c.cle] as number} onChange={(v) => maj({ [c.cle]: v })} />
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="etiquette">Filtre</h2>
          <div className="flex flex-wrap gap-2">
            {FILTRES.map((f) => (
              <button
                key={f.val}
                type="button"
                aria-pressed={r.filtre === f.val}
                onClick={() => maj({ filtre: f.val })}
                className={`min-h-11 rounded-md border px-3 text-sm ${r.filtre === f.val ? "border-encre bg-encre text-papier" : "border-filet"}`}
              >
                {f.libelle}
              </button>
            ))}
          </div>
          {r.filtre !== "aucun" ? <Glissiere libelle="Intensité" valeur={r.intensite} min={0} max={1} onChange={(v) => maj({ intensite: v })} /> : null}
        </section>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-filet bg-papier py-3">
          <button type="button" className="bouton" disabled={!image || !!etat} onClick={enregistrer}>
            {etat ?? "Enregistrer"}
          </button>
          <button type="button" className="bouton-discret" onClick={() => router.push(retour)}>
            Annuler
          </button>
          {erreur ? (
            <p role="alert" className="w-full text-sm text-danger">
              {erreur}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

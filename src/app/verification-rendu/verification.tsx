"use client";

import { useEffect, useState } from "react";
import { deltaE } from "@/lib/rendu/couleur";
import { rendreCpu } from "@/lib/rendu/cpu";
import { schemaRetouche, type Retouche } from "@/lib/rendu/parametres";
import { MoteurRendu } from "@/lib/rendu/webgl";

export const JEUX: { nom: string; r: Partial<Retouche>; geometrie?: boolean }[] = [
  { nom: "neutre", r: {} },
  { nom: "lumière +", r: { lumiere: 0.6 } },
  { nom: "lumière −", r: { lumiere: -0.7 } },
  { nom: "contraste", r: { contraste: 0.8 } },
  { nom: "ombres et hautes lumières", r: { ombres: 0.9, hautesLumieres: -0.8 } },
  { nom: "noirs et blancs", r: { noirs: -0.6, blancs: 0.7 } },
  { nom: "température et teinte", r: { temperature: 0.8, teinte: -0.5 } },
  { nom: "saturation", r: { saturation: 0.7 } },
  { nom: "désaturation", r: { saturation: -1 } },
  { nom: "noir et blanc", r: { filtre: "noir-et-blanc" } },
  { nom: "argentique doux", r: { filtre: "argentique", intensite: 0.8 } },
  { nom: "chaud", r: { filtre: "chaud" } },
  { nom: "froid", r: { filtre: "froid", intensite: 0.5 } },
  { nom: "tout ensemble", r: { lumiere: 0.3, contraste: 0.4, ombres: 0.5, temperature: -0.4, saturation: 0.3, filtre: "argentique", intensite: 0.5 } },
  { nom: "quart de tour", r: { rotation: 90 }, geometrie: true },
  { nom: "redressement et recadrage", r: { redressement: 7, recadrage: { x: 0.1, y: 0.2, l: 0.6, h: 0.7 } }, geometrie: true },
];

type Resultat = { nom: string; moyen: number; p99: number; ok: boolean };

/** Image de test : dégradés, aplats saturés, tons chair et gris. */
function mire(l: number, h: number): ImageData {
  const d = new Uint8ClampedArray(l * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < l; x++) {
      const i = (y * l + x) * 4;
      const u = x / (l - 1);
      const v = y / (h - 1);
      const bande = Math.floor(v * 4);
      const c =
        bande === 0 ? [u, u, u] : bande === 1 ? [u, 1 - u, 0.5] : bande === 2 ? [0.9 * u + 0.1, 0.65 * u + 0.1, 0.5 * u + 0.1] : [0.5 + 0.5 * Math.sin(u * 9), v, 1 - u];
      d.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], i);
    }
  return new ImageData(d, l, h);
}

export function Verification() {
  const [resultats, setResultats] = useState<Resultat[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const L = 160;
        const H = 120;
        const img = mire(L, H);
        const bitmap = await createImageBitmap(img, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
        const moteur = new MoteurRendu(document.createElement("canvas"));
        moteur.charger(bitmap);
        const res: Resultat[] = [];
        for (const j of JEUX) {
          const r = schemaRetouche.parse(j.r);
          const [l, h] = moteur.rendre(r, 400);
          const gpu = moteur.lirePixels(l, h);
          const cpu = rendreCpu({ donnees: img.data, largeur: L, hauteur: H }, r, 400);
          const ecarts: number[] = [];
          for (let i = 0; i < gpu.length; i += 4) {
            ecarts.push(
              deltaE([gpu[i] / 255, gpu[i + 1] / 255, gpu[i + 2] / 255], [cpu.donnees[i] / 255, cpu.donnees[i + 1] / 255, cpu.donnees[i + 2] / 255]),
            );
          }
          ecarts.sort((a, b) => a - b);
          const moyen = ecarts.reduce((s, x) => s + x, 0) / ecarts.length;
          const p99 = ecarts[Math.floor(ecarts.length * 0.99)];
          // Géométrie : l'échantillonnage bilinéaire peut différer d'un demi-pixel sur les bords.
          const ok = j.geometrie ? moyen < 1 && p99 < 8 : moyen < 0.5 && p99 < 2;
          res.push({ nom: j.nom, moyen, p99, ok });
        }
        setResultats(res);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  if (erreur) return <p role="alert" className="text-danger">Rendu GPU impossible : {erreur}</p>;
  if (!resultats) return <p>Calcul en cours…</p>;
  const tousOk = resultats.every((r) => r.ok);
  return (
    <div className="space-y-4">
      <p data-testid="bilan-rendu" className={tousOk ? "text-succes" : "text-danger"}>
        {tousOk ? "Rendu identique sur cet appareil." : "Écarts détectés sur cet appareil."}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-encre-douce">
            <th className="py-1">Réglage</th>
            <th>ΔE moyen</th>
            <th>ΔE 99 %</th>
            <th />
          </tr>
        </thead>
        <tbody data-testid="resultats-rendu" data-json={JSON.stringify(resultats)}>
          {resultats.map((r) => (
            <tr key={r.nom} className="border-t border-filet">
              <td className="py-1">{r.nom}</td>
              <td>{r.moyen.toFixed(3)}</td>
              <td>{r.p99.toFixed(3)}</td>
              <td>{r.ok ? "✓" : "✗"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

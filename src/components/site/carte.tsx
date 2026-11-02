/**
 * Itinéraire dessiné en SVG, sans fond de carte : aucune dépendance, aucun appel externe,
 * fonctionne hors ligne et dans l'export .zip. Les étapes sont déjà arrondies (environ 10 km).
 */
import type { PointCarte } from "@/lib/site/types";

const LARGEUR = 1000;

export function projeter(points: { lat: number; lon: number }[]) {
  const latMoy = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos((latMoy * Math.PI) / 180);
  const xs = points.map((p) => p.lon * k);
  const ys = points.map((p) => -p.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // Étendue minimale (environ 20 km) pour ne pas grossir à l'excès deux étapes voisines.
  const ex = Math.max(x1 - x0, 0.2);
  const ey = Math.max(y1 - y0, 0.2);
  const hauteur = Math.round(Math.min(1.1, Math.max(0.32, ey / ex)) * LARGEUR);
  const marge = 110;
  const echelle = Math.min((LARGEUR - 2 * marge) / ex, (hauteur - 2 * marge) / ey);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return {
    hauteur,
    xy: points.map((_, i) => ({
      x: LARGEUR / 2 + (xs[i] - cx) * echelle,
      y: hauteur / 2 + (ys[i] - cy) * echelle,
    })),
  };
}

export function Carte({ points }: { points: PointCarte[] }) {
  const { hauteur, xy } = projeter(points);
  // Étapes au même endroit : une seule pastille, numéros regroupés.
  const lieux: { x: number; y: number; numeros: number[]; titre: string }[] = [];
  points.forEach((p, i) => {
    const deja = lieux.find((l) => Math.hypot(l.x - xy[i].x, l.y - xy[i].y) < 4);
    if (deja) deja.numeros.push(i + 1);
    else lieux.push({ ...xy[i], numeros: [i + 1], titre: p.titre });
  });
  const trace = xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <figure className="mt-6">
      <svg
        viewBox={`0 0 ${LARGEUR} ${hauteur}`}
        role="img"
        aria-label={`Itinéraire en ${points.length} étapes`}
        className="h-auto w-full rounded-lg bg-s-fond2"
      >
        <polyline points={trace} fill="none" stroke="var(--s-accent)" strokeWidth="4" strokeDasharray="2 12" strokeLinecap="round" strokeLinejoin="round" />
        {lieux.map((l, i) => {
          const aDroite = l.x < LARGEUR * 0.62;
          return (
            <g key={i}>
              <circle cx={l.x} cy={l.y} r="22" fill="var(--s-accent)" />
              <text x={l.x} y={l.y + 8} textAnchor="middle" fontSize={l.numeros.length > 1 ? 17 : 22} fill="var(--s-fond)" fontWeight="600">
                {l.numeros.length > 2 ? `${l.numeros[0]}…` : l.numeros.join(",")}
              </text>
              <text
                x={l.x + (aDroite ? 32 : -32)}
                y={l.y + 10}
                textAnchor={aDroite ? "start" : "end"}
                fontSize="30"
                fill="var(--s-encre)"
                stroke="var(--s-fond2)"
                strokeWidth="8"
                paintOrder="stroke"
              >
                {l.titre.length > 32 ? `${l.titre.slice(0, 31)}…` : l.titre}
              </text>
            </g>
          );
        })}
      </svg>
      <ol className="mt-4 grid gap-x-6 gap-y-1 text-sm text-s-douce sm:grid-cols-2">
        {points.map((p, i) => (
          <li key={p.episodeId}>
            <span className="s-numero text-s-accent">{i + 1}.</span> {p.titre}
          </li>
        ))}
      </ol>
    </figure>
  );
}

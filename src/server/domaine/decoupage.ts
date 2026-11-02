/**
 * Découpage automatique d'un voyage en épisodes (fonctions pures).
 *
 * Règles, appliquées entre deux médias consécutifs (ordre chronologique corrigé) :
 * - un long silence (≥ 6 h) commence un nouvel épisode ;
 * - une nuit (changement de jour local avec ≥ 2 h d'écart) aussi ;
 * - un grand déplacement (≥ 50 km avec ≥ 1 h d'écart) marque une nouvelle étape.
 * Puis les épisodes trop maigres (< 4 médias) rejoignent leur voisin le plus proche dans le temps,
 * sauf s'ils sont isolés par plus de 24 h (un événement à part entière).
 */

export type PointMedia = { id: string; instant: Date | null; latitude: number | null; longitude: number | null };
export type Groupe = { ids: string[]; debut: Date; fin: Date };

export const SILENCE_MS = 6 * 3600_000;
export const NUIT_MS = 2 * 3600_000;
export const ETAPE_KM = 50;
export const ETAPE_MS = 3600_000;
export const MIN_MEDIAS = 4;
export const ISOLE_MS = 24 * 3600_000;

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Jour local « AAAA-MM-JJ » d'un instant dans un fuseau, avec une journée qui finit à 4 h du matin. */
export function jourLocal(instant: Date, fuseau: string): string {
  const decale = new Date(instant.getTime() - 4 * 3600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuseau, year: "numeric", month: "2-digit", day: "2-digit" }).format(decale);
}

function coupure(a: PointMedia & { instant: Date }, b: PointMedia & { instant: Date }, fuseau: string): boolean {
  const ecart = b.instant.getTime() - a.instant.getTime();
  if (ecart >= SILENCE_MS) return true;
  if (ecart >= NUIT_MS && jourLocal(a.instant, fuseau) !== jourLocal(b.instant, fuseau)) return true;
  if (
    ecart >= ETAPE_MS &&
    a.latitude != null &&
    a.longitude != null &&
    b.latitude != null &&
    b.longitude != null &&
    distanceKm(a as { latitude: number; longitude: number }, b as { latitude: number; longitude: number }) >= ETAPE_KM
  ) {
    return true;
  }
  return false;
}

export function decouper(medias: PointMedia[], fuseau: string): { groupes: Groupe[]; sansDate: string[] } {
  const dates = medias
    .filter((m): m is PointMedia & { instant: Date } => !!m.instant)
    .sort((a, b) => a.instant.getTime() - b.instant.getTime());
  const sansDate = medias.filter((m) => !m.instant).map((m) => m.id);
  if (!dates.length) return { groupes: [], sansDate };

  const bruts: (PointMedia & { instant: Date })[][] = [[dates[0]]];
  for (let i = 1; i < dates.length; i++) {
    if (coupure(dates[i - 1], dates[i], fuseau)) bruts.push([]);
    bruts[bruts.length - 1].push(dates[i]);
  }

  // Fusion des épisodes trop maigres avec le voisin le plus proche (sauf événement isolé).
  const groupes = bruts.map((g) => ({ medias: g, debut: g[0].instant, fin: g[g.length - 1].instant }));
  for (let change = true; change; ) {
    change = false;
    for (let i = 0; i < groupes.length && groupes.length > 1; i++) {
      const g = groupes[i];
      if (g.medias.length >= MIN_MEDIAS) continue;
      const avant = i > 0 ? g.debut.getTime() - groupes[i - 1].fin.getTime() : Infinity;
      const apres = i < groupes.length - 1 ? groupes[i + 1].debut.getTime() - g.fin.getTime() : Infinity;
      if (Math.min(avant, apres) > ISOLE_MS) continue;
      const j = avant <= apres ? i - 1 : i + 1;
      const [a, b] = j < i ? [groupes[j], g] : [g, groupes[j]];
      const fusion = { medias: [...a.medias, ...b.medias], debut: a.debut, fin: b.fin };
      groupes.splice(Math.min(i, j), 2, fusion);
      change = true;
      break;
    }
  }
  return { groupes: groupes.map((g) => ({ ids: g.medias.map((m) => m.id), debut: g.debut, fin: g.fin })), sansDate };
}

const fmtJour = (fuseau: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, weekday: "long", day: "numeric", month: "long" });
const fmtCourt = (fuseau: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, day: "numeric", month: "long" });

/** « Lundi 3 août », ou « Du 3 au 5 août » si l'épisode couvre plusieurs jours. */
export function titreAuto(debut: Date, fin: Date, fuseau: string): string {
  const j1 = jourLocal(debut, fuseau);
  const j2 = jourLocal(fin, fuseau);
  const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (j1 === j2) return majuscule(fmtJour(fuseau).format(new Date(debut.getTime() - 4 * 3600_000)));
  const d1 = fmtCourt(fuseau).formatToParts(debut);
  const d2 = fmtCourt(fuseau).format(fin);
  const memeMois = d1.find((p) => p.type === "month")?.value === fmtCourt(fuseau).formatToParts(fin).find((p) => p.type === "month")?.value;
  return memeMois ? `Du ${d1.find((p) => p.type === "day")?.value} au ${d2}` : `Du ${fmtCourt(fuseau).format(debut)} au ${d2}`;
}

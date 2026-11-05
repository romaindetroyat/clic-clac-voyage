/**
 * Tri des photos : on avance « moment » par moment. Un moment, c'est une photo seule, ou une série
 * de photos semblables (même scène, prises à moins de deux minutes d'écart, ou une rafale détectée) :
 * on les montre côte à côte pour choisir la meilleure. Fonctions pures.
 */
import { scoreQualite } from "../qualite";

export const ECART_MOMENT_MS = 120_000;
/** Distance (sur 64 bits) entre empreintes perceptuelles en dessous de laquelle deux photos montrent la même scène. */
export const SEUIL_SEMBLABLES = 20;
export const TAILLE_MAX_MOMENT = 12;

export type PhotoTri = {
  id: string;
  type: "photo" | "video";
  instant: string | null;
  dhash: string | null;
  rafaleId: string | null;
  nettete: number | null;
  exposition: number | null;
};

function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i += 8) {
    let x = Number.parseInt(a.slice(i, i + 8), 16) ^ Number.parseInt(b.slice(i, i + 8), 16);
    while (x) {
      d += x & 1;
      x >>>= 1;
    }
  }
  return d;
}

export function semblables(a: PhotoTri, b: PhotoTri): boolean {
  if (a.type !== "photo" || b.type !== "photo") return false;
  if (a.rafaleId && a.rafaleId === b.rafaleId) return true;
  if (!a.instant || !b.instant || !a.dhash || !b.dhash) return false;
  return Math.abs(Date.parse(b.instant) - Date.parse(a.instant)) <= ECART_MOMENT_MS && hamming(a.dhash, b.dhash) <= SEUIL_SEMBLABLES;
}

/** Découpe une liste chronologique en moments (l'ordre est conservé). */
export function moments<T extends PhotoTri>(medias: T[]): T[][] {
  const res: T[][] = [];
  for (const m of medias) {
    const courant = res.at(-1);
    // Comparé à la dernière photo du moment : une série qui glisse doucement reste groupée.
    if (courant && courant.length < TAILLE_MAX_MOMENT && semblables(courant.at(-1)!, m)) courant.push(m);
    else res.push([m]);
  }
  return res;
}

export type Avis = { mediaId: string; raison: string };

/** Photo suggérée dans un moment : l'avis de l'IA s'il existe, sinon la meilleure netteté et exposition. */
export function suggestion<T extends PhotoTri>(moment: T[], avis?: Map<string, string>): T {
  const parIa = avis && moment.find((m) => avis.has(m.id));
  if (parIa) return parIa;
  return moment.reduce((best, m) => (scoreQualite(m) > scoreQualite(best) + 0.005 ? m : best));
}

/** Défauts visibles, pour prévenir avant de garder une photo. */
export function defauts(m: { type: string; nettete: number | null; exposition: number | null }): string[] {
  if (m.type !== "photo") return [];
  const d: string[] = [];
  if (m.nettete != null && m.nettete < 0.25) d.push("floue");
  if (m.exposition != null && m.exposition < 0.3) d.push("mal exposée");
  return d;
}

export type Decision = "ecarter" | "site" | "livre" | "coeur";
/** Ce qu'une décision change sur un média. */
export function effet(d: Decision): { dansSite: boolean; dansLivre: boolean; vedette?: boolean } {
  if (d === "ecarter") return { dansSite: false, dansLivre: false, vedette: false };
  if (d === "site") return { dansSite: true, dansLivre: false };
  if (d === "livre") return { dansSite: true, dansLivre: true };
  return { dansSite: true, dansLivre: true, vedette: true };
}

/** Regroupements proposés dans la vue « par groupes ». */
export const REGROUPEMENTS = {
  serie: { libelle: "Rafales et photos semblables", ecartMs: null },
  "5min": { libelle: "Prises à moins de 5 min d'écart", ecartMs: 5 * 60_000 },
  "30min": { libelle: "Prises à moins de 30 min d'écart", ecartMs: 30 * 60_000 },
  "2h": { libelle: "Prises à moins de 2 h d'écart", ecartMs: 2 * 3600_000 },
} as const;
export type Regroupement = keyof typeof REGROUPEMENTS;

/**
 * Groupes de médias proches dans le temps (liste chronologique, ordre conservé) : un nouveau groupe
 * commence quand l'écart avec le média précédent dépasse `ecartMs`. Les médias sans date forment un groupe à part.
 */
export function parProximite<T extends PhotoTri>(medias: T[], regroupement: Regroupement): T[][] {
  const ecart = REGROUPEMENTS[regroupement].ecartMs;
  if (ecart === null) return moments(medias);
  const res: T[][] = [];
  let prec: T | null = null;
  for (const m of medias) {
    const courant = res.at(-1);
    const proche =
      courant &&
      prec &&
      (m.instant && prec.instant ? Date.parse(m.instant) - Date.parse(prec.instant) <= ecart : !m.instant && !prec.instant);
    if (proche) courant.push(m);
    else res.push([m]);
    prec = m;
  }
  return res;
}

export type Groupe<T> = { medias: T[]; /** Série de photos semblables (on y choisit la meilleure). */ serie: boolean };

/**
 * Groupes pour la planche. En mode « rafales », les photos seules qui se suivent le même jour
 * sont réunies dans un même groupe (une carte par série, une carte pour les photos seules du jour).
 */
export function groupesPlanche<T extends PhotoTri>(medias: T[], regroupement: Regroupement, jourDe: (iso: string | null) => string): Groupe<T>[] {
  const bruts = parProximite(medias, regroupement);
  if (regroupement !== "serie") return bruts.map((g) => ({ medias: g, serie: false }));
  const res: Groupe<T>[] = [];
  for (const g of bruts) {
    const prec = res.at(-1);
    if (g.length === 1 && prec && !prec.serie && jourDe(prec.medias[0].instant) === jourDe(g[0].instant)) prec.medias.push(g[0]);
    else res.push({ medias: [...g], serie: g.length > 1 });
  }
  return res;
}

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

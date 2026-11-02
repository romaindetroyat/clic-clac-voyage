/**
 * Dédoublonnage.
 * 1. Doublon exact : même empreinte SHA-256 dans le voyage → on n'envoie pas une seconde fois.
 * 2. Même photo recompressée (WhatsApp, mode économie de données, capture…) :
 *    empreinte perceptuelle dHash proche, même ratio, dates compatibles.
 *    On garde la version de meilleure qualité (plus de pixels, puis plus d'octets).
 */

export const SEUIL_HAMMING = 8;
export const ECART_RATIO = 0.01;
export const ECART_TEMPS_MS = 36 * 3600 * 1000;

export type Empreinte = {
  id: string;
  dhash: string | null;
  largeur: number | null;
  hauteur: number | null;
  taille: number;
  instant: Date | null;
  copieCompressee?: boolean;
};

/** Distance de Hamming entre deux dHash 64 bits en hexadécimal. */
export function distanceHamming(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

function ratio(e: Empreinte): number | null {
  if (!e.largeur || !e.hauteur) return null;
  // Insensible à l'orientation : même photo tournée = même ratio.
  return Math.max(e.largeur, e.hauteur) / Math.min(e.largeur, e.hauteur);
}

export function memePhoto(a: Empreinte, b: Empreinte): boolean {
  if (!a.dhash || !b.dhash) return false;
  if (distanceHamming(a.dhash, b.dhash) > SEUIL_HAMMING) return false;
  const ra = ratio(a);
  const rb = ratio(b);
  if (ra && rb && Math.abs(ra - rb) / rb > ECART_RATIO) return false;
  // Les copies WhatsApp n'ont pas de date EXIF fiable : on ne bloque que si les deux en ont une.
  if (a.instant && b.instant && Math.abs(a.instant.getTime() - b.instant.getTime()) > ECART_TEMPS_MS) return false;
  return true;
}

/** Score de qualité : l'original non compressé, puis le plus de pixels, puis le plus lourd. */
function qualite(e: Empreinte): [number, number, number] {
  return [e.copieCompressee ? 0 : 1, (e.largeur ?? 0) * (e.hauteur ?? 0), e.taille];
}

export function meilleur(a: Empreinte, b: Empreinte): Empreinte {
  const qa = qualite(a);
  const qb = qualite(b);
  for (let i = 0; i < 3; i++) if (qa[i] !== qb[i]) return qa[i] > qb[i] ? a : b;
  return a; // à égalité, on garde le premier arrivé
}

/**
 * Pour un nouveau média, cherche parmi les médias visibles du voyage une même photo.
 * Renvoie la décision : rien, le nouveau est un doublon, ou le nouveau remplace l'ancien.
 */
export function deciderDoublon(
  nouveau: Empreinte,
  existants: Empreinte[],
): { action: "aucune" } | { action: "masquer-nouveau"; garde: string } | { action: "remplacer"; masque: string } {
  const proche = existants.find((e) => e.id !== nouveau.id && memePhoto(e, nouveau));
  if (!proche) return { action: "aucune" };
  return meilleur(proche, nouveau) === nouveau
    ? { action: "remplacer", masque: proche.id }
    : { action: "masquer-nouveau", garde: proche.id };
}

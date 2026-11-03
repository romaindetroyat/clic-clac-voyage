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
export const ECART_ORIGINAUX_MS = 1000;

export type Empreinte = {
  id: string;
  dhash: string | null;
  largeur: number | null;
  hauteur: number | null;
  taille: number;
  instant: Date | null;
  copieCompressee?: boolean;
  /** Date déduite (nom du fichier, saisie à la main) : seulement approchée. */
  dateApprochee?: boolean;
  mime?: string;
  auteurId?: string | null;
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
  if (a.instant && b.instant) {
    const ecart = Math.abs(a.instant.getTime() - b.instant.getTime());
    // Une copie compressée (WhatsApp…) n'a qu'une date approximative (heure du message) : large tolérance.
    // Deux originaux, eux, gardent l'heure exacte de prise de vue : à plus d'une seconde d'écart,
    // ce sont deux photos différentes (une rafale, par exemple), pas des doublons.
    // Même chose pour une date déduite du nom du fichier.
    if (a.copieCompressee || b.copieCompressee || a.dateApprochee || b.dateApprochee) return ecart <= ECART_TEMPS_MS;
    if (ecart >= ECART_ORIGINAUX_MS) return false;
    // Même seconde : un appareil en rafale prend plusieurs images par seconde, au même format,
    // de la même taille, envoyées par la même personne. Un vrai doublon vient d'ailleurs
    // (autre format, autre personne, autre taille), comme un HEIC et son export JPEG.
    const memeSource =
      a.mime === b.mime && a.auteurId === b.auteurId && a.largeur === b.largeur && a.hauteur === b.hauteur;
    if (memeSource && a.mime !== undefined) return false;
  }
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

/**
 * Stockage des fichiers (originaux et versions web).
 * Le navigateur envoie et lit directement par URL signée : aucun octet ne transite par Vercel.
 */
export type Morceau = { numero: number; etag: string };

export interface Stockage {
  /** URL signée pour un envoi en une fois (PUT). */
  urlEnvoi(cle: string, typeMime: string): Promise<string>;
  /** Démarre un envoi en plusieurs morceaux ; renvoie son identifiant. */
  creerMultipart(cle: string, typeMime: string): Promise<string>;
  /** URL signée pour envoyer le morceau `numero` (à partir de 1). */
  urlMorceau(cle: string, envoiId: string, numero: number): Promise<string>;
  /** Morceaux déjà reçus : sert à reprendre après une coupure. */
  listerMorceaux(cle: string, envoiId: string): Promise<Morceau[]>;
  terminerMultipart(cle: string, envoiId: string, morceaux: Morceau[]): Promise<void>;
  annulerMultipart(cle: string, envoiId: string): Promise<void>;
  /** URL signée de lecture, à durée limitée. */
  urlLecture(cle: string, dureeSecondes: number, nomTelechargement?: string): Promise<string>;
  /**
   * URL signée identique toute la journée (signée à minuit UTC, valable 48 h) :
   * le navigateur et le service worker peuvent la garder en cache.
   */
  urlLectureStable(cle: string): Promise<string>;
  /** Contenu d'un objet (côté serveur : assemblage du PDF). */
  lire(cle: string): Promise<Uint8Array>;
  /** Écrit un objet en une fois (côté serveur ; jusqu'à quelques centaines de Mo). */
  ecrire(cle: string, contenu: Uint8Array, typeMime: string): Promise<void>;
  /** Taille de l'objet, ou null s'il n'existe pas. */
  taille(cle: string): Promise<number | null>;
  supprimer(cles: string[]): Promise<void>;
  /** Supprime tout ce qui commence par ce préfixe (ex. « voyages/<id>/ ») ; renvoie le nombre d'objets. */
  supprimerPrefixe(prefixe: string): Promise<number>;
}

/** 16 Mio : au-dessus de la taille minimale (5 Mio) et assez gros pour 10 000 morceaux = 160 Gio. */
export const TAILLE_MORCEAU = 16 * 1024 * 1024;
/** En dessous, un seul PUT suffit. */
export const SEUIL_MULTIPART = 32 * 1024 * 1024;

export const cles = {
  original: (voyageId: string, mediaId: string) => `voyages/${voyageId}/originaux/${mediaId}`,
  version: (voyageId: string, mediaId: string, nom: string, ext: string) =>
    `voyages/${voyageId}/web/${mediaId}-${nom}.${ext}`,
};

/** Début du jour UTC courant : base des URL de lecture stables. */
export function debutDuJourUtc(maintenant = new Date()): Date {
  return new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
}

export const DUREE_URL_STABLE = 48 * 3600;

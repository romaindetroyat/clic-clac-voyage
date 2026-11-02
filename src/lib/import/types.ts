/** Résultat de l'analyse d'un fichier dans le navigateur, avant envoi. */
export type Analyse = {
  type: "photo" | "video";
  mime: string;
  sha256: string;
  dhash: string | null;
  largeur: number | null;
  hauteur: number | null;
  dureeSecondes: number | null;
  priseLocale: string | null;
  decalageExifMinutes: number | null;
  latitude: number | null;
  longitude: number | null;
  appareil: { cle: string; libelle: string } | null;
  /** Versions web déjà calculées (WebP) : s ≈ 400 px, m ≈ 1200 px, l ≈ 2400 px, affiche pour les vidéos. */
  versions: Partial<Record<"s" | "m" | "l" | "affiche" | "video", Blob>>;
  avertissement?: string;
};

export const TAILLES_VERSIONS = { s: 400, m: 1200, l: 2400 } as const;

const EXT_RAW = ["cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "dng", "raf", "orf", "rw2", "pef", "srw", "3fr", "iiq"];
const EXT_VIDEO = ["mov", "mp4", "m4v", "3gp", "avi", "mkv", "webm", "mts", "m2ts"];
const EXT_PHOTO = ["jpg", "jpeg", "heic", "heif", "hif", "png", "webp", "avif", "gif", "tif", "tiff", ...EXT_RAW];

export function extension(nom: string) {
  return nom.split(".").pop()?.toLowerCase() ?? "";
}

export function estRaw(nom: string) {
  return EXT_RAW.includes(extension(nom));
}

/** Type de média d'après le type MIME, ou l'extension quand le navigateur ne le connaît pas (HEIC, RAW). */
export function typeDeFichier(f: { name: string; type: string }): "photo" | "video" | null {
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("image/")) return "photo";
  const ext = extension(f.name);
  if (EXT_VIDEO.includes(ext)) return "video";
  if (EXT_PHOTO.includes(ext)) return "photo";
  return null;
}

export function mimeDeFichier(f: { name: string; type: string }) {
  if (f.type) return f.type;
  const ext = extension(f.name);
  const connus: Record<string, string> = { heic: "image/heic", heif: "image/heif", hif: "image/heif", mov: "video/quicktime", mts: "video/mp2t" };
  if (connus[ext]) return connus[ext];
  if (EXT_RAW.includes(ext)) return `image/x-${ext}`;
  return "application/octet-stream";
}

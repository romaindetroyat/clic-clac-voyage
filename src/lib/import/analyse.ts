/**
 * Analyse d'un fichier dans le navigateur (de préférence dans un Web Worker) :
 * empreinte SHA-256, EXIF, décodage (HEIC, aperçu des RAW), empreinte perceptuelle,
 * versions web en WebP. Les versions générées ne contiennent aucune métadonnée (ni GPS).
 */
import { createSHA256 } from "hash-wasm";
import { exposition, gris, nettete } from "../qualite";
import { estRaw, extension, mimeDeFichier, TAILLES_VERSIONS, typeDeFichier, type Analyse } from "./types";

const TRANCHE = 8 * 1024 * 1024;

export async function empreinteSha256(f: Blob, progression?: (fraction: number) => void): Promise<string> {
  const h = await createSHA256();
  h.init();
  for (let pos = 0; pos < f.size; pos += TRANCHE) {
    h.update(new Uint8Array(await f.slice(pos, pos + TRANCHE).arrayBuffer()));
    progression?.(Math.min(1, (pos + TRANCHE) / f.size));
  }
  return h.digest("hex");
}

import { lireExif } from "./exif";
export { lireExif };

/* ----------------------------- Décodage ------------------------------ */

/** Le plus grand JPEG intégré à un fichier RAW (aperçu « taille réelle » le plus souvent). */
export async function apercuRaw(f: Blob): Promise<Blob | null> {
  const octets = new Uint8Array(await f.arrayBuffer());
  let meilleur: [number, number] | null = null;
  for (let i = 0; i < octets.length - 3; i++) {
    if (octets[i] !== 0xff || octets[i + 1] !== 0xd8 || octets[i + 2] !== 0xff) continue;
    // Parcours des segments JPEG jusqu'au début des données (SOS), puis recherche de la fin (EOI).
    let j = i + 2;
    let valide = false;
    while (j < octets.length - 4 && octets[j] === 0xff) {
      const marqueur = octets[j + 1];
      const longueur = (octets[j + 2] << 8) | octets[j + 3];
      if (marqueur === 0xda) {
        valide = true;
        j += 2 + longueur;
        break;
      }
      j += 2 + longueur;
    }
    if (!valide) continue;
    while (j < octets.length - 1 && !(octets[j] === 0xff && octets[j + 1] === 0xd9)) j++;
    const fin = j + 2;
    if (!meilleur || fin - i > meilleur[1] - meilleur[0]) meilleur = [i, fin];
    i = fin - 1;
  }
  return meilleur && meilleur[1] - meilleur[0] > 50_000 ? new Blob([octets.slice(meilleur[0], meilleur[1])], { type: "image/jpeg" }) : null;
}

async function estHeic(f: Blob) {
  const tete = new Uint8Array(await f.slice(0, 32).arrayBuffer());
  const marque = String.fromCharCode(...tete.slice(8, 12));
  return ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(marque);
}

/** Décode une image en ImageBitmap orientée selon l'EXIF ; HEIC et RAW compris. */
export async function decoder(f: Blob, nom: string): Promise<{ image: ImageBitmap; avertissement?: string }> {
  const source = estRaw(nom) ? await apercuRaw(f) : f;
  if (!source) throw new Error("Ce fichier RAW ne contient pas d'aperçu : il sera conservé, sans vignette.");
  try {
    return { image: await createImageBitmap(source, { imageOrientation: "from-image" }) };
  } catch (e) {
    if (!(await estHeic(source))) throw e;
    // Chrome, Firefox, Edge ne savent pas décoder le HEIC : bibliothèque wasm.
    // Sortie directe en ImageBitmap : la conversion en JPEG passe par un <canvas> du document,
    // qui n'existe pas dans le Web Worker où tourne l'analyse (l'aperçu échouait en silence).
    // L'orientation est déjà appliquée par le décodeur HEIF.
    const { heicTo } = await import("heic-to");
    return { image: await heicTo({ blob: source, type: "bitmap" }) };
  }
}

/* --------------------- Empreinte et versions web --------------------- */

function canevas(l: number, h: number) {
  const c = new OffscreenCanvas(l, h);
  const ctx = c.getContext("2d", { willReadFrequently: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

/** Netteté et exposition mesurées sur une réduction à 512 px de côté. */
export function mesurerQualite(image: CanvasImageSource & { width: number; height: number }) {
  const echelle = Math.min(1, 512 / Math.max(image.width, image.height));
  const l = Math.max(3, Math.round(image.width * echelle));
  const h = Math.max(3, Math.round(image.height * echelle));
  const { ctx } = canevas(l, h);
  ctx.drawImage(image, 0, 0, l, h);
  const g = gris(ctx.getImageData(0, 0, l, h).data);
  return { nettete: nettete(g, l, h), exposition: exposition(g) };
}

/** dHash 64 bits : on réduit à 9×8 en gris et on compare chaque pixel à son voisin de droite. */
export function dhash(image: CanvasImageSource & { width: number; height: number }): string {
  const { ctx } = canevas(9, 8);
  ctx.drawImage(image, 0, 0, 9, 8);
  const p = ctx.getImageData(0, 0, 9, 8).data;
  const gris = (x: number, y: number) => {
    const i = (y * 9 + x) * 4;
    return 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
  };
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (gris(x, y) > gris(x + 1, y) ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}

let webpNatif: boolean | undefined;

export async function encoderWebp(c: OffscreenCanvas, qualite = 0.82): Promise<Blob> {
  if (webpNatif !== false) {
    const b = await c.convertToBlob({ type: "image/webp", quality: qualite });
    webpNatif = b.type === "image/webp";
    if (webpNatif) return b;
  }
  // Safari n'encode pas le WebP : encodeur wasm, identique partout.
  const { default: encode } = await import("@jsquash/webp/encode");
  const ctx = c.getContext("2d")!;
  const donnees = ctx.getImageData(0, 0, c.width, c.height);
  return new Blob([await encode(donnees, { quality: Math.round(qualite * 100) })], { type: "image/webp" });
}

/** Réduit par paliers (meilleure qualité qu'un seul redimensionnement) et encode en WebP. */
export async function versionWeb(image: CanvasImageSource & { width: number; height: number }, cote: number) {
  let source: CanvasImageSource & { width: number; height: number } = image;
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const cibleL = Math.max(1, Math.round(image.width * echelle));
  const cibleH = Math.max(1, Math.round(image.height * echelle));
  while (source.width / 2 > cibleL * 1.5) {
    const { c, ctx } = canevas(Math.round(source.width / 2), Math.round(source.height / 2));
    ctx.drawImage(source, 0, 0, c.width, c.height);
    source = c;
  }
  const { c, ctx } = canevas(cibleL, cibleH);
  ctx.drawImage(source, 0, 0, cibleL, cibleH);
  return encoderWebp(c);
}

/* --------------------------- Analyse photo --------------------------- */

export async function analyserPhoto(f: File, progression?: (f: number) => void): Promise<Analyse> {
  const [sha256, exif] = await Promise.all([empreinteSha256(f, (x) => progression?.(x * 0.5)), lireExif(f)]);
  const base: Analyse = {
    type: "photo",
    mime: mimeDeFichier(f),
    sha256,
    dhash: null,
    largeur: null,
    hauteur: null,
    dureeSecondes: null,
    ...exif,
    versions: {},
  };
  try {
    const { image } = await decoder(f, f.name);
    base.largeur = image.width;
    base.hauteur = image.height;
    base.dhash = dhash(image);
    Object.assign(base, mesurerQualite(image));
    base.versions.s = await versionWeb(image, TAILLES_VERSIONS.s);
    progression?.(0.7);
    base.versions.m = await versionWeb(image, TAILLES_VERSIONS.m);
    progression?.(0.85);
    if (Math.max(image.width, image.height) > TAILLES_VERSIONS.m) base.versions.l = await versionWeb(image, TAILLES_VERSIONS.l);
    image.close();
  } catch (e) {
    base.avertissement = e instanceof Error && e.message.startsWith("Ce fichier") ? e.message : "Aperçu impossible : l'original sera conservé tel quel.";
  }
  progression?.(1);
  return base;
}

export { extension, typeDeFichier };

/**
 * Métadonnées EXIF : date de prise de vue, décalage horaire, position, appareil.
 * Utilisé à l'import (navigateur) et pour relire les originaux déjà stockés (serveur).
 */
import { exifHeif } from "./heif";
import type { Analyse } from "./types";

export type Exif = Pick<Analyse, "priseLocale" | "decalageExifMinutes" | "latitude" | "longitude" | "appareil">;

function heureExif(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v.trim());
  if (!m || m[1] === "0000") return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

function decalageExif(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(v.trim());
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : null;
}

const vide = (): Exif => ({ priseLocale: null, decalageExifMinutes: null, latitude: null, longitude: null, appareil: null });

/** Lecture n'importe où (navigateur : File ; serveur : objet distant lu par plages). */
export type SourceOctets = { size: number; slice(debut: number, fin: number): { arrayBuffer(): Promise<ArrayBuffer> } };

/** Date, position et appareil d'un fichier ; HEIC (iPhone) compris. */
export async function lireExif(f: SourceOctets): Promise<Exif> {
  try {
    // HEIC : exifr échoue sur ces fichiers ; on lui donne directement le bloc TIFF.
    const tiff = await exifHeif(f).catch(() => null);
    if (tiff) return interpreterExif(tiff);
    // Ailleurs (JPEG, PNG, RAW…), l'EXIF est au début du fichier.
    return interpreterExif(f instanceof Blob ? f : new Uint8Array(await f.slice(0, Math.min(f.size, 1024 * 1024)).arrayBuffer()));
  } catch {
    return vide();
  }
}

async function interpreterExif(source: Blob | Uint8Array): Promise<Exif> {
  try {
    const exifr = (await import("exifr")).default;
    const t = await exifr.parse(source, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: false,
      icc: false,
      iptc: false,
      reviveValues: false,
      translateValues: false,
    });
    if (!t) return vide();
    const gps = await exifr.gps(source).catch(() => null);
    const marque = typeof t.Make === "string" ? t.Make.trim() : "";
    const modele = typeof t.Model === "string" ? t.Model.trim() : "";
    const serie = String(t.BodySerialNumber ?? t.SerialNumber ?? t.InternalSerialNumber ?? "").trim();
    const libelle = modele.toLowerCase().startsWith(marque.toLowerCase()) ? modele : `${marque} ${modele}`.trim();
    return {
      // Pas la date de modification (ModifyDate) : sur une photo exportée ou retouchée, c'est le jour de l'export.
      priseLocale: heureExif(t.DateTimeOriginal ?? t.CreateDate ?? t.DateTimeDigitized),
      decalageExifMinutes: decalageExif(t.OffsetTimeOriginal ?? t.OffsetTime),
      latitude: gps && Number.isFinite(gps.latitude) ? gps.latitude : null,
      longitude: gps && Number.isFinite(gps.longitude) ? gps.longitude : null,
      appareil: marque || modele ? { cle: [marque, modele, serie].join("|"), libelle: libelle || "Appareil inconnu" } : null,
    };
  } catch {
    return vide();
  }
}


/**
 * Analyse d'une vidéo dans le navigateur : durée, dimensions, date (atome mvhd), affiche.
 * La version allégée (720p) sera produite plus tard (Mediabunny, ou tâche par lots en secours).
 */
import { empreinteSha256, versionWeb } from "./analyse";
import { versionLegere } from "./video-legere";
import { mimeDeFichier, TAILLES_VERSIONS, type Analyse } from "./types";

import { dateMp4 } from "./mp4";
export { dateMp4 };

function chargerVideo(f: Blob): Promise<HTMLVideoElement> {
  return new Promise((ok, ko) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => ok(v);
    v.onerror = () => ko(new Error("Vidéo illisible par ce navigateur"));
    v.src = URL.createObjectURL(f);
  });
}

function aller(v: HTMLVideoElement, t: number) {
  return new Promise<void>((ok) => {
    v.onseeked = () => ok();
    v.currentTime = t;
  });
}

export async function analyserVideo(f: File, progression?: (f: number) => void): Promise<Analyse> {
  const sha256 = await empreinteSha256(f, (x) => progression?.(x * 0.3));
  const date = await dateMp4(f);
  const base: Analyse = {
    type: "video",
    mime: f.type || mimeDeFichier(f),
    sha256,
    dhash: null,
    largeur: null,
    hauteur: null,
    dureeSecondes: null,
    priseLocale: date ? date.toISOString().slice(0, 19) : null,
    decalageExifMinutes: date ? 0 : null,
    latitude: null,
    longitude: null,
    appareil: null,
    versions: {},
  };
  try {
    const v = await chargerVideo(f);
    base.dureeSecondes = Number.isFinite(v.duration) ? v.duration : null;
    base.largeur = v.videoWidth || null;
    base.hauteur = v.videoHeight || null;
    await aller(v, Math.min(1, (v.duration || 2) / 2));
    const c = new OffscreenCanvas(v.videoWidth, v.videoHeight);
    c.getContext("2d")!.drawImage(v, 0, 0);
    const image = await createImageBitmap(c);
    base.versions.s = await versionWeb(image, TAILLES_VERSIONS.s);
    base.versions.affiche = await versionWeb(image, TAILLES_VERSIONS.m);
    image.close();
    URL.revokeObjectURL(v.src);
  } catch {
    base.avertissement = "Aperçu de la vidéo impossible sur cet appareil : l'original sera conservé.";
  }
  try {
    const legere = await versionLegere(f, base.largeur, base.hauteur, (p) => progression?.(0.3 + p * 0.7));
    if (legere && legere.size < f.size) base.versions.video = legere;
  } catch {
    // Encodeur indisponible ou format non pris en charge : version allégée produite plus tard.
  }
  progression?.(1);
  return base;
}

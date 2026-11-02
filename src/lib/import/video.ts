/**
 * Analyse d'une vidéo dans le navigateur : durée, dimensions, date (atome mvhd), affiche.
 * La version allégée (720p) sera produite plus tard (Mediabunny, ou tâche par lots en secours).
 */
import { empreinteSha256, versionWeb } from "./analyse";
import { mimeDeFichier, TAILLES_VERSIONS, type Analyse } from "./types";

const EPOQUE_MP4 = Date.UTC(1904, 0, 1);

/** Date de création UTC notée dans l'atome « mvhd » (MP4, MOV). */
export async function dateMp4(f: Blob): Promise<Date | null> {
  async function lire(pos: number, n: number) {
    return new DataView(await f.slice(pos, pos + n).arrayBuffer());
  }
  async function chercher(debut: number, fin: number, type: string): Promise<[number, number] | null> {
    let pos = debut;
    while (pos + 8 <= fin) {
      const v = await lire(pos, 16);
      let taille = v.getUint32(0);
      const t = String.fromCharCode(v.getUint8(4), v.getUint8(5), v.getUint8(6), v.getUint8(7));
      let entete = 8;
      if (taille === 1) {
        taille = Number(v.getBigUint64(8));
        entete = 16;
      } else if (taille === 0) taille = fin - pos;
      if (taille < 8) return null;
      if (t === type) return [pos + entete, pos + taille];
      pos += taille;
    }
    return null;
  }
  try {
    const moov = await chercher(0, f.size, "moov");
    if (!moov) return null;
    const mvhd = await chercher(moov[0], moov[1], "mvhd");
    if (!mvhd) return null;
    const v = await lire(mvhd[0], 12);
    const secondes = v.getUint8(0) === 1 ? Number(v.getBigUint64(4)) : v.getUint32(4);
    if (!secondes) return null;
    const d = new Date(EPOQUE_MP4 + secondes * 1000);
    return d.getUTCFullYear() > 1990 && d.getUTCFullYear() < 2100 ? d : null;
  } catch {
    return null;
  }
}

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
  const sha256 = await empreinteSha256(f, (x) => progression?.(x * 0.8));
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
  progression?.(1);
  return base;
}

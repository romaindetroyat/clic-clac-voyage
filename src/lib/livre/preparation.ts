"use client";

/**
 * Préparation des photos pour l'impression, dans le navigateur de l'administrateur :
 * original téléchargé, retouche appliquée par le même moteur que l'écran, recadrage du cadre,
 * mise à 300 dpi, JPEG envoyé directement sur le stockage. Chaque image prête est gardée :
 * une préparation interrompue reprend là où elle s'était arrêtée.
 */
import { decoder } from "@/lib/import/analyse";
import { geometrie } from "@/lib/rendu/geometrie";
import type { Retouche } from "@/lib/rendu/parametres";
import { MoteurRendu } from "@/lib/rendu/webgl";

export type ImageAPreparer = {
  cle: string;
  nomFichier: string;
  retouche: Retouche | null;
  fractions: { x: number; y: number; l: number; h: number };
  largeurPx: number;
  hauteurPx: number;
  urlOriginal: string;
  urlEnvoi: string;
};

async function avecReprises<T>(fn: () => Promise<T>, essais = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= essais) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

let moteur: { m: MoteurRendu; max: number } | null = null;
function moteurRendu() {
  if (!moteur) {
    const canevas = new OffscreenCanvas(1, 1);
    const m = new MoteurRendu(canevas);
    const gl = canevas.getContext("webgl2") as WebGL2RenderingContext;
    moteur = { m, max: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number };
  }
  return moteur;
}

/** Fabrique le JPEG d'une image à imprimer. */
export async function fabriquer(img: Omit<ImageAPreparer, "urlEnvoi" | "cle">): Promise<Blob> {
  const original = await avecReprises(async () => {
    const r = await fetch(img.urlOriginal);
    if (!r.ok) throw new Error(`Original indisponible (${r.status})`);
    return r.blob();
  });
  let { image } = await decoder(original, img.nomFichier);
  const sortie = new OffscreenCanvas(img.largeurPx, img.hauteurPx);
  const ctx = sortie.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const f = img.fractions;
  if (!img.retouche) {
    ctx.drawImage(image, f.x * image.width, f.y * image.height, f.l * image.width, f.h * image.height, 0, 0, img.largeurPx, img.hauteurPx);
  } else {
    const { m, max } = moteurRendu();
    // Texture limitée par la carte graphique : on réduit la source si besoin.
    if (Math.max(image.width, image.height) > max) {
      const e = max / Math.max(image.width, image.height);
      const reduite = await createImageBitmap(image, { resizeWidth: Math.floor(image.width * e), resizeHeight: Math.floor(image.height * e), resizeQuality: "high" });
      image.close();
      image = reduite;
    }
    // Rendu juste assez grand pour que la partie imprimée ait la taille voulue.
    const g = geometrie(img.retouche, image.width, image.height);
    const largeurVoulue = img.largeurPx / f.l;
    const cote = Math.min(max, Math.ceil(g.ratio >= 1 ? largeurVoulue : largeurVoulue / g.ratio) + 2);
    m.charger(image);
    const [l, h] = m.rendre(img.retouche, cote);
    ctx.drawImage(m.canevas, f.x * l, f.y * h, f.l * l, f.h * h, 0, 0, img.largeurPx, img.hauteurPx);
  }
  image.close();
  return sortie.convertToBlob({ type: "image/jpeg", quality: 0.92 });
}

/** Prépare et envoie toutes les images, deux à la fois. */
export async function preparerImages(images: ImageAPreparer[], progres: (fait: number) => void, signal?: AbortSignal) {
  let fait = 0;
  const file = [...images];
  async function ouvrier() {
    for (;;) {
      if (signal?.aborted) throw new DOMException("Interrompu", "AbortError");
      const img = file.shift();
      if (!img) return;
      const jpeg = await fabriquer(img);
      await avecReprises(async () => {
        const r = await fetch(img.urlEnvoi, { method: "PUT", body: jpeg, headers: { "content-type": "image/jpeg" } });
        if (!r.ok) throw new Error(`Envoi refusé (${r.status})`);
      });
      progres(++fait);
    }
  }
  await Promise.all([ouvrier(), ouvrier()]);
}

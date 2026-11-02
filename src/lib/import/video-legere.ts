"use client";

/**
 * Version allégée d'une vidéo pour le site : 720p (côté long 1280 px), H.264 + AAC, MP4 « faststart ».
 * Encodage matériel dans le navigateur (WebCodecs, via Mediabunny). Si l'appareil ne sait pas faire,
 * l'original est conservé et la version allégée sera produite plus tard par une tâche par lots.
 */
export async function versionLegere(f: Blob, largeur: number | null, hauteur: number | null, progression?: (p: number) => void) {
  if (typeof VideoEncoder === "undefined") return null;
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(f) });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const paysage = (largeur ?? 16) >= (hauteur ?? 9);
  const grand = Math.max(largeur ?? 0, hauteur ?? 0) > 1280;
  const conversion = await Conversion.init({
    input,
    output,
    video: {
      ...(grand ? (paysage ? { width: 1280 } : { height: 1280 }) : {}),
      codec: "avc",
      bitrate: 2_500_000,
      frameRate: 30,
    },
    audio: { codec: "aac", bitrate: 128_000 },
  });
  if (!conversion.isValid) return null;
  conversion.onProgress = (p) => progression?.(p);
  await conversion.execute();
  const tampon = output.target.buffer;
  return tampon ? new Blob([tampon], { type: "video/mp4" }) : null;
}

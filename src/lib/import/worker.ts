/// <reference lib="webworker" />
import { analyserPhoto } from "./analyse";

/** Analyse des photos hors du fil principal : l'interface reste fluide pendant un gros import. */
self.onmessage = async (e: MessageEvent<{ id: string; fichier: File }>) => {
  const { id, fichier } = e.data;
  try {
    const resultat = await analyserPhoto(fichier, (p) => self.postMessage({ id, progression: p }));
    self.postMessage({ id, resultat });
  } catch (err) {
    self.postMessage({ id, erreur: err instanceof Error ? err.message : "Analyse impossible" });
  }
};

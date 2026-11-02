"use client";

import { Unzip, UnzipInflate } from "fflate";

/**
 * Extrait les fichiers d'une archive .zip en flux (sans charger l'archive entière en mémoire),
 * en ne gardant que ceux que `garder` accepte.
 */
export async function extraireZip(zip: Blob, garder: (nom: string) => boolean): Promise<File[]> {
  const fichiers: File[] = [];
  const enCours: Promise<void>[] = [];
  const u = new Unzip();
  u.register(UnzipInflate);
  u.onfile = (f) => {
    const nom = f.name.split("/").pop() ?? f.name;
    if (!garder(f.name) || !garder(nom)) return;
    enCours.push(
      new Promise((ok, ko) => {
        const morceaux: Uint8Array<ArrayBuffer>[] = [];
        f.ondata = (err, donnees, fin) => {
          if (err) return ko(err);
          morceaux.push(new Uint8Array(donnees));
          if (fin) {
            fichiers.push(new File(morceaux, nom, { type: "" }));
            ok();
          }
        };
        f.start();
      }),
    );
  };
  const lecteur = zip.stream().getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) {
      u.push(new Uint8Array(0), true);
      break;
    }
    u.push(value);
  }
  await Promise.all(enCours);
  return fichiers;
}

/** Lit un fichier texte d'une archive (ex. _chat.txt de WhatsApp). */
export async function lireTexteZip(zip: Blob, correspond: (nom: string) => boolean): Promise<string | null> {
  const [f] = await extraireZip(zip, (n) => n.endsWith("/") || correspond(n.split("/").pop() ?? n));
  return f ? f.text() : null;
}

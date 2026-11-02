"use client";

/**
 * Export du site en archive .zip autonome, fabriquée dans le navigateur de l'administrateur :
 * index.html (styles et visionneuse intégrés), polices et photos à côté. Elle s'ouvre par
 * double-clic, sans serveur ni connexion. Rien ne transite par Vercel à part les données.
 */
import { createElement } from "react";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { Site } from "@/components/site/site";
import type { DonneesSite } from "./types";
import { installerVisionneuse } from "./visionneuse";

export type ProgresExport = { etape: string; fait: number; total: number };

type ReponseExport = { donnees: DonneesSite; fichiers: { chemin: string; url: string }[] };

const encodeur = new TextEncoder();

/** Styles de la page courante (thèmes du site compris), polices rapatriées dans l'archive. */
async function stylesEtPolices(): Promise<{ css: string; polices: { chemin: string; url: string }[] }> {
  let css = "";
  const polices = new Map<string, string>();
  for (const feuille of [...document.styleSheets]) {
    let texte: string;
    try {
      texte = [...feuille.cssRules].map((r) => r.cssText).join("\n");
    } catch {
      continue; // feuille d'une autre origine : ignorée
    }
    // Les adresses des polices sont relatives à la feuille de style, pas à la page.
    const base = feuille.href ?? location.href;
    css +=
      texte.replace(/url\(\s*["']?([^"')]+\.(?:woff2?|ttf|otf))["']?\s*\)/g, (_, url: string) => {
        const absolu = new URL(url, base).href;
        const chemin = `polices/${absolu.split("/").pop()}`;
        polices.set(chemin, absolu);
        return `url("${chemin}")`;
      }) + "\n";
  }
  return { css, polices: [...polices].map(([chemin, url]) => ({ chemin, url })) };
}

function nomArchive(d: DonneesSite) {
  return `${d.slug}-site.zip`;
}

export async function exporterSite(
  slug: string,
  o: { videos: boolean; classesPolices: string; onProgres: (p: ProgresExport) => void },
) {
  o.onProgres({ etape: "Préparation", fait: 0, total: 1 });
  const rep = await fetch(`/api/voyages/${slug}/site/export${o.videos ? "?videos=1" : ""}`);
  const json = (await rep.json()) as ReponseExport | { erreur: string };
  if ("erreur" in json) throw new Error(json.erreur);
  const { donnees, fichiers } = json;

  const { renderToStaticMarkup } = await import("react-dom/server");
  const corps = renderToStaticMarkup(createElement(Site, { d: donnees, enLigne: false }));
  const { css, polices } = await stylesEtPolices();
  const classes = `${document.documentElement.className} ${o.classesPolices}`;
  const html = `<!doctype html>
<html lang="fr" class="${classes}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${donnees.nom.replace(/[<&>"]/g, (c) => `&#${c.charCodeAt(0)};`)}</title>
<link rel="stylesheet" href="styles.css">
</head>
<body class="flex min-h-full flex-col">
<div class="flex flex-1 flex-col ${o.classesPolices}">${corps}</div>
<script>(${installerVisionneuse.toString()})(document);</script>
</body>
</html>`;

  // Écriture en flux : directement sur le disque si le navigateur le permet, sinon en mémoire.
  const fenetre = window as unknown as {
    showSaveFilePicker?: (o: object) => Promise<{ createWritable(): Promise<FileSystemWritableFileStream> }>;
  };
  let flux: FileSystemWritableFileStream | null = null;
  if (fenetre.showSaveFilePicker) {
    try {
      const f = await fenetre.showSaveFilePicker({
        suggestedName: nomArchive(donnees),
        types: [{ description: "Archive zip", accept: { "application/zip": [".zip"] } }],
      });
      flux = await f.createWritable();
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
    }
  }

  const morceaux: Uint8Array[] = [];
  let ecriture = Promise.resolve();
  let fin!: () => void;
  let echec!: (e: unknown) => void;
  const termine = new Promise<void>((ok, ko) => ((fin = ok), (echec = ko)));
  const zip = new Zip((err, donneesZip, dernier) => {
    if (err) return echec(err);
    if (flux) {
      const f = flux;
      ecriture = ecriture.then(() => f.write(donneesZip as Uint8Array<ArrayBuffer>));
    } else morceaux.push(donneesZip);
    if (dernier) ecriture.then(fin, echec);
  });

  function ajouter(chemin: string, contenu: Uint8Array, compresser: boolean) {
    const f = compresser ? new ZipDeflate(chemin, { level: 6 }) : new ZipPassThrough(chemin);
    zip.add(f);
    f.push(contenu, true);
  }

  ajouter("index.html", encodeur.encode(html), true);
  ajouter("styles.css", encodeur.encode(css), true);
  ajouter(
    "LISEZ-MOI.txt",
    encodeur.encode(
      `${donnees.nom}\r\n\r\nOuvrez « index.html » dans votre navigateur (double-clic).\r\nAucune connexion n'est nécessaire.\r\n\r\nArchive créée avec Clic-Clac Voyage.\r\n`,
    ),
    true,
  );

  const aTelecharger = [...polices, ...fichiers];
  let fait = 0;
  const file = [...aTelecharger];
  const manquants: string[] = [];
  async function ouvrier() {
    for (;;) {
      const f = file.shift();
      if (!f) return;
      try {
        const r = await fetch(f.url);
        if (!r.ok) throw new Error(String(r.status));
        ajouter(f.chemin, new Uint8Array(await r.arrayBuffer()), false);
      } catch {
        manquants.push(f.chemin);
      }
      o.onProgres({ etape: "Téléchargement des photos", fait: ++fait, total: aTelecharger.length });
    }
  }
  await Promise.all([ouvrier(), ouvrier(), ouvrier(), ouvrier()]);
  zip.end();
  await termine;

  if (flux) {
    await flux.close();
  } else {
    const blob = new Blob(morceaux as BlobPart[], { type: "application/zip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nomArchive(donnees);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  }
  return { manquants: manquants.length, total: aTelecharger.length };
}

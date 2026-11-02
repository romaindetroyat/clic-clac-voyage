// Génère les icônes PNG de la PWA à partir de scripts/icones.svg (à relancer si le dessin change).
// Usage : node scripts/generer-icones.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("./icones.svg", import.meta.url), "utf8");
const tailles = [
  { fichier: "public/icones/192.png", px: 192 },
  { fichier: "public/icones/512.png", px: 512 },
  { fichier: "public/icones/maskable-512.png", px: 512, marge: 0.12 },
  { fichier: "src/app/apple-icon.png", px: 180 },
  { fichier: "src/app/icon.png", px: 64 },
];

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
for (const t of tailles) {
  await page.setViewportSize({ width: t.px, height: t.px });
  const m = (t.marge ?? 0) * t.px;
  await page.setContent(
    `<html><body style="margin:0;background:#1d1b18"><div style="padding:${m}px;width:${t.px - 2 * m}px;height:${t.px - 2 * m}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body></html>`,
  );
  await page.screenshot({ path: t.fichier, omitBackground: false });
  console.log("écrit", t.fichier);
}
await navigateur.close();

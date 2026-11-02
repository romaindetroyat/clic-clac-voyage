import { readFileSync } from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { expect, test } from "@playwright/test";
import { seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);
// Positions précises des photos de test : elles ne doivent apparaître nulle part dans le site.
const PRECISES = ["37.105", "25.376", "37.085", "25.149", "37,105", "25,376"];

test("site du voyage : réglages, lien secret, carte arrondie, visionneuse, hors ligne, export .zip", async ({ browser }, info) => {
  test.setTimeout(240_000);
  const admin = await browser.newContext({ ...info.project.use, acceptDownloads: true });
  const page = await admin.newPage();
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Site Cyclades");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/site-cyclades$/);

  await page.goto("/voyages/site-cyclades/importer");
  await page
    .getByTestId("choisir-fichiers")
    .setInputFiles([F("IMG_0001.jpg"), F("IMG_0002.jpg"), F("NAXOS_GPS.jpg"), F("PAROS_GPS.jpg"), F("VID_0001.mp4")]);
  await expect(page.getByTestId("bilan-envoi")).toHaveText(/^5 envoyés$/, { timeout: 90_000 });

  // Trois journées éloignées : trois épisodes.
  await page.goto("/voyages/site-cyclades/recit");
  await page.getByRole("button", { name: "Proposer un découpage en épisodes" }).click();
  await expect(page.getByTestId("episode")).toHaveCount(3);

  // Réglages du site.
  await page.goto("/voyages/site-cyclades/site");
  await page.getByRole("radio", { name: /Mer et îles/ }).click();
  await page.getByLabel("Sous-titre").fill("Deux semaines dans les Cyclades");
  await page.getByLabel("Texte de présentation").fill("Un été entre amis, d’île en île.");
  await page.getByRole("checkbox", { name: "Galerie complète" }).check();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
  await page.getByLabel(/Présentation de « .*6 août/).selectOption("plein-ecran");

  // Lien secret pour un lecteur.
  await page.goto("/voyages/site-cyclades/partage");
  await page.getByLabel("Pour qui ?").fill("La famille");
  await page.getByRole("button", { name: "Créer le lien" }).click();
  const lien = (await page.getByTestId("lien-secret").textContent())!.trim();

  const lecteur = await browser.newContext(info.project.use);
  const pl = await lecteur.newPage();
  await pl.goto(lien);
  await expect(pl).toHaveURL(/\/v\/site-cyclades$/);
  await expect(pl.getByRole("heading", { level: 1, name: "Site Cyclades" })).toBeVisible();
  await expect(pl.getByText("Deux semaines dans les Cyclades")).toBeVisible();
  await expect(pl.getByText("Un été entre amis, d’île en île.")).toBeVisible();
  await expect(pl.getByRole("heading", { name: "L’itinéraire" })).toBeVisible();
  await expect(pl.getByRole("img", { name: "Itinéraire en 2 étapes" })).toBeVisible();
  await expect(pl.getByText("Épisode 3")).toBeVisible();
  await expect(pl.getByRole("heading", { name: "Le voyage en chiffres" })).toBeVisible();

  // Aucune position précise dans le HTML.
  const html = await pl.content();
  for (const p of PRECISES) expect(html).not.toContain(p);

  // Visionneuse : ouverture, photo suivante, fermeture par le bouton retour.
  await pl.locator("#episode-1 [data-media]").first().click();
  const v = pl.getByRole("dialog", { name: "Visionneuse" });
  await expect(v).toBeVisible();
  await expect(v.getByText("1 / 3")).toBeVisible();
  await pl.keyboard.press("ArrowRight");
  await expect(v.getByText("2 / 3")).toBeVisible();
  await pl.goBack();
  await expect(v).toHaveCount(0);
  await expect(pl).toHaveURL(/\/v\/site-cyclades$/);

  // Les images servies sont des versions web, sans EXIF (donc sans GPS).
  const id = await pl.locator("#episode-2 [data-media]").first().getAttribute("data-media");
  const image = await pl.request.get(`/v/site-cyclades/m/${id}/m`);
  expect(image.ok()).toBe(true);
  const octets = await image.body();
  expect(octets.subarray(0, 4).toString()).toBe("RIFF");
  expect(octets.includes(Buffer.from("Exif"))).toBe(false);
  // Un inconnu n'obtient rien.
  const inconnu = await browser.newContext();
  expect((await inconnu.request.get(`/v/site-cyclades/m/${id}/m`, { maxRedirects: 0 })).status()).toBe(404);
  await inconnu.close();

  // Hors ligne : on garde tout le site, puis on coupe le réseau.
  await pl.evaluate(() => navigator.serviceWorker.ready);
  await pl.reload();
  await pl.getByRole("button", { name: "Garder ce site pour le lire hors ligne" }).click();
  await expect(pl.getByText("Le site est disponible hors ligne sur cet appareil.")).toBeVisible({ timeout: 30_000 });
  await lecteur.setOffline(true);
  await pl.reload();
  await expect(pl.getByRole("heading", { level: 1, name: "Site Cyclades" })).toBeVisible();
  const chargees = await pl.locator("#episode-1 img").evaluateAll((imgs) =>
    Promise.all(
      (imgs as HTMLImageElement[]).map((i) => {
        i.loading = "eager";
        return i.decode().then(() => i.naturalWidth, () => 0);
      }),
    ),
  );
  expect(chargees.every((w) => w > 0)).toBe(true);
  await lecteur.setOffline(false);
  await lecteur.close();

  // Export .zip (sans sélecteur de fichier : téléchargement classique).
  await page.addInitScript(() => {
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });
  await page.goto("/voyages/site-cyclades/site");
  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter le site en .zip" }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toBe("site-cyclades-site.zip");
  const chemin = info.outputPath("site.zip");
  await fichier.saveAs(chemin);
  await expect(page.getByText(/Archive créée/)).toBeVisible();

  const archive = unzipSync(new Uint8Array(readFileSync(chemin)));
  const index = strFromU8(archive["index.html"]);
  expect(index).toContain("Site Cyclades");
  for (const p of PRECISES) expect(index).not.toContain(p);
  const medias = Object.keys(archive).filter((n) => n.startsWith("medias/"));
  expect(medias.length).toBeGreaterThanOrEqual(8);
  for (const n of medias) expect(index.includes(n) || n.endsWith("-s.webp")).toBe(true);
  expect(Object.keys(archive).some((n) => n.startsWith("polices/"))).toBe(true);
});

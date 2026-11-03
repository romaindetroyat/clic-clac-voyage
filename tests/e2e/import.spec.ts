import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test.describe.configure({ mode: "serial" });

async function attendreFinEnvoi(page: Page, attendu: RegExp) {
  await expect(page.getByTestId("bilan-envoi")).toHaveText(attendu, { timeout: 60_000 });
}

test("import : photos, vidéo, gros fichier en morceaux, doublons, recalage d'horloge", async ({ page }) => {
  test.setTimeout(180_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Import Naxos");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/import-naxos$/);

  // Un gros fichier (> 32 Mo) passe par l'envoi en plusieurs morceaux.
  mkdirSync(".data/e2e", { recursive: true });
  const gros = ".data/e2e/GROS_0001.mov";
  writeFileSync(gros, randomBytes(40 * 1024 * 1024));

  await page.goto("/voyages/import-naxos/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([
    F("IMG_0001.jpg"),
    F("IMG_0002.jpg"),
    F("DSCF1234.jpg"),
    F("VID_0001.mp4"),
    gros,
  ]);
  await expect(page.getByRole("status")).toContainText("5 fichiers ajoutés");
  await attendreFinEnvoi(page, /^5 envoyés$/);

  // Doublons : la même photo renvoyée sous un autre nom, et sa copie WhatsApp.
  await page.getByTestId("choisir-fichiers").setInputFiles([F("copie-de-IMG_0001.jpg"), F("IMG-20260803-WA0001.jpg")]);
  await attendreFinEnvoi(page, /^6 envoyés · 1 déjà présent$/);

  // Galerie : la copie WhatsApp est écartée, l'ordre suit l'heure des appareils (Fuji en retard).
  await page.goto("/voyages/import-naxos/photos");
  await expect(page.getByTestId("compte-medias")).toHaveText(/^3 photos · 2 vidéos/);
  const ordre = async () =>
    (await page.locator("button[aria-label^='Photo'], button[aria-label^='Vidéo']").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label"))))
      .map((l) => l!.replace(/^(Photo|Vidéo) /, ""))
      .filter((n) => n.startsWith("IMG_") || n.startsWith("DSCF") || n.startsWith("VID"));
  // Heures réelles : Fuji 10:00 UTC (à tort), iPhone 11:00 et 11:30, vidéo 11:45.
  expect(await ordre()).toEqual(["DSCF1234.jpg", "IMG_0001.jpg", "IMG_0002.jpg", "VID_0001.mp4"]);
  await expect(page.locator("img[src*='/medias/']").first()).toBeVisible();

  // L'appareil Fujifilm retardait de 1 h 12 : on le recale, ses photos se replacent.
  await page.goto("/voyages/import-naxos/appareils");
  const fuji = page.getByRole("listitem").filter({ hasText: "X-T5" });
  await fuji.getByLabel(/Décalage de/).fill("+1 h 12");
  await fuji.getByRole("button", { name: "Recaler" }).click();
  await expect(page.getByText("Décalage enregistré : +1 h 12 min.")).toBeVisible();
  await page.goto("/voyages/import-naxos/photos");
  expect(await ordre()).toEqual(["IMG_0001.jpg", "DSCF1234.jpg", "IMG_0002.jpg", "VID_0001.mp4"]);
});

test("l'envoi reprend après une coupure réseau", async ({ page, context }) => {
  test.setTimeout(120_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.goto("/voyages/import-naxos/importer");
  const gros = ".data/e2e/GROS_0002.mov";
  writeFileSync(gros, randomBytes(48 * 1024 * 1024));

  // Coupe le réseau dès le premier morceau envoyé.
  let coupe = false;
  await page.route("**/api/stockage-local**", async (route) => {
    if (!coupe && route.request().method() === "PUT" && route.request().url().includes("j=")) {
      coupe = true;
      await route.continue();
      await context.setOffline(true);
      return;
    }
    await route.continue();
  });
  await page.getByTestId("choisir-fichiers").setInputFiles([gros]);
  await expect(page.getByText(/Pas de réseau/)).toBeVisible({ timeout: 30_000 });

  // Fermeture de l'app pendant la coupure, puis retour du réseau et réouverture.
  await context.setOffline(false);
  await page.unroute("**/api/stockage-local**");
  await page.reload();
  await expect(page.getByTestId("bilan-envoi")).toHaveText(/1 envoyé/, { timeout: 60_000 });
});

test("archive WhatsApp : dates de la discussion, puis l'original remplace la copie", async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.goto("/voyages");
  await page.getByLabel("Nom").fill("Groupe WhatsApp");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/groupe-whatsapp$/);

  await page.goto("/voyages/groupe-whatsapp/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("Discussion WhatsApp avec Naxos.zip")]);
  await expect(page.getByRole("status")).toContainText("2 photos ou vidéos WhatsApp ajoutées");
  await attendreFinEnvoi(page, /^2 envoyés$/);

  await page.goto("/voyages/groupe-whatsapp/photos");
  await expect(page.getByTestId("compte-medias")).toHaveText(/^2 photos/);
  // Dates tirées de la discussion : 3 et 4 août.
  await expect(page.getByRole("heading", { name: /3 août 2026/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /4 août 2026/i })).toBeVisible();

  // L'original arrive : il remplace la copie WhatsApp.
  await page.goto("/voyages/groupe-whatsapp/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("IMG_0001.jpg")]);
  await attendreFinEnvoi(page, /^3 envoyés$/);
  await page.goto("/voyages/groupe-whatsapp/photos");
  await expect(page.getByTestId("compte-medias")).toHaveText(/^2 photos/);
  await expect(page.getByRole("button", { name: "Photo IMG_0001.jpg" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Photo IMG-20260803-WA0001.jpg" })).toHaveCount(0);
});

test("vidéo : affiche et version allégée lisible", async ({ page }) => {
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.goto("/voyages/import-naxos/photos");
  await page.getByRole("button", { name: "Vidéo VID_0001.mp4" }).click();
  const encodeur = await page.evaluate(() => typeof VideoEncoder !== "undefined");
  test.info().annotations.push({ type: "encodeur", description: String(encodeur) });
  await expect(page.locator("video, [role=dialog] img").first()).toBeVisible();
});

test("économie de données : les gros fichiers attendent le Wi-Fi ou un feu vert", async ({ page }) => {
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.goto("/voyages/groupe-whatsapp/importer");
  await page.getByLabel(/Économiser les données mobiles/).check();
  const gros = ".data/e2e/VIDEO_LOURDE.mov";
  writeFileSync(gros, randomBytes(6 * 1024 * 1024));
  await page.getByTestId("choisir-fichiers").setInputFiles([gros, F("DSCF1234.jpg")]);
  await expect(page.getByText("1 fichier en attente du Wi-Fi")).toBeVisible();
  // La petite photo, elle, part tout de suite.
  await attendreFinEnvoi(page, /^1 envoyé · 1 en cours$/);
  await page.getByRole("button", { name: "Envoyer maintenant" }).click();
  await attendreFinEnvoi(page, /^2 envoyés$/);
  await page.getByLabel(/Économiser les données mobiles/).uncheck();
});

test("HEIC (iPhone) : vignette générée dans le navigateur", async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Photos iPhone");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/photos-iphone$/);
  await page.goto("/voyages/photos-iphone/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("IMG_0003.HEIC")]);
  await attendreFinEnvoi(page, /^1 envoyé$/);
  await expect(page.getByText("Aperçu impossible")).toHaveCount(0);

  await page.goto("/voyages/photos-iphone/photos");
  const vignette = page.getByRole("button", { name: "Photo IMG_0003.HEIC" }).locator("img");
  await expect(vignette).toBeVisible();
  await expect.poll(() => vignette.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
});

test("photos importées sans aperçu : l'aperçu est recréé depuis l'original", async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  // Simule un ancien import sans versions web : la déclaration part sans « versions ».
  await page.route("**/api/voyages/photos-iphone/envois", async (route) => {
    const corps = route.request().postDataJSON();
    await route.continue({ postData: JSON.stringify({ ...corps, versions: [] }) });
  });
  await page.goto("/voyages/photos-iphone/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("RAFALE_1.jpg")]);
  await attendreFinEnvoi(page, /^1 envoyé$/);
  await page.unroute("**/api/voyages/photos-iphone/envois");

  await page.goto("/voyages/photos-iphone/photos");
  const bloc = page.getByTestId("apercus-manquants");
  await expect(bloc).toContainText("1 photo sans aperçu");
  await bloc.getByRole("button", { name: "Créer les aperçus manquants" }).click();
  // Une fois tout réparé, l'encadré disparaît.
  await expect(page.getByTestId("apercus-manquants")).toHaveCount(0, { timeout: 60_000 });
  const vignette = page.getByRole("button", { name: "Photo RAFALE_1.jpg" }).locator("img");
  await expect.poll(() => vignette.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
});

test("dates : HEIC d'iPhone datée à l'import, capture d'écran datée à la main", async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.goto("/voyages/photos-iphone/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("IMG_0004.HEIC"), F("Capture_ecran.png")]);
  await attendreFinEnvoi(page, /^\d+ envoyés$/);

  await page.goto("/voyages/photos-iphone/photos");
  // La HEIC garde sa date EXIF (3 août, 14 h à Naxos) ; la capture n'en a pas.
  await page.getByRole("button", { name: "Photo IMG_0004.HEIC" }).click();
  await expect(page.getByRole("dialog")).toContainText("3 août");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("sans-date")).toContainText("1 photo ou vidéo sans date");

  await page.getByRole("link", { name: "Leur donner une date" }).click();
  await expect(page.getByRole("heading", { name: "Dates à fixer" })).toBeVisible();
  await page.getByRole("button", { name: "Photo Capture_ecran.png" }).click();
  await page.getByLabel("Heure").fill("18:30");
  await page.getByRole("group", { name: "Jours du voyage" }).getByRole("button", { name: /3 août/ }).click();
  await expect(page.getByRole("status")).toContainText("Toutes les photos et vidéos ont une date.");

  await page.goto("/voyages/photos-iphone/photos");
  await expect(page.getByTestId("sans-date")).toHaveCount(0);
  await page.getByRole("button", { name: "Photo Capture_ecran.png" }).click();
  await expect(page.getByRole("dialog")).toContainText("(date estimée)");
});

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
  await expect(page.locator("img[src*='stockage-local']").first()).toBeVisible();

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

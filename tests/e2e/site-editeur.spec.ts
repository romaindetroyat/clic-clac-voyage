import path from "node:path";
import { expect, test } from "@playwright/test";
import { seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test("site : éditeur visuel (disposition, recadrage, légende, annulation), visible sur le site", async ({ page }) => {
  test.setTimeout(180_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Site Visuel");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/site-visuel$/);
  await page.goto("/voyages/site-visuel/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("IMG_0001.jpg"), F("IMG_0002.jpg"), F("DSCF1234.jpg"), F("NAXOS_GPS.jpg")]);
  await expect(page.getByTestId("bilan-envoi")).toHaveText(/^4 envoyés$/, { timeout: 90_000 });

  // Depuis les réglages du site.
  await page.goto("/voyages/site-visuel/site");
  await page.getByRole("link", { name: "Modifier le site visuellement" }).click();
  await expect(page).toHaveURL(/\/site\/editer$/);
  await expect(page.locator("[data-edition-bloc]").first()).toBeVisible();

  // Un bloc : changer sa disposition.
  const bloc = page.locator("[data-edition-bloc]").first();
  await bloc.dispatchEvent("click");
  await page.getByRole("button", { name: "Disposition : Défilement" }).first().click();
  await expect(page.getByRole("button", { name: "Disposition : Défilement" }).first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "Enregistré" })).toBeVisible();

  // Une photo : recadrer en carré et zoomer.
  const photo = page.locator("[data-edition-bloc] [data-edition-media]").first();
  const id = await photo.getAttribute("data-edition-media");
  await photo.click();
  await page.getByRole("toolbar", { name: "Outils de la photo" }).getByRole("button", { name: /Recadrer/ }).click();
  await expect(page.getByTestId("recadreur")).toBeVisible();
  await page.getByRole("radio", { name: "1:1" }).click();
  await page.getByRole("slider", { name: "Zoom" }).fill("2");
  await page.getByRole("button", { name: "Terminé" }).click();
  const img = page.locator(`[data-edition-media="${id}"] img`);
  await expect(img).toHaveAttribute("style", /scale\(2\)/);

  // Annuler puis rétablir le zoom.
  await page.getByRole("button", { name: "↶ Annuler" }).click();
  await expect(img).not.toHaveAttribute("style", /scale\(2\)/);
  await page.getByRole("button", { name: "↷ Rétablir" }).click();
  await expect(img).toHaveAttribute("style", /scale\(2\)/);

  // Une légende écrite sur place.
  await page.getByRole("button", { name: "Ajouter une légende" }).first().click();
  await page.getByRole("textbox", { name: "Légende de la photo" }).fill("Le port de Naxos au matin");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Le port de Naxos au matin")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Enregistré" })).toBeVisible();
  await page.waitForTimeout(1200);

  // Tout est gardé, et le site des lecteurs suit.
  await page.reload();
  await expect(page.locator(`[data-edition-media="${id}"] img`)).toHaveAttribute("style", /scale\(2\)/);
  await expect(page.getByText("Le port de Naxos au matin")).toBeVisible();
  await page.goto("/v/site-visuel");
  await expect(page.locator(`[data-media="${id}"] img`).first()).toHaveAttribute("style", /scale\(2\)/);
  await expect(page.getByText("Le port de Naxos au matin")).toBeVisible();
  await expect(page.locator(".s-defilement").first()).toBeVisible();
});

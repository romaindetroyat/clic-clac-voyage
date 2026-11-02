import path from "node:path";
import { expect, test } from "@playwright/test";
import { seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test("rafales : la photo nette est proposée, un clic en préfère une autre", async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Rafales");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/rafales$/);
  await page.goto("/voyages/rafales/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("RAFALE_1.jpg"), F("RAFALE_2.jpg"), F("RAFALE_3.jpg"), F("IMG_0001.jpg")]);
  await expect(page.getByTestId("bilan-envoi")).toHaveText(/^4 envoyés$/, { timeout: 60_000 });

  await page.goto("/voyages/rafales/recit/rafales");
  await page.getByRole("button", { name: "Rechercher les rafales" }).click();
  await expect(page.getByText("1 rafale trouvée.")).toBeVisible();
  await expect(page.getByTestId("rafale")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "RAFALE_2.jpg (retenue)" })).toBeVisible();

  await page.getByRole("button", { name: "RAFALE_3.jpg" }).click();
  await expect(page.getByRole("button", { name: "RAFALE_3.jpg (retenue)" })).toBeVisible();

  // Dans la galerie, les photos écartées sont signalées (ni site ni livre).
  await page.goto("/voyages/rafales/photos");
  await expect(page.getByRole("button", { name: "Photo RAFALE_1.jpg" })).toHaveClass(/opacity-40/);
  await expect(page.getByRole("button", { name: "Photo RAFALE_3.jpg" })).not.toHaveClass(/opacity-40/);
});

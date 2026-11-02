import path from "node:path";
import { expect, test } from "@playwright/test";
import { seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test("livre : mise en page automatique, édition, contrôles, versions, feuilletage", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("dialog", (d) => (d.type() === "prompt" ? d.accept("Ma version") : d.accept()));
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Livre Cyclades");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/livre-cyclades$/);
  await page.goto("/voyages/livre-cyclades/importer");
  await page
    .getByTestId("choisir-fichiers")
    .setInputFiles([F("IMG_0001.jpg"), F("IMG_0002.jpg"), F("DSCF1234.jpg"), F("NAXOS_GPS.jpg"), F("PAROS_GPS.jpg"), F("RAFALE_2.jpg")]);
  await expect(page.getByTestId("bilan-envoi")).toHaveText(/^6 envoyés$/, { timeout: 90_000 });
  await page.goto("/voyages/livre-cyclades/recit");
  await page.getByRole("button", { name: "Proposer un découpage en épisodes" }).click();
  await expect(page.getByTestId("episode")).toHaveCount(3);

  // Mise en page automatique sur 24 pages (le minimum du format).
  await page.getByRole("link", { name: "Livre" }).click();
  await expect(page.getByText("6 photos cochées « Dans le livre »")).toBeVisible();
  await page.getByLabel("Nombre de pages visé").fill("24");
  await page.getByRole("button", { name: "Créer le livre automatiquement" }).click();
  await expect(page.getByText(/page\(s\) blanche\(s\) ajoutée\(s\)/)).toBeVisible();
  await expect(page.getByText("24 pages · dos")).toBeVisible();
  await expect(page.locator("[data-page]")).toHaveCount(25); // couverture + 24 pages
  await expect(page.locator('[data-page="1"]')).toContainText("Livre Cyclades");
  await expect(page.getByRole("status").filter({ hasText: "Enregistré" })).toBeVisible();

  // Les photos de test (1 600 px) sont trop petites pour une page entière : contrôle bloquant.
  await expect(page.getByRole("button", { name: /problèmes? bloquants?/ })).toBeVisible();

  // Page 2 (ouverture d'épisode) : titre modifié, gabarit changé.
  await page.locator('[data-page="2"]').click();
  await expect(page.getByRole("heading", { name: "Page 2" })).toBeVisible();
  await page.getByRole("textbox", { name: "Titre", exact: true }).fill("Arrivée à Naxos");
  await expect(page.locator('[data-page="2"]')).toContainText("Arrivée à Naxos");
  await page.locator('[data-page="3"]').click();
  await page.getByRole("radio", { name: "Deux côte à côte" }).click();
  await expect(page.locator('[data-page="3"] [data-cellule]')).toHaveCount(2);

  // Recadrage d'une photo et échange entre deux pages.
  await page.locator('[data-page="2"] [data-cellule="0"]').click();
  await page.getByLabel(/Agrandir/).fill("2");
  await expect(page.getByText(/Résolution : \d+ dpi/)).toBeVisible();
  const avant = await page.locator('[data-page="2"] [data-cellule="0"] img').getAttribute("src");
  await page.getByRole("button", { name: "Échanger" }).click();
  await page.locator('[data-page="3"] [data-cellule="0"]').click();
  await expect(page.locator('[data-page="3"] [data-cellule="0"] img')).toHaveAttribute("src", avant!);
  expect(await page.locator('[data-page="2"] [data-cellule="0"] img').getAttribute("src")).not.toBe(avant);

  // Annuler, puis enregistrement automatique conservé après rechargement.
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  expect(await page.locator('[data-page="2"] [data-cellule="0"] img').getAttribute("src")).toBe(avant);
  await expect(page.getByRole("status").filter({ hasText: "Enregistré" })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator('[data-page="2"]')).toContainText("Arrivée à Naxos");
  await expect(page.locator('[data-page="3"] [data-cellule]')).toHaveCount(2);

  // Versions : on en garde une, on modifie, on revient en arrière.
  await page.getByRole("button", { name: "Enregistrer une version" }).click();
  await expect(page.getByText("Version enregistrée.")).toBeVisible();
  await page.locator('[data-page="2"]').click();
  await page.getByRole("textbox", { name: "Titre", exact: true }).fill("Titre provisoire");
  await expect(page.getByRole("status").filter({ hasText: "Enregistré" })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Fermer" }).click();
  await page.getByRole("listitem").filter({ hasText: "Ma version" }).getByRole("button", { name: "Revenir" }).click();
  await expect(page.locator('[data-page="2"]')).toContainText("Arrivée à Naxos");

  // Aperçu feuilletable.
  await page.getByRole("button", { name: "Feuilleter" }).click();
  const f = page.getByRole("dialog", { name: "Feuilleter le livre" });
  await expect(f.getByText("Couverture · 1 / 14")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(f.getByText("Pages 1 · 2 / 14")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(f.getByText("Pages 2 – 3 · 3 / 14")).toBeVisible();
  await f.getByRole("button", { name: "Fermer" }).click();
  await expect(f).toHaveCount(0);
});

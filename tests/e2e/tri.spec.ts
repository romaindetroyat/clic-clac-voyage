import path from "node:path";
import { expect, test } from "@playwright/test";
import { seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test("tri : série comparée, décisions au clavier, annulation, retouche auto, tout trié", async ({ page }) => {
  test.setTimeout(180_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Tri Milos");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/tri-milos$/);
  await page.goto("/voyages/tri-milos/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("RAFALE_1.jpg"), F("RAFALE_2.jpg"), F("RAFALE_3.jpg"), F("IMG_0001.jpg"), F("IMG_0002.jpg")]);
  await expect(page.getByTestId("bilan-envoi")).toHaveText(/^5 envoyés$/, { timeout: 90_000 });

  await page.goto("/voyages/tri-milos/photos");
  await expect(page.getByTestId("appel-tri")).toContainText("5 photos ou vidéos à trier");
  await page.getByRole("link", { name: "Trier les photos" }).click();
  await expect(page.getByTestId("progression")).toContainText("5 photos à trier sur 5");

  // Sous chaque photo : Garder (vert), Non (rouge), Site, Livre. Annuler revient en arrière.
  await expect(page.getByTestId("planche")).toBeVisible();
  const choix = (nom: string) => page.getByRole("group", { name: `Choix pour ${nom}` });
  await choix("IMG_0002.jpg").getByRole("button", { name: "Ne pas garder" }).click();
  await expect(choix("IMG_0002.jpg").getByRole("button", { name: "Ne pas garder" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("progression")).toContainText("4 photos à trier sur 5");
  await page.getByRole("button", { name: /Annuler/ }).click();
  await expect(page.getByTestId("progression")).toContainText("5 photos à trier sur 5");
  await choix("IMG_0002.jpg").getByRole("button", { name: "Livre seulement" }).click();
  await expect(choix("IMG_0002.jpg").getByRole("button", { name: "Livre seulement" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("progression")).toContainText("4 photos à trier sur 5");

  // Photo agrandie : mêmes boutons ; après un choix, la photo suivante à trier s'affiche.
  await page.getByRole("button", { name: "Agrandir IMG_0001.jpg" }).click();
  const grande = page.getByRole("dialog");
  await expect(grande).toHaveAttribute("aria-label", "Photo IMG_0001.jpg");
  await grande.getByRole("button", { name: "Site seulement" }).click();
  await expect(page.getByTestId("progression")).toContainText("3 photos à trier sur 5");
  await expect(grande).not.toHaveAttribute("aria-label", "Photo IMG_0001.jpg");
  await expect(page.getByTestId("etat-agrandie")).toHaveText("À trier");

  // Retouche automatique depuis la photo agrandie, puis retour sur la même photo.
  await grande.getByRole("link", { name: /Retouche auto/ }).click();
  await expect(page.getByTestId("apercu-retouche")).toBeVisible();
  await expect
    .poll(async () => {
      const v = await Promise.all(["Lumière", "Contraste", "Noirs", "Blancs", "Température", "Teinte", "Saturation"].map((l) => page.getByLabel(l, { exact: true }).inputValue()));
      return v.some((x) => Number(x) !== 0);
    })
    .toBe(true);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/voyages\/tri-milos\/photos\/trier\?m=/, { timeout: 30_000 });
  await expect(page.getByRole("dialog")).toBeVisible();
  // Clavier : G garde la photo, Échap ferme.
  await page.keyboard.press("g");
  await expect(page.getByTestId("progression")).toContainText("2 photos à trier sur 5");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Le reste du groupe : la meilleure seulement, ou tout garder.
  for (let i = 0; i < 3 && !(await page.getByTestId("tri-fini").isVisible()); i++) {
    const groupe = page.getByTestId("groupe").first();
    const meilleure = groupe.getByRole("button", { name: /Garder seulement la meilleure/ });
    if (await meilleure.isVisible()) await meilleure.click();
    else await groupe.getByRole("button", { name: /Tout garder/ }).click();
  }
  await expect(page.getByTestId("tri-fini")).toContainText("Tout est trié");
  await expect(page.getByTestId("tri-fini")).toContainText("1 dans le livre seulement");

  // Les choix sont enregistrés : la page Photos le dit, et une photo écartée y est estompée.
  await page.goto("/voyages/tri-milos/photos");
  await expect(page.getByTestId("appel-tri")).toContainText("Tout est trié");
  await page.goto("/voyages/tri-milos/photos/trier");
  await expect(page.getByTestId("tri-fini")).toBeVisible();
});

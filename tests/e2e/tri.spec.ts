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

  // Vue par groupes (par défaut) : planche de vignettes ; un toucher garde une photo, Z annule.
  await expect(page.getByTestId("planche")).toBeVisible();
  await page.getByLabel("Regrouper").selectOption("2h");
  const groupes = page.getByTestId("groupe");
  await expect(groupes.first()).toContainText("photos");
  await page.getByRole("button", { name: "Photo IMG_0002.jpg" }).click();
  await expect(page.getByRole("button", { name: "Photo IMG_0002.jpg (gardée)" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("progression")).toContainText("4 photos à trier sur 5");
  await page.keyboard.press("z");
  await expect(page.getByTestId("progression")).toContainText("5 photos à trier sur 5");
  // « Tout garder » sur un groupe, puis annulation.
  await groupes.first().getByRole("button", { name: "Tout garder" }).click();
  await expect(page.getByTestId("progression")).not.toContainText("5 photos à trier sur 5");
  await page.getByRole("button", { name: /Annuler/ }).click();
  await expect(page.getByTestId("progression")).toContainText("5 photos à trier sur 5");

  // Vue une par une.
  await page.getByRole("button", { name: "Une par une" }).click();

  // Photo seule : on l'écarte (←), puis on annule (Z) : elle revient à trier.
  await expect(page.getByTestId("etat-media")).toHaveText("À trier");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("progression")).toContainText("4 photos à trier sur 5");
  await page.keyboard.press("z");
  await expect(page.getByTestId("progression")).toContainText("5 photos à trier sur 5");
  await expect(page.getByTestId("etat-media")).toHaveText("À trier");

  // Retouche automatique depuis le tri, puis retour au même endroit.
  await page.getByRole("link", { name: /Retouche auto/ }).click();
  await expect(page.getByTestId("apercu-retouche")).toBeVisible();
  // La retouche auto change au moins un réglage de lumière ou de couleur.
  await expect
    .poll(async () => {
      const v = await Promise.all(["Lumière", "Contraste", "Noirs", "Blancs", "Température", "Teinte", "Saturation"].map((l) => page.getByLabel(l, { exact: true }).inputValue()));
      return v.some((x) => Number(x) !== 0);
    })
    .toBe(true);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/voyages\/tri-milos\/photos\/trier\?m=/, { timeout: 30_000 });
  await expect(page.getByText(/retouchée/)).toBeVisible();

  // Site seulement (↓).
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("progression")).toContainText("4 photos à trier sur 5");

  // La suite : la rafale arrive en série (suggestion cochée, Entrée garde la sélection), la photo seule va au livre (→).
  const serie = page.getByRole("heading", { name: "3 photos semblables" });
  let series = 0;
  for (let i = 0; i < 4 && !(await page.getByTestId("tri-fini").isVisible()); i++) {
    await expect(page.getByTestId("etat-media").or(serie)).toBeVisible();
    if (await serie.isVisible()) {
      series++;
      await expect(page.getByTestId("suggestion")).toHaveCount(1);
      await expect(page.getByRole("button", { name: /Garder la sélection \(1\)/ })).toBeVisible();
      await page.keyboard.press("Enter");
    } else await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("tri-fini").or(page.getByTestId("etat-media")).or(serie)).toBeVisible();
  }
  expect(series).toBe(1);
  await expect(page.getByTestId("tri-fini")).toContainText("Tout est trié");
  await expect(page.getByTestId("tri-fini")).toContainText("2 écartées");

  // Les choix sont enregistrés : la page Photos le dit, et une photo écartée y est estompée.
  await page.goto("/voyages/tri-milos/photos");
  await expect(page.getByTestId("appel-tri")).toContainText("Tout est trié");
  await page.goto("/voyages/tri-milos/photos/trier");
  await expect(page.getByTestId("tri-fini")).toBeVisible();
});

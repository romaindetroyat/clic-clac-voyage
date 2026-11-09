import path from "node:path";
import { expect, test } from "@playwright/test";
import { seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test("retouche : noir et blanc enregistré, versions web retouchées partout, original intact", async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Retouches");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/retouches$/);
  await page.goto("/voyages/retouches/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("IMG_0002.jpg")]);
  await expect(page.getByTestId("bilan-envoi")).toHaveText(/^1 envoyé$/, { timeout: 60_000 });

  await page.goto("/voyages/retouches/photos");
  await page.getByRole("button", { name: "Photo IMG_0002.jpg" }).click();
  await page.getByRole("link", { name: "Retoucher" }).click();
  await expect(page.getByTestId("apercu-retouche")).toBeVisible();
  // L'aperçu reste à l'écran quand on descend jusqu'aux derniers réglages (téléphone, puis ordinateur).
  await page.getByLabel("Vignettage").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("apercu-retouche")).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Froid" }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 2000);
  await expect(page.getByTestId("apercu-retouche")).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Noir et blanc" }).click();
  await page.getByLabel("Lumière", { exact: true }).fill("0.3");
  await page.getByRole("button", { name: "Tourner à droite" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/voyages\/retouches\/photos$/, { timeout: 30_000 });

  // La vignette affichée est la version retouchée : en noir et blanc, et tournée (portrait).
  const vignette = page.locator("button[aria-label='Photo IMG_0002.jpg'] img");
  await expect(vignette).toBeVisible();
  const mesure = await vignette.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let ecart = 0;
    for (let i = 0; i < d.length; i += 4) ecart = Math.max(ecart, Math.abs(d[i] - d[i + 1]), Math.abs(d[i + 1] - d[i + 2]));
    return { ecart, portrait: img.naturalHeight > img.naturalWidth };
  });
  expect(mesure.ecart).toBeLessThanOrEqual(6); // gris (petits écarts dus à la compression WebP)
  expect(mesure.portrait).toBe(true);

  // Les réglages sont conservés et modifiables ; « Tout réinitialiser » revient à l'original.
  await page.getByRole("button", { name: "Photo IMG_0002.jpg" }).click();
  await page.getByRole("link", { name: "Modifier la retouche" }).click();
  await expect(page.getByRole("button", { name: "Noir et blanc" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Tout réinitialiser" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/voyages\/retouches\/photos$/, { timeout: 30_000 });
  await page.getByRole("button", { name: "Photo IMG_0002.jpg" }).click();
  await expect(page.getByRole("link", { name: "Retoucher" })).toBeVisible();
});

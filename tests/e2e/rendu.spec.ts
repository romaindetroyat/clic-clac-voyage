import { expect, test } from "@playwright/test";

test("retouches : le rendu GPU est identique au rendu de référence (ΔE)", async ({ page }) => {
  await page.goto("/verification-rendu");
  const bilan = page.getByTestId("bilan-rendu");
  await expect(page.getByText(/Rendu identique|Écarts détectés|Rendu GPU impossible/)).toBeVisible({ timeout: 30_000 });
  const resultats = JSON.parse((await page.getByTestId("resultats-rendu").getAttribute("data-json"))!) as {
    nom: string;
    moyen: number;
    p99: number;
    ok: boolean;
  }[];
  for (const r of resultats) test.info().annotations.push({ type: r.nom, description: `ΔE moyen ${r.moyen.toFixed(3)}, 99 % ${r.p99.toFixed(3)}` });
  expect(resultats.filter((r) => !r.ok)).toEqual([]);
  await expect(bilan).toHaveText("Rendu identique sur cet appareil.");
});

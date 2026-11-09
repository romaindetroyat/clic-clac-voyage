import path from "node:path";
import { expect, test } from "@playwright/test";
import { seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test("organiser : ordre dans la journée, site et livre, date corrigée, masquer, remplacer par une image modifiée", async ({ page }) => {
  test.setTimeout(180_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Organiser Naxos");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/organiser-naxos$/);
  await page.goto("/voyages/organiser-naxos/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("IMG_0001.jpg"), F("IMG_0002.jpg"), F("DSCF1234.jpg"), F("NAXOS_GPS.jpg")]);
  await expect(page.getByTestId("bilan-envoi")).toHaveText(/^4 envoyés$/, { timeout: 90_000 });

  await page.goto("/voyages/organiser-naxos/photos");
  await page.getByRole("link", { name: "Organiser photo par photo" }).click();
  await expect(page.getByTestId("organiseur")).toBeVisible();
  const journees = page.getByTestId("journee");
  await expect(journees).toHaveCount(2);
  const ordre = () => journees.first().getByTestId("fiche-photo").evaluateAll((l) => l.map((x) => x.getAttribute("aria-label")));
  const avant = await ordre();
  expect(avant).toHaveLength(3);

  // Descendre la première photo de la journée : l'ordre est gardé après rechargement.
  await page.getByRole("button", { name: `Descendre ${avant[0]!.replace("Photo ", "")}` }).click();
  await expect.poll(ordre).toEqual([avant[1], avant[0], avant[2]]);
  await page.reload();
  await expect.poll(ordre).toEqual([avant[1], avant[0], avant[2]]);

  // Cases Site et Livre.
  const livre = page.getByRole("checkbox", { name: "Livre : NAXOS_GPS.jpg" });
  await livre.click();
  await expect(livre).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: "Site : NAXOS_GPS.jpg" })).toHaveAttribute("aria-checked", "false");

  // Date corrigée : la photo rejoint la journée choisie.
  const naxos = page.getByRole("listitem", { name: "Photo NAXOS_GPS.jpg" });
  await naxos.getByLabel("Jour de NAXOS_GPS.jpg").fill("2026-08-03");
  await naxos.getByLabel("Heure de NAXOS_GPS.jpg").fill("18:00");
  await naxos.getByRole("button", { name: "Enregistrer la date" }).click();
  await expect(journees).toHaveCount(1);
  await expect(journees.first().getByTestId("fiche-photo")).toHaveCount(4);

  // Masquer, retrouver dans « Photos masquées », réafficher.
  await page.getByRole("listitem", { name: "Photo IMG_0002.jpg" }).getByRole("button", { name: "Masquer" }).click();
  await expect(page.getByRole("status")).toContainText("IMG_0002.jpg est masquée");
  await page.reload();
  await page.getByTestId("lien-masquees").click();
  await expect(page.getByRole("heading", { name: "Photos masquées" })).toBeVisible();
  await page.getByRole("listitem", { name: "Photo IMG_0002.jpg" }).getByRole("button", { name: "Réafficher" }).click();
  await expect(page.getByText("Aucune photo masquée.")).toBeVisible();

  // Remplacer par une image modifiée ailleurs, puis revenir à l'original.
  await page.goto("/voyages/organiser-naxos/photos/organiser");
  const img1 = page.getByRole("listitem", { name: "Photo IMG_0001.jpg" });
  await img1.getByLabel("Image modifiée pour IMG_0001.jpg").setInputFiles(F("Capture_ecran.png"));
  await expect(page.getByRole("status")).toContainText("IMG_0001.jpg est remplacée", { timeout: 30_000 });
  await expect(img1.getByText("Remplacée")).toBeVisible();
  await img1.getByRole("button", { name: "Revenir à l’original" }).click();
  await expect(page.getByRole("status")).toContainText("retour à la photo d’origine");
  await expect(img1.getByText("Remplacée")).toHaveCount(0);
});

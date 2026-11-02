import path from "node:path";
import { expect, test } from "@playwright/test";
import { seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test("récit : découpage, épisode, légende, commentaire, réaction, sélection, scission", async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecterParCode(page, "romain@exemple.fr");
  await page.getByLabel("Nom").fill("Récit Naxos");
  await page.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(page).toHaveURL(/\/voyages\/recit-naxos$/);
  await page.goto("/voyages/recit-naxos/importer");
  await page.getByTestId("choisir-fichiers").setInputFiles([F("IMG_0001.jpg"), F("IMG_0002.jpg"), F("DSCF1234.jpg"), F("VID_0001.mp4")]);
  await expect(page.getByTestId("bilan-envoi")).toHaveText(/^4 envoyés$/, { timeout: 60_000 });

  // Découpage automatique : une seule journée → un épisode.
  await page.goto("/voyages/recit-naxos/recit");
  await page.getByRole("button", { name: "Proposer un découpage en épisodes" }).click();
  await expect(page.getByTestId("episode")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Lundi 3 août" })).toBeVisible();

  // Titre, lieu et récit.
  await page.getByText("Titre, lieu et récit").click();
  await page.getByRole("textbox", { name: "Titre", exact: true }).fill("Arrivée à Naxos");
  await page.getByLabel("Lieu (facultatif)").fill("Chora");
  await page.getByRole("textbox", { name: "Récit", exact: true }).fill("Le ferry accoste en fin de matinée.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Épisode enregistré.")).toBeVisible();
  await page.getByRole("link", { name: "Arrivée à Naxos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Arrivée à Naxos" })).toBeVisible();
  await expect(page.getByText("Le ferry accoste en fin de matinée.")).toBeVisible();

  // Visionneuse : légende, réaction, commentaire, case « livre ».
  await page.getByRole("button", { name: "Photo IMG_0001.jpg" }).click();
  const v = page.getByRole("dialog");
  await v.getByPlaceholder("Ce qu’on voit, ce qu’on a vécu…").fill("Premier coucher de soleil");
  await v.getByRole("button", { name: "Enregistrer la légende" }).click();
  await expect(v.getByRole("button", { name: "Enregistrer la légende" })).toHaveCount(0);
  await v.getByRole("button", { name: "❤️" }).click();
  await expect(v.getByRole("button", { name: /❤️\s*1/ })).toHaveAttribute("aria-pressed", "true");
  await v.getByLabel("Ajouter un commentaire").fill("Quelle lumière !");
  await v.getByRole("button", { name: "Publier" }).click();
  await expect(v.getByText("Quelle lumière !")).toBeVisible();
  await v.getByLabel("Dans le livre").uncheck();
  await expect(v.getByLabel("Dans le livre")).not.toBeChecked();
  // Photo suivante au clavier.
  await page.keyboard.press("ArrowRight");
  await expect(v.getByText("2 / 4")).toBeVisible();
  await v.getByRole("button", { name: "Fermer" }).click();

  // Après rechargement, tout est conservé.
  await page.reload();
  await page.getByRole("button", { name: "Photo IMG_0001.jpg" }).click();
  await expect(page.getByRole("dialog").getByPlaceholder("Ce qu’on voit, ce qu’on a vécu…")).toHaveValue("Premier coucher de soleil");
  await expect(page.getByRole("dialog").getByLabel("Dans le livre")).not.toBeChecked();
  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();

  // Sélection : commencer un nouvel épisode à partir de la photo de 11:30.
  await page.getByRole("button", { name: "Sélectionner des photos" }).click();
  await page.getByRole("button", { name: "Photo IMG_0002.jpg" }).click();
  await page.getByRole("button", { name: "Commencer un nouvel épisode ici" }).click();
  await expect(page).toHaveURL(/\/recit$/);
  await expect(page.getByTestId("episode")).toHaveCount(2);
});

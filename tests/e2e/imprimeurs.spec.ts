import path from "node:path";
import { expect, test } from "@playwright/test";
import { dernierCourriel, lienDans, seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test("imprimeurs et commande : comparer, choisir, commander, qui doit combien à qui", async ({ browser }) => {
  test.setTimeout(240_000);
  const romain = await browser.newPage();
  romain.on("dialog", (d) => d.accept());
  await seConnecterParCode(romain, "romain@exemple.fr");
  await romain.getByLabel("Nom").fill("Commande Paros");
  await romain.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(romain).toHaveURL(/\/voyages\/commande-paros$/);
  await romain.goto("/voyages/commande-paros/importer");
  await romain.getByTestId("choisir-fichiers").setInputFiles([F("IMG_0001.jpg"), F("IMG_0002.jpg"), F("DSCF1234.jpg")]);
  await expect(romain.getByTestId("bilan-envoi")).toHaveText(/^3 envoyés$/, { timeout: 90_000 });
  await romain.goto("/voyages/commande-paros/livre");
  await romain.getByLabel("Nombre de pages visé").fill("24");
  await romain.getByRole("button", { name: "Créer le livre automatiquement" }).click();
  await expect(romain.getByRole("status").filter({ hasText: "Enregistré" })).toBeVisible();

  // Comparateur : CEWE écarté avec sa raison, classement par prix.
  await romain.getByRole("link", { name: "Imprimeurs" }).click();
  await expect(romain.getByText("Pour votre livre : 24 pages")).toBeVisible();
  await expect(romain.getByText(/CEWE.*France/)).toBeVisible();
  await romain.getByRole("link", { name: "Prix", exact: true }).click();
  // Le moins cher : Flexilivre A4 rigide, 24 à 30 pages à 29,90 € (port non relevé, signalé), livré en France.
  await expect(romain.getByTestId("offre").first().getByRole("heading")).toHaveText("Flexilivre");
  await expect(romain.getByTestId("offre").first().getByText("hors frais de port")).toBeVisible();
  await expect(romain.getByTestId("offre").first().getByTestId("livraison-france")).toContainText("Oui");
  // Fotofabriek : livraison en France seulement sur demande, signalée.
  const fotofabriek = romain.getByTestId("offre").filter({ has: romain.getByRole("heading", { name: "Fotofabriek" }) });
  await expect(fotofabriek.getByTestId("livraison-france")).toContainText("Sur demande");
  const premiere = romain.getByTestId("offre").filter({ has: romain.getByRole("heading", { name: "Blurb" }) });
  // Blurb 20 × 25 Standard, 24 pages : 38,40 + 4 × 0,48 = 40,32 €.
  await expect(premiere.getByTestId("total")).toHaveText(/40,32\s€/);

  // Choisir Blurb : le livre suit ses règles.
  await premiere.getByRole("button", { name: "Choisir Blurb" }).click();
  await expect(romain).toHaveURL(/\/livre\?imprimeur=1$/);
  await expect(romain.getByText(/Le livre suit maintenant les règles de Blurb/)).toBeVisible();
  await expect(romain.getByLabel("Format")).toHaveValue("blurb:20x25");

  // Romain commande 2 exemplaires et invite Léa.
  await romain.goto("/voyages/commande-paros/commande");
  await expect(romain.getByText(/Imprimé par Blurb/)).toBeVisible();
  await romain.getByLabel("Nombre d’exemplaires").fill("2");
  await romain.getByRole("button", { name: "Enregistrer ma commande" }).click();
  await expect(romain.getByTestId("ma-part")).toContainText("c’est moi qui paie l’imprimeur");
  await romain.goto("/voyages/commande-paros/participants");
  await romain.getByLabel("Adresse e-mail").fill("lea@exemple.fr");
  await romain.getByRole("button", { name: "Envoyer l’invitation" }).click();
  await expect(romain.getByRole("status")).toContainText("Invitation envoyée");

  const lea = await browser.newPage();
  await lea.goto(lienDans((await dernierCourriel("lea@exemple.fr", "vous invite")).texte));
  await lea.getByRole("button", { name: "Recevoir mon code" }).click();
  await lea.goto(lienDans((await dernierCourriel("lea@exemple.fr", "code de connexion")).texte));
  await expect(lea).toHaveURL(/\/voyages$/);
  await lea.goto("/voyages/commande-paros/commande");
  await lea.getByLabel("Livrés chez moi").check();
  await lea.getByLabel("Adresse de livraison").fill("Léa Martin\n3 rue du Port\n13002 Marseille");
  await lea.getByRole("button", { name: "Enregistrer ma commande" }).click();
  await expect(lea.getByTestId("ma-part")).toContainText(/Je dois 40,32\s€ à romain/);

  // Romain voit qui lui doit quoi, et l'adresse de Léa ; il note le remboursement puis la commande.
  await romain.goto("/voyages/commande-paros/commande");
  await expect(romain.getByTestId("dettes")).toContainText(/romain|lea/i);
  await expect(romain.getByText("13002 Marseille")).toBeVisible();
  await romain.getByTestId("dettes").getByRole("button", { name: "Marquer payé" }).click();
  await expect(romain.getByTestId("dettes").getByText("payé", { exact: true })).toBeVisible();
  await romain.getByRole("button", { name: "La commande est passée" }).click();
  await expect(romain.getByText("Commande passée.")).toBeVisible();

  // Léa ne peut plus changer sa commande ; elle ne voit pas les adresses des autres.
  await lea.reload();
  await expect(lea.getByLabel("Nombre d’exemplaires")).toBeDisabled();
  await expect(lea.getByText("Remboursement reçu.")).toBeVisible();
});

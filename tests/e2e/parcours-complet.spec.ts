import path from "node:path";
import { expect, test } from "@playwright/test";
import { dernierCourriel, lienDans, seConnecterParCode } from "./outils";

const F = (n: string) => path.join(__dirname, "fixtures", n);

test("parcours complet : invitation, import, épisodes, site, livre, comparateur, commande, puis effacement", async ({ browser }, info) => {
  test.setTimeout(300_000);
  const romain = await browser.newPage();
  romain.on("dialog", (d) => d.accept());
  await seConnecterParCode(romain, "romain@exemple.fr");
  await romain.getByLabel("Nom").fill("Voyage complet");
  await romain.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(romain).toHaveURL(/\/voyages\/voyage-complet$/);

  // 1. Invitation : Paul rejoint le voyage depuis l'e-mail.
  await romain.goto("/voyages/voyage-complet/participants");
  await romain.getByLabel("Adresse e-mail").fill("paul.complet@exemple.fr");
  await romain.getByRole("button", { name: "Envoyer l’invitation" }).click();
  await expect(romain.getByRole("status")).toContainText("Invitation envoyée");
  const paul = await browser.newPage();
  await paul.goto(lienDans((await dernierCourriel("paul.complet@exemple.fr", "vous invite")).texte));
  await paul.getByRole("button", { name: "Recevoir mon code" }).click();
  await paul.goto(lienDans((await dernierCourriel("paul.complet@exemple.fr", "code de connexion")).texte));
  await expect(paul).toHaveURL(/\/voyages$/);

  // 2. Import : Paul envoie ses photos, Romain les siennes.
  await paul.goto("/voyages/voyage-complet/importer");
  await paul.getByTestId("choisir-fichiers").setInputFiles([F("NAXOS_GPS.jpg"), F("PAROS_GPS.jpg")]);
  await expect(paul.getByTestId("bilan-envoi")).toHaveText(/^2 envoyés$/, { timeout: 90_000 });
  await romain.goto("/voyages/voyage-complet/importer");
  await romain.getByTestId("choisir-fichiers").setInputFiles([F("IMG_0001.jpg"), F("IMG_0002.jpg")]);
  await expect(romain.getByTestId("bilan-envoi")).toHaveText(/^2 envoyés$/, { timeout: 90_000 });

  // 3. Épisodes automatiques.
  await romain.goto("/voyages/voyage-complet/recit");
  await romain.getByRole("button", { name: "Proposer un découpage en épisodes" }).click();
  await expect(romain.getByTestId("episode")).toHaveCount(3);

  // 4. Site partagé par lien secret.
  await romain.goto("/voyages/voyage-complet/partage");
  await romain.getByLabel("Pour qui ?").fill("Famille");
  await romain.getByRole("button", { name: "Créer le lien" }).click();
  const lien = (await romain.getByTestId("lien-secret").textContent())!.trim();
  const lecteur = await (await browser.newContext(info.project.use)).newPage();
  await lecteur.goto(lien);
  await expect(lecteur.getByRole("heading", { level: 1, name: "Voyage complet" })).toBeVisible();
  await expect(lecteur.locator("[data-media]").first()).toBeVisible();

  // 5. Livre et PDF d'impression.
  await romain.goto("/voyages/voyage-complet/livre");
  await romain.getByLabel("Format").selectOption("carre-20");
  await romain.getByLabel("Nombre de pages visé").fill("24");
  await romain.getByRole("button", { name: "Créer le livre automatiquement" }).click();
  await expect(romain.getByRole("status").filter({ hasText: "Enregistré" })).toBeVisible();
  await romain.getByRole("button", { name: "Exporter le PDF" }).click();
  await romain.getByRole("dialog", { name: "Exporter le livre en PDF" }).getByRole("button", { name: "Créer le PDF" }).click();
  await expect(romain.getByRole("link", { name: /Télécharger l’intérieur/ })).toBeVisible({ timeout: 120_000 });
  await romain.getByRole("dialog", { name: "Exporter le livre en PDF" }).getByRole("button", { name: "Fermer" }).click();

  // 6. Comparateur, choix de l'imprimeur, commande de Paul.
  await romain.goto("/voyages/voyage-complet/imprimeurs");
  const blurb = romain.getByTestId("offre").filter({ has: romain.getByRole("heading", { name: "Blurb" }) });
  await expect(blurb.getByText(/Carré 30 × 30 cm/)).toBeVisible();
  await blurb.getByRole("button", { name: "Choisir Blurb" }).click();
  await expect(romain).toHaveURL(/\/livre\?imprimeur=1$/);
  await paul.goto("/voyages/voyage-complet/commande");
  await paul.getByRole("button", { name: "Enregistrer ma commande" }).click();
  await expect(paul.getByTestId("ma-part")).toContainText(/Je dois .* à romain/);
  await romain.goto("/voyages/voyage-complet/commande");
  await expect(romain.getByTestId("dettes")).toContainText("paul.complet");

  // 7. Paul supprime son compte : ses photos et sa commande disparaissent.
  await paul.goto("/compte");
  await paul.getByLabel("Recopiez votre adresse e-mail pour confirmer").fill("paul.complet@exemple.fr");
  await paul.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
  await expect(paul.getByText("Votre compte et vos photos ont été supprimés.")).toBeVisible();
  await romain.goto("/voyages/voyage-complet/photos");
  await expect(romain.getByRole("button", { name: /^Photo / })).toHaveCount(2);
  await expect(romain.getByRole("button", { name: /NAXOS_GPS|PAROS_GPS/ })).toHaveCount(0);
  await romain.goto("/voyages/voyage-complet/commande");
  await expect(romain.getByText("Personne ne doit rien pour l’instant.")).toBeVisible();

  // 8. Romain supprime le voyage : le site n'existe plus.
  await romain.goto("/voyages/voyage-complet/reglages");
  await expect(romain.getByTestId("cout")).toContainText("€ par mois");
  await romain.getByLabel(/Recopiez le nom du voyage/).fill("Voyage complet");
  await romain.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(romain).toHaveURL(/\/voyages$/);
  await expect(romain.getByText("Voyage complet")).toHaveCount(0);
  expect((await lecteur.goto("/v/voyage-complet"))?.status()).toBe(404);
});

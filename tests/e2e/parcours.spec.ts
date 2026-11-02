import { expect, test } from "@playwright/test";
import { courriels, dernierCourriel, lienDans, seConnecterParCode } from "./outils";

test.describe.configure({ mode: "serial" });

test("une adresse non invitée ne reçoit rien et ne peut pas entrer", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill("intrus@exemple.fr");
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  // Même écran que pour une adresse invitée : on ne révèle rien.
  await expect(page.getByLabel("Code à 6 chiffres")).toBeVisible();
  await page.getByLabel("Code à 6 chiffres").fill("123456");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page.getByText(/Cette adresse n’a pas été invitée|Code incorrect/)).toBeVisible();
  expect(courriels("intrus@exemple.fr")).toHaveLength(0);
});

test("parcours principal : créer un voyage, inviter, rejoindre, cloisonner, partager", async ({ browser }) => {
  // 1. L'administrateur se connecte et crée deux voyages.
  const romain = await browser.newPage();
  const debut = Date.now();
  await seConnecterParCode(romain, "romain@exemple.fr");
  expect(Date.now() - debut).toBeLessThan(60_000);

  await romain.getByLabel("Nom").fill("Naxos, été 2026");
  await romain.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(romain).toHaveURL(/\/voyages\/naxos-ete-2026$/);
  await expect(romain.getByRole("heading", { level: 1, name: "Naxos, été 2026" })).toBeVisible();

  await romain.goto("/voyages");
  await romain.getByLabel("Nom").fill("Voyage privé");
  await romain.getByRole("button", { name: "Créer le voyage" }).click();
  await expect(romain).toHaveURL(/\/voyages\/voyage-prive$/);

  // 2. Il invite Paul sur Naxos seulement.
  await romain.goto("/voyages/naxos-ete-2026/participants");
  await romain.getByLabel("Adresse e-mail").fill("Paul@Exemple.fr");
  await romain.getByRole("button", { name: "Envoyer l’invitation" }).click();
  await expect(romain.getByRole("status")).toContainText("Invitation envoyée à paul@exemple.fr");
  await expect(romain.getByText("Invitations en attente")).toBeVisible();

  // 3. Paul ouvre l'invitation, reçoit un code, utilise le lien de l'e-mail.
  const invitation = await dernierCourriel("paul@exemple.fr", "vous invite");
  const paul = await browser.newPage();
  await paul.goto(lienDans(invitation.texte));
  await expect(paul.getByRole("heading", { name: "Rejoindre « Naxos, été 2026 »" })).toBeVisible();
  await expect(paul.getByLabel("Adresse e-mail")).toHaveValue("paul@exemple.fr");
  await paul.getByRole("button", { name: "Recevoir mon code" }).click();
  const courrielCode = await dernierCourriel("paul@exemple.fr", "code de connexion");
  await paul.goto(lienDans(courrielCode.texte));
  await expect(paul).toHaveURL(/\/voyages$/);
  await expect(paul.getByRole("link", { name: /Naxos, été 2026/ })).toBeVisible();
  await expect(paul.getByText("Voyage privé")).toHaveCount(0);

  // 4. Paul est contributeur : pas d'onglets d'administration, et rien d'un autre voyage.
  await paul.goto("/voyages/naxos-ete-2026");
  await expect(paul.getByRole("link", { name: "Participants" })).toBeVisible();
  await expect(paul.getByRole("link", { name: "Partage" })).toHaveCount(0);
  const interdit = await paul.goto("/voyages/voyage-prive");
  expect(interdit?.status()).toBe(404);
  await expect(paul.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

  // 5. Romain voit Paul parmi les participants.
  await romain.goto("/voyages/naxos-ete-2026/participants");
  await expect(romain.getByText("paul@exemple.fr · Contributeur")).toBeVisible();

  // 6. Lien secret pour un lecteur sans compte, puis révocation.
  await romain.goto("/voyages/naxos-ete-2026/partage");
  await romain.getByLabel("Pour qui ?").fill("La famille");
  await romain.getByRole("button", { name: "Créer le lien" }).click();
  const lien = (await romain.getByTestId("lien-secret").textContent())!.trim();
  expect(lien).toMatch(/\/v\/naxos-ete-2026\?cle=/);

  const lecteur = await browser.newContext();
  const pageLecteur = await lecteur.newPage();
  await pageLecteur.goto(lien);
  await expect(pageLecteur).toHaveURL(/\/v\/naxos-ete-2026$/); // jeton retiré de l'adresse
  await expect(pageLecteur.getByRole("heading", { name: "Naxos, été 2026" })).toBeVisible();
  const autre = await pageLecteur.goto("/v/voyage-prive");
  expect(autre?.status()).toBe(404);

  await romain.reload();
  romain.once("dialog", (d) => d.accept());
  await romain.getByRole("button", { name: "Révoquer" }).click();
  await expect(romain.getByText(/révoqué le/)).toBeVisible();
  const apres = await pageLecteur.goto("/v/naxos-ete-2026");
  expect(apres?.status()).toBe(404);
  await lecteur.close();
});

test("lien protégé par mot de passe", async ({ browser }) => {
  const romain = await browser.newPage();
  await seConnecterParCode(romain, "romain@exemple.fr");
  await romain.goto("/voyages/naxos-ete-2026/partage");
  await romain.getByLabel("Pour qui ?").fill("Les amis");
  await romain.getByLabel("Mot de passe (facultatif)").fill("soleil");
  await romain.getByRole("button", { name: "Créer le lien" }).click();
  const lien = (await romain.getByTestId("lien-secret").textContent())!.trim();

  const lecteur = await (await browser.newContext()).newPage();
  await lecteur.goto(lien);
  await expect(lecteur.getByRole("heading", { name: "Ce voyage est protégé" })).toBeVisible();
  await lecteur.getByLabel("Mot de passe").fill("pluie");
  await lecteur.getByRole("button", { name: "Entrer" }).click();
  await expect(lecteur.getByText("Mot de passe incorrect.")).toBeVisible();
  await lecteur.getByLabel("Mot de passe").fill("soleil");
  await lecteur.getByRole("button", { name: "Entrer" }).click();
  await expect(lecteur.getByRole("heading", { name: "Naxos, été 2026" })).toBeVisible();
  await lecteur.reload();
  await expect(lecteur.getByRole("heading", { name: "Naxos, été 2026" })).toBeVisible();
});

test("PWA : manifeste en français et service worker", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.lang).toBe("fr");
  expect(m.display).toBe("standalone");
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect((await request.get("/sw.js")).ok()).toBe(true);
  expect((await request.get("/icones/512.png")).ok()).toBe(true);
});

import { readFileSync, existsSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

const BOITE = ".data/e2e/outbox.jsonl";

type Courriel = { a: string; sujet: string; texte: string };

export function courriels(a?: string): Courriel[] {
  if (!existsSync(BOITE)) return [];
  const tous = readFileSync(BOITE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Courriel);
  return a ? tous.filter((c) => c.a === a) : tous;
}

export async function dernierCourriel(a: string, sujetContient: string): Promise<Courriel> {
  let trouve: Courriel | undefined;
  await expect
    .poll(() => {
      trouve = courriels(a)
        .filter((c) => c.sujet.includes(sujetContient))
        .at(-1);
      return !!trouve;
    })
    .toBe(true);
  return trouve!;
}

export function lienDans(texte: string): string {
  const m = texte.match(/https?:\/\/\S+/);
  if (!m) throw new Error("Aucun lien dans l'e-mail");
  return m[0];
}

/** Connexion par code saisi à la main. */
export async function seConnecterParCode(page: Page, email: string) {
  const avant = courriels(email).length;
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await expect(page.getByLabel("Code à 6 chiffres")).toBeVisible();
  await expect.poll(() => courriels(email).length).toBeGreaterThan(avant);
  const code = courriels(email).at(-1)!.sujet.match(/(\d{6})/)![1];
  await page.getByLabel("Code à 6 chiffres").fill(code);
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL(/\/voyages$/);
}

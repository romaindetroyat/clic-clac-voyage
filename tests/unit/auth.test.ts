import { beforeEach, describe, expect, it } from "vitest";
import { creerAuth } from "@/server/auth/creer";
import type { Db } from "@/server/db/client";
import { creerVoyage, inviter, roleDans } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

const BASE = "http://localhost:3000";

function monter(db: Db, adminEmails: string[] = []) {
  const envoyes: { email: string; code: string; lien: string }[] = [];
  const auth = creerAuth({
    db,
    secret: "secret-de-test-secret-de-test-secret-de-test",
    baseURL: BASE,
    adminEmails,
    limiterDebit: false,
    envoyerCode: async (a) => {
      envoyes.push(a);
    },
  });
  return { auth, envoyes };
}

async function demanderCode(auth: ReturnType<typeof creerAuth>, email: string) {
  return auth.handler(
    new Request(`${BASE}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email, type: "sign-in" }),
    }),
  );
}

async function seConnecter(auth: ReturnType<typeof creerAuth>, email: string, otp: string) {
  return auth.handler(
    new Request(`${BASE}/api/auth/sign-in/email-otp`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email, otp }),
    }),
  );
}

describe("connexion par code e-mail", () => {
  let db: Db;
  beforeEach(async () => {
    db = await baseDeTest();
  });

  it("n'envoie rien à une adresse ni invitée ni connue, avec la même réponse", async () => {
    const { auth, envoyes } = monter(db);
    const r = await demanderCode(auth, "inconnu@exemple.fr");
    expect(r.status).toBe(200);
    expect(envoyes).toHaveLength(0);
  });

  it("refuse de créer un compte sans invitation", async () => {
    const { auth } = monter(db);
    const r = await seConnecter(auth, "inconnu@exemple.fr", "123456");
    expect(r.ok).toBe(false);
  });

  it("l'administrateur d'amorçage se connecte, l'invité rejoint son voyage", async () => {
    const { auth, envoyes } = monter(db, ["romain@exemple.fr"]);

    expect((await demanderCode(auth, "Romain@Exemple.fr")).status).toBe(200);
    expect(envoyes).toHaveLength(1);
    expect(envoyes[0].code).toMatch(/^\d{6}$/);
    expect(envoyes[0].lien).toBe(`${BASE}/connexion/code?email=romain%40exemple.fr&code=${envoyes[0].code}`);

    const r = await seConnecter(auth, "romain@exemple.fr", envoyes[0].code);
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toContain("session_token");

    // Un invité : connexion puis participation automatique.
    const romain = await db.query.user.findFirst({ where: (t, { eq }) => eq(t.email, "romain@exemple.fr") });
    const v = await creerVoyage(db, romain!.id, { nom: "Naxos" });
    await inviter(db, { voyageId: v.id, email: "paul@exemple.fr", role: "contributeur", invitePar: romain!.id });
    await demanderCode(auth, "paul@exemple.fr");
    const codePaul = envoyes.at(-1)!.code;
    expect((await seConnecter(auth, "paul@exemple.fr", "000000")).ok).toBe(false);
    expect((await seConnecter(auth, "paul@exemple.fr", codePaul)).status).toBe(200);
    const paul = await db.query.user.findFirst({ where: (t, { eq }) => eq(t.email, "paul@exemple.fr") });
    expect(await roleDans(db, paul!.id, v.id)).toBe("contributeur");
  });

  it("un utilisateur existant peut se reconnecter même sans invitation en cours", async () => {
    await creerUtilisateur(db, "ancien@exemple.fr");
    const { auth, envoyes } = monter(db);
    await demanderCode(auth, "ancien@exemple.fr");
    expect(envoyes).toHaveLength(1);
    expect((await seConnecter(auth, "ancien@exemple.fr", envoyes[0].code)).status).toBe(200);
  });
});

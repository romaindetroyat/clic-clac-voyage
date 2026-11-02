import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { lienSecret } from "@/server/db/schema";
import { empreinteJeton, hacherMotDePasse, verifierMotDePasse } from "@/server/domaine/crypto";
import { creerLienSecret, creerVoyage, revoquerLienSecret, verifierAccesLecteur } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

describe("liens secrets des lecteurs", () => {
  let db: Db;
  beforeEach(async () => {
    db = await baseDeTest();
  });

  it("ne stocke jamais le jeton en clair", async () => {
    const a = await creerUtilisateur(db, "a@exemple.fr");
    const v = await creerVoyage(db, a.id, { nom: "Naxos" });
    const { jeton } = await creerLienSecret(db, { voyageId: v.id, libelle: "Famille", creePar: a.id });
    const lignes = await db.select().from(lienSecret);
    expect(JSON.stringify(lignes)).not.toContain(jeton);
    expect(lignes[0].jetonEmpreinte).toBe(empreinteJeton(jeton));
  });

  it("donne accès au bon voyage seulement, et plus après révocation", async () => {
    const a = await creerUtilisateur(db, "a@exemple.fr");
    const v1 = await creerVoyage(db, a.id, { nom: "Un" });
    const v2 = await creerVoyage(db, a.id, { nom: "Deux" });
    const { id, jeton } = await creerLienSecret(db, { voyageId: v1.id, libelle: "", creePar: a.id });

    expect((await verifierAccesLecteur(db, v1.slug, jeton)).statut).toBe("ok");
    expect((await verifierAccesLecteur(db, v2.slug, jeton)).statut).toBe("refuse");
    expect((await verifierAccesLecteur(db, v1.slug, "faux")).statut).toBe("refuse");
    expect((await verifierAccesLecteur(db, v1.slug, "")).statut).toBe("refuse");

    await revoquerLienSecret(db, v1.id, id);
    expect((await verifierAccesLecteur(db, v1.slug, jeton)).statut).toBe("refuse");
  });

  it("exige le mot de passe facultatif quand il est défini", async () => {
    const a = await creerUtilisateur(db, "a@exemple.fr");
    const v = await creerVoyage(db, a.id, { nom: "Un" });
    const { jeton } = await creerLienSecret(db, { voyageId: v.id, libelle: "Amis", motDePasse: "soleil", creePar: a.id });
    expect((await verifierAccesLecteur(db, v.slug, jeton)).statut).toBe("mot-de-passe");
    expect((await verifierAccesLecteur(db, v.slug, jeton, "pluie")).statut).toBe("mot-de-passe");
    expect((await verifierAccesLecteur(db, v.slug, jeton, "soleil")).statut).toBe("ok");
  });

  it("hache les mots de passe avec du sel", async () => {
    const h1 = await hacherMotDePasse("x");
    const h2 = await hacherMotDePasse("x");
    expect(h1).not.toBe(h2);
    expect(await verifierMotDePasse("x", h1)).toBe(true);
    expect(await verifierMotDePasse("y", h1)).toBe(false);
    expect(await verifierMotDePasse("x", "n'importe quoi")).toBe(false);
  });
});

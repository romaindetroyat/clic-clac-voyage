import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import {
  accepterInvitations,
  annulerInvitation,
  changerRole,
  creerVoyage,
  ErreurMetier,
  invitationsEnAttente,
  inviter,
  peutCreerCompte,
  retirerParticipant,
  roleDans,
  roleSuffisant,
  slugifier,
  voyagePourUtilisateur,
  voyagesDe,
} from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

describe("règles pures", () => {
  it("compare les rôles", () => {
    expect(roleSuffisant("admin", "contributeur")).toBe(true);
    expect(roleSuffisant("admin", "admin")).toBe(true);
    expect(roleSuffisant("contributeur", "admin")).toBe(false);
    expect(roleSuffisant(null, "contributeur")).toBe(false);
  });

  it("fabrique des slugs lisibles", () => {
    expect(slugifier("Été 2026 à Naxos !")).toBe("ete-2026-a-naxos");
    expect(slugifier("   ")).toBe("voyage");
    expect(slugifier("Œuvre & Cie / Mariage")).toBe("uvre-cie-mariage");
  });
});

describe("voyages et droits d'accès", () => {
  let db: Db;
  beforeEach(async () => {
    db = await baseDeTest();
  });

  it("le créateur devient administrateur, les slugs restent uniques", async () => {
    const romain = await creerUtilisateur(db, "romain@exemple.fr");
    const v1 = await creerVoyage(db, romain.id, { nom: "Naxos" });
    const v2 = await creerVoyage(db, romain.id, { nom: "Naxos" });
    expect(v1.slug).toBe("naxos");
    expect(v2.slug).toBe("naxos-2");
    expect(await roleDans(db, romain.id, v1.id)).toBe("admin");
    expect(await voyagesDe(db, romain.id)).toHaveLength(2);
  });

  it("refuse des dates incohérentes", async () => {
    const r = await creerUtilisateur(db, "r@exemple.fr");
    await expect(creerVoyage(db, r.id, { nom: "X", dateDebut: "2026-08-10", dateFin: "2026-08-01" })).rejects.toThrow(
      ErreurMetier,
    );
  });

  it("aucune donnée d'un voyage n'est visible par un non-membre", async () => {
    const a = await creerUtilisateur(db, "a@exemple.fr");
    const b = await creerUtilisateur(db, "b@exemple.fr");
    const va = await creerVoyage(db, a.id, { nom: "Voyage A" });
    await creerVoyage(db, b.id, { nom: "Voyage B" });
    expect(await voyagePourUtilisateur(db, b.id, va.slug)).toBeNull();
    expect(await roleDans(db, b.id, va.id)).toBeNull();
    expect((await voyagesDe(db, b.id)).map((v) => v.nom)).toEqual(["Voyage B"]);
  });

  it("une invitation donne accès à un seul voyage, avec le rôle prévu", async () => {
    const admin = await creerUtilisateur(db, "admin@exemple.fr");
    const v1 = await creerVoyage(db, admin.id, { nom: "Un" });
    const v2 = await creerVoyage(db, admin.id, { nom: "Deux" });
    await inviter(db, { voyageId: v1.id, email: "  Paul@Exemple.fr ", role: "contributeur", invitePar: admin.id });

    expect(await peutCreerCompte(db, "paul@exemple.fr", [])).toBe(true);
    expect(await peutCreerCompte(db, "inconnu@exemple.fr", [])).toBe(false);
    expect(await peutCreerCompte(db, "inconnu@exemple.fr", ["inconnu@exemple.fr"])).toBe(true);

    const paul = await creerUtilisateur(db, "paul@exemple.fr");
    expect(await accepterInvitations(db, paul.id, "PAUL@exemple.fr")).toBe(1);
    expect(await roleDans(db, paul.id, v1.id)).toBe("contributeur");
    expect(await roleDans(db, paul.id, v2.id)).toBeNull();
    // Invitation consommée : plus en attente, plus utilisable.
    expect(await invitationsEnAttente(db, v1.id)).toHaveLength(0);
    expect(await accepterInvitations(db, paul.id, "paul@exemple.fr")).toBe(0);
  });

  it("une invitation expirée ou annulée ne permet pas de créer un compte", async () => {
    const admin = await creerUtilisateur(db, "admin@exemple.fr");
    const v = await creerVoyage(db, admin.id, { nom: "Un" });
    const ilYa40Jours = new Date(Date.now() - 40 * 86_400_000);
    await inviter(db, { voyageId: v.id, email: "vieux@exemple.fr", role: "contributeur", invitePar: admin.id }, ilYa40Jours);
    expect(await peutCreerCompte(db, "vieux@exemple.fr", [])).toBe(false);

    const inv = await inviter(db, { voyageId: v.id, email: "annule@exemple.fr", role: "contributeur", invitePar: admin.id });
    await annulerInvitation(db, v.id, inv.id);
    expect(await peutCreerCompte(db, "annule@exemple.fr", [])).toBe(false);
  });

  it("relancer une invitation ne crée pas de doublon", async () => {
    const admin = await creerUtilisateur(db, "admin@exemple.fr");
    const v = await creerVoyage(db, admin.id, { nom: "Un" });
    const i1 = await inviter(db, { voyageId: v.id, email: "x@exemple.fr", role: "contributeur", invitePar: admin.id });
    const i2 = await inviter(db, { voyageId: v.id, email: "x@exemple.fr", role: "admin", invitePar: admin.id });
    expect(i2.id).toBe(i1.id);
    expect(i2.relance).toBe(true);
    const enAttente = await invitationsEnAttente(db, v.id);
    expect(enAttente).toHaveLength(1);
    expect(enAttente[0].role).toBe("admin");
  });

  it("refuse d'inviter un participant existant", async () => {
    const admin = await creerUtilisateur(db, "admin@exemple.fr");
    const v = await creerVoyage(db, admin.id, { nom: "Un" });
    await expect(
      inviter(db, { voyageId: v.id, email: "admin@exemple.fr", role: "contributeur", invitePar: admin.id }),
    ).rejects.toThrow("participe déjà");
  });

  it("le voyage garde toujours au moins un administrateur", async () => {
    const admin = await creerUtilisateur(db, "admin@exemple.fr");
    const v = await creerVoyage(db, admin.id, { nom: "Un" });
    await expect(retirerParticipant(db, v.id, admin.id)).rejects.toThrow("dernier administrateur");
    await expect(changerRole(db, v.id, admin.id, "contributeur")).rejects.toThrow("au moins un administrateur");

    await inviter(db, { voyageId: v.id, email: "b@exemple.fr", role: "admin", invitePar: admin.id });
    const b = await creerUtilisateur(db, "b@exemple.fr");
    await accepterInvitations(db, b.id, b.email);
    await changerRole(db, v.id, admin.id, "contributeur");
    expect(await roleDans(db, admin.id, v.id)).toBe("contributeur");
    await retirerParticipant(db, v.id, admin.id);
    expect(await roleDans(db, admin.id, v.id)).toBeNull();
  });
});

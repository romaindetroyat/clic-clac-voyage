import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { commentaire, episode, media, participant, reaction, user, verification, voyage } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { commenter, basculerReaction } from "@/server/domaine/recit";
import { supprimerCompte, supprimerVoyage, viderVoyage, voyagesABloquer } from "@/server/domaine/suppression";
import { accepterInvitations, changerRole, creerVoyage, ErreurMetier, inviter } from "@/server/domaine/voyages";
import { StockageLocal } from "@/server/stockage/local";
import { baseDeTest, creerUtilisateur } from "./aide-db";

describe("RGPD : suppression d'un voyage et d'un compte", () => {
  let db: Db;
  let stockage: StockageLocal;
  let romain: { id: string };
  let lea: { id: string };
  let partage: string;

  async function photo(voyageId: string, auteurId: string) {
    const id = genererId();
    const cle = `voyages/${voyageId}/originaux/${id}`;
    const versions = { s: `voyages/${voyageId}/web/${id}-s.webp`, m: `voyages/${voyageId}/web/${id}-m.webp` };
    for (const c of [cle, ...Object.values(versions)]) await stockage.ecrire(c, new Uint8Array([1, 2, 3]));
    await db.insert(media).values({ id, voyageId, auteurId, type: "photo", statut: "pret", nomFichier: "x.jpg", mime: "image/jpeg", taille: 3, sha256: id, cleOriginal: cle, versions });
    return { id, cle };
  }

  beforeEach(async () => {
    db = await baseDeTest();
    stockage = new StockageLocal(mkdtempSync(path.join(tmpdir(), "cc-")), "http://localhost", "secret-de-test-secret-de-test");
    romain = await creerUtilisateur(db, "romain@exemple.fr");
    lea = await creerUtilisateur(db, "lea_m@exemple.fr");
    partage = (await creerVoyage(db, romain.id, { nom: "Partagé" })).id;
    await inviter(db, { voyageId: partage, email: "lea_m@exemple.fr", role: "contributeur", invitePar: romain.id });
    await accepterInvitations(db, lea.id, "lea_m@exemple.fr");
  });

  it("supprime un voyage : base et tous ses fichiers", async () => {
    const p = await photo(partage, lea.id);
    await stockage.ecrire(`voyages/${partage}/livre/export/x.pdf`, new Uint8Array([1]));
    const autre = (await creerVoyage(db, romain.id, { nom: "Autre" })).id;
    const q = await photo(autre, romain.id);
    const r = await supprimerVoyage(db, stockage, partage);
    expect(r.fichiers).toBe(4);
    expect(await stockage.taille(p.cle)).toBeNull();
    expect(await db.$count(media, undefined)).toBe(1);
    expect(await db.$count(participant, undefined)).toBe(1);
    expect(await stockage.taille(q.cle)).toBe(3); // l'autre voyage est intact
  });

  it("repartir de zéro : photos, fichiers et épisodes supprimés, voyage et participants gardés", async () => {
    const p = await photo(partage, lea.id);
    await photo(partage, romain.id);
    await commenter(db, { voyageId: partage, userId: lea.id }, p.id, "Superbe");
    await db.insert(episode).values({ id: genererId(), voyageId: partage, titre: "Naxos", ordre: 0 });
    const autre = (await creerVoyage(db, romain.id, { nom: "Autre" })).id;
    const q = await photo(autre, romain.id);

    expect(await viderVoyage(db, stockage, partage)).toEqual({ medias: 2, fichiers: 6 });
    expect(await stockage.taille(p.cle)).toBeNull();
    expect(await db.$count(media, undefined)).toBe(1);
    expect(await db.$count(commentaire, undefined)).toBe(0);
    expect(await db.$count(episode, undefined)).toBe(0);
    expect(await db.$count(participant, undefined)).toBe(3); // Romain et Léa dans « Partagé », Romain dans « Autre »
    expect(await db.query.voyage.findFirst({ where: (t, { eq }) => eq(t.id, partage) })).toBeDefined();
    expect(await stockage.taille(q.cle)).toBe(3);
  });

  it("supprime un compte : ses photos (fichiers compris), ses commentaires, ses voyages où il est seul", async () => {
    const sienne = await photo(partage, lea.id);
    const deRomain = await photo(partage, romain.id);
    await commenter(db, { voyageId: partage, userId: lea.id }, deRomain.id, "Superbe");
    await basculerReaction(db, { voyageId: partage, userId: lea.id }, deRomain.id, "❤️");
    const solo = (await creerVoyage(db, lea.id, { nom: "Le mien" })).id;
    await photo(solo, lea.id);
    await db.insert(verification).values({ id: genererId(), identifier: "sign-in-otp-lea_m@exemple.fr", value: "x", expiresAt: new Date(Date.now() + 1e6) });
    await db.insert(verification).values({ id: genererId(), identifier: "sign-in-otp-leaxm@exemple.fr", value: "x", expiresAt: new Date(Date.now() + 1e6) });

    const r = await supprimerCompte(db, stockage, lea.id);
    expect(r).toMatchObject({ voyages: 1, photos: 1 });
    expect(await db.query.user.findFirst({ where: (t, { eq }) => eq(t.id, lea.id) })).toBeUndefined();
    expect(await stockage.taille(sienne.cle)).toBeNull();
    expect(await stockage.taille(deRomain.cle)).toBe(3);
    expect(await db.$count(commentaire, undefined)).toBe(0);
    expect(await db.$count(reaction, undefined)).toBe(0);
    expect(await db.query.voyage.findFirst({ where: (t, { eq }) => eq(t.id, solo) })).toBeUndefined();
    expect(await db.query.voyage.findFirst({ where: (t, { eq }) => eq(t.id, partage) })).toBeDefined();
    // Seuls ses codes de connexion sont effacés (« _ » n'est pas un joker).
    expect((await db.select().from(verification)).map((v) => v.identifier)).toEqual(["sign-in-otp-leaxm@exemple.fr"]);
  });

  it("refuse de supprimer le seul administrateur d'un voyage partagé", async () => {
    expect((await voyagesABloquer(db, romain.id)).bloquants).toEqual(["Partagé"]);
    await expect(supprimerCompte(db, stockage, romain.id)).rejects.toThrow(ErreurMetier);
    await changerRole(db, partage, lea.id, "admin");
    await supprimerCompte(db, stockage, romain.id);
    expect(await db.$count(user, undefined)).toBe(1);
    expect(await db.$count(voyage, undefined)).toBe(1);
  });
});

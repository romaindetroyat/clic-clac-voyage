import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import {
  basculerReaction,
  cocher,
  commenter,
  deplacerEpisode,
  deplacerMedias,
  detailMedia,
  episodesDe,
  fusionnerAvecSuivant,
  legender,
  modifierEpisode,
  proposerDecoupage,
  rangerNonClasses,
  scinder,
  supprimerCommentaire,
  supprimerEpisode,
} from "@/server/domaine/recit";
import { accepterInvitations, creerVoyage, inviter } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

describe("récit : épisodes, sélection, échanges", () => {
  let db: Db;
  let voyageId: string;
  let romain: { id: string };
  let paul: { id: string };

  async function photo(iso: string | null, auteurId = romain.id) {
    const id = genererId();
    await db.insert(media).values({
      id,
      voyageId,
      auteurId,
      type: "photo",
      statut: "pret",
      nomFichier: `${id}.jpg`,
      mime: "image/jpeg",
      taille: 1,
      sha256: id,
      cleOriginal: id,
      priseUtc: iso ? new Date(iso) : null,
    });
    return id;
  }

  beforeEach(async () => {
    db = await baseDeTest();
    romain = await creerUtilisateur(db, "romain@exemple.fr");
    paul = await creerUtilisateur(db, "paul@exemple.fr");
    voyageId = (await creerVoyage(db, romain.id, { nom: "Naxos" })).id;
    await inviter(db, { voyageId, email: "paul@exemple.fr", role: "contributeur", invitePar: romain.id });
    await accepterInvitations(db, paul.id, "paul@exemple.fr");
  });

  async function troisJours() {
    const ids: string[] = [];
    for (const j of ["03", "04", "05"]) for (let h = 8; h < 13; h++) ids.push(await photo(`2026-08-${j}T${String(h).padStart(2, "0")}:00:00Z`));
    return ids;
  }

  it("propose un épisode par jour et compte les photos", async () => {
    await troisJours();
    expect(await proposerDecoupage(db, voyageId)).toBe(3);
    const { episodes, nonClasses } = await episodesDe(db, voyageId);
    expect(episodes.map((e) => e.nbMedias)).toEqual([5, 5, 5]);
    expect(episodes[0].titre).toBe("Lundi 3 août");
    expect(nonClasses).toBe(0);
  });

  it("modifie, fusionne, scinde, réordonne et supprime", async () => {
    const ids = await troisJours();
    await proposerDecoupage(db, voyageId);
    let { episodes } = await episodesDe(db, voyageId);
    await modifierEpisode(db, voyageId, episodes[0].id, { titre: "Arrivée à Naxos", lieu: "Chora", recit: "Le ferry…" });

    await fusionnerAvecSuivant(db, voyageId, episodes[0].id);
    ({ episodes } = await episodesDe(db, voyageId));
    expect(episodes.map((e) => [e.titre, e.nbMedias])).toEqual([["Arrivée à Naxos", 10], ["Mercredi 5 août", 5]]);

    // Scinder au premier média du 4 août redonne deux épisodes.
    await scinder(db, voyageId, episodes[0].id, ids[5]);
    ({ episodes } = await episodesDe(db, voyageId));
    expect(episodes.map((e) => e.nbMedias)).toEqual([5, 5, 5]);
    expect(episodes[1].titre).toBe("Mardi 4 août");
    await expect(scinder(db, voyageId, episodes[0].id, ids[0])).rejects.toThrow("pas la première");

    await deplacerEpisode(db, voyageId, episodes[2].id, -1);
    ({ episodes } = await episodesDe(db, voyageId));
    expect(episodes.map((e) => e.titre)).toEqual(["Arrivée à Naxos", "Mercredi 5 août", "Mardi 4 août"]);

    await supprimerEpisode(db, voyageId, episodes[1].id);
    const r = await episodesDe(db, voyageId);
    expect(r.episodes).toHaveLength(2);
    expect(r.nonClasses).toBe(5);
    expect(r.episodes.map((e) => e.ordre)).toEqual([1, 2]);
  });

  it("range les nouvelles photos dans le bon épisode et déplace à la main", async () => {
    await troisJours();
    await proposerDecoupage(db, voyageId);
    const nouvelle = await photo("2026-08-04T15:00:00Z", paul.id);
    await photo(null);
    await rangerNonClasses(db, voyageId);
    const r = await episodesDe(db, voyageId);
    expect(r.episodes.map((e) => e.nbMedias)).toEqual([5, 6, 5]);
    expect(r.nonClasses).toBe(1); // la photo sans date

    await deplacerMedias(db, voyageId, [nouvelle], r.episodes[2].id);
    const { episodes } = await episodesDe(db, voyageId);
    expect(episodes.map((e) => e.nbMedias)).toEqual([5, 5, 6]);
    expect(episodes[2].debut?.toISOString()).toBe("2026-08-04T15:00:00.000Z");
  });

  it("coche site et livre", async () => {
    const [a, b] = await troisJours();
    await cocher(db, voyageId, [a, b], "dansLivre", false);
    const d = await detailMedia(db, { voyageId, userId: romain.id }, a);
    expect([d.dansSite, d.dansLivre]).toEqual([true, false]);
  });

  it("la légende revient à l'auteur de la photo, les autres commentent et réagissent", async () => {
    const p = await photo("2026-08-03T10:00:00Z", paul.id);
    await legender(db, { voyageId, userId: paul.id, estAdmin: false }, p, "Coucher de soleil à Portara");
    await expect(legender(db, { voyageId, userId: "intrus", estAdmin: false }, p, "x")).rejects.toThrow("commentaire");

    const c = await commenter(db, { voyageId, userId: romain.id }, p, "Magnifique !");
    await commenter(db, { voyageId, userId: paul.id }, p, "Merci");
    expect(await basculerReaction(db, { voyageId, userId: romain.id }, p, "❤️")).toBe(true);
    await basculerReaction(db, { voyageId, userId: paul.id }, p, "❤️");
    await basculerReaction(db, { voyageId, userId: paul.id }, p, "🔥");
    expect(await basculerReaction(db, { voyageId, userId: paul.id }, p, "🔥")).toBe(false);
    await expect(basculerReaction(db, { voyageId, userId: paul.id }, p, "💩")).rejects.toThrow("inconnue");

    const d = await detailMedia(db, { voyageId, userId: romain.id }, p);
    expect(d.legende).toBe("Coucher de soleil à Portara");
    expect(d.auteur).toBe("paul");
    expect(d.commentaires.map((x) => `${x.auteur}: ${x.texte}`)).toEqual(["romain: Magnifique !", "paul: Merci"]);
    expect(d.reactions).toEqual([{ emoji: "❤️", nb: 2, moi: true, qui: expect.arrayContaining(["romain", "paul"]) }]);

    // Paul ne peut pas supprimer le commentaire de Romain ; Romain (administrateur) oui.
    await expect(supprimerCommentaire(db, { voyageId, userId: paul.id, estAdmin: false }, c)).rejects.toThrow();
    await supprimerCommentaire(db, { voyageId, userId: romain.id, estAdmin: true }, c);
    expect((await detailMedia(db, { voyageId, userId: romain.id }, p)).commentaires).toHaveLength(1);
  });

  it("aucune action possible depuis un autre voyage", async () => {
    const p = await photo("2026-08-03T10:00:00Z");
    const autre = (await creerVoyage(db, paul.id, { nom: "Autre" })).id;
    await expect(commenter(db, { voyageId: autre, userId: paul.id }, p, "hop")).rejects.toThrow("introuvable");
    await expect(detailMedia(db, { voyageId: autre, userId: paul.id }, p)).rejects.toThrow("introuvable");
    await cocher(db, autre, [p], "dansSite", false);
    expect((await detailMedia(db, { voyageId, userId: romain.id }, p)).dansSite).toBe(true);
  });
});

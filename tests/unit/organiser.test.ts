import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { fixerDates } from "@/server/domaine/dates";
import { galerie } from "@/server/domaine/medias";
import { masquer, reordonner } from "@/server/domaine/organiser";
import { trierChronologiquement } from "@/server/domaine/temps";
import { accepterInvitations, creerVoyage, inviter } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

const h = (hh: number, mm = 0) => new Date(Date.UTC(2026, 7, 3, hh, mm));

describe("ordre choisi à la main", () => {
  it("le rang remplace l'heure pour le tri, les autres restent à leur place chronologique", () => {
    const m = (id: string, instant: Date | null, rang: Date | null = null) => ({ id, nomFichier: id, instant, rang });
    const l = [m("a", h(9)), m("b", h(10), h(12)), m("c", h(11)), m("d", h(12), h(10)), m("e", null)];
    expect(trierChronologiquement(l).map((x) => x.id)).toEqual(["a", "d", "c", "b", "e"]);
  });
});

describe("organiser (base)", () => {
  let db: Db;
  let voyageId: string;
  let romain: string;
  let paul: string;
  const admin = () => ({ voyageId, userId: romain, estAdmin: true });
  const url = (id: string, t: string) => `/${t}/${id}`;
  async function ajouter(nom: string, prise: Date | null, auteur = romain) {
    const id = genererId();
    await db.insert(media).values({ id, voyageId, auteurId: auteur, type: "photo", statut: "pret", nomFichier: nom, mime: "image/jpeg", taille: 1, sha256: id, cleOriginal: id, priseUtc: prise, versions: { s: `s/${id}` } });
    return id;
  }
  const noms = async (o: { masques?: boolean } = {}) => (await galerie(db, url, voyageId, o)).map((m) => m.nomFichier);

  beforeEach(async () => {
    db = await baseDeTest();
    romain = (await creerUtilisateur(db, "romain@exemple.fr")).id;
    voyageId = (await creerVoyage(db, romain, { nom: "Naxos" })).id;
    await inviter(db, { voyageId, email: "paul@exemple.fr", role: "contributeur", invitePar: romain });
    paul = (await creerUtilisateur(db, "paul@exemple.fr")).id;
    await accepterInvitations(db, paul, "paul@exemple.fr");
  });

  it("masquer : absent de la galerie, dans le dossier des masquées ; réafficher ; droits", async () => {
    const a = await ajouter("A.jpg", h(9));
    const b = await ajouter("B.jpg", h(10), paul);
    await masquer(db, admin(), [a], true);
    expect(await noms()).toEqual(["B.jpg"]);
    expect(await noms({ masques: true })).toEqual(["A.jpg"]);
    await expect(masquer(db, { voyageId, userId: paul, estAdmin: false }, [a], true)).rejects.toThrow("auteur");
    await masquer(db, { voyageId, userId: paul, estAdmin: false }, [b], true);
    await masquer(db, admin(), [a, b], false);
    expect(await noms()).toEqual(["A.jpg", "B.jpg"]);
  });

  it("réordonner une journée : les heures sont redistribuées, la date réelle ne change pas ; une nouvelle date efface le rang", async () => {
    const a = await ajouter("A.jpg", h(9));
    const b = await ajouter("B.jpg", h(10));
    const c = await ajouter("C.jpg", h(11));
    await ajouter("D.jpg", h(12, 30)); // ajoutée hors de l'ordre choisi : reste à sa place
    await reordonner(db, admin(), [c, a, b]);
    expect(await noms()).toEqual(["C.jpg", "A.jpg", "B.jpg", "D.jpg"]);
    expect((await db.query.media.findFirst({ where: eq(media.id, c) }))!.priseUtc).toEqual(h(11));
    await expect(reordonner(db, { voyageId, userId: paul, estAdmin: false }, [a, b])).rejects.toThrow("administrateur");
    await fixerDates(db, admin(), [{ id: c, instant: h(13) }]);
    expect((await db.query.media.findFirst({ where: eq(media.id, c) }))!.rang).toBeNull();
    expect(await noms()).toEqual(["A.jpg", "B.jpg", "D.jpg", "C.jpg"]);
  });
});

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { choisirDansRafale, detecterRafales, grouperRafales, meilleurePhoto, type PhotoRafale } from "@/server/domaine/rafales";
import { creerVoyage } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

const t = (s: number) => new Date(Date.UTC(2026, 7, 3, 10, 0, s));
const p = (id: string, s: number, o: Partial<PhotoRafale> = {}): PhotoRafale => ({
  id,
  instant: t(s),
  appareilId: "iphone",
  dhash: "f0e1d2c3b4a59687",
  nettete: 0.5,
  exposition: 0.5,
  ...o,
});

describe("rafales (règles)", () => {
  it("regroupe les photos rapprochées d'un même appareil et d'une même scène", () => {
    const g = grouperRafales([p("a", 0), p("b", 2), p("c", 5), p("d", 60), p("e", 61), p("f", 200)]);
    expect(g.map((x) => x.map((y) => y.id))).toEqual([["a", "b", "c"], ["d", "e"]]);
  });

  it("sépare deux appareils et deux scènes différentes", () => {
    expect(grouperRafales([p("a", 0), p("b", 1, { appareilId: "fuji" })])).toEqual([]);
    expect(grouperRafales([p("a", 0), p("b", 1, { dhash: "0f1e2d3c4b5a6978" })])).toEqual([]);
  });

  it("propose la photo la plus nette et la mieux exposée", () => {
    const g = [p("floue", 0, { nettete: 0.2 }), p("nette", 1, { nettete: 0.9 }), p("brulee", 2, { nettete: 0.95, exposition: 0.05 })];
    expect(meilleurePhoto(g).id).toBe("nette");
  });
});

describe("rafales (base)", () => {
  let db: Db;
  let voyageId: string;
  async function photo(id: string, s: number, nettete: number) {
    await db.insert(media).values({
      id,
      voyageId,
      type: "photo",
      statut: "pret",
      nomFichier: id,
      mime: "image/jpeg",
      taille: 1,
      sha256: id,
      cleOriginal: id,
      priseUtc: t(s),
      dhash: "f0e1d2c3b4a59687",
      nettete,
      exposition: 0.6,
    });
  }
  const etat = async () =>
    Object.fromEntries(
      (await db.query.media.findMany({ columns: { nomFichier: true, choixRafale: true, dansSite: true, dansLivre: true } })).map((m) => [
        m.nomFichier,
        [m.choixRafale, m.dansSite, m.dansLivre],
      ]),
    );

  beforeEach(async () => {
    db = await baseDeTest();
    const u = await creerUtilisateur(db, "r@exemple.fr");
    voyageId = (await creerVoyage(db, u.id, { nom: "Naxos" })).id;
    const ids = [genererId(), genererId(), genererId()];
    await photo(ids[0], 0, 0.3);
    await photo(ids[1], 1, 0.9);
    await photo(ids[2], 3, 0.6);
    await db.update(media).set({ nomFichier: "A" }).where(eqId(ids[0]));
    await db.update(media).set({ nomFichier: "B" }).where(eqId(ids[1]));
    await db.update(media).set({ nomFichier: "C" }).where(eqId(ids[2]));
  });

  it("propose la meilleure, écarte les autres, et garde le choix manuel", async () => {
    expect(await detecterRafales(db, voyageId)).toEqual({ rafales: 1, photos: 3 });
    expect(await etat()).toEqual({ A: [false, false, false], B: [true, true, true], C: [false, false, false] });

    const c = (await db.query.media.findFirst({ where: (m, { eq }) => eq(m.nomFichier, "C") }))!;
    await choisirDansRafale(db, voyageId, c.id);
    expect(await etat()).toEqual({ A: [false, false, false], B: [false, false, false], C: [true, true, true] });

    // Une nouvelle détection ne défait pas le choix.
    await detecterRafales(db, voyageId);
    expect((await etat()).C).toEqual([true, true, true]);
  });
});

function eqId(id: string) {
  return eq(media.id, id);
}

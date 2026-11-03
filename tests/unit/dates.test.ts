import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { appareil, media, voyage } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { enregistrerExifRelu, etatDates, fixerDates, instantDuJour, numeroDeFichier, suggererDates } from "@/server/domaine/dates";
import { galerie, urlsMembre } from "@/server/domaine/medias";
import { accepterInvitations, creerVoyage, inviter } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

const h = (hh: number, mm = 0) => new Date(Date.UTC(2026, 7, 3, hh, mm));

describe("dates déduites des voisines", () => {
  it("lit le numéro de série des noms de fichiers", () => {
    expect(numeroDeFichier("IMG_1234.HEIC")).toEqual({ serie: "img_", numero: 1234 });
    expect(numeroDeFichier("DSCF0042.JPG")).toEqual({ serie: "dscf", numero: 42 });
    expect(numeroDeFichier("IMG_1234 (1).jpg")).toEqual({ serie: "img_", numero: 1234 });
    expect(numeroDeFichier("Capture d’écran.png")).toBeNull();
  });

  it("interpole entre deux voisines, prend la plus proche sinon, ignore les autres séries", () => {
    const d = (id: string, nom: string, instant: Date | null, auteurId = "romain") => ({ id, nomFichier: nom, auteurId, instant });
    const datees = [d("a", "IMG_1230.HEIC", h(10)), d("b", "IMG_1240.HEIC", h(11)), d("c", "DSCF0001.JPG", h(9))];
    const r = suggererDates(
      [
        d("x", "IMG_1235.HEIC", null), // à mi-chemin
        d("y", "IMG_1245.HEIC", null), // après la dernière : + 5 s
        d("z", "IMG_1300.HEIC", null), // trop loin
        d("w", "IMG_1235.HEIC", null, "paul"), // autre auteur : autre série
        d("v", "WhatsApp Image.jpeg", null),
      ],
      datees,
    );
    expect(r).toEqual([
      { id: "x", instant: h(10, 30), raison: "entre IMG_1230.HEIC et IMG_1240.HEIC" },
      { id: "y", instant: new Date(h(11).getTime() + 5000), raison: "près de IMG_1240.HEIC" },
    ]);
  });
});

describe("dates à fixer (base)", () => {
  let db: Db;
  let voyageId: string;
  let romain: string;
  let paul: string;
  let appareilRomain: string;
  const ctx = () => ({ voyageId, userId: romain, estAdmin: true });

  async function ajouter(nom: string, o: { prise?: Date; auteur?: string; appareilId?: string } = {}) {
    const id = genererId();
    await db.insert(media).values({
      id,
      voyageId,
      auteurId: o.auteur ?? romain,
      appareilId: o.appareilId ?? null,
      type: "photo",
      statut: "pret",
      nomFichier: nom,
      mime: "image/heic",
      taille: 1,
      sha256: id,
      cleOriginal: id,
      priseUtc: o.prise ?? null,
      versions: { s: `v/${id}` },
    });
    return id;
  }

  beforeEach(async () => {
    db = await baseDeTest();
    romain = (await creerUtilisateur(db, "romain@exemple.fr")).id;
    const v = await creerVoyage(db, romain, { nom: "Naxos", dateDebut: "2026-08-02", dateFin: "2026-08-04" });
    voyageId = v.id;
    await db.update(voyage).set({ fuseau: "Europe/Athens" }).where(eq(voyage.id, voyageId));
    await inviter(db, { voyageId, email: "paul@exemple.fr", role: "contributeur", invitePar: romain });
    paul = (await creerUtilisateur(db, "paul@exemple.fr")).id;
    await accepterInvitations(db, paul, "paul@exemple.fr");
    appareilRomain = genererId();
    // L'appareil de Romain retardait d'une heure.
    await db.insert(appareil).values({ id: appareilRomain, voyageId, cle: "x", libelle: "iPhone", proprietaireId: romain, decalageSecondes: 3600 });
  });

  it("propose les jours du voyage, avec le nombre de photos de chacun, et les suggestions", async () => {
    await ajouter("IMG_0010.HEIC", { prise: h(9) });
    await ajouter("IMG_0012.HEIC", { prise: h(10) });
    const x = await ajouter("IMG_0011.HEIC");
    const e = await etatDates(db, urlsMembre("naxos"), ctx());
    expect(e.jours).toEqual([
      { jour: "2026-08-02", photos: 0 },
      { jour: "2026-08-03", photos: 2 },
      { jour: "2026-08-04", photos: 0 },
    ]);
    expect(e.sansDate).toHaveLength(1);
    expect(e.sansDate[0]).toMatchObject({ id: x, modifiable: true, suggestion: { local: "2026-08-03T12:30:00", raison: "entre IMG_0010.HEIC et IMG_0012.HEIC" } });
  });

  it("place les médias au jour et à l'heure choisis (heure locale du voyage), recalage d'appareil compensé", async () => {
    const a = await ajouter("Capture 1.png", { appareilId: appareilRomain });
    const b = await ajouter("Capture 2.png");
    const debut = instantDuJour("2026-08-04", "14:30", "Europe/Athens");
    expect(debut.toISOString()).toBe("2026-08-04T11:30:00.000Z");
    await fixerDates(db, ctx(), [
      { id: a, instant: debut },
      { id: b, instant: new Date(debut.getTime() + 1000) },
    ]);
    const g = await galerie(db, urlsMembre("naxos"), voyageId);
    expect(g.map((m) => [m.nomFichier, m.instant, m.dateEstimee])).toEqual([
      ["Capture 1.png", "2026-08-04T11:30:00.000Z", true],
      ["Capture 2.png", "2026-08-04T11:30:01.000Z", true],
    ]);
    expect((await db.query.media.findFirst({ where: eq(media.id, a) }))!.priseLocale).toBe("2026-08-04T13:30:00");
  });

  it("un contributeur ne date que ses propres médias", async () => {
    const deRomain = await ajouter("IMG_1.HEIC");
    const dePaul = await ajouter("IMG_2.HEIC", { auteur: paul });
    const ctxPaul = { voyageId, userId: paul, estAdmin: false };
    await expect(fixerDates(db, ctxPaul, [{ id: deRomain, instant: h(9) }])).rejects.toThrow("auteur");
    expect(await fixerDates(db, ctxPaul, [{ id: dePaul, instant: h(9) }])).toBe(1);
    expect((await etatDates(db, urlsMembre("naxos"), ctxPaul)).sansDate.map((m) => [m.nom, m.modifiable])).toEqual([["IMG_1.HEIC", false]]);
  });

  it("enregistre la date relue dans l'original (date réelle, position, appareil)", async () => {
    const id = await ajouter("IMG_0004.HEIC");
    await enregistrerExifRelu(db, ctx(), id, {
      priseLocale: "2026-08-03T14:00:00",
      decalageExifMinutes: 180,
      latitude: 37.1,
      longitude: 25.4,
      appareil: { cle: "Apple|iPhone 15|", libelle: "Apple iPhone 15" },
    });
    const m = (await db.query.media.findFirst({ where: eq(media.id, id) }))!;
    expect(m.priseUtc?.toISOString()).toBe("2026-08-03T11:00:00.000Z");
    expect([m.dateEstimee, m.latitude, m.longitude]).toEqual([false, 37.1, 25.4]);
    expect((await db.query.appareil.findFirst({ where: eq(appareil.id, m.appareilId!) }))!.libelle).toBe("Apple iPhone 15");
  });
});

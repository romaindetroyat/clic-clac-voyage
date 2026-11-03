import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { appareil, media, voyage } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { compterARelire, etatDates, fixerDates, instantDuJour, numeroDeFichier, relireDatesServeur, suggererDates } from "@/server/domaine/dates";
import { dateDuFichier, galerie, urlsMembre } from "@/server/domaine/medias";
import { StockageLocal } from "@/server/stockage/local";
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
      { id: "x", instant: h(10, 30), raison: "entre IMG_1230.HEIC et IMG_1240.HEIC", sure: true },
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

  it("après la relecture, date d'office les médias sûrement encadrés par leurs voisines", async () => {
    const s = new StockageLocal(await mkdtemp(path.join(tmpdir(), "cc-sures-")), "http://localhost", "secret-de-test-secret-de-test-secret-de-test");
    await ajouter("IMG_0010.HEIC", { prise: h(9) });
    await ajouter("IMG_0012.HEIC", { prise: h(10) });
    await ajouter("IMG_0020.HEIC", { prise: h(20) });
    const sure = await ajouter("IMG_0011.HEIC"); // entre 9 h et 10 h : sûr
    const douteuse = await ajouter("IMG_0015.HEIC"); // entre 10 h et 20 h : à confirmer
    for (const id of [sure, douteuse]) await s.ecrire(id, new Uint8Array([1, 2, 3]));
    await db.update(media).set({ cleOriginal: sure }).where(eq(media.id, sure));
    await db.update(media).set({ cleOriginal: douteuse }).where(eq(media.id, douteuse));

    const r = await relireDatesServeur(db, s, ctx());
    expect(r).toMatchObject({ restantes: 0, trouvees: 1 });
    const m = (id: string) => db.query.media.findFirst({ where: eq(media.id, id) });
    expect([(await m(sure))!.priseUtc?.toISOString(), (await m(sure))!.dateEstimee]).toEqual(["2026-08-03T09:30:00.000Z", true]);
    expect((await m(douteuse))!.priseUtc).toBeNull();
    expect((await etatDates(db, urlsMembre("naxos"), ctx())).sansDate[0].suggestion?.raison).toBe("entre IMG_0012.HEIC et IMG_0020.HEIC");
  });

  it("date du fichier : seulement si elle tombe pendant le voyage", async () => {
    const c = { voyageId, fuseau: "Europe/Athens" };
    expect(await dateDuFichier(db, c, "2026-08-03T16:00:00.000Z")).toBe("2026-08-03T19:00:00");
    expect(await dateDuFichier(db, c, "2026-11-03T16:00:00.000Z")).toBeNull(); // exporté plus tard
    expect(await dateDuFichier(db, c, null)).toBeNull();
  });

  it("un contributeur ne date que ses propres médias", async () => {
    const deRomain = await ajouter("IMG_1.HEIC");
    const dePaul = await ajouter("IMG_2.HEIC", { auteur: paul });
    const ctxPaul = { voyageId, userId: paul, estAdmin: false };
    await expect(fixerDates(db, ctxPaul, [{ id: deRomain, instant: h(9) }])).rejects.toThrow("auteur");
    expect(await fixerDates(db, ctxPaul, [{ id: dePaul, instant: h(9) }])).toBe(1);
    expect((await etatDates(db, urlsMembre("naxos"), ctxPaul)).sansDate.map((m) => [m.nom, m.modifiable])).toEqual([["IMG_1.HEIC", false]]);
  });

  it("relit sur le serveur la date des originaux (HEIC d'iPhone, vidéo), une seule fois chacun", async () => {
    const s = new StockageLocal(await mkdtemp(path.join(tmpdir(), "cc-dates-")), "http://localhost", "secret-de-test-secret-de-test-secret-de-test");
    const fichier = async (nom: string, type: "photo" | "video" = "photo") => {
      const id = await ajouter(nom);
      await s.ecrire(id, readFileSync(path.join(__dirname, "../e2e/fixtures", nom)));
      if (type === "video") await db.update(media).set({ type: "video" }).where(eq(media.id, id));
      return id;
    };
    const heic = await fichier("IMG_0004.HEIC");
    const video = await fichier("VID_0001.mp4", "video");
    const capture = await fichier("Capture_ecran.png");
    const nomDate = await fichier("Screenshot_20260804-183000.png");
    expect(await compterARelire(db, ctx())).toBe(4);

    // Par lots : le navigateur relance tant qu'il en reste.
    const r1 = await relireDatesServeur(db, s, ctx(), 2);
    const r2 = await relireDatesServeur(db, s, ctx(), 2);
    expect([r1.essayees, r1.restantes, r2.essayees, r2.restantes, r1.trouvees + r2.trouvees]).toEqual([2, 2, 2, 0, 3]);
    expect(await relireDatesServeur(db, s, ctx(), 2)).toEqual({ essayees: 0, trouvees: 0, restantes: 0 });

    const m = (id: string) => db.query.media.findFirst({ where: eq(media.id, id) });
    const h = (await m(heic))!;
    expect([h.priseUtc?.toISOString(), h.dateEstimee]).toEqual(["2026-08-03T11:00:00.000Z", false]);
    expect((await db.query.appareil.findFirst({ where: eq(appareil.id, h.appareilId!) }))!.libelle).toBe("Apple iPhone 15");
    expect((await m(video))!.priseUtc).not.toBeNull();
    expect((await m(capture))!.priseUtc).toBeNull();
    // Sans EXIF mais datée dans son nom : 18 h 30 à Athènes.
    expect((await m(nomDate))!.priseUtc?.toISOString()).toBe("2026-08-04T15:30:00.000Z");
    // La capture reste à dater à la main.
    expect((await etatDates(db, urlsMembre("naxos"), ctx())).sansDate.map((x) => x.nom)).toEqual(["Capture_ecran.png"]);
  });
});

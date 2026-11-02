import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import {
  annulerEnvoi,
  appareilsDe,
  galerie,
  morceauxRecus,
  preparerEnvoi,
  reglerDecalage,
  schemaDeclaration,
  signerMorceaux,
  terminerEnvoi,
  type Declaration,
} from "@/server/domaine/medias";
import { accepterInvitations, creerVoyage, inviter } from "@/server/domaine/voyages";
import { StockageLocal } from "@/server/stockage/local";
import { TAILLE_MORCEAU } from "@/server/stockage/types";
import { baseDeTest, creerUtilisateur } from "./aide-db";

const SECRET = "secret-de-test-secret-de-test-secret-de-test";

/** Simule le navigateur : PUT vers une URL signée du stockage local. */
async function put(s: StockageLocal, url: string, contenu: Buffer) {
  const o = s.lireJeton(new URL(url).searchParams.get("j")!);
  if (!o) throw new Error("URL invalide");
  return s.ecrire(o, contenu);
}

function decl(d: Partial<Declaration> & { sha256: string; taille: number }): Declaration {
  return schemaDeclaration.parse({
    nomFichier: "IMG_0001.HEIC",
    mime: "image/heic",
    type: "photo",
    versions: ["s", "m"],
    ...d,
  });
}

const sha = (c: string) => c.repeat(64).slice(0, 64);

describe("import des médias", () => {
  let db: Db;
  let s: StockageLocal;
  let ctx: { voyageId: string; fuseau: string; userId: string };
  let paul: { id: string };

  beforeEach(async () => {
    db = await baseDeTest();
    s = new StockageLocal(await mkdtemp(path.join(tmpdir(), "cc-stockage-")), "http://localhost", SECRET);
    const romain = await creerUtilisateur(db, "romain@exemple.fr");
    const v = await creerVoyage(db, romain.id, { nom: "Naxos" });
    ctx = { voyageId: v.id, fuseau: "Europe/Athens", userId: romain.id };
    await inviter(db, { voyageId: v.id, email: "paul@exemple.fr", role: "contributeur", invitePar: romain.id });
    paul = await creerUtilisateur(db, "paul@exemple.fr");
    await accepterInvitations(db, paul.id, "paul@exemple.fr");
  });

  async function envoyerPhoto(d: Partial<Declaration> & { sha256: string }, contenu = Buffer.from("photo"), qui = ctx.userId) {
    const c = { ...ctx, userId: qui };
    const plan = await preparerEnvoi(db, s, c, decl({ taille: contenu.length, ...d }));
    if (plan.statut === "doublon") return { plan };
    if (plan.original.mode !== "simple") throw new Error("attendu simple");
    await put(s, plan.original.url, contenu);
    for (const url of Object.values(plan.versions)) await put(s, url, Buffer.from("webp"));
    const fin = await terminerEnvoi(db, s, c, plan.mediaId, { versions: Object.keys(plan.versions) });
    return { plan, fin };
  }

  it("envoie une photo, enregistre ses versions et l'heure UTC", async () => {
    const { plan } = await envoyerPhoto({ sha256: sha("a"), priseLocale: "2026-08-03T14:00:00" });
    if (plan.statut !== "a-envoyer") throw new Error();
    const m = await db.query.media.findFirst();
    expect(m?.statut).toBe("pret");
    expect(m?.versions.s).toMatch(/-s\.webp$/);
    expect(m?.priseUtc?.toISOString()).toBe("2026-08-03T11:00:00.000Z"); // heure d'Athènes
    const g = await galerie(db, s, ctx.voyageId);
    expect(g).toHaveLength(1);
    expect(g[0].vignette).toContain("/api/stockage-local?j=");
  });

  it("ne renvoie pas un fichier déjà présent (même empreinte)", async () => {
    await envoyerPhoto({ sha256: sha("a") });
    const { plan } = await envoyerPhoto({ sha256: sha("a"), nomFichier: "copie.heic" }, Buffer.from("photo"), paul.id);
    expect(plan.statut).toBe("doublon");
    expect(await db.$count(media)).toBe(1);
  });

  it("refuse de terminer un envoi incomplet", async () => {
    const plan = await preparerEnvoi(db, s, ctx, decl({ sha256: sha("b"), taille: 10 }));
    if (plan.statut !== "a-envoyer" || plan.original.mode !== "simple") throw new Error();
    await put(s, plan.original.url, Buffer.from("123"));
    await expect(terminerEnvoi(db, s, ctx, plan.mediaId, { versions: [] })).rejects.toThrow("incomplet");
  });

  it("envoie un gros fichier en morceaux et reprend après une coupure", async () => {
    const taille = 2 * TAILLE_MORCEAU + 1000;
    const contenu = Buffer.alloc(taille, 7);
    const d = decl({ sha256: sha("c"), taille, type: "video", mime: "video/quicktime", nomFichier: "IMG_0002.MOV", versions: [] });
    const plan = await preparerEnvoi(db, s, ctx, d);
    if (plan.statut !== "a-envoyer" || plan.original.mode !== "multipart") throw new Error("attendu multipart");
    expect(plan.original.nbMorceaux).toBe(3);

    // Premier morceau envoyé, puis « coupure ».
    const urls1 = await signerMorceaux(db, s, ctx, plan.mediaId, [1]);
    await put(s, urls1[1], contenu.subarray(0, TAILLE_MORCEAU));

    // Réouverture de l'app : même fichier redéclaré, même média, reprise au morceau 2.
    const reprise = await preparerEnvoi(db, s, ctx, d);
    expect(reprise.statut === "a-envoyer" && reprise.mediaId).toBe(plan.mediaId);
    const { morceaux: deja } = await morceauxRecus(db, s, ctx, plan.mediaId);
    expect(deja.map((m) => m.numero)).toEqual([1]);

    const urls = await signerMorceaux(db, s, ctx, plan.mediaId, [2, 3]);
    const e2 = await put(s, urls[2], contenu.subarray(TAILLE_MORCEAU, 2 * TAILLE_MORCEAU));
    const e3 = await put(s, urls[3], contenu.subarray(2 * TAILLE_MORCEAU));
    await terminerEnvoi(db, s, ctx, plan.mediaId, {
      morceaux: [...deja, { numero: 2, etag: e2 }, { numero: 3, etag: e3 }],
      versions: [],
    });
    expect(await s.taille((await db.query.media.findFirst())!.cleOriginal)).toBe(taille);
  });

  it("personne d'autre ne peut signer les morceaux d'un envoi", async () => {
    const d = decl({ sha256: sha("d"), taille: 40 * 1024 * 1024, type: "video", mime: "video/mp4", versions: [] });
    const plan = await preparerEnvoi(db, s, ctx, d);
    if (plan.statut !== "a-envoyer") throw new Error();
    await expect(signerMorceaux(db, s, { ...ctx, userId: paul.id }, plan.mediaId, [1])).rejects.toThrow("introuvable");
    await expect(signerMorceaux(db, s, { ...ctx, voyageId: "autre" }, plan.mediaId, [1])).rejects.toThrow("introuvable");
    await expect(signerMorceaux(db, s, ctx, plan.mediaId, [99])).rejects.toThrow("invalide");
  });

  it("l'original arrivé après la copie WhatsApp la remplace dans la galerie", async () => {
    await envoyerPhoto(
      { sha256: sha("e"), dhash: "f0e1d2c3b4a59685", largeur: 1600, hauteur: 1200, copieCompressee: true, source: "whatsapp", nomFichier: "IMG-20260803-WA0001.jpg", mime: "image/jpeg" },
      Buffer.from("petite"),
      paul.id,
    );
    const { fin } = await envoyerPhoto(
      { sha256: sha("f"), dhash: "f0e1d2c3b4a59687", largeur: 4032, hauteur: 3024, priseLocale: "2026-08-03T14:00:00" },
      Buffer.from("grande photo"),
    );
    expect(fin?.masque).toBeDefined();
    const g = await galerie(db, s, ctx.voyageId);
    expect(g.map((m) => m.nomFichier)).toEqual(["IMG_0001.HEIC"]);
  });

  it("recale l'horloge d'un appareil et réordonne la galerie", async () => {
    const appRomain = { cle: "Apple|iPhone 15|A1", libelle: "iPhone 15 de Romain" };
    const appPaul = { cle: "Fujifilm|X-T5|123", libelle: "Fujifilm X-T5" };
    await envoyerPhoto({ sha256: sha("1"), nomFichier: "R1.HEIC", priseLocale: "2026-08-03T11:00:00", decalageExifMinutes: 180, appareil: appRomain });
    await envoyerPhoto({ sha256: sha("2"), nomFichier: "R2.HEIC", priseLocale: "2026-08-03T11:30:00", decalageExifMinutes: 180, appareil: appRomain });
    await envoyerPhoto(
      { sha256: sha("3"), nomFichier: "P1.JPG", priseLocale: "2026-08-03T10:00:00", decalageExifMinutes: 180, appareil: appPaul },
      Buffer.from("photo"),
      paul.id,
    );
    expect((await galerie(db, s, ctx.voyageId)).map((m) => m.nomFichier)).toEqual(["P1.JPG", "R1.HEIC", "R2.HEIC"]);

    const apps = await appareilsDe(db, ctx.voyageId);
    const fuji = apps.find((a) => a.libelle === "Fujifilm X-T5")!;
    expect(fuji.nbMedias).toBe(1);
    // Un contributeur ne peut pas recaler l'appareil d'un autre…
    const iphone = apps.find((a) => a.libelle === "iPhone 15 de Romain")!;
    await expect(reglerDecalage(db, { voyageId: ctx.voyageId, userId: paul.id, estAdmin: false }, iphone.id, 60)).rejects.toThrow();
    // …mais peut recaler le sien : son Fuji retardait de 1 h 12.
    await reglerDecalage(db, { voyageId: ctx.voyageId, userId: paul.id, estAdmin: false }, fuji.id, 72 * 60);
    expect((await galerie(db, s, ctx.voyageId)).map((m) => m.nomFichier)).toEqual(["R1.HEIC", "P1.JPG", "R2.HEIC"]);
  });

  it("annule un envoi en cours et nettoie le stockage", async () => {
    const plan = await preparerEnvoi(db, s, ctx, decl({ sha256: sha("9"), taille: 5 }));
    if (plan.statut !== "a-envoyer" || plan.original.mode !== "simple") throw new Error();
    await put(s, plan.original.url, Buffer.from("12345"));
    await annulerEnvoi(db, s, ctx, plan.mediaId);
    expect(await db.$count(media)).toBe(0);
    expect(await s.taille(`voyages/${ctx.voyageId}/originaux/${plan.mediaId}`)).toBeNull();
  });

  it("refuse les types de fichiers étrangers", () => {
    expect(() => decl({ sha256: sha("x"), taille: 10, mime: "application/pdf" })).toThrow();
  });
});

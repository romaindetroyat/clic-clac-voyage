import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument, PDFName } from "@cantoo/pdf-lib";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { formatParId } from "@/lib/livre/formats";
import { mettreEnPage } from "@/lib/livre/mise-en-page";
import type { Db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { enregistrerLivre, episodesDuLivre, mediasDuLivre } from "@/server/domaine/livre";
import { proposerDecoupage } from "@/server/domaine/recit";
import { creerVoyage } from "@/server/domaine/voyages";
import { assemblerLivre, compilerTypst, dernierExport, planImages, planPreparation } from "@/server/livre/impression";
import { chaine, geometrieCouvertureComplete, sourceCouverture, sourceInterieur } from "@/server/livre/typst";
import { StockageLocal } from "@/server/stockage/local";
import { baseDeTest, creerUtilisateur } from "./aide-db";

const carre = formatParId("carre-20");
const MM = 72 / 25.4;

describe("impression : source Typst", () => {
  it("échappe les textes", () => {
    expect(chaine('Il a dit "oui" \\ non\nfin')).toBe('"Il a dit \\"oui\\" \\\\ non\\nfin"');
  });

  it("compile intérieur et couverture : bonnes dimensions, polices embarquées", async () => {
    const medias = Array.from({ length: 12 }, (_, i) => ({
      id: `m${i}`, largeur: 4000, hauteur: 3000, episodeId: "e", instant: null, legende: i === 0 ? "Le port de Naxos, « au soleil »" : null,
      auteur: null, vedette: false, qualite: null, vignette: null, moyenne: null, commentaires: [],
    }));
    const { livre } = mettreEnPage({
      nom: "Été à Naxos", periode: "août 2026", fuseau: "UTC", format: carre,
      options: { ciblePages: 24, rythme: "equilibre", fond: "noir", legendes: true, commentaires: false },
      episodes: [{ id: "e", titre: "L’arrivée", lieu: null, recit: "Le ferry accoste.\n\nOn dîne sur le port.", debut: null, fin: null }],
      medias, fin: { titre: "Les voyageurs", corps: "Romain, Léa" },
    });
    livre.couverture.quatrieme = "Deux semaines dans les Cyclades.";
    const octets = await compilerTypst(sourceInterieur(livre, carre));
    const texte = Buffer.from(octets).toString("latin1");
    expect(texte).toMatch(/\/FontName\s*\/[A-Z]{6}\+EBGaramond/);
    expect(texte).toMatch(/\/FontName\s*\/[A-Z]{6}\+Inter/);
    expect(texte).toContain("/FontFile2");
    const interieur = await PDFDocument.load(octets);
    expect(interieur.getPageCount()).toBe(24);
    const { width, height } = interieur.getPage(0).getSize();
    expect(width / MM).toBeCloseTo(206, 1);
    expect(height / MM).toBeCloseTo(206, 1);
    const couverture = await PDFDocument.load(await compilerTypst(sourceCouverture(livre, carre)));
    const g = geometrieCouvertureComplete(carre, 24);
    expect(couverture.getPage(0).getWidth() / MM).toBeCloseTo(g.largeur, 1);
    expect(g.dos).toBe(7.8);
  });
});

describe("impression : plan et assemblage", () => {
  let db: Db;
  let voyageId: string;
  let ctx: { voyageId: string; userId: string };
  let stockage: StockageLocal;

  beforeEach(async () => {
    db = await baseDeTest();
    const romain = await creerUtilisateur(db, "romain@exemple.fr");
    voyageId = (await creerVoyage(db, romain.id, { nom: "Naxos" })).id;
    ctx = { voyageId, userId: romain.id };
    stockage = new StockageLocal(mkdtempSync(path.join(tmpdir(), "cc-")), "http://localhost", "secret-de-test-secret-de-test");
    for (let h = 8; h < 18; h++) {
      const id = genererId();
      await db.insert(media).values({
        id, voyageId, type: "photo", statut: "pret", nomFichier: `${id}.jpg`, mime: "image/jpeg", taille: 1, sha256: id,
        cleOriginal: `voyages/${voyageId}/originaux/${id}`, priseUtc: new Date(`2026-08-03T${String(h).padStart(2, "0")}:00:00Z`),
        largeur: 6000, hauteur: 4000, retouche: h === 9 ? { filtre: "noir-et-blanc" } : null,
      });
    }
    await proposerDecoupage(db, voyageId);
    const { livre } = mettreEnPage({
      nom: "Naxos", periode: null, fuseau: "UTC", format: carre,
      options: { ciblePages: 24, rythme: "equilibre", fond: "blanc", legendes: true, commentaires: false },
      episodes: await episodesDuLivre(db, voyageId), medias: await mediasDuLivre(db, stockage, voyageId),
    });
    await enregistrerLivre(db, ctx, livre, null);
  });

  it("une image par cadre, à 300 dpi sans agrandir, partagée entre emplacements identiques", async () => {
    const plan = await planPreparation(db, stockage, voyageId);
    // 10 photos dans les pages + la couverture (même photo que la première ouverture ? pas forcément)
    expect(plan.total).toBeGreaterThanOrEqual(10);
    expect(plan.prets).toBe(0);
    for (const i of plan.images) {
      expect(i.largeurPx).toBeLessThanOrEqual(Math.ceil((200 / 25.4) * 300) + 80);
      expect(i.cle).toMatch(new RegExp(`^voyages/${voyageId}/livre/images/[0-9a-f]{32}\\.jpg$`));
      expect(i.urlEnvoi).toContain("/api/stockage-local");
    }
    expect(plan.images.find((i) => i.retouche)?.retouche?.filtre).toBe("noir-et-blanc");
    // Un original trop petit n'est jamais agrandi.
    const [{ images }] = [planImages(voyageId, (await import("@/server/domaine/livre").then((m) => m.livreDe(db, voyageId)))!.contenu, carre, new Map(
      (await db.query.media.findMany()).map((m) => [m.id, { id: m.id, nomFichier: m.nomFichier, cleOriginal: m.cleOriginal, largeur: 600, hauteur: 400, retouche: null }]),
    ))];
    for (const i of images) expect(i.largeurPx).toBeLessThanOrEqual(600);
  });

  it("assemble l'intérieur et la couverture, reprend sans refaire, remplace l'export précédent", async () => {
    await expect(assemblerLivre(db, stockage, voyageId, "naxos")).rejects.toThrow(/pas encore préparées/);
    const plan = await planPreparation(db, stockage, voyageId);
    // On prépare la moitié, le plan suivant ne demande que le reste (reprise).
    const moitie = Math.floor(plan.images.length / 2);
    const preparer = async (i: (typeof plan.images)[number]) =>
      stockage.ecrire(i.cle, await sharp({ create: { width: i.largeurPx, height: i.hauteurPx, channels: 3, background: "#4a7" } }).jpeg().toBuffer());
    for (const i of plan.images.slice(0, moitie)) await preparer(i);
    const reprise = await planPreparation(db, stockage, voyageId);
    expect(reprise.prets).toBe(moitie);
    for (const i of reprise.images) await preparer(i);

    const r = await assemblerLivre(db, stockage, voyageId, "naxos");
    expect(r.pages).toBe(24);
    expect(r.avertissements).toEqual([]);
    const pdf = await PDFDocument.load(await stockage.lire(r.interieur.cle));
    expect(pdf.getPageCount()).toBe(24);
    const p = pdf.getPage(3);
    const trim = p.getTrimBox();
    expect([trim.x / MM, trim.y / MM, trim.width / MM, trim.height / MM].map((x) => Math.round(x * 10) / 10)).toEqual([3, 3, 200, 200]);
    expect(p.getBleedBox().width / MM).toBeCloseTo(206, 1);
    // Les JPEG sont intégrés tels quels (filtre DCTDecode).
    const brut = Buffer.from(await stockage.lire(r.interieur.cle)).toString("latin1");
    expect((brut.match(/\/DCTDecode/g) ?? []).length).toBeGreaterThanOrEqual(plan.total - 1);
    expect(pdf.catalog.get(PDFName.of("Lang"))?.toString()).toContain("fr-FR");
    const couv = await PDFDocument.load(await stockage.lire(r.couverture.cle));
    expect(couv.getPageCount()).toBe(1);
    expect(couv.getPage(0).getWidth() / MM).toBeCloseTo(r.couverture.largeurMm, 1);

    // Nouvel export : le précédent est supprimé du stockage.
    const r2 = await assemblerLivre(db, stockage, voyageId, "naxos");
    expect(await stockage.taille(r.interieur.cle)).toBeNull();
    expect((await dernierExport(db, voyageId))?.interieur.cle).toBe(r2.interieur.cle);
  }, 60_000);
});

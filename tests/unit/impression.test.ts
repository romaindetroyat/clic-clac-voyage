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
import { urlsMembre } from "@/server/domaine/medias";
import { enregistrerLivre, episodesDuLivre, mediasDuLivre } from "@/server/domaine/livre";
import { proposerDecoupage } from "@/server/domaine/recit";
import { creerVoyage } from "@/server/domaine/voyages";
import { assemblerLivre, compilerTypst, dernierExport, planImages, planPreparation } from "@/server/livre/impression";
import { fichiersPdf } from "@/server/livre/feuilles";
import { chaine, sourceFeuilles } from "@/server/livre/typst";
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
    const [fi, fc] = fichiersPdf(carre, 24);
    const octets = await compilerTypst(sourceFeuilles(livre, carre, fi.feuilles));
    const texte = Buffer.from(octets).toString("latin1");
    expect(texte).toMatch(/\/FontName\s*\/[A-Z]{6}\+EBGaramond/);
    expect(texte).toMatch(/\/FontName\s*\/[A-Z]{6}\+Inter/);
    expect(texte).toContain("/FontFile2");
    const interieur = await PDFDocument.load(octets);
    expect(interieur.getPageCount()).toBe(24);
    const { width, height } = interieur.getPage(0).getSize();
    expect(width / MM).toBeCloseTo(206, 1);
    expect(height / MM).toBeCloseTo(206, 1);
    const couverture = await PDFDocument.load(await compilerTypst(sourceFeuilles(livre, carre, fc.feuilles)));
    // 2 × 200 + dos 7,8 + 2 × 3 de fond perdu
    expect(couverture.getPage(0).getWidth() / MM).toBeCloseTo(413.8, 1);
  });
});

describe("impression : styles et gabarits créatifs", () => {
  it("chaque style embarque ses polices ; chaque gabarit compile, couche du dessus comprise", async () => {
    const { GABARITS } = await import("@/lib/livre/gabarits");
    const { IDS_STYLES, POLICES, STYLES } = await import("@/lib/livre/styles");
    const medias = Array.from({ length: 9 }, (_, i) => ({
      id: `m${i}`, largeur: i % 2 ? 3000 : 4000, hauteur: i % 2 ? 4000 : 3000, episodeId: "e", instant: null, legende: `Légende ${i} : « été » à l’Hôtel`,
      auteur: null, vedette: false, qualite: null, vignette: null, moyenne: null, commentaires: [],
    }));
    const base = mettreEnPage({
      nom: "Été à Naxos", periode: "août 2026", fuseau: "UTC", format: carre,
      options: { ciblePages: 24, rythme: "equilibre", fond: "blanc", legendes: true, commentaires: false },
      episodes: [{ id: "e", titre: "L’arrivée", lieu: null, recit: "Le ferry accoste.", debut: null, fin: null }], medias,
    }).livre;
    // Une page par gabarit, toutes les photos légendées.
    const pages = GABARITS.map((g, i) => ({
      id: `p${i}`, gabarit: g.id, titre: "Titre", surtitre: "Surtitre", corps: "Récit de la journée.", legende: "Légende de page",
      cellules: Array.from({ length: g.n }, (_, j) => ({ mediaId: `m${j}`, zoom: 1, cx: 0.5, cy: 0.5, legende: `Photo ${j}` })),
      fond: i % 3 ? undefined : ("sauge" as const),
    }));
    const ratios = new Map(medias.map((m) => [m.id, m.largeur / m.hauteur]));
    for (const style of IDS_STYLES) {
      const livre = { ...base, options: { ...base.options, style, fond: "ocean" as const }, pages: pages.length % 2 ? [...pages, { id: "v", gabarit: "vierge", cellules: [] }] : pages };
      const [fi] = fichiersPdf(carre, livre.pages.length);
      const dessous = Buffer.from(await compilerTypst(sourceFeuilles(livre, carre, fi.feuilles, { ratios }))).toString("latin1");
      const dessus = await compilerTypst(sourceFeuilles(livre, carre, fi.feuilles, { ratios, couche: "dessus" }));
      expect((await PDFDocument.load(dessus)).getPageCount()).toBe(livre.pages.length);
      const st = STYLES[style];
      for (const r of ["titre", "corps", "legende"] as const) {
        const famille = POLICES[st[r].police].famille.replace(/ /g, "");
        expect(dessous, `${style} ${r}`).toMatch(new RegExp(`/FontName\\s*/[A-Z]{6}\\+${famille}`));
      }
    }
  }, 60_000);
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
      episodes: await episodesDuLivre(db, voyageId), medias: await mediasDuLivre(db, urlsMembre("naxos"), voyageId),
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
    expect(r.fichiers.map((x) => x.suffixe)).toEqual(["interieur", "couverture"]);
    const [interieur, couvertureF] = r.fichiers;
    const pdf = await PDFDocument.load(await stockage.lire(interieur.cle));
    expect(pdf.getPageCount()).toBe(24);
    const p = pdf.getPage(3);
    const trim = p.getTrimBox();
    expect([trim.x / MM, trim.y / MM, trim.width / MM, trim.height / MM].map((x) => Math.round(x * 10) / 10)).toEqual([3, 3, 200, 200]);
    expect(p.getBleedBox().width / MM).toBeCloseTo(206, 1);
    // Les JPEG sont intégrés tels quels (filtre DCTDecode).
    const brut = Buffer.from(await stockage.lire(interieur.cle)).toString("latin1");
    expect((brut.match(/\/DCTDecode/g) ?? []).length).toBeGreaterThanOrEqual(plan.total - 1);
    expect(pdf.catalog.get(PDFName.of("Lang"))?.toString()).toContain("fr-FR");
    const couv = await PDFDocument.load(await stockage.lire(couvertureF.cle));
    expect(couv.getPageCount()).toBe(1);
    expect(couv.getPage(0).getWidth() / MM).toBeCloseTo(couvertureF.largeurMm, 1);

    // Nouvel export : le précédent est supprimé du stockage.
    const r2 = await assemblerLivre(db, stockage, voyageId, "naxos");
    expect(await stockage.taille(interieur.cle)).toBeNull();
    expect((await dernierExport(db, voyageId))?.fichiers[0].cle).toBe(r2.fichiers[0].cle);
  }, 60_000);
});

describe("impression : profils d'export par imprimeur", () => {
  const pages = (f: ReturnType<typeof fichiersPdf>[number]) => f.feuilles.map((x) => x.vues.map((v) => (v.contenu.type === "page" ? v.contenu.numero : v.contenu.type)));

  it("générique : intérieur en pages simples et couverture d'une pièce", () => {
    const [i, c] = fichiersPdf(formatParId("portrait-21x28"), 24);
    expect(i.feuilles).toHaveLength(24);
    expect(c.feuilles[0].vues.map((v) => v.contenu.type)).toEqual(["quatrieme", "dos", "premiere"]);
  });

  it("Saal Digital : intérieur en doubles pages, page 1 seule à droite, rien ne déborde au pli", () => {
    const f = formatParId("saal:28x28");
    const [i] = fichiersPdf(f, 26);
    expect(i.titre).toMatch(/doubles pages/);
    expect(pages(i)).toEqual([[1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17], [18, 19], [20, 21], [22, 23], [24, 25], [26]]);
    const planche = i.feuilles[1];
    expect(planche.largeur).toBe(2 * 280 + 6);
    const [g, d] = planche.vues;
    expect(g.clip.x + g.clip.l).toBe(d.clip.x); // découpe exactement au pli
    expect(d.dx).toBe(3 + 280);
  });

  it("Gelato : un seul PDF, couverture étalée, gardes vierges", () => {
    const [u] = fichiersPdf(formatParId("gelato:8x11"), 30);
    expect(u.suffixe).toBe("livre");
    expect(u.feuilles).toHaveLength(33);
    expect(u.feuilles[0].vues.map((v) => v.contenu.type)).toEqual(["quatrieme", "dos", "premiere"]);
    expect(u.feuilles[1].vues).toEqual([]);
    expect(u.feuilles[32].vues).toEqual([]);
  });

  it("Prodigi : un seul PDF en pages simples, sans fond perdu ni dos", () => {
    const [u] = fichiersPdf(formatParId("prodigi:a4-portrait"), 24);
    expect(pages(u)[0]).toEqual(["premiere"]);
    expect(pages(u).at(-1)).toEqual(["quatrieme"]);
    expect(u.feuilles).toHaveLength(26);
    expect(u.feuilles[0]).toMatchObject({ largeur: 210, hauteur: 300, fondPerdu: 0 });
  });

  it("CEWE : fond perdu de 10 mm sur la couverture, 3 mm à l'intérieur", () => {
    const [i, c] = fichiersPdf(formatParId("cewe:21x28"), 26);
    expect(i.feuilles[0].fondPerdu).toBe(3);
    expect(c.feuilles[0].fondPerdu).toBe(10);
  });
});

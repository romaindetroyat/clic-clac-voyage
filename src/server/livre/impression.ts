/**
 * Export PDF du livre.
 *
 * 1. Plan : pour chaque cadre, la partie de la photo à imprimer et sa taille à 300 dpi.
 *    Chaque image préparée a une clé qui dépend de tout ce qui la change (photo, retouche,
 *    recadrage, taille) : déjà présente sur le stockage, elle n'est pas refaite (reprise).
 * 2. Préparation : dans le navigateur de l'administrateur, avec le moteur de retouche de
 *    l'écran (rendu identique), puis envoi direct sur le stockage.
 * 3. Assemblage (ici, côté serveur) : Typst compose fonds et textes, pdf-lib pose les JPEG
 *    tels quels et les boîtes d'impression (TrimBox, BleedBox).
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { clip, concatTransformationMatrix, endPath, PDFDocument, PDFName, PDFString, popGraphicsState, pushGraphicsState, rectangle } from "@cantoo/pdf-lib";
import { and, eq, inArray } from "drizzle-orm";
import { rectSource } from "@/lib/livre/cadrage";
import { DPI_ALERTE, DPI_BLOQUANT, controler } from "@/lib/livre/controles";
import { epaisseurDos, formatParId, type Format } from "@/lib/livre/formats";
import { geometrieCouverture, geometriePage, type CadrePhoto, type Rect } from "@/lib/livre/gabarits";
import { ratiosDe, type Cellule, type Livre, type MediaLivre } from "@/lib/livre/modele";
import { empreinteRetouche, estNeutre, schemaRetouche, type Retouche } from "@/lib/rendu/parametres";
import type { Db } from "../db/client";
import { livre as tableLivre, media } from "../db/schema";
import { dimensionsEffectives, livreDe } from "../domaine/livre";
import { ErreurMetier } from "../domaine/voyages";
import type { Stockage } from "../stockage/types";
import { fichiersPdf, profilDe, type Feuille } from "./feuilles";
import { aUneCoucheDessus, sourceFeuilles } from "./typst";

export const DPI = 300;
const PT = 72 / 25.4;

type Fractions = { x: number; y: number; l: number; h: number };

export type ImageAImprimer = {
  cle: string;
  mediaId: string;
  nomFichier: string;
  cleOriginal: string;
  retouche: Retouche | null;
  /** Partie de la photo (après retouche) à imprimer, en fractions de sa largeur et de sa hauteur. */
  fractions: Fractions;
  largeurPx: number;
  hauteurPx: number;
  /** Où la poser : page (0 = couverture) et cadre en mm (coordonnées de la page rognée). */
  emplacements: { page: number; cadre: CadrePhoto }[];
};

type MediaImpression = { id: string; nomFichier: string; cleOriginal: string; largeur: number; hauteur: number; retouche: Retouche | null };

async function mediasImpression(db: Db, voyageId: string, ids: string[]): Promise<Map<string, MediaImpression>> {
  if (!ids.length) return new Map();
  const lignes = await db
    .select({ id: media.id, nomFichier: media.nomFichier, cleOriginal: media.cleOriginal, largeur: media.largeur, hauteur: media.hauteur, retouche: media.retouche })
    .from(media)
    .where(and(eq(media.voyageId, voyageId), inArray(media.id, ids)));
  return new Map(
    lignes
      .filter((l) => l.largeur && l.hauteur)
      .map((l) => {
        const r = l.retouche ? schemaRetouche.safeParse(l.retouche) : null;
        const retouche = r?.success && !estNeutre(r.data) ? r.data : null;
        return [l.id, { id: l.id, nomFichier: l.nomFichier, cleOriginal: l.cleOriginal, largeur: l.largeur!, hauteur: l.hauteur!, retouche }];
      }),
  );
}

function arrondi(x: number) {
  return Math.round(x * 10000) / 10000;
}

/** Proportions des photos après retouche (recadrage compris). */
function ratiosImpression(medias: Map<string, MediaImpression>): Map<string, number> {
  return new Map(
    [...medias.values()].map((m) => {
      const [l, h] = dimensionsEffectives(m.largeur, m.hauteur, m.retouche);
      return [m.id, l / h];
    }),
  );
}

/** Plan des images : une entrée par image distincte à préparer, avec tous ses emplacements. */
export function planImages(voyageId: string, livre: Livre, f: Format, medias: Map<string, MediaImpression>) {
  const images = new Map<string, ImageAImprimer>();
  const manquantes: number[] = [];
  const ajouter = (page: number, cadre: CadrePhoto, c: Cellule | null) => {
    if (!c) return;
    const m = medias.get(c.mediaId);
    if (!m) {
      manquantes.push(page);
      return;
    }
    const [l, h] = dimensionsEffectives(m.largeur, m.hauteur, m.retouche);
    const src = rectSource(l, h, cadre.l / cadre.h, c);
    const fractions = { x: arrondi(src.x / l), y: arrondi(src.y / h), l: arrondi(src.l / l), h: arrondi(src.h / h) };
    // 300 dpi, sans jamais agrandir au-delà des pixels disponibles.
    let largeurPx = Math.round((cadre.l / 25.4) * DPI);
    let hauteurPx = Math.round((cadre.h / 25.4) * DPI);
    if (src.l < largeurPx) {
      largeurPx = Math.max(1, Math.round(src.l));
      hauteurPx = Math.max(1, Math.round(src.h));
    }
    const empreinte = createHash("sha256")
      .update(JSON.stringify([m.id, m.retouche ? empreinteRetouche(m.retouche) : "", fractions, largeurPx, hauteurPx]))
      .digest("hex")
      .slice(0, 32);
    const cle = `voyages/${voyageId}/livre/images/${empreinte}.jpg`;
    const deja = images.get(cle);
    if (deja) deja.emplacements.push({ page, cadre });
    else
      images.set(cle, {
        cle,
        mediaId: m.id,
        nomFichier: m.nomFichier,
        cleOriginal: m.cleOriginal,
        retouche: m.retouche,
        fractions,
        largeurPx,
        hauteurPx,
        emplacements: [{ page, cadre }],
      });
  };
  const ratios = ratiosImpression(medias);
  livre.pages.forEach((p, i) =>
    geometriePage(f, p.gabarit, i + 1, ratiosDe(p.cellules, (id) => (ratios.has(id) ? { largeur: ratios.get(id)!, hauteur: 1 } : undefined))).photos.forEach((cadre, ci) =>
      ajouter(i + 1, cadre, p.cellules[ci] ?? null),
    ),
  );
  ajouter(0, geometrieCouverture(f).premiere.photos[0], livre.couverture.photo);
  return { images: [...images.values()], manquantes };
}

/** Livre enregistré, ses photos et son plan d'images. */
async function charger(db: Db, voyageId: string) {
  const l = await livreDe(db, voyageId);
  if (!l) throw new ErreurMetier("Le livre n’existe pas encore.");
  const f = formatParId(l.contenu.formatId);
  const ids = [...new Set([...l.contenu.pages.flatMap((p) => p.cellules.map((c) => c?.mediaId)), l.contenu.couverture.photo?.mediaId])].filter(
    (x): x is string => !!x,
  );
  const medias = await mediasImpression(db, voyageId, ids);
  return { livre: l.contenu, revision: l.revision, format: f, medias, ratios: ratiosImpression(medias), ...planImages(voyageId, l.contenu, f, medias) };
}

/** Problèmes bloquants du livre enregistré (mêmes contrôles que l'éditeur). */
function bloquants(livre: Livre, f: Format, medias: Map<string, MediaImpression>) {
  const pourControle = new Map<string, MediaLivre>(
    [...medias.values()].map((m) => {
      const [largeur, hauteur] = dimensionsEffectives(m.largeur, m.hauteur, m.retouche);
      return [m.id, { id: m.id, largeur, hauteur } as MediaLivre];
    }),
  );
  return controler(livre, f, pourControle).filter((p) => p.niveau === "bloquant");
}

async function existants(stockage: Stockage, cles: string[]) {
  const presents = new Set<string>();
  for (let i = 0; i < cles.length; i += 24) {
    const lot = cles.slice(i, i + 24);
    const tailles = await Promise.all(lot.map((c) => stockage.taille(c)));
    lot.forEach((c, j) => tailles[j] && presents.add(c));
  }
  return presents;
}

/** Images encore à préparer, avec de quoi les fabriquer et les envoyer. */
export async function planPreparation(db: Db, stockage: Stockage, voyageId: string) {
  const c = await charger(db, voyageId);
  const b = bloquants(c.livre, c.format, c.medias);
  if (b.length) throw new ErreurMetier(`Le livre a ${b.length} problème(s) bloquant(s) : corrigez-les avant d’exporter (${b[0].message}).`);
  const presents = await existants(stockage, c.images.map((i) => i.cle));
  const aFaire = c.images.filter((i) => !presents.has(i.cle));
  return {
    total: c.images.length,
    prets: c.images.length - aFaire.length,
    images: await Promise.all(
      aFaire.map(async (i) => ({
        cle: i.cle,
        nomFichier: i.nomFichier,
        retouche: i.retouche,
        fractions: i.fractions,
        largeurPx: i.largeurPx,
        hauteurPx: i.hauteurPx,
        urlOriginal: await stockage.urlLecture(i.cleOriginal, 3 * 3600),
        urlEnvoi: await stockage.urlEnvoi(i.cle, "image/jpeg"),
      })),
    ),
  };
}

export type ImagePreparation = Awaited<ReturnType<typeof planPreparation>>["images"][number];

let compilateur: Promise<import("@myriaddreamin/typst-ts-node-compiler").NodeCompiler> | null = null;
function typst() {
  compilateur ??= import("@myriaddreamin/typst-ts-node-compiler").then(({ NodeCompiler }) =>
    NodeCompiler.create({ workspace: process.cwd(), fontArgs: [{ fontPaths: [path.join(process.cwd(), "polices")] }] }),
  );
  return compilateur;
}

export async function compilerTypst(source: string): Promise<Uint8Array> {
  const c = await typst();
  return new Uint8Array(c.pdf({ mainFileContent: source }, { pdfTags: false }));
}

/**
 * Pose les images de chaque feuille, découpées à la zone de leur page logique (une photo
 * pleine page ne déborde jamais sur la page d'en face). Origine PDF en bas à gauche, en points.
 */
async function poserImages(doc: PDFDocument, stockage: Stockage, images: ImageAImprimer[], feuilles: Feuille[]) {
  const pageDe = (c: Feuille["vues"][number]["contenu"]) => (c.type === "page" ? c.numero : c.type === "premiere" ? 0 : -1);
  for (const img of images) {
    const poses: { index: number; x: number; y: number; l: number; h: number; rotation: number; clip: Rect; hauteur: number }[] = [];
    feuilles.forEach((fe, index) => {
      for (const v of fe.vues) {
        for (const e of img.emplacements) {
          if (e.page !== pageDe(v.contenu)) continue;
          poses.push({ index, x: v.dx + e.cadre.x, y: v.dy + e.cadre.y, l: e.cadre.l, h: e.cadre.h, rotation: e.cadre.rotation ?? 0, clip: v.clip, hauteur: fe.hauteur });
        }
      }
    });
    if (!poses.length) continue;
    const jpeg = await doc.embedJpg(await stockage.lire(img.cle));
    for (const p of poses) {
      const pg = doc.getPage(p.index);
      const H = p.hauteur;
      pg.pushOperators(
        pushGraphicsState(),
        rectangle(p.clip.x * PT, (H - p.clip.y - p.clip.h) * PT, p.clip.l * PT, p.clip.h * PT),
        clip(),
        endPath(),
      );
      if (p.rotation) {
        // Rotation autour du centre du cadre ; sens horaire à l'écran = angle négatif en PDF (y vers le haut).
        const a = (-p.rotation * Math.PI) / 180;
        const cx = (p.x + p.l / 2) * PT;
        const cy = (H - p.y - p.h / 2) * PT;
        pg.pushOperators(concatTransformationMatrix(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), cx, cy));
        pg.drawImage(jpeg, { x: (-p.l / 2) * PT, y: (-p.h / 2) * PT, width: p.l * PT, height: p.h * PT });
      } else {
        pg.drawImage(jpeg, { x: p.x * PT, y: (H - p.y - p.h) * PT, width: p.l * PT, height: p.h * PT });
      }
      pg.pushOperators(popGraphicsState());
    }
  }
}

/** Pose la couche « dessus » (voiles, textes sur les photos), feuille par feuille, après les photos. */
async function poserDessus(doc: PDFDocument, octets: Uint8Array) {
  const source = await PDFDocument.load(octets);
  if (source.getPageCount() !== doc.getPageCount()) throw new Error("Typst : nombre de feuilles inattendu (couche du dessus)");
  const pages = await doc.embedPdf(source, source.getPageIndices());
  pages.forEach((p, i) => doc.getPage(i).drawPage(p, { x: 0, y: 0 }));
}

function metadonnees(doc: PDFDocument, titre: string) {
  doc.setTitle(titre);
  doc.setProducer("Clic-Clac Voyage");
  doc.setCreator("Clic-Clac Voyage");
  doc.setLanguage("fr-FR");
  doc.catalog.set(PDFName.of("Lang"), PDFString.of("fr-FR"));
}

export type FichierExporte = { suffixe: string; titre: string; cle: string; taille: number; feuilles: number; largeurMm: number; hauteurMm: number };

export type ResultatExport = {
  revision: number;
  le: string;
  pages: number;
  /** Imprimeur dont le profil a servi (null = format générique). */
  imprimeur: string | null;
  dosMm: number;
  fichiers: FichierExporte[];
  avertissements: string[];
};

/** Assemble les fichiers du profil de l'imprimeur, les dépose sur le stockage, renvoie le résultat. */
export async function assemblerLivre(db: Db, stockage: Stockage, voyageId: string, nomFichier: string): Promise<ResultatExport> {
  const c = await charger(db, voyageId);
  const b = bloquants(c.livre, c.format, c.medias);
  if (b.length) throw new ErreurMetier(`Le livre a ${b.length} problème(s) bloquant(s) : corrigez-les avant d’exporter.`);
  const presents = await existants(stockage, c.images.map((i) => i.cle));
  const manquantes = c.images.filter((i) => !presents.has(i.cle)).length;
  if (manquantes) throw new ErreurMetier(`${manquantes} photo(s) ne sont pas encore préparées pour l’impression.`);
  const f = c.format;
  const profil = profilDe(f);

  // Contrôles : résolution effective de chaque photo posée.
  const avertissements: string[] = [];
  for (const img of c.images) {
    for (const e of img.emplacements) {
      const dpi = Math.round(img.largeurPx / (e.cadre.l / 25.4));
      if (dpi < DPI_BLOQUANT) throw new ErreurMetier(`Page ${e.page} : photo à ${dpi} dpi, trop petite pour l’impression.`);
      if (dpi < DPI_ALERTE) avertissements.push(`${e.page ? `Page ${e.page}` : "Couverture"} : photo à ${dpi} dpi.`);
    }
  }

  const horodatage = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const base = `voyages/${voyageId}/livre/export/${horodatage}-${nomFichier}`;
  const fichiers: FichierExporte[] = [];
  const dessus = aUneCoucheDessus(c.livre, f, c.ratios);
  for (const fp of fichiersPdf(f, c.livre.pages.length)) {
    const doc = await PDFDocument.load(await compilerTypst(sourceFeuilles(c.livre, f, fp.feuilles, { ratios: c.ratios })));
    if (doc.getPageCount() !== fp.feuilles.length) throw new Error("Typst : nombre de feuilles inattendu");
    await poserImages(doc, stockage, c.images, fp.feuilles);
    if (dessus) await poserDessus(doc, await compilerTypst(sourceFeuilles(c.livre, f, fp.feuilles, { ratios: c.ratios, couche: "dessus" })));
    fp.feuilles.forEach((fe, i) => {
      const pg = doc.getPage(i);
      pg.setBleedBox(0, 0, fe.largeur * PT, fe.hauteur * PT);
      pg.setTrimBox(fe.fondPerdu * PT, fe.fondPerdu * PT, (fe.largeur - 2 * fe.fondPerdu) * PT, (fe.hauteur - 2 * fe.fondPerdu) * PT);
    });
    metadonnees(doc, `${c.livre.couverture.titre} : ${fp.titre}`);
    const octets = await doc.save({ useObjectStreams: false });
    const cle = `${base}-${fp.suffixe}.pdf`;
    await stockage.ecrire(cle, octets, "application/pdf");
    const premiere = fp.feuilles.find((x) => x.vues.some((v) => v.contenu.type === "dos")) ?? fp.feuilles[0];
    fichiers.push({ suffixe: fp.suffixe, titre: fp.titre, cle, taille: octets.length, feuilles: fp.feuilles.length, largeurMm: premiere.largeur, hauteurMm: premiere.hauteur });
  }

  const resultat: ResultatExport = {
    revision: c.revision,
    le: new Date().toISOString(),
    pages: c.livre.pages.length,
    imprimeur: profil.imprimeur,
    dosMm: epaisseurDos(f, c.livre.pages.length),
    fichiers,
    avertissements,
  };

  // L'export précédent est remplacé.
  const avant = await db.query.livre.findFirst({ where: eq(tableLivre.voyageId, voyageId), columns: { export: true } });
  const ancien = avant?.export as Partial<ResultatExport> | null | undefined;
  const anciennes = ancien?.fichiers?.map((x) => x.cle) ?? [];
  // Exports d'avant ce format de résultat : intérieur et couverture.
  const vieux = ancien as { interieur?: { cle: string }; couverture?: { cle: string } } | null | undefined;
  if (vieux?.interieur?.cle) anciennes.push(vieux.interieur.cle);
  if (vieux?.couverture?.cle) anciennes.push(vieux.couverture.cle);
  if (anciennes.length) await stockage.supprimer(anciennes).catch(() => {});
  await db.update(tableLivre).set({ export: resultat }).where(eq(tableLivre.voyageId, voyageId));
  return resultat;
}

export async function dernierExport(db: Db, voyageId: string): Promise<ResultatExport | null> {
  const l = await db.query.livre.findFirst({ where: eq(tableLivre.voyageId, voyageId), columns: { export: true } });
  const r = l?.export as ResultatExport | null | undefined;
  // Les exports d'un format plus ancien sont ignorés : il suffit de refaire le PDF.
  return r && Array.isArray(r.fichiers) ? r : null;
}

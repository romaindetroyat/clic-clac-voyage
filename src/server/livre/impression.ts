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
import { PDFDocument, PDFName, PDFString } from "@cantoo/pdf-lib";
import { and, eq, inArray } from "drizzle-orm";
import { rectSource } from "@/lib/livre/cadrage";
import { DPI_ALERTE, DPI_BLOQUANT, controler } from "@/lib/livre/controles";
import { formatParId, type Format } from "@/lib/livre/formats";
import { geometrieCouverture, geometriePage, type Rect } from "@/lib/livre/gabarits";
import type { Cellule, Livre, MediaLivre } from "@/lib/livre/modele";
import { empreinteRetouche, estNeutre, schemaRetouche, type Retouche } from "@/lib/rendu/parametres";
import type { Db } from "../db/client";
import { livre as tableLivre, media } from "../db/schema";
import { dimensionsEffectives, livreDe } from "../domaine/livre";
import { ErreurMetier } from "../domaine/voyages";
import type { Stockage } from "../stockage/types";
import { geometrieCouvertureComplete, sourceCouverture, sourceInterieur } from "./typst";

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
  emplacements: { page: number; cadre: Rect }[];
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

/** Plan des images : une entrée par image distincte à préparer, avec tous ses emplacements. */
export function planImages(voyageId: string, livre: Livre, f: Format, medias: Map<string, MediaImpression>) {
  const images = new Map<string, ImageAImprimer>();
  const manquantes: number[] = [];
  const ajouter = (page: number, cadre: Rect, c: Cellule | null) => {
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
  livre.pages.forEach((p, i) => geometriePage(f, p.gabarit, i + 1).photos.forEach((cadre, ci) => ajouter(i + 1, cadre, p.cellules[ci] ?? null)));
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
  return { livre: l.contenu, revision: l.revision, format: f, medias, ...planImages(voyageId, l.contenu, f, medias) };
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

/** Pose les images sur les pages (coordonnées PDF : origine en bas à gauche, en points). */
async function poserImages(
  doc: PDFDocument,
  stockage: Stockage,
  images: ImageAImprimer[],
  page: (numero: number) => { index: number; dx: number; dy: number } | null,
) {
  for (const img of images) {
    const cibles = img.emplacements.map((e) => ({ e, p: page(e.page) })).filter((x) => x.p);
    if (!cibles.length) continue;
    const jpeg = await doc.embedJpg(await stockage.lire(img.cle));
    for (const { e, p } of cibles) {
      const pg = doc.getPage(p!.index);
      const hauteur = pg.getHeight();
      pg.drawImage(jpeg, {
        x: (p!.dx + e.cadre.x) * PT,
        y: hauteur - (p!.dy + e.cadre.y + e.cadre.h) * PT,
        width: e.cadre.l * PT,
        height: e.cadre.h * PT,
      });
    }
  }
}

function metadonnees(doc: PDFDocument, titre: string) {
  doc.setTitle(titre);
  doc.setProducer("Clic-Clac Voyage");
  doc.setCreator("Clic-Clac Voyage");
  doc.setLanguage("fr-FR");
  // Pas de date variable : deux exports identiques donnent le même fichier (hors identifiant).
  doc.catalog.set(PDFName.of("Lang"), PDFString.of("fr-FR"));
}

export type ResultatExport = {
  revision: number;
  le: string;
  pages: number;
  interieur: { cle: string; taille: number };
  couverture: { cle: string; taille: number; largeurMm: number; hauteurMm: number; dosMm: number };
  avertissements: string[];
};

/** Assemble l'intérieur et la couverture, les dépose sur le stockage, renvoie le résultat. */
export async function assemblerLivre(db: Db, stockage: Stockage, voyageId: string, nomFichier: string): Promise<ResultatExport> {
  const c = await charger(db, voyageId);
  const b = bloquants(c.livre, c.format, c.medias);
  if (b.length) throw new ErreurMetier(`Le livre a ${b.length} problème(s) bloquant(s) : corrigez-les avant d’exporter.`);
  const presents = await existants(stockage, c.images.map((i) => i.cle));
  const manquantes = c.images.filter((i) => !presents.has(i.cle)).length;
  if (manquantes) throw new ErreurMetier(`${manquantes} photo(s) ne sont pas encore préparées pour l’impression.`);
  const f = c.format;
  const bp = f.fondPerdu;

  // Intérieur
  const interieur = await PDFDocument.load(await compilerTypst(sourceInterieur(c.livre, f)));
  if (interieur.getPageCount() !== c.livre.pages.length) throw new Error("Typst : nombre de pages inattendu");
  await poserImages(interieur, stockage, c.images, (n) => (n >= 1 ? { index: n - 1, dx: bp, dy: bp } : null));
  for (const pg of interieur.getPages()) {
    pg.setBleedBox(0, 0, (f.largeur + 2 * bp) * PT, (f.hauteur + 2 * bp) * PT);
    pg.setTrimBox(bp * PT, bp * PT, f.largeur * PT, f.hauteur * PT);
  }
  metadonnees(interieur, `${c.livre.couverture.titre} : intérieur`);
  const octetsInterieur = await interieur.save({ useObjectStreams: false });

  // Couverture : quatrième, dos, première, d'un seul tenant.
  const gc = geometrieCouvertureComplete(f, c.livre.pages.length);
  const couverture = await PDFDocument.load(await compilerTypst(sourceCouverture(c.livre, f)));
  await poserImages(couverture, stockage, c.images, (n) => (n === 0 ? { index: 0, dx: gc.premiere.x, dy: gc.premiere.y } : null));
  const [pc] = couverture.getPages();
  pc.setBleedBox(0, 0, gc.largeur * PT, gc.hauteur * PT);
  pc.setTrimBox(bp * PT, bp * PT, (gc.largeur - 2 * bp) * PT, f.hauteur * PT);
  metadonnees(couverture, `${c.livre.couverture.titre} : couverture`);
  const octetsCouverture = await couverture.save({ useObjectStreams: false });

  // Contrôles du résultat : résolution effective de chaque photo posée.
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
  const resultat: ResultatExport = {
    revision: c.revision,
    le: new Date().toISOString(),
    pages: c.livre.pages.length,
    interieur: { cle: `${base}-interieur.pdf`, taille: octetsInterieur.length },
    couverture: { cle: `${base}-couverture.pdf`, taille: octetsCouverture.length, largeurMm: gc.largeur, hauteurMm: gc.hauteur, dosMm: gc.dos },
    avertissements,
  };
  await stockage.ecrire(resultat.interieur.cle, octetsInterieur, "application/pdf");
  await stockage.ecrire(resultat.couverture.cle, octetsCouverture, "application/pdf");

  // L'export précédent est remplacé.
  const avant = await db.query.livre.findFirst({ where: eq(tableLivre.voyageId, voyageId), columns: { export: true } });
  const ancien = avant?.export as ResultatExport | null | undefined;
  if (ancien?.interieur?.cle) await stockage.supprimer([ancien.interieur.cle, ancien.couverture.cle]).catch(() => {});
  await db.update(tableLivre).set({ export: resultat }).where(eq(tableLivre.voyageId, voyageId));
  return resultat;
}

export async function dernierExport(db: Db, voyageId: string): Promise<ResultatExport | null> {
  const l = await db.query.livre.findFirst({ where: eq(tableLivre.voyageId, voyageId), columns: { export: true } });
  return (l?.export as ResultatExport | null) ?? null;
}

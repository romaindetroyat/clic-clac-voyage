import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { detecterRafales } from "@/server/domaine/rafales";
import { avisIaMoment, compterATrier, donneesTri, trier } from "@/server/domaine/tri";
import { creerVoyage } from "@/server/domaine/voyages";
import type { AppelIa } from "@/server/ia/client";
import { StockageLocal } from "@/server/stockage/local";
import { baseDeTest, creerUtilisateur } from "./aide-db";
import { pixel } from "@/lib/rendu/couleur";
import { retoucheAuto } from "@/lib/rendu/auto";
import { NEUTRE } from "@/lib/rendu/parametres";
import { defauts, effet, moments, suggestion, type PhotoTri } from "@/lib/tri/moments";

let n = 0;
const p = (o: Partial<PhotoTri> = {}): PhotoTri => ({
  id: `p${++n}`,
  type: "photo",
  instant: "2026-08-03T10:00:00.000Z",
  dhash: "0f0f0f0f0f0f0f0f",
  rafaleId: null,
  nettete: 0.6,
  exposition: 0.6,
  ...o,
});
const t = (s: number) => new Date(Date.parse("2026-08-03T10:00:00.000Z") + s * 1000).toISOString();

describe("tri : moments", () => {
  it("regroupe les photos semblables prises à moins de deux minutes, garde l'ordre", () => {
    const l = [
      p({ instant: t(0) }),
      p({ instant: t(30) }),
      p({ instant: t(100) }), // 70 s après la précédente : même moment
      p({ instant: t(400) }), // trop loin
      p({ instant: t(410), dhash: "f0f0f0f0f0f0f0f0" }), // autre scène
      p({ instant: t(420), type: "video" }),
      p({ instant: null }),
    ];
    expect(moments(l).map((m) => m.length)).toEqual([3, 1, 1, 1, 1]);
    expect(moments(l).flat()).toEqual(l);
  });

  it("une rafale détectée reste groupée même sans empreinte", () => {
    expect(moments([p({ rafaleId: "r", dhash: null }), p({ rafaleId: "r", dhash: null, instant: t(500) })]).length).toBe(1);
  });

  it("suggestion : l'avis de l'IA, sinon la meilleure qualité ; défauts signalés", () => {
    const floue = p({ nettete: 0.1 });
    const nette = p({ nettete: 0.9 });
    expect(suggestion([floue, nette]).id).toBe(nette.id);
    expect(suggestion([floue, nette], new Map([[floue.id, "Yeux ouverts"]])).id).toBe(floue.id);
    expect(defauts(floue)).toEqual(["floue"]);
    expect(defauts(p({ exposition: 0.1 }))).toEqual(["mal exposée"]);
    expect(effet("site")).toEqual({ dansSite: true, dansLivre: false });
    expect(effet("coeur")).toMatchObject({ dansLivre: true, vedette: true });
  });
});

/** Image unie (ou en dégradé) de taille 40 × 40. */
function image(f: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(40 * 40 * 4);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
    const c = f(x / 39, y / 39);
    d.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], (y * 40 + x) * 4);
  }
  return { donnees: d, largeur: 40, hauteur: 40 };
}
const lum = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe("retouche automatique", () => {
  it("éclaircit une photo sombre", () => {
    const sombre = image((x) => [0.05 + x * 0.25, 0.05 + x * 0.25, 0.05 + x * 0.25]);
    const r = retoucheAuto(sombre);
    expect(r.lumiere).toBeGreaterThan(0.2);
    expect(lum(pixel([0.15, 0.15, 0.15], r))).toBeGreaterThan(0.18);
  });

  it("corrige une dominante bleue (sans aller jusqu'au gris parfait)", () => {
    const bleue = image((x) => [0.3 + x * 0.3, 0.35 + x * 0.3, 0.55 + x * 0.3]);
    const r = retoucheAuto(bleue);
    expect(r.temperature).toBeGreaterThan(0.1);
    const [R, , B] = pixel([0.45, 0.5, 0.7], r);
    expect(B - R).toBeLessThan(0.25);
    expect(B - R).toBeGreaterThan(0);
  });

  it("laisse presque intacte une photo déjà bien réglée", () => {
    const bonne = image((x, y) => {
      const v = ((x + y) / 2) * 0.95 + 0.02;
      return [v, v, v];
    });
    const r = retoucheAuto(bonne);
    for (const k of ["lumiere", "temperature", "teinte", "contraste", "saturation"] as const) expect(Math.abs(r[k])).toBeLessThan(0.15);
    expect(r.filtre).toBe(NEUTRE.filtre);
  });
});

describe("tri (base)", () => {
  let db: Db;
  let s: StockageLocal;
  let voyageId: string;
  let auteur: string;
  const ids: Record<string, string> = {};
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  async function photo(nom: string, seconde: number, nettete: number) {
    const id = genererId();
    ids[nom] = id;
    await s.ecrire(`m/${nom}`, JPEG);
    await db.insert(media).values({
      id, voyageId, auteurId: auteur, type: "photo", statut: "pret", nomFichier: nom, mime: "image/jpeg", taille: 1, sha256: id, cleOriginal: id,
      priseUtc: new Date(Date.UTC(2026, 7, 3, 10, 0, seconde)), dhash: "f0e1d2c3b4a59687", nettete, exposition: 0.6, versions: { m: `m/${nom}`, l: `l/${nom}` },
    });
  }
  const lire = async (nom: string) => (await db.query.media.findFirst({ where: (m, { eq }) => eq(m.id, ids[nom]) }))!;

  beforeEach(async () => {
    db = await baseDeTest();
    s = new StockageLocal(await mkdtemp(path.join(tmpdir(), "cc-tri-")), "http://localhost", "secret-de-test-secret-de-test-secret-de-test");
    auteur = (await creerUtilisateur(db, "r@exemple.fr")).id;
    voyageId = (await creerVoyage(db, auteur, { nom: "Naxos" })).id;
    await photo("A", 0, 0.8);
    await photo("B", 1, 0.3);
    await photo("C", 500, 0.7);
  });

  it("données : série groupable, grande version, droits de retouche", async () => {
    const url = (id: string, t: string) => `/${t}/${id}`;
    const { medias } = await donneesTri(db, url, { voyageId, userId: "autre", estAdmin: false });
    expect(medias.map((m) => [m.nomFichier, m.grande, m.retouchable, m.trie])).toEqual([
      ["A", `/l/${ids.A}`, false, false],
      ["B", `/l/${ids.B}`, false, false],
      ["C", `/l/${ids.C}`, false, false],
    ]);
    expect(moments(medias).map((g) => g.length)).toEqual([2, 1]);
    expect((await donneesTri(db, url, { voyageId, userId: auteur, estAdmin: false })).medias[0].retouchable).toBe(true);
  });

  it("décisions, annulation, coup de cœur réservé aux administrateurs, choix manuel dans une rafale", async () => {
    await detecterRafales(db, voyageId);
    expect(await compterATrier(db, voyageId)).toBe(3);
    await trier(db, { voyageId, estAdmin: false }, [
      { id: ids.A, dansSite: false, dansLivre: false, trie: true },
      { id: ids.B, dansSite: true, dansLivre: true, trie: true },
    ]);
    expect(await lire("A")).toMatchObject({ dansSite: false, trie: true, choixRafale: false, choixManuel: true });
    expect(await lire("B")).toMatchObject({ dansLivre: true, choixRafale: true, choixManuel: true });
    expect(await compterATrier(db, voyageId)).toBe(1);
    // L'IA ne revient pas sur un choix fait à la main.
    await detecterRafales(db, voyageId);
    expect((await lire("B")).choixRafale).toBe(true);

    await expect(trier(db, { voyageId, estAdmin: false }, [{ id: ids.C, dansSite: true, dansLivre: true, vedette: true, trie: true }])).rejects.toThrow("coups de cœur");
    await trier(db, { voyageId, estAdmin: true }, [{ id: ids.C, dansSite: true, dansLivre: true, vedette: true, trie: true }]);
    expect(await lire("C")).toMatchObject({ vedette: true, trie: true });
    // Annuler = renvoyer l'état d'avant.
    await trier(db, { voyageId, estAdmin: true }, [{ id: ids.C, dansSite: true, dansLivre: true, vedette: false, trie: false }]);
    expect(await lire("C")).toMatchObject({ vedette: false, trie: false });
    await expect(trier(db, { voyageId, estAdmin: true }, [{ id: genererId(), dansSite: true, dansLivre: true, trie: true }])).rejects.toThrow("introuvable");
  });

  it("avis de l'IA sur une série : suggestion gardée, rien n'est décidé à votre place", async () => {
    const appel = vi.fn<AppelIa>(async () =>
      ({ content: [{ type: "text", text: JSON.stringify({ photo: 2, raison: "Sourires naturels." }) }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 } }) as unknown as Awaited<ReturnType<AppelIa>>,
    );
    expect(await avisIaMoment(db, s, appel, voyageId, [ids.A, ids.B], { plafondEur: 3 })).toMatchObject({ mediaId: ids.B, raison: "Sourires naturels." });
    expect((await lire("B")).trie).toBe(false);
    const { avis } = await donneesTri(db, () => "", { voyageId, userId: auteur, estAdmin: true });
    expect(avis[ids.B]).toBe("Sourires naturels.");
    await expect(avisIaMoment(db, s, appel, voyageId, [ids.A], { plafondEur: 3 })).rejects.toThrow("deux photos");
  });
});

import { describe, expect, it } from "vitest";
import { appliquerMise, avecCadrages, chapitres, construireBlocs, mediasDuBloc, ratioDe, versStocke } from "@/lib/site/carnet";
import { configParDefaut, lireConfig, type BlocSite } from "@/lib/site/config";
import { changerCote, changerType, deplacerBloc, deplacerPhoto, echanger, fusionner, isoler, mettreDansBloc, NB_VARIANTES, scinder, variante } from "@/lib/site/edition";
import type { DonneesSite, MediaSite } from "@/lib/site/types";

let n = 0;
const m = (o: Partial<MediaSite> & { l?: number; h?: number } = {}): MediaSite => ({
  id: `m${++n}`,
  type: "photo",
  largeur: o.l ?? 1600,
  hauteur: o.h ?? 1067,
  urls: { s: "s", m: "m", l: "l" },
  legende: null,
  auteur: null,
  instant: "2026-08-03T10:00:00.000Z",
  vedette: false,
  reactions: [],
  commentaires: [],
  ...o,
});
const ids = (b: BlocSite[]) => b.map((x) => `${x.type}:${x.ids.join(",")}`);
const B = (type: BlocSite["type"], ...i: string[]): BlocSite => ({ type, ids: i });

describe("éditeur du site : opérations sur les blocs", () => {
  const base = [B("grande", "a"), B("rangee", "b", "c"), B("grande", "d"), B("grande", "e")];

  it("changer de disposition prend les photos qui manquent aux blocs suivants, rend le surplus", () => {
    expect(ids(changerType(base, 0, "mosaique"))).toEqual(["mosaique:a,b,c", "grande:d", "grande:e"]);
    expect(ids(changerType(base, 1, "grande"))).toEqual(["grande:a", "grande:b", "grande:c", "grande:d", "grande:e"]);
    expect(changerType(base, 0, "duo")[0]).toMatchObject({ type: "duo", ids: ["a", "b"], cote: "gauche" });
    expect(changerCote(changerType(base, 0, "duo"), 0)[0].cote).toBe("droite");
    // Rien n'est modifié en place.
    expect(ids(base)).toEqual(["grande:a", "rangee:b,c", "grande:d", "grande:e"]);
  });

  it("déplacer, scinder, réunir", () => {
    expect(ids(deplacerBloc(base, 0, 2))).toEqual(["rangee:b,c", "grande:d", "grande:a", "grande:e"]);
    expect(ids(scinder(base, 1))).toEqual(["grande:a", "grande:b", "grande:c", "grande:d", "grande:e"]);
    expect(ids(fusionner(base, 1))).toEqual(["grande:a", "rangee:b,c,d", "grande:e"]);
  });

  it("une photo avance ou recule, et passe dans le bloc voisin au bord", () => {
    expect(ids(deplacerPhoto(base, "c", -1))).toEqual(["grande:a", "rangee:c,b", "grande:d", "grande:e"]);
    // Un bloc d'une seule photo qui en reçoit une deuxième devient une rangée.
    expect(ids(deplacerPhoto(base, "b", -1))).toEqual(["rangee:a,b", "rangee:c", "grande:d", "grande:e"]);
    expect(ids(deplacerPhoto(base, "d", 1))).toEqual(["grande:a", "rangee:b,c", "rangee:d,e"]);
    expect(ids(deplacerPhoto(base, "e", 1))).toEqual(ids(base));
  });

  it("échanger deux photos, en mettre une dans un autre bloc, l'isoler", () => {
    expect(ids(echanger(base, "a", "c"))).toEqual(["grande:c", "rangee:b,a", "grande:d", "grande:e"]);
    expect(ids(mettreDansBloc(base, "a", 1))).toEqual(["rangee:b,c,a", "grande:d", "grande:e"]);
    expect(ids(mettreDansBloc(base, "e", 1))).toEqual(["grande:a", "rangee:b,c,e", "grande:d"]);
    expect(ids(isoler(base, "b"))).toEqual(["grande:a", "rangee:c", "grande:b", "grande:d", "grande:e"]);
  });

  it("variantes : toutes les photos, une fois, dans l'ordre", () => {
    const ms = Array.from({ length: 13 }, (_, i) => ({ id: `p${i}`, ratio: i % 3 ? 1.5 : 0.67 }));
    for (let k = 0; k < NB_VARIANTES; k++) {
      const v = variante(ms, k);
      expect(v.flatMap((b) => b.ids)).toEqual(ms.map((x) => x.id));
      expect(new Set(v.map((b) => b.type)).size).toBeGreaterThan(2);
    }
  });
});

describe("éditeur du site : disposition enregistrée appliquée au site", () => {
  it("garde l'ordre choisi, oublie les photos retirées, ajoute les nouvelles à la suite", () => {
    const [a, b, c, d, e] = [m(), m(), m(), m(), m()];
    const blocs = appliquerMise([a, b, c, d, e], [B("duo", e.id, a.id), B("grande", "disparue"), B("mosaique", b.id)]);
    expect(blocs.map((x) => x.type)).toEqual(["duo", "grande", "rangee"]);
    expect(blocs.flatMap(mediasDuBloc).map((x) => x.id)).toEqual([e.id, a.id, b.id, c.id, d.id]);
    expect(blocs.map(versStocke)[0]).toEqual({ type: "duo", ids: [e.id, a.id], cote: "gauche" });
  });

  it("construit des blocs valides quel que soit le nombre de photos", () => {
    const l = Array.from({ length: 9 }, () => m());
    expect(construireBlocs("mosaique", l).map((x) => x.type)).toEqual(["mosaique", "rangee"]);
    expect(construireBlocs("duo", l.slice(0, 1)).map((x) => x.type)).toEqual(["grande"]);
    expect(construireBlocs("rangee", l.slice(0, 6)).map((x) => [x.type, mediasDuBloc(x).length])).toEqual([["rangee", 5], ["grande", 1]]);
  });

  it("recadrage : format imposé, photo d'ouverture choisie, configuration ancienne complétée", () => {
    const ph = [m(), m({ l: 1000, h: 1500 }), m()];
    const d: DonneesSite = {
      slug: "v", nom: "V", periode: null, fuseau: "UTC",
      config: { ...configParDefaut(), cadrages: { [ph[1].id]: { zoom: 1.5, cx: 0.3, cy: 0.6, format: "16:9" } }, ouvertures: { "ep-e1": ph[2].id }, mise: { "ep-e1|2026-08-03": [B("rangee", ph[1].id, ph[0].id)] } },
      couverture: null,
      episodes: [{ id: "e1", ordre: 1, titre: "Naxos", lieu: null, recit: null, debut: null, fin: null, presentation: "carnet", medias: ph }],
      horsEpisodes: [], carte: [], chiffres: { jours: 1, photos: 3, videos: 0, episodes: 1, participants: 1, km: 0, commentaires: 0, reactions: 0 }, participants: [], journal: false, majLe: "",
    };
    const [c] = chapitres(avecCadrages(d), "episodes");
    expect(c.cle).toBe("ep-e1");
    expect(c.episodeId).toBe("e1");
    expect(c.ouverture?.id).toBe(ph[2].id);
    const [bloc] = c.parties[0].blocs;
    expect(mediasDuBloc(bloc).map((x) => x.id)).toEqual([ph[1].id, ph[0].id]);
    expect(ratioDe(mediasDuBloc(bloc)[0])).toBeCloseTo(16 / 9);
    expect(lireConfig({ theme: "montagne" })).toMatchObject({ mise: {}, cadrages: {}, ouvertures: {} });
  });
});

describe("éditeur du site : enregistrement et IA", async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { vi } = await import("vitest");
  const { baseDeTest, creerUtilisateur } = await import("./aide-db");
  const { media, depenseIa } = await import("@/server/db/schema");
  const { creerVoyage } = await import("@/server/domaine/voyages");
  const { configSite, enregistrerConfigSite, enregistrerEdition, modifierChapitre } = await import("@/server/domaine/site");
  const { proposerDisposition, proposerLegendes, nettoyer } = await import("@/server/ia/site");
  const { StockageLocal } = await import("@/server/stockage/local");
  const { proposerDecoupage, episodesDe } = await import("@/server/domaine/recit");
  type AppelIa = import("@/server/ia/client").AppelIa;
  const usage = { input_tokens: 3000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null };
  const reponse = (json: object) => ({ content: [{ type: "text", text: JSON.stringify(json) }], stop_reason: "end_turn", usage }) as unknown as Awaited<ReturnType<AppelIa>>;

  async function preparer() {
    const db = await baseDeTest();
    const u = await creerUtilisateur(db, "r@exemple.fr");
    const voyageId = (await creerVoyage(db, u.id, { nom: "Naxos" })).id;
    const s = new StockageLocal(await mkdtemp(path.join(tmpdir(), "cc-site-")), "http://localhost", "secret-de-test-secret-de-test-secret-de-test");
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      const cle = `voyages/${voyageId}/web/${id}-s.webp`;
      await s.ecrire(cle, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
      await db.insert(media).values({
        id, voyageId, type: "photo", statut: "pret", nomFichier: `${i}.jpg`, mime: "image/jpeg", taille: 1, sha256: id, cleOriginal: `o/${id}`,
        largeur: 4000, hauteur: 3000, versions: { s: cle, m: cle }, priseUtc: new Date(Date.UTC(2026, 7, 3, 9 + i)),
      });
    }
    return { db, s, voyageId, ids };
  }

  it("les réglages et la mise en page visuelle s'enregistrent séparément", async () => {
    const { db, voyageId, ids } = await preparer();
    await enregistrerEdition(db, voyageId, { mise: { "ep-x|tout": [{ type: "duo", ids: [ids[0], ids[1]] }] }, cadrages: { [ids[0]]: { zoom: 2, cx: 0.2, cy: 0.8, format: "1:1" } }, ouvertures: {} });
    // Les réglages (thème…) n'écrasent pas la mise en page faite dans l'éditeur.
    await enregistrerConfigSite(db, voyageId, { ...configParDefaut("montagne") });
    const c = await configSite(db, voyageId);
    expect(c.theme).toBe("montagne");
    expect(c.mise["ep-x|tout"][0].type).toBe("duo");
    expect(c.cadrages[ids[0]].format).toBe("1:1");
    await expect(enregistrerEdition(db, voyageId, { mise: { x: [{ type: "inconnu", ids: ["a"] }] } })).rejects.toThrow("invalide");
  });

  it("titre et récit d'un chapitre, lieu gardé", async () => {
    const { db, voyageId } = await preparer();
    await proposerDecoupage(db, voyageId);
    const { episodes } = await episodesDe(db, voyageId);
    await modifierChapitre(db, voyageId, episodes[0].id, { titre: "  L’arrivée  ", recit: "Le ferry." });
    const apres = (await episodesDe(db, voyageId)).episodes[0];
    expect(apres.titre).toBe("L’arrivée");
    expect(apres.recit).toBe("Le ferry.");
    expect(apres.lieu).toBe(episodes[0].lieu);
    await expect(modifierChapitre(db, voyageId, episodes[0].id, { titre: " " })).rejects.toThrow("obligatoire");
  });

  it("légendes et disposition proposées par l'IA, dépense comptée", async () => {
    const { db, s, voyageId, ids } = await preparer();
    const appel = vi.fn<AppelIa>(async (p) =>
      JSON.stringify(p.system).includes("légendes")
        ? reponse({ legendes: [{ photo: 1, texte: "Le port au matin" }, { photo: 9, texte: "hors limites" }] })
        : reponse({ blocs: [{ type: "duo", photos: [2, 1], cote: "droite" }, { type: "grande", photos: [2] }, { type: "magique", photos: [3] }], idee: "Ouvrir sur le contraste" }),
    );
    const l = await proposerLegendes(db, s, appel, voyageId, [ids[0], ids[1]], { titre: "Naxos" }, { plafondEur: 3 });
    expect(l.legendes).toEqual([{ id: ids[0], texte: "Le port au matin" }]);
    const d = await proposerDisposition(db, s, appel, voyageId, ids, { plafondEur: 3 });
    // Doublons et types inconnus écartés ; les photos oubliées sont ajoutées à la fin.
    expect(d.blocs).toEqual([{ type: "duo", ids: [ids[1], ids[0]], cote: "droite" }, { type: "rangee", ids: [ids[2], ids[3]] }]);
    expect(d.idee).toBe("Ouvrir sur le contraste");
    expect((await db.select().from(depenseIa)).map((x) => x.usage)).toEqual(["site", "site"]);
    await expect(proposerLegendes(db, s, vi.fn<AppelIa>(), voyageId, ids, {}, { plafondEur: 0 })).rejects.toThrow("Budget");
    expect(nettoyer([{ type: "mosaique", photos: [1, 2] }], ["a", "b", "c"])).toEqual([{ type: "mosaique", ids: ["a", "b"] }, { type: "grande", ids: ["c"] }]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { configParDefaut, contraste, THEMES, couleursEffectives, journalActif, lireConfig } from "@/lib/site/config";
import type { Db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { commenter, modifierEpisode, proposerDecoupage, basculerReaction, cocher } from "@/server/domaine/recit";
import {
  arrondirPosition,
  cleMediaPublie,
  cleVersion,
  donneesSite,
  enregistrerConfigSite,
  etapes,
  longueurItineraire,
  mettreEnAvant,
} from "@/server/domaine/site";
import { creerVoyage, ErreurMetier } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

describe("site : positions publiques arrondies", () => {
  it("arrondit au dixième de degré, sans « -0 »", () => {
    expect(arrondirPosition(37.10512)).toBe(37.1);
    expect(arrondirPosition(25.14981)).toBe(25.1);
    expect(arrondirPosition(-0.04)).toBe(0);
    expect(Object.is(arrondirPosition(-0.04), -0)).toBe(false);
    expect(arrondirPosition(-3.76)).toBe(-3.8);
  });

  it("une étape par épisode, à la médiane de ses photos", () => {
    const eps = [
      { id: "a", ordre: 1, titre: "Lundi 3 août", lieu: "Naxos" },
      { id: "b", ordre: 2, titre: "Mardi 4 août", lieu: null },
      { id: "c", ordre: 3, titre: "Sans GPS", lieu: null },
    ];
    const pos = [
      { episodeId: "a", latitude: 37.101, longitude: 25.371 },
      { episodeId: "a", latitude: 37.106, longitude: 25.377 },
      { episodeId: "a", latitude: 48.85, longitude: 2.35 }, // valeur aberrante : la médiane l'ignore
      { episodeId: "b", latitude: 37.0853, longitude: 25.1498 },
      { episodeId: "c", latitude: null, longitude: null },
    ];
    const p = etapes(eps, pos);
    expect(p).toEqual([
      { lat: 37.1, lon: 25.4, titre: "Naxos", episodeId: "a", ordre: 1 },
      { lat: 37.1, lon: 25.1, titre: "Mardi 4 août", episodeId: "b", ordre: 2 },
    ]);
    expect(longueurItineraire(p)).toBe(27);
  });
});

describe("site : configuration", () => {
  it("complète une configuration ancienne ou abîmée", () => {
    expect(lireConfig(null)).toEqual(configParDefaut());
    const c = lireConfig({ theme: "montagne", polices: "fraunces-worksans", sections: [{ id: "episodes", actif: true }, { id: "inconnue", actif: true }] });
    expect(c.theme).toBe("montagne");
    expect(c.sections[0]).toEqual({ id: "episodes", actif: true });
    expect(c.sections).toHaveLength(8);
    expect(c.sections.filter((s) => s.actif)).toHaveLength(1);
    expect(lireConfig({ theme: "pas-un-theme" })).toEqual(configParDefaut());
  });

  it("chaque thème est lisible (WCAG AA)", () => {
    for (const t of Object.values(THEMES)) {
      const c = t.couleurs;
      for (const texte of [c.encre, c.encreDouce, c.accent]) expect(contraste(texte, c.fond)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.encreDouce, c.fond2)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("garde un texte lisible quand le fond est personnalisé", () => {
    for (const fond of ["#000000", "#ffffff", "#123456", "#f0e68c", "#7f7f7f"]) {
      const c = couleursEffectives({ ...configParDefaut(), couleurs: { fond, accent: fond } });
      expect(contraste(c.encre, c.fond)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.encreDouce, c.fond)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.accent, c.fond)).toBeGreaterThanOrEqual(3);
    }
  });

  it("journal en direct pendant les dates du voyage", () => {
    const c = configParDefaut();
    expect(journalActif(c, "2026-08-03", "2026-08-17", "2026-08-10")).toBe(true);
    expect(journalActif(c, "2026-08-03", "2026-08-17", "2026-08-18")).toBe(false);
    expect(journalActif(c, null, null, "2026-08-10")).toBe(false);
    expect(journalActif({ ...c, journal: "oui" }, null, null, "2026-08-10")).toBe(true);
  });

  it("sert les versions retouchées d'abord, jamais l'original", () => {
    const v = { s: "s", m: "m", l: "l", rs: "rs", rm: "rm" };
    expect(cleVersion(v, "photo", "s")).toBe("rs");
    expect(cleVersion(v, "photo", "l")).toBe("l");
    expect(cleVersion({ m: "m" }, "photo", "l")).toBe("m");
    expect(cleVersion({ affiche: "a", video: "v" }, "video", "m")).toBe("a");
    expect(cleVersion({ m: "m" }, "photo", "video")).toBeUndefined();
  });
});

describe("site : données publiques", () => {
  let db: Db;
  let voyageId: string;
  let romain: { id: string };

  async function photo(iso: string, lat: number | null, lon: number | null, versions = { s: "k-s", m: "k-m", l: "k-l" }) {
    const id = genererId();
    await db.insert(media).values({
      id,
      voyageId,
      auteurId: romain.id,
      type: "photo",
      statut: "pret",
      nomFichier: `${id}.jpg`,
      mime: "image/jpeg",
      taille: 1,
      sha256: id,
      cleOriginal: `originaux/${id}`,
      priseUtc: new Date(iso),
      latitude: lat,
      longitude: lon,
      versions,
    });
    return id;
  }

  beforeEach(async () => {
    db = await baseDeTest();
    romain = await creerUtilisateur(db, "romain@exemple.fr");
    voyageId = (await creerVoyage(db, romain.id, { nom: "Cyclades" })).id;
  });

  it("assemble épisodes, carte et chiffres sans aucune position précise", async () => {
    const a = await photo("2026-08-03T10:00:00Z", 37.10512, 25.37683);
    await photo("2026-08-03T11:00:00Z", 37.10601, 25.37702);
    const c = await photo("2026-08-06T10:00:00Z", 37.08533, 25.14981);
    const cachee = await photo("2026-08-06T11:00:00Z", 37.08533, 25.14981);
    await cocher(db, voyageId, [cachee], "dansSite", false);
    await proposerDecoupage(db, voyageId);
    await commenter(db, { voyageId, userId: romain.id }, a, "Quelle lumière !");
    await basculerReaction(db, { voyageId, userId: romain.id }, a, "❤️");
    await mettreEnAvant(db, voyageId, c, true);

    const d = await donneesSite(db, voyageId, (id, t) => `/v/cyclades/m/${id}/${t}`);
    expect(d.episodes).toHaveLength(2);
    expect(d.episodes.map((e) => e.medias.length)).toEqual([2, 1]);
    expect(d.episodes.flatMap((e) => e.medias).some((m) => m.id === cachee)).toBe(false);
    expect(d.carte.map((p) => [p.lat, p.lon])).toEqual([
      [37.1, 25.4],
      [37.1, 25.1],
    ]);
    expect(d.chiffres).toMatchObject({ photos: 3, jours: 2, episodes: 2, commentaires: 1, reactions: 1, participants: 1 });
    expect(d.couverture?.id).toBe(c); // la photo mise en avant
    const premiere = d.episodes[0].medias[0];
    expect(premiere.urls).toEqual({ s: `/v/cyclades/m/${a}/s`, m: `/v/cyclades/m/${a}/m`, l: `/v/cyclades/m/${a}/l`, affiche: `/v/cyclades/m/${a}/affiche` });
    expect(premiere.commentaires).toEqual([{ auteur: "romain", texte: "Quelle lumière !" }]);

    const json = JSON.stringify(d);
    for (const precis of ["37.105", "25.376", "37.085", "25.149", "originaux/", "@exemple.fr"]) expect(json).not.toContain(precis);
  });

  it("respecte les réglages d'affichage et le choix de couverture", async () => {
    const a = await photo("2026-08-03T10:00:00Z", null, null);
    await proposerDecoupage(db, voyageId);
    await commenter(db, { voyageId, userId: romain.id }, a, "Bravo");
    const { episodes } = { episodes: await db.query.episode.findMany() };
    await modifierEpisode(db, voyageId, episodes[0].id, { titre: "Arrivée", recit: "Le ferry." });
    await enregistrerConfigSite(db, voyageId, {
      ...configParDefaut("road-trip"),
      couvertureId: a,
      afficher: { legendes: true, auteurs: false, commentaires: false, reactions: true },
    });
    const d = await donneesSite(db, voyageId, (id, t) => `${id}/${t}`);
    expect(d.config.theme).toBe("road-trip");
    expect(d.couverture?.id).toBe(a);
    expect(d.episodes[0].titre).toBe("Arrivée");
    expect(d.episodes[0].medias[0].auteur).toBeNull();
    expect(d.episodes[0].medias[0].commentaires).toEqual([]);
    await expect(enregistrerConfigSite(db, voyageId, { ...configParDefaut(), couvertureId: genererId() })).rejects.toThrow(ErreurMetier);
    await expect(enregistrerConfigSite(db, voyageId, { theme: "x" })).rejects.toThrow(ErreurMetier);
  });

  it("ne publie que les médias cochés pour le site", async () => {
    const a = await photo("2026-08-03T10:00:00Z", null, null);
    expect(await cleMediaPublie(db, voyageId, a, "m")).toBe("k-m");
    await cocher(db, voyageId, [a], "dansSite", false);
    expect(await cleMediaPublie(db, voyageId, a, "m")).toBeNull();
    const autre = (await creerVoyage(db, romain.id, { nom: "Autre" })).id;
    expect(await cleMediaPublie(db, autre, a, "m")).toBeNull();
  });
});

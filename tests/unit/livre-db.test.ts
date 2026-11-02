import { beforeEach, describe, expect, it } from "vitest";
import { formatParId } from "@/lib/livre/formats";
import { mettreEnPage } from "@/lib/livre/mise-en-page";
import type { Livre } from "@/lib/livre/modele";
import type { Db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { empreinteCle } from "@/server/domaine/medias";
import { urlsMembre } from "@/server/domaine/medias";
import {
  creerVersion,
  dimensionsEffectives,
  enregistrerLivre,
  episodesDuLivre,
  livreDe,
  mediasDuLivre,
  restaurerVersion,
  VERSIONS_MAX,
  versionsDe,
} from "@/server/domaine/livre";
import { cocher, proposerDecoupage } from "@/server/domaine/recit";
import { creerVoyage, ErreurMetier } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";


describe("livre : données et versions", () => {
  let db: Db;
  let voyageId: string;
  let ctx: { voyageId: string; userId: string };

  async function photo(iso: string, o: Partial<typeof media.$inferInsert> = {}) {
    const id = genererId();
    await db.insert(media).values({
      id,
      voyageId,
      type: "photo",
      statut: "pret",
      nomFichier: `${id}.jpg`,
      mime: "image/jpeg",
      taille: 1,
      sha256: id,
      cleOriginal: id,
      priseUtc: new Date(iso),
      largeur: 4000,
      hauteur: 3000,
      versions: { s: `${id}-s`, m: `${id}-m` },
      ...o,
    });
    return id;
  }

  async function livreGenere(): Promise<Livre> {
    const medias = await mediasDuLivre(db, urlsMembre("naxos"), voyageId);
    return mettreEnPage({
      nom: "Naxos",
      periode: null,
      fuseau: "Europe/Athens",
      format: formatParId("carre-30"),
      options: { ciblePages: 24, rythme: "equilibre", fond: "blanc", legendes: true, commentaires: false },
      episodes: await episodesDuLivre(db, voyageId),
      medias,
    }).livre;
  }

  beforeEach(async () => {
    db = await baseDeTest();
    const romain = await creerUtilisateur(db, "romain@exemple.fr");
    voyageId = (await creerVoyage(db, romain.id, { nom: "Naxos" })).id;
    ctx = { voyageId, userId: romain.id };
  });

  it("ne garde que les photos cochées pour le livre, jamais les vidéos, avec leurs dimensions retouchées", async () => {
    const a = await photo("2026-08-03T10:00:00Z", { retouche: { rotation: 90, recadrage: { x: 0, y: 0, l: 0.5, h: 1 } } });
    const b = await photo("2026-08-03T09:00:00Z");
    const c = await photo("2026-08-03T11:00:00Z");
    await photo("2026-08-03T12:00:00Z", { type: "video" });
    await cocher(db, voyageId, [c], "dansLivre", false);
    const m = await mediasDuLivre(db, urlsMembre("naxos"), voyageId);
    expect(m.map((x) => x.id)).toEqual([b, a]);
    expect(m[1]).toMatchObject({ largeur: 1500, hauteur: 4000 });
    expect(m[1].vignette).toBe(`/api/voyages/naxos/medias/${a}/s?v=${empreinteCle(`${a}-s`)}`);
    expect(dimensionsEffectives(4000, 3000, null)).toEqual([4000, 3000]);
  });

  it("enregistre, refuse une édition concurrente et une photo d'un autre voyage", async () => {
    for (let h = 8; h < 20; h++) await photo(`2026-08-03T${String(h).padStart(2, "0")}:00:00Z`);
    await proposerDecoupage(db, voyageId);
    const l = await livreGenere();
    expect(await enregistrerLivre(db, ctx, l, null)).toBe(1);
    expect(await enregistrerLivre(db, ctx, l, 1)).toBe(2);
    await expect(enregistrerLivre(db, ctx, l, 1)).rejects.toThrow(/modifié par quelqu’un d’autre/);
    expect((await livreDe(db, voyageId))?.revision).toBe(2);

    const autre = (await creerVoyage(db, ctx.userId, { nom: "Autre" })).id;
    const etrangere = genererId();
    await db.insert(media).values({ id: etrangere, voyageId: autre, type: "photo", statut: "pret", nomFichier: "x", mime: "image/jpeg", taille: 1, sha256: etrangere, cleOriginal: "x" });
    const pirate = structuredClone(l);
    pirate.pages[2].cellules[0] = { mediaId: etrangere, zoom: 1, cx: 0.5, cy: 0.5 };
    await expect(enregistrerLivre(db, ctx, pirate, 2)).rejects.toThrow(ErreurMetier);
    await expect(enregistrerLivre(db, ctx, { ...l, version: 2 }, 2)).rejects.toThrow(/invalide/);
  });

  it("versions : création, retour en arrière annulable, plafond", async () => {
    for (let h = 8; h < 14; h++) await photo(`2026-08-03T${String(h).padStart(2, "0")}:00:00Z`);
    const l = await livreGenere();
    await enregistrerLivre(db, ctx, l, null);
    await creerVersion(db, ctx, "Première");
    const modifie = { ...l, couverture: { ...l.couverture, titre: "Titre changé" } };
    await enregistrerLivre(db, ctx, modifie, 1);
    const [premiere] = (await versionsDe(db, voyageId)).filter((v) => v.libelle === "Première");
    expect(premiere.pages).toBe(24);
    const revision = await restaurerVersion(db, ctx, premiere.id);
    expect(revision).toBe(3);
    expect((await livreDe(db, voyageId))?.contenu.couverture.titre).toBe("Naxos");
    // L'état d'avant le retour est gardé.
    const avant = (await versionsDe(db, voyageId)).find((v) => v.libelle.startsWith("Avant le retour"));
    expect(avant).toBeDefined();
    await restaurerVersion(db, ctx, avant!.id);
    expect((await livreDe(db, voyageId))?.contenu.couverture.titre).toBe("Titre changé");

    for (let i = 0; i < VERSIONS_MAX + 3; i++) await creerVersion(db, ctx, `v${i}`);
    expect(await versionsDe(db, voyageId)).toHaveLength(VERSIONS_MAX);
  });
});

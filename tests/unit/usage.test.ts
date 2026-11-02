import { describe, expect, it } from "vitest";
import { estimerCout } from "@/lib/couts/estimation";
import { media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { usage } from "@/server/domaine/usage";
import { creerVoyage } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

describe("coût d'hébergement", () => {
  it("gratuit sous 10 Go, puis 0,015 $ par Go et par mois", () => {
    expect(estimerCout({ photos: 3000, videos: 0, octetsOriginaux: 6e9, octetsVersions: 2.7e9, octetsBase: 5e7 })).toMatchObject({ stockageGo: 8.7, r2Eur: 0, dansLeBudget: true });
    const gros = estimerCout({ photos: 10000, videos: 200, octetsOriginaux: 50e9, octetsVersions: 10e9, octetsBase: 4.5e8 });
    expect(gros.r2Eur).toBe(0.69); // 50 Go payants × 0,015 $ × 0,92
    expect(gros.dansLeBudget).toBe(true);
    expect(gros.alertes.join(" ")).toMatch(/Neon/);
  });

  it("mesure l'espace d'un voyage et de toute l'application", async () => {
    const db = await baseDeTest();
    const u = await creerUtilisateur(db, "romain@exemple.fr");
    const v = (await creerVoyage(db, u.id, { nom: "N" })).id;
    for (const [type, taille, duree] of [["photo", 4e6, null], ["photo", 6e6, null], ["video", 1e8, 40]] as const) {
      const id = genererId();
      await db.insert(media).values({ id, voyageId: v, type, statut: "pret", nomFichier: "x", mime: "x", taille, sha256: id, cleOriginal: id, dureeSecondes: duree });
    }
    const r = await usage(db, v);
    expect(r).toMatchObject({ photos: 2, videos: 1, octetsOriginaux: 110e6, octetsVersions: 2 * 900_000 + 40 * 250_000, octetsBase: null });
    const tout = await usage(db);
    expect(tout.octetsBase).toBeGreaterThan(0);
  });
});

describe("adresses des images", () => {
  it("l'empreinte change avec la version (retouche), pas d'un appel à l'autre", async () => {
    const { empreinteCle } = await import("@/server/domaine/medias");
    expect(empreinteCle("voyages/v/web/m-s.webp")).toBe(empreinteCle("voyages/v/web/m-s.webp"));
    expect(empreinteCle("voyages/v/web/m-s.webp")).not.toBe(empreinteCle("voyages/v/web/m-rs-3f2a.webp"));
  });
});

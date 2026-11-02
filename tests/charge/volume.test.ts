/**
 * Tenue en charge : un voyage de 10 000 photos (lancer avec `pnpm test:charge`).
 * Mesure les traitements serveur les plus lourds ; pas dans la CI ordinaire (trop long).
 */
import { describe, expect, it } from "vitest";
import { formatParId } from "@/lib/livre/formats";
import { mettreEnPage } from "@/lib/livre/mise-en-page";
import { media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { episodesDuLivre, mediasDuLivre } from "@/server/domaine/livre";
import { galerie, urlsMembre } from "@/server/domaine/medias";
import { detecterRafales } from "@/server/domaine/rafales";
import { episodesDe, proposerDecoupage } from "@/server/domaine/recit";
import { donneesSite } from "@/server/domaine/site";
import { creerVoyage } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "../unit/aide-db";

const N = Number(process.env.CHARGE_N ?? 10_000);

async function chrono<T>(nom: string, fn: () => Promise<T>, limite: number): Promise<T> {
  const t = performance.now();
  const r = await fn();
  const ms = Math.round(performance.now() - t);
  process.stderr.write(`${nom.padEnd(36)} ${String(ms).padStart(6)} ms\n`);
  expect(ms, nom).toBeLessThan(limite);
  return r;
}

describe(`charge : ${N} photos`, () => {
  it("tient les traitements principaux", async () => {
    const db = await baseDeTest();
    const romain = await creerUtilisateur(db, "romain@exemple.fr");
    const voyageId = (await creerVoyage(db, romain.id, { nom: "Grand voyage" })).id;
    const debut = Date.UTC(2026, 6, 1, 6);
    await chrono("insertion", async () => {
      for (let i = 0; i < N; i += 1000) {
        await db.insert(media).values(
          Array.from({ length: Math.min(1000, N - i) }, (_, k) => {
            const j = i + k;
            const id = genererId();
            // ~ 330 photos par jour sur 30 jours, avec des rafales et des trous la nuit.
            const t = debut + Math.floor(j / 330) * 86_400_000 + (j % 330) * 150_000 + (j % 7 === 0 ? 0 : 1000);
            return {
              id, voyageId, auteurId: romain.id, type: "photo" as const, statut: "pret" as const, nomFichier: `IMG_${j}.jpg`,
              mime: "image/jpeg", taille: 4_000_000, sha256: id, cleOriginal: `voyages/${voyageId}/originaux/${id}`,
              priseUtc: new Date(t), largeur: 4000, hauteur: 3000, dhash: (j % 997).toString(16).padStart(16, "0"),
              nettete: (j % 10) / 10, exposition: 0.5, latitude: 37 + (j % 100) / 1000, longitude: 25,
              versions: { s: `s/${id}`, m: `m/${id}`, l: `l/${id}` },
            };
          }),
        );
      }
    }, 120_000);
    await chrono("découpage en épisodes", () => proposerDecoupage(db, voyageId), 60_000);
    await chrono("liste des épisodes", () => episodesDe(db, voyageId), 3_000);
    await chrono("détection des rafales", () => detecterRafales(db, voyageId), 60_000);
    await chrono("galerie complète", () => galerie(db, urlsMembre("naxos"), voyageId), 5_000);
    await chrono("données du site", () => donneesSite(db, voyageId, (id, t) => `/v/x/m/${id}/${t}`), 5_000);
    const medias = await chrono("photos du livre", () => mediasDuLivre(db, urlsMembre("naxos"), voyageId), 5_000);
    const episodes = await episodesDuLivre(db, voyageId);
    await chrono("mise en page auto (200 pages)", async () =>
      mettreEnPage({
        nom: "Grand voyage", periode: null, fuseau: "Europe/Paris", format: formatParId("portrait-21x28"),
        options: { ciblePages: 200, rythme: "dense", fond: "blanc", legendes: true, commentaires: false },
        episodes, medias: medias.slice(0, 1500),
      }), 5_000);
  }, 600_000);
});

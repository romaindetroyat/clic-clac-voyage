import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IMPRIMEURS, imprimeurParId } from "@/lib/imprimeurs/catalogue";
import { coutMicroUsd, typeImage } from "@/lib/ia/tarifs";
import type { Db } from "@/server/db/client";
import { depenseIa, majImprimeur, media } from "@/server/db/schema";
import { genererId } from "@/server/domaine/crypto";
import { choisirDansRafale, detecterRafales } from "@/server/domaine/rafales";
import { creerVoyage } from "@/server/domaine/voyages";
import { budgetIa } from "@/server/ia/budget";
import type { AppelIa } from "@/server/ia/client";
import { catalogueEffectif, filtrerPropositions, proposerMaj, rejeterMaj, validerMaj } from "@/server/ia/imprimeurs";
import { avisIa, departagerRafales, rafalesADepartager } from "@/server/ia/rafales";
import { StockageLocal } from "@/server/stockage/local";
import { baseDeTest, creerUtilisateur } from "./aide-db";

const usage = { input_tokens: 3000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null };
/** Fausse réponse de l'API (seuls les champs lus par l'app). */
const reponse = (content: unknown[], stop_reason = "end_turn", u: object = usage) =>
  ({ content, stop_reason, usage: u }) as unknown as Awaited<ReturnType<AppelIa>>;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe("tarifs de l'IA", () => {
  it("compte les jetons et les recherches web", () => {
    // 3 000 × 4 $ + 200 × 20 $ par million = 0,016 $ ; + 2 recherches à 0,01 $.
    expect(coutMicroUsd(usage)).toBe(16_000);
    expect(coutMicroUsd({ ...usage, server_tool_use: { web_search_requests: 2 } })).toBe(36_000);
  });

  it("reconnaît le type des images", () => {
    expect(typeImage(JPEG)).toBe("image/jpeg");
    expect(typeImage(new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]))).toBe("image/webp");
    expect(typeImage(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("départage des rafales par l'IA", () => {
  let db: Db;
  let s: StockageLocal;
  let voyageId: string;
  const ids: Record<string, string> = {};

  async function photo(nom: string, seconde: number, nettete: number) {
    const id = genererId();
    ids[nom] = id;
    await s.ecrire(`m/${nom}`, JPEG);
    await db.insert(media).values({
      id,
      voyageId,
      type: "photo",
      statut: "pret",
      nomFichier: nom,
      mime: "image/jpeg",
      taille: 1,
      sha256: id,
      cleOriginal: id,
      priseUtc: new Date(Date.UTC(2026, 7, 3, 10, 0, seconde)),
      dhash: "f0e1d2c3b4a59687",
      nettete,
      exposition: 0.6,
      versions: { m: `m/${nom}` },
    });
  }
  const retenue = async () => (await db.query.media.findFirst({ where: (m, { eq, and }) => and(eq(m.choixRafale, true), eq(m.dansLivre, true)) }))?.nomFichier;

  beforeEach(async () => {
    db = await baseDeTest();
    s = new StockageLocal(await mkdtemp(path.join(tmpdir(), "cc-ia-")), "http://localhost", "secret-de-test-secret-de-test-secret-de-test");
    const u = await creerUtilisateur(db, "r@exemple.fr");
    voyageId = (await creerVoyage(db, u.id, { nom: "Naxos" })).id;
    await photo("A", 0, 0.8);
    await photo("B", 1, 0.81);
    await photo("C", 2, 0.2);
    await detecterRafales(db, voyageId);
  });

  it("n'envoie que les photos à égalité, applique le choix et ne repaie pas", async () => {
    expect(await retenue()).toBe("B");
    const a = await rafalesADepartager(db, voyageId);
    expect(a).toHaveLength(1);
    expect(a[0].candidates.map((c) => c.id)).toEqual([ids.B, ids.A]); // la floue C n'est pas envoyée

    const appel = vi.fn<AppelIa>(async (p) => {
      const images = (p.messages[0].content as { type: string }[]).filter((b) => b.type === "image");
      expect(images).toHaveLength(2);
      return reponse([{ type: "text", text: JSON.stringify({ photo: 2, raison: "Yeux ouverts, meilleur cadrage." }) }]);
    });
    expect(await departagerRafales(db, s, appel, voyageId, { plafondEur: 3 })).toEqual({ faites: 1, changees: 1, restantes: 0 });
    expect(await retenue()).toBe("A");
    expect((await avisIa(db, voyageId)).get(ids.A)).toBe("Yeux ouverts, meilleur cadrage.");
    expect(await db.$count(depenseIa)).toBe(1);
    expect((await budgetIa(db, 3)).depenseEur).toBeCloseTo(0.016 * 0.92, 5);

    // Déjà départagée : plus rien à envoyer.
    await departagerRafales(db, s, appel, voyageId, { plafondEur: 3 });
    expect(appel).toHaveBeenCalledTimes(1);
  });

  it("ne touche jamais un choix fait à la main", async () => {
    await choisirDansRafale(db, voyageId, ids.C);
    expect(await rafalesADepartager(db, voyageId)).toEqual([]);
  });

  it("une réponse refusée ou illisible ne change rien et n'est pas redemandée", async () => {
    const appel = vi.fn<AppelIa>(async () => reponse([{ type: "text", text: "pas du JSON" }]));
    expect(await departagerRafales(db, s, appel, voyageId, { plafondEur: 3 })).toEqual({ faites: 1, changees: 0, restantes: 0 });
    expect(await retenue()).toBe("B");
    expect(await rafalesADepartager(db, voyageId)).toEqual([]);
  });

  it("s'arrête au plafond du budget, sans appeler l'API", async () => {
    const appel = vi.fn<AppelIa>();
    await expect(departagerRafales(db, s, appel, voyageId, { plafondEur: 0 })).rejects.toThrow("Budget d’IA du mois atteint");
    expect(appel).not.toHaveBeenCalled();
  });
});

describe("mise à jour des fiches imprimeurs par l'IA", () => {
  let db: Db;
  let userId: string;
  const blurb = IMPRIMEURS.find((i) => i.id === "blurb")!;
  const sourceOk = "https://www.blurb.fr/pricing";

  beforeEach(async () => {
    db = await baseDeTest();
    userId = (await creerUtilisateur(db, "admin@exemple.fr")).id;
  });

  it("ne garde que les propositions valides, utiles et sourcées", () => {
    const p = (o: object) => ({ champ: "prix.base", produitId: "20x25", valeur: 41, source: sourceOk, extrait: "41,00 €", ...o });
    const r = filtrerPropositions(blurb, [
      p({}),
      p({ produitId: "inconnu" }),
      p({ valeur: 38.4, produitId: "30x30" }), // 30x30 coûte 61,2 : gardée
      p({ champ: "prix.base", produitId: "20x25-premium", valeur: 44.4 }), // inchangée
      p({ champ: "note.valeur", produitId: null, valeur: 7 }), // note sur 5
      p({ champ: "inconnu" }),
      p({ source: "pas une adresse" }),
      p({ champ: "delais.livraison", produitId: "20x25", valeur: 6 }), // produitId ignoré hors prix
      p({ valeur: 42 }), // remplace la première
    ]);
    expect(r.map((x) => [x.champ, x.produitId, x.actuelle, x.proposee])).toEqual([
      ["prix.base", "20x25", 38.4, 42],
      ["prix.base", "30x30", 61.2, 38.4],
      ["delais.livraison", null, null, 6],
    ]);
  });

  it("propose (avec reprise après pause), puis applique seulement ce qui est validé", async () => {
    const appel = vi
      .fn<AppelIa>()
      .mockResolvedValueOnce(reponse([{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "blurb prix" } }], "pause_turn", { ...usage, server_tool_use: { web_search_requests: 3 } }))
      .mockResolvedValueOnce(
        reponse(
          [
            {
              type: "tool_use",
              id: "t1",
              name: "proposer",
              input: {
                resume: "Prix vérifiés sur blurb.fr ; port non affiché.",
                propositions: [
                  { champ: "prix.base", produitId: "20x25", valeur: 39.9, source: sourceOk, extrait: "à partir de 39,90 €" },
                  { champ: "note.valeur", produitId: null, valeur: 2.5, source: "https://www.trustpilot.com/review/blurb.co.uk", extrait: "TrustScore 2,5" },
                ],
              },
            },
          ],
          "tool_use",
        ),
      );
    const { id, propositions } = await proposerMaj(db, appel, "blurb", userId, { plafondEur: 3 });
    expect(propositions).toHaveLength(2);
    expect(appel).toHaveBeenCalledTimes(2);
    // Le tour repris renvoie la réponse en pause telle quelle.
    expect(appel.mock.calls[1][0].messages.at(-1)?.role).toBe("assistant");
    expect(await db.$count(depenseIa)).toBe(2);

    // Rien n'est appliqué avant validation, et une seule proposition en attente à la fois.
    expect((await catalogueEffectif(db)).find((i) => i.id === "blurb")!.produits[0].prix.base).toBe(38.4);
    await expect(proposerMaj(db, appel, "blurb", userId, { plafondEur: 3 })).rejects.toThrow("attend déjà");

    await validerMaj(db, id, [0]);
    const b = (await catalogueEffectif(db)).find((i) => i.id === "blurb")!;
    expect(b.produits[0].prix).toMatchObject({ base: 39.9, statut: "V", source: sourceOk });
    expect(b.note?.valeur).toBe(2.3); // non cochée
    expect(b.releve).toBe(new Date().toISOString().slice(0, 10));
    // Le catalogue du dépôt n'est pas modifié.
    expect(blurb.produits[0].prix.base).toBe(38.4);
  });

  it("relance une fois si l'IA oublie l'outil, puis abandonne proprement", async () => {
    const appel = vi.fn<AppelIa>(async () => reponse([{ type: "text", text: "J’ai cherché." }]));
    await expect(proposerMaj(db, appel, "saal", userId, { plafondEur: 3 })).rejects.toThrow("n’a pas pu terminer");
    expect(appel).toHaveBeenCalledTimes(2);
    expect(await db.$count(majImprimeur)).toBe(0);
  });

  it("un rejet n'applique rien et libère l'imprimeur", async () => {
    const appel = vi.fn<AppelIa>(async () =>
      reponse([{ type: "tool_use", id: "t", name: "proposer", input: { resume: "Rien.", propositions: [] } }], "tool_use"),
    );
    const { id } = await proposerMaj(db, appel, "saal", userId, { plafondEur: 3 });
    await rejeterMaj(db, id);
    await expect(validerMaj(db, id, [])).rejects.toThrow("plus en attente");
    expect((await catalogueEffectif(db)).find((i) => i.id === "saal")!.releve).toBe(imprimeurParId("saal")!.releve);
    await proposerMaj(db, appel, "saal", userId, { plafondEur: 3 });
  });
});

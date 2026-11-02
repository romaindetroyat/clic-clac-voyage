import { describe, expect, it } from "vitest";
import { IMPRIMEURS, imprimeurParId } from "@/lib/imprimeurs/catalogue";
import { comparer, enEuros, forme, formatDepuisProduit, pagesFacturees, prixExemplaire, prixPort, produitProche } from "@/lib/imprimeurs/comparateur";
import { euros, recapitulatif, repartir } from "@/lib/imprimeurs/parts";
import type { Imprimeur, Produit } from "@/lib/imprimeurs/types";
import { epaisseurDos, formatParId } from "@/lib/livre/formats";
import { zoneUtile } from "@/lib/livre/gabarits";

const produit = (o: Partial<Produit> = {}): Produit => ({
  id: "p", nom: "Portrait", largeur: 210, hauteur: 280, reliure: "rigide", papier: "x", pagesMin: 24, pagesMax: 120, pas: 2,
  prix: { devise: "EUR", base: 30, pagesIncluses: 24, parPageSup: 0.5, statut: "V" }, ...o,
});
const imprimeur = (id: string, o: Partial<Imprimeur> = {}): Imprimeur => ({
  id, nom: id, pays: "FR", site: "", lienCommande: "", pdfFrance: { valeur: true, statut: "V" }, produits: [produit()],
  technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 6, securiteReliure: 6, couleur: "sRGB", normePdf: "libre", fichiers: "separes", dos: "formule", dosTitreMin: 6, poidsMaxMo: null, statut: "V" },
  port: { devise: "EUR", premier: 8, suivant: 2, francoDes: null, statut: "V" }, delais: { fabrication: 3, livraison: 4, statut: "V" },
  note: { valeur: 4.5, avis: 100, domaine: "x", statut: "V" }, api: false, releve: "2026-11-02", remarques: "", ...o,
});

describe("imprimeurs : prix et port", () => {
  it("pages facturées : minimum et pas", () => {
    expect(pagesFacturees(produit({ pas: 4 }), 41)).toBe(44);
    expect(pagesFacturees(produit(), 10)).toBe(24);
  });

  it("prix d'un exemplaire : base + pages supplémentaires (ou doubles pages), inconnu si non relevé", () => {
    expect(prixExemplaire(produit(), 24)).toBe(30);
    expect(prixExemplaire(produit(), 100)).toBe(68); // 30 + 76 × 0,5
    expect(prixExemplaire(produit({ prix: { devise: "EUR", base: 30, pagesIncluses: 24, parPageSup: 1, parDoublePage: true, statut: "V" } }), 100)).toBe(68);
    expect(prixExemplaire(produit({ prix: { devise: "EUR", base: 30, pagesIncluses: 24, parPageSup: null, statut: "NV" } }), 40)).toBeNull();
    expect(prixExemplaire(produit({ prix: { devise: "EUR", base: 30, pagesIncluses: 24, parPageSup: null, statut: "NV" } }), 24)).toBe(30);
  });

  it("port : premier exemplaire, suivants, franco", () => {
    const i = imprimeur("a", { port: { devise: "EUR", premier: 8, suivant: 2, francoDes: 150, statut: "V" } });
    expect(prixPort(i, 1, 40)).toBe(8);
    expect(prixPort(i, 3, 120)).toBe(12);
    expect(prixPort(i, 5, 200)).toBe(0);
    expect(enEuros(100, "USD")).toBe(92);
  });
});

describe("imprimeurs : comparateur", () => {
  const livre = { pages: 60, largeur: 210, hauteur: 280 };

  it("coût total réel, exclusions motivées", () => {
    const { lignes, exclusions } = comparer(
      [
        imprimeur("a"),
        imprimeur("b", { produits: [produit({ prix: { devise: "EUR", base: 20, pagesIncluses: 20, parPageSup: 0.4, statut: "V" } })] }),
        imprimeur("logiciel", { pdfFrance: { valeur: false, statut: "V" } }),
        imprimeur("carres", { produits: [produit({ largeur: 300, hauteur: 300 })] }),
        imprimeur("court", { produits: [produit({ pagesMax: 40 })] }),
      ],
      livre,
      3,
      "prix",
    );
    expect(lignes.map((l) => l.imprimeur.id)).toEqual(["b", "a"]);
    // b : (20 + 40 × 0,4) × 3 + 8 + 2 × 2 = 108 + 12
    expect(lignes[0]).toMatchObject({ exemplaire: 36, port: 12, total: 120, pages: 60 });
    expect(exclusions.map((e) => [e.imprimeur.id, e.raison])).toEqual([
      ["logiciel", expect.stringMatching(/PDF libre depuis la France/)],
      ["carres", expect.stringMatching(/Aucun format portrait/)],
      ["court", expect.stringMatching(/40 pages au plus/)],
    ]);
  });

  it("prix inconnu : listé en dernier avec ce qu'il reste à vérifier", () => {
    const { lignes } = comparer(
      [imprimeur("inconnu", { produits: [produit({ prix: { devise: "USD", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } })], pdfFrance: { valeur: null, statut: "NV" } }), imprimeur("a")],
      livre,
      1,
      "prix",
    );
    expect(lignes.map((l) => l.imprimeur.id)).toEqual(["a", "inconnu"]);
    expect(lignes[1].total).toBeNull();
    // Port inconnu : total des livres seulement, signalé.
    const sansPort = comparer([imprimeur("p", { port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" } })], livre, 2).lignes[0];
    expect(sansPort).toMatchObject({ total: 96, port: null, portInclus: false });
    expect(lignes[1].incertitudes.join(" ")).toMatch(/Prix non relevé.*PDF|PDF.*Prix non relevé/s);
  });

  it("classements : note, délai, score combiné", () => {
    const imps = [
      imprimeur("cher-note", { note: { valeur: 4.9, avis: 9, domaine: "", statut: "V" }, produits: [produit({ prix: { devise: "EUR", base: 60, pagesIncluses: 24, parPageSup: 0.5, statut: "V" } })] }),
      imprimeur("rapide", { delais: { fabrication: 1, livraison: 2, statut: "V" }, note: { valeur: 3, avis: 9, domaine: "", statut: "V" } }),
    ];
    expect(comparer(imps, livre, 1, "note").lignes[0].imprimeur.id).toBe("cher-note");
    expect(comparer(imps, livre, 1, "delai").lignes[0].imprimeur.id).toBe("rapide");
    const s = comparer(imps, livre, 1, "score").lignes;
    expect(s[0].score).toBeGreaterThanOrEqual(s[1].score);
  });

  it("choisit le produit de même forme le plus proche", () => {
    const i = imprimeur("x", { produits: [produit({ id: "a4", largeur: 210, hauteur: 297 }), produit({ id: "petit", largeur: 150, hauteur: 200 }), produit({ id: "carre", largeur: 300, hauteur: 300 })] });
    expect(produitProche(i, 210, 280)?.id).toBe("a4");
    expect(produitProche(i, 200, 200)?.id).toBe("carre");
    expect(produitProche(i, 280, 210)).toBeNull();
    expect(forme(297, 210)).toBe("paysage");
  });

  it("catalogue réel : chaque imprimeur a des produits cohérents et une source", () => {
    expect(IMPRIMEURS.length).toBeGreaterThanOrEqual(8);
    for (const i of IMPRIMEURS) {
      expect(i.produits.length).toBeGreaterThan(0);
      expect(i.releve).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const p of i.produits) {
        expect(p.pagesMin).toBeLessThan(p.pagesMax);
        expect(p.pagesMin % 2).toBe(0);
        if (p.prix.statut !== "NV") expect(p.prix.source).toMatch(/^https:\/\//);
      }
    }
  });
});

describe("imprimeurs : le livre suit les règles du produit choisi", () => {
  it("format, pages, marges de sécurité, dos de l'imprimeur", () => {
    const f = formatParId("fotofabriek:a4-portrait");
    expect(f).toMatchObject({ largeur: 210, hauteur: 297, pagesMin: 24, pagesMax: 200, imprimeurId: "fotofabriek" });
    // Table officielle : 100 à 114 pages → 12 mm.
    expect(epaisseurDos(f, 100)).toBe(12);
    expect(epaisseurDos(f, 200)).toBe(19);
    expect(epaisseurDos(formatParId("fotofabriek:a4-plat"), 100)).toBe(24);
    const lulu = formatParId("lulu:11x8.5");
    expect(zoneUtile(lulu, 2).x).toBeGreaterThanOrEqual(12.7);
    expect(formatParId("inconnu:zzz").id).toBe("portrait-21x28");
    const imp = imprimeurParId("saal")!;
    expect(formatDepuisProduit(imp, imp.produits[0]).id).toBe("saal:21x28");
  });
});

describe("commande groupée : parts et dettes", () => {
  const port = (n: number) => 8 + 2 * (n - 1);
  const payeur = { id: "romain", nom: "Romain" };

  it("répartit au centime près", () => {
    expect(repartir(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(repartir(999, [2, 1]).reduce((a, b) => a + b)).toBe(999);
    expect(repartir(500, [0, 0])).toEqual([0, 0]);
  });

  it("port groupé au prorata, livraison à domicile à part, le payeur ne se doit rien", () => {
    const r = recapitulatif(
      [
        { userId: "romain", nom: "Romain", exemplaires: 2, livraison: "groupee" },
        { userId: "lea", nom: "Léa", exemplaires: 1, livraison: "groupee" },
        { userId: "paul", nom: "Paul", exemplaires: 1, livraison: "domicile" },
        { userId: "zoe", nom: "Zoé", exemplaires: 0, livraison: "groupee" },
      ],
      45.5,
      port,
      payeur,
    );
    // Envoi groupé : 3 exemplaires → 12 € de port, 8 € pour Romain, 4 € pour Léa.
    expect(r.parts.map((p) => [p.userId, p.livres, p.port, p.total, p.doitA])).toEqual([
      ["romain", 9100, 800, 9900, null],
      ["lea", 4550, 400, 4950, "romain"],
      ["paul", 4550, 800, 5350, "romain"],
    ]);
    expect(r).toMatchObject({ exemplaires: 4, livres: 18200, port: 2000, total: 20200 });
    expect(r.dettes).toEqual([
      { de: "lea", deNom: "Léa", a: "romain", aNom: "Romain", montant: 4950 },
      { de: "paul", deNom: "Paul", a: "romain", aNom: "Romain", montant: 5350 },
    ]);
    expect(euros(4950)).toMatch(/49,50\s€/);
  });
});

describe("imprimeurs : catalogue relevé le 2 novembre 2026", () => {
  it("Blurb, prix en euros publiés : 20 × 25 Standard de 100 pages, 76,80 €", () => {
    const blurb = imprimeurParId("blurb")!;
    expect(prixExemplaire(blurb.produits.find((p) => p.id === "20x25")!, 100)).toBe(76.8);
  });

  it("CEWE écarté en France, Prodigi sans fond perdu ni dos à fournir", () => {
    const { exclusions } = comparer(IMPRIMEURS, { pages: 60, largeur: 210, hauteur: 280 }, 2);
    expect(exclusions.find((e) => e.imprimeur.id === "cewe")?.raison).toMatch(/France/);
    expect(formatParId("prodigi:a4-portrait").fondPerdu).toBe(0);
  });
});

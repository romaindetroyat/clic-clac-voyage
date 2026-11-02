import { beforeEach, describe, expect, it } from "vitest";
import { formatParId } from "@/lib/livre/formats";
import { mettreEnPage } from "@/lib/livre/mise-en-page";
import type { Db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import {
  changerStatut,
  choisirImprimeur,
  definirPayeur,
  enregistrerMaCommande,
  etatCommande,
  marquerCommandee,
  marquerPaye,
} from "@/server/domaine/commande";
import { genererId } from "@/server/domaine/crypto";
import { enregistrerLivre, livreDe, versionsDe } from "@/server/domaine/livre";
import { accepterInvitations, creerVoyage, ErreurMetier, inviter } from "@/server/domaine/voyages";
import { baseDeTest, creerUtilisateur } from "./aide-db";

describe("commande groupée", () => {
  let db: Db;
  let voyageId: string;
  let romain: { id: string };
  let lea: { id: string };
  let paul: { id: string };
  const ctx = (u: { id: string }, estAdmin = false) => ({ voyageId, userId: u.id, estAdmin });

  beforeEach(async () => {
    db = await baseDeTest();
    romain = await creerUtilisateur(db, "romain@exemple.fr", "Romain");
    lea = await creerUtilisateur(db, "lea@exemple.fr", "Léa");
    paul = await creerUtilisateur(db, "paul@exemple.fr", "Paul");
    voyageId = (await creerVoyage(db, romain.id, { nom: "Naxos" })).id;
    for (const [u, e] of [[lea, "lea@exemple.fr"], [paul, "paul@exemple.fr"]] as const) {
      await inviter(db, { voyageId, email: e, role: "contributeur", invitePar: romain.id });
      await accepterInvitations(db, u.id, e);
    }
    const ids = [];
    for (let i = 0; i < 6; i++) {
      const id = genererId();
      ids.push(id);
      await db.insert(media).values({ id, voyageId, type: "photo", statut: "pret", nomFichier: "x", mime: "image/jpeg", taille: 1, sha256: id, cleOriginal: id, largeur: 4000, hauteur: 3000 });
    }
    const { livre } = mettreEnPage({
      nom: "Naxos", periode: null, fuseau: "UTC", format: formatParId("portrait-21x28"),
      options: { ciblePages: 40, rythme: "equilibre", fond: "blanc", legendes: false, commentaires: false },
      episodes: [], medias: ids.map((id) => ({ id, largeur: 4000, hauteur: 3000, episodeId: null, instant: null, legende: null, auteur: null, vedette: false, qualite: null, vignette: null, moyenne: null, commentaires: [] })),
    });
    await enregistrerLivre(db, ctx(romain), livre, null);
  });

  it("choisir un imprimeur adapte le livre et garde une version", async () => {
    await choisirImprimeur(db, ctx(romain), "blurb", "20x25");
    const l = await livreDe(db, voyageId);
    expect(l?.contenu.formatId).toBe("blurb:20x25");
    expect(l?.revision).toBe(2);
    expect((await versionsDe(db, voyageId))[0].libelle).toBe("Avant le choix de Blurb");
    await expect(choisirImprimeur(db, ctx(romain), "cewe", "21x28")).rejects.toThrow(/France/);
    await expect(choisirImprimeur(db, ctx(romain), "blurb", "inconnu")).rejects.toThrow(ErreurMetier);
  });

  it("parts, adresses privées, payeur, remboursements, montants figés", async () => {
    await choisirImprimeur(db, ctx(romain), "blurb", "20x25");
    await enregistrerMaCommande(db, ctx(romain), { exemplaires: 2, livraison: "groupee" });
    await enregistrerMaCommande(db, ctx(lea), { exemplaires: 1, livraison: "groupee" });
    await expect(enregistrerMaCommande(db, ctx(paul), { exemplaires: 1, livraison: "domicile", adresse: "" })).rejects.toThrow(/adresse/);
    await enregistrerMaCommande(db, ctx(paul), { exemplaires: 1, livraison: "domicile", adresse: "12 rue des Lilas\n75011 Paris" });
    await expect(enregistrerMaCommande(db, ctx(paul), { exemplaires: 99, livraison: "groupee" })).rejects.toThrow(/20/);

    const vuLea = await etatCommande(db, ctx(lea));
    // Blurb 20 × 25 Standard, 40 pages : 38,40 + 20 × 0,48 = 48 €.
    expect(vuLea.prix).toBe(48);
    expect(vuLea.commandes.find((c) => c.userId === paul.id)?.adresse).toBeNull();
    expect(vuLea.payeur.id).toBe(romain.id);
    expect(vuLea.recap?.dettes.map((d) => [d.deNom, d.aNom, d.montant])).toEqual([
      ["Léa", "Romain", 4800],
      ["Paul", "Romain", 4800],
    ]);
    const vuAdmin = await etatCommande(db, ctx(romain, true));
    expect(vuAdmin.commandes.find((c) => c.userId === paul.id)?.adresse).toContain("Lilas");

    await marquerPaye(db, voyageId, lea.id, true);
    await marquerCommandee(db, ctx(romain, true));
    const apres = await etatCommande(db, ctx(romain, true));
    expect(apres.commandes.map((c) => [c.nom, c.statut, c.paye, c.montantFige])).toEqual([
      ["Léa", "commandee", true, 4800],
      ["Paul", "commandee", false, 4800],
      ["Romain", "commandee", false, 9600],
    ]);
    // Commande passée : plus de changement de quantité ni d'imprimeur.
    await expect(enregistrerMaCommande(db, ctx(lea), { exemplaires: 3, livraison: "groupee" })).rejects.toThrow(/déjà passée/);
    await expect(choisirImprimeur(db, ctx(romain), "saal", "21x28")).rejects.toThrow(/déjà passée/);
    await changerStatut(db, voyageId, lea.id, "expediee");
    expect((await etatCommande(db, ctx(lea))).commandes.find((c) => c.userId === lea.id)?.statut).toBe("expediee");
  });

  it("le payeur est un organisateur du voyage", async () => {
    await expect(definirPayeur(db, voyageId, lea.id)).rejects.toThrow(/organisateur/);
    await definirPayeur(db, voyageId, romain.id);
    expect((await etatCommande(db, ctx(romain, true))).payeur.id).toBe(romain.id);
    const inconnu = await creerUtilisateur(db, "x@exemple.fr");
    await expect(definirPayeur(db, voyageId, inconnu.id)).rejects.toThrow(ErreurMetier);
  });
});

/**
 * Commande groupée du livre : exemplaires de chacun, livraison, choix de l'imprimeur,
 * montants et « qui doit combien à qui ». Pas de paiement en ligne : seulement le suivi.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { imprimeurParId } from "@/lib/imprimeurs/catalogue";
import { enEuros, prixExemplaire, prixPort } from "@/lib/imprimeurs/comparateur";
import { recapitulatif, type Recapitulatif } from "@/lib/imprimeurs/parts";
import type { Imprimeur, Produit } from "@/lib/imprimeurs/types";
import { schemaLivre } from "@/lib/livre/modele";
import type { Db } from "../db/client";
import { commandeLivre, livre, participant, user } from "../db/schema";
import { genererId } from "./crypto";
import { creerVersion } from "./livre";
import { ErreurMetier } from "./voyages";

export const STATUTS = { demandee: "Demandée", commandee: "Commandée", expediee: "Expédiée" } as const;
export type StatutCommande = keyof typeof STATUTS;
export const EXEMPLAIRES_MAX = 20;

/** Imprimeur et produit choisis : ceux du format du livre (« imprimeur:produit »). */
export async function choixImprimeur(db: Db, voyageId: string): Promise<{ imprimeur: Imprimeur; produit: Produit; pages: number } | null> {
  const l = await db.query.livre.findFirst({ where: eq(livre.voyageId, voyageId), columns: { contenu: true } });
  const r = l ? schemaLivre.safeParse(l.contenu) : null;
  if (!r?.success) return null;
  const [imp, prod] = r.data.formatId.split(":");
  const imprimeur = imprimeurParId(imp);
  const produit = imprimeur?.produits.find((p) => p.id === prod);
  return imprimeur && produit ? { imprimeur, produit, pages: r.data.pages.length } : null;
}

/** Choisir un imprimeur réadapte le livre à son format et à ses règles (version gardée avant). */
export async function choisirImprimeur(db: Db, ctx: { voyageId: string; userId: string }, imprimeurId: string, produitId: string) {
  const imp = imprimeurParId(imprimeurId);
  const prod = imp?.produits.find((p) => p.id === produitId);
  if (!imp || !prod) throw new ErreurMetier("Imprimeur ou produit inconnu.");
  if (imp.pdfFrance.valeur === false) throw new ErreurMetier(`${imp.nom} n’accepte pas de PDF depuis la France.`);
  const l = await db.query.livre.findFirst({ where: eq(livre.voyageId, ctx.voyageId) });
  const r = l ? schemaLivre.safeParse(l.contenu) : null;
  if (!l || !r?.success) throw new ErreurMetier("Créez d’abord le livre (onglet Livre).");
  const engagees = await db
    .select({ id: commandeLivre.id })
    .from(commandeLivre)
    .where(and(eq(commandeLivre.voyageId, ctx.voyageId), inArray(commandeLivre.statut, ["commandee", "expediee"])));
  if (engagees.length) throw new ErreurMetier("La commande est déjà passée : l’imprimeur ne peut plus changer.");
  await creerVersion(db, ctx, `Avant le choix de ${imp.nom}`);
  const contenu = { ...r.data, formatId: `${imp.id}:${prod.id}` };
  await db
    .update(livre)
    .set({ contenu, revision: l.revision + 1, modifiePar: ctx.userId, updatedAt: new Date() })
    .where(eq(livre.voyageId, ctx.voyageId));
}

const schemaAdresse = (a: string | null | undefined) => (a ?? "").trim().slice(0, 500);

export async function enregistrerMaCommande(
  db: Db,
  ctx: { voyageId: string; userId: string },
  d: { exemplaires: number; livraison: "groupee" | "domicile"; adresse?: string | null },
) {
  if (!Number.isInteger(d.exemplaires) || d.exemplaires < 0 || d.exemplaires > EXEMPLAIRES_MAX) {
    throw new ErreurMetier(`Entre 0 et ${EXEMPLAIRES_MAX} exemplaires.`);
  }
  const adresse = d.livraison === "domicile" ? schemaAdresse(d.adresse) : "";
  if (d.livraison === "domicile" && d.exemplaires > 0 && adresse.length < 10) throw new ErreurMetier("Indiquez l’adresse de livraison complète.");
  const existante = await db.query.commandeLivre.findFirst({ where: and(eq(commandeLivre.voyageId, ctx.voyageId), eq(commandeLivre.userId, ctx.userId)) });
  if (existante && (existante.statut === "commandee" || existante.statut === "expediee")) {
    throw new ErreurMetier("La commande est déjà passée chez l’imprimeur : voyez avec l’organisateur.");
  }
  const valeurs = { exemplaires: d.exemplaires, livraison: d.livraison, adresse: adresse || null, updatedAt: new Date() };
  if (existante) await db.update(commandeLivre).set(valeurs).where(eq(commandeLivre.id, existante.id));
  else await db.insert(commandeLivre).values({ id: genererId(), voyageId: ctx.voyageId, userId: ctx.userId, ...valeurs });
}

export async function changerStatut(db: Db, voyageId: string, userId: string, statut: StatutCommande) {
  const r = await db
    .update(commandeLivre)
    .set({ statut, updatedAt: new Date() })
    .where(and(eq(commandeLivre.voyageId, voyageId), eq(commandeLivre.userId, userId)))
    .returning({ id: commandeLivre.id });
  if (!r.length) throw new ErreurMetier("Commande introuvable.");
}

/** Remboursement reçu (ou annulé) par la personne qui a avancé l'argent. */
export async function marquerPaye(db: Db, voyageId: string, userId: string, paye: boolean) {
  const r = await db
    .update(commandeLivre)
    .set({ paye, updatedAt: new Date() })
    .where(and(eq(commandeLivre.voyageId, voyageId), eq(commandeLivre.userId, userId)))
    .returning({ id: commandeLivre.id });
  if (!r.length) throw new ErreurMetier("Commande introuvable.");
}

export async function definirPayeur(db: Db, voyageId: string, userId: string) {
  const p = await db.query.participant.findFirst({ where: and(eq(participant.voyageId, voyageId), eq(participant.userId, userId)) });
  if (!p) throw new ErreurMetier("Cette personne ne participe pas au voyage.");
  if (p.role !== "admin") throw new ErreurMetier("Choisissez un organisateur (administrateur du voyage).");
  const r = await db.update(livre).set({ payeurId: userId }).where(eq(livre.voyageId, voyageId)).returning({ id: livre.voyageId });
  if (!r.length) throw new ErreurMetier("Créez d’abord le livre.");
}

export type LigneCommande = {
  userId: string;
  nom: string;
  exemplaires: number;
  livraison: "groupee" | "domicile";
  adresse: string | null;
  statut: StatutCommande;
  paye: boolean;
  montantFige: number | null;
};

/** État complet de la commande. Les adresses ne sont données qu'aux administrateurs (et à chacun la sienne). */
export async function etatCommande(db: Db, ctx: { voyageId: string; userId: string; estAdmin: boolean }) {
  const choix = await choixImprimeur(db, ctx.voyageId);
  const lignes = await db
    .select({
      userId: commandeLivre.userId,
      nom: user.name,
      exemplaires: commandeLivre.exemplaires,
      livraison: commandeLivre.livraison,
      adresse: commandeLivre.adresse,
      statut: commandeLivre.statut,
      paye: commandeLivre.paye,
      montantFige: commandeLivre.montantFige,
    })
    .from(commandeLivre)
    .innerJoin(user, eq(user.id, commandeLivre.userId))
    .where(eq(commandeLivre.voyageId, ctx.voyageId))
    .orderBy(asc(user.name));
  const commandes: LigneCommande[] = lignes.map((l) => ({ ...l, adresse: ctx.estAdmin || l.userId === ctx.userId ? l.adresse : null }));

  const l = await db.query.livre.findFirst({ where: eq(livre.voyageId, ctx.voyageId), columns: { payeurId: true } });
  const admins = await db
    .select({ id: user.id, nom: user.name })
    .from(participant)
    .innerJoin(user, eq(user.id, participant.userId))
    .where(and(eq(participant.voyageId, ctx.voyageId), eq(participant.role, "admin")))
    .orderBy(asc(user.name));
  const payeur = admins.find((a) => a.id === l?.payeurId) ?? admins[0] ?? { id: "", nom: "l’organisateur" };

  let recap: Recapitulatif | null = null;
  let prix: number | null = null;
  if (choix) {
    const unitaire = prixExemplaire(choix.produit, choix.pages);
    prix = unitaire == null ? null : enEuros(unitaire, choix.produit.prix.devise);
    if (prix != null) {
      const imp = choix.imprimeur;
      const port = (n: number, sousTotal: number) => {
        const p = prixPort(imp, n, sousTotal);
        return p == null ? null : enEuros(p, imp.port.devise);
      };
      recap = recapitulatif(commandes, prix, port, payeur);
    }
  }
  return { choix, commandes, payeur, admins, prix, recap, portConnu: choix?.imprimeur.port.premier != null };
}

/** La commande est passée chez l'imprimeur : on fige le montant de chacun. */
export async function marquerCommandee(db: Db, ctx: { voyageId: string; userId: string; estAdmin: boolean }) {
  const e = await etatCommande(db, ctx);
  if (!e.choix) throw new ErreurMetier("Choisissez d’abord un imprimeur.");
  for (const c of e.commandes) {
    if (c.exemplaires <= 0) continue;
    const part = e.recap?.parts.find((p) => p.userId === c.userId);
    await db
      .update(commandeLivre)
      .set({ statut: c.statut === "expediee" ? "expediee" : "commandee", montantFige: part?.total ?? null, updatedAt: new Date() })
      .where(and(eq(commandeLivre.voyageId, ctx.voyageId), eq(commandeLivre.userId, c.userId)));
  }
}

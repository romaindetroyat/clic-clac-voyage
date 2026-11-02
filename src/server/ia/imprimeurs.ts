import "server-only";
/**
 * IMPR-04 : « mettre à jour avec l'IA ». L'IA cherche sur le web les prix, frais de port,
 * délais et notes d'un imprimeur et propose des changements sourcés ; rien n'est appliqué
 * avant qu'un administrateur de l'app les valide. Le catalogue du dépôt reste la base,
 * les valeurs validées sont rangées en base et appliquées par-dessus.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { IMPRIMEURS } from "../../lib/imprimeurs/catalogue";
import type { Imprimeur } from "../../lib/imprimeurs/types";
import type { Db } from "../db/client";
import { majImprimeur, type PropositionImprimeur } from "../db/schema";
import { ErreurMetier } from "../domaine/voyages";
import { enregistrerDepense, verifierBudget } from "./budget";
import type { AppelIa } from "./client";

export const CHAMPS = {
  "prix.base": "Prix de base",
  "prix.pagesIncluses": "Pages incluses dans le prix de base",
  "prix.parPageSup": "Prix par page supplémentaire",
  "port.premier": "Port pour le premier exemplaire",
  "port.suivant": "Port par exemplaire suivant",
  "port.francoDes": "Port offert dès (montant de commande)",
  "delais.fabrication": "Délai de fabrication (jours ouvrés)",
  "delais.livraison": "Délai de livraison (jours ouvrés)",
  "note.valeur": "Note des clients (sur 5)",
  "note.avis": "Nombre d’avis",
} as const;
export type Champ = keyof typeof CHAMPS;

/** Coût maximal estimé d'un tour de recherche, en dollars. */
export const ESTIMATION_TOUR_USD = 0.6;
const TOURS_MAX = 6;

export function valeurActuelle(imp: Imprimeur, champ: Champ, produitId: string | null): number | null {
  const [groupe, cle] = champ.split(".") as [string, string];
  if (groupe === "prix") {
    const p = imp.produits.find((x) => x.id === produitId);
    return p ? ((p.prix as Record<string, unknown>)[cle] as number | null) : null;
  }
  if (groupe === "note") return imp.note ? ((imp.note as Record<string, unknown>)[cle] as number) : null;
  return ((imp[groupe as "port" | "delais"] as Record<string, unknown>)[cle] as number | null) ?? null;
}

function appliquer(imp: Imprimeur, p: PropositionImprimeur) {
  const [groupe, cle] = p.champ.split(".") as [string, string];
  if (groupe === "prix") {
    const prod = imp.produits.find((x) => x.id === p.produitId);
    if (!prod) return;
    Object.assign(prod.prix, { [cle]: p.proposee, statut: "V", source: p.source });
  } else if (groupe === "note") {
    imp.note ??= { valeur: 0, avis: 0, domaine: new URL(p.source).hostname.replace(/^www\./, ""), statut: "V" };
    Object.assign(imp.note, { [cle]: p.proposee, statut: "V", source: p.source });
  } else {
    Object.assign(imp[groupe as "port" | "delais"], { [cle]: p.proposee, statut: "V", source: p.source });
  }
}

/** Le catalogue du dépôt, corrigé des mises à jour validées (les plus récentes en dernier). */
export async function catalogueEffectif(db: Db): Promise<Imprimeur[]> {
  const majs = await db.query.majImprimeur.findMany({ where: eq(majImprimeur.statut, "validee"), orderBy: asc(majImprimeur.verifieLe) });
  const cat = structuredClone(IMPRIMEURS);
  for (const m of majs) {
    const imp = cat.find((i) => i.id === m.imprimeurId);
    if (!imp) continue;
    for (const p of m.propositions) if (p.acceptee) appliquer(imp, p);
    if (m.verifieLe) imp.releve = m.verifieLe.toISOString().slice(0, 10);
  }
  return cat;
}

/** Fiche résumée envoyée à l'IA : seulement ce qu'elle peut proposer de changer. */
function ficheIa(imp: Imprimeur) {
  return {
    nom: imp.nom,
    site: imp.site,
    commande: imp.lienCommande,
    produits: imp.produits.map((p) => ({ produitId: p.id, nom: p.nom, papier: p.papier, pages: `${p.pagesMin} à ${p.pagesMax}`, prix: { devise: p.prix.devise, base: p.prix.base, pagesIncluses: p.prix.pagesIncluses, parPageSup: p.prix.parPageSup, parDoublePage: p.prix.parDoublePage ?? false } })),
    port: { devise: imp.port.devise, premier: imp.port.premier, suivant: imp.port.suivant, francoDes: imp.port.francoDes },
    delais: imp.delais,
    note: imp.note ? { valeur: imp.note.valeur, avis: imp.note.avis, domaine: imp.note.domaine } : null,
    releve: imp.releve,
  };
}

const OUTIL_PROPOSER = {
  name: "proposer",
  description: "Rend le résultat de la vérification : les valeurs à corriger dans la fiche (liste vide si tout est à jour) et un résumé.",
  strict: true,
  input_schema: {
    type: "object" as const,
    properties: {
      propositions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            champ: { type: "string", enum: Object.keys(CHAMPS) },
            produitId: { type: ["string", "null"], description: "Identifiant du produit pour les champs prix.*, null sinon." },
            valeur: { type: "number", description: "Nouvelle valeur, dans la devise de la fiche pour les montants." },
            source: { type: "string", description: "Adresse exacte de la page où la valeur a été lue." },
            extrait: { type: "string", description: "Citation courte de la page qui montre la valeur." },
          },
          required: ["champ", "produitId", "valeur", "source", "extrait"],
          additionalProperties: false,
        },
      },
      resume: { type: "string", description: "Deux ou trois phrases en français : ce qui a été vérifié, ce qui n’a pas pu l’être." },
    },
    required: ["propositions", "resume"],
    additionalProperties: false,
  },
};

const sortie = z.object({
  propositions: z.array(z.object({ champ: z.string(), produitId: z.string().nullable(), valeur: z.number(), source: z.string(), extrait: z.string() })),
  resume: z.string(),
});

/** Garde les propositions valides, utiles (valeur différente) et sourcées ; une seule par champ. */
export function filtrerPropositions(imp: Imprimeur, brutes: z.infer<typeof sortie>["propositions"]): PropositionImprimeur[] {
  const res = new Map<string, PropositionImprimeur>();
  for (const b of brutes) {
    if (!(b.champ in CHAMPS) || !Number.isFinite(b.valeur) || b.valeur < 0 || !/^https?:\/\//.test(b.source)) continue;
    const champ = b.champ as Champ;
    const produitId = champ.startsWith("prix.") ? b.produitId : null;
    if (champ.startsWith("prix.") && !imp.produits.some((p) => p.id === produitId)) continue;
    if (champ === "note.valeur" && b.valeur > 5) continue;
    const actuelle = valeurActuelle(imp, champ, produitId);
    if (actuelle === b.valeur) continue;
    res.set(`${champ}|${produitId}`, { champ, produitId, actuelle, proposee: b.valeur, source: b.source, extrait: b.extrait.slice(0, 300) });
  }
  return [...res.values()];
}

export async function propositionEnAttente(db: Db, imprimeurId: string) {
  return db.query.majImprimeur.findFirst({ where: and(eq(majImprimeur.imprimeurId, imprimeurId), eq(majImprimeur.statut, "proposee")) });
}

/** Lance la recherche et enregistre les propositions (en attente de validation). */
export async function proposerMaj(db: Db, appel: AppelIa, imprimeurId: string, userId: string, o: { plafondEur?: number } = {}) {
  const base = (await catalogueEffectif(db)).find((i) => i.id === imprimeurId);
  if (!base) throw new ErreurMetier("Imprimeur inconnu.");
  if (await propositionEnAttente(db, imprimeurId)) throw new ErreurMetier("Une mise à jour attend déjà votre validation pour cet imprimeur.");

  const messages: Parameters<AppelIa>[0]["messages"] = [
    {
      role: "user",
      content: `Voici la fiche de l’imprimeur de livres photo ${base.nom}, relevée le ${base.releve} :\n\n${JSON.stringify(ficheIa(base), null, 2)}\n\nVérifie sur le web si ces valeurs sont toujours justes pour une commande livrée en France : prix TTC des produits listés (même format, même papier), frais de port vers la France, délais, note et nombre d’avis Trustpilot du domaine indiqué. Préfère les pages officielles de l’imprimeur ; pour la note, la page Trustpilot. Ne propose une valeur que si tu l’as lue sur une page précise, avec une citation qui la montre ; ignore les promotions temporaires. Quand tu as fini, appelle l’outil « proposer » (liste vide si tout est à jour).`,
    },
  ];
  let resultat: z.infer<typeof sortie> | null = null;
  let relance = false;
  for (let tour = 0; tour < TOURS_MAX && !resultat; tour++) {
    await verifierBudget(db, ESTIMATION_TOUR_USD, o.plafondEur);
    const m = await appel({
      max_tokens: 16000,
      output_config: { effort: "medium" },
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "FR" } },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8 },
        OUTIL_PROPOSER,
      ],
      messages,
    });
    await enregistrerDepense(db, { voyageId: null, usage: "imprimeur", u: m.usage });
    const outil = m.content.find((b) => b.type === "tool_use" && b.name === "proposer");
    if (outil?.type === "tool_use") {
      const r = sortie.safeParse(outil.input);
      if (r.success) resultat = r.data;
      break;
    }
    if (m.stop_reason === "refusal") break;
    messages.push({ role: "assistant", content: m.content });
    if (m.stop_reason === "pause_turn") continue;
    if (relance) break;
    relance = true;
    messages.push({ role: "user", content: "Appelle maintenant l’outil « proposer » avec ce que tu as trouvé (liste vide si rien n’a changé)." });
  }
  if (!resultat) throw new ErreurMetier("L’IA n’a pas pu terminer la vérification. Réessayez plus tard.");

  const propositions = filtrerPropositions(base, resultat.propositions);
  const id = randomUUID();
  await db.insert(majImprimeur).values({ id, imprimeurId, propositions, resume: resultat.resume.slice(0, 1000), demandePar: userId });
  return { id, propositions };
}

/** Valide les propositions cochées (aucune : « vérifié, rien à changer ») ; la date de vérification est mise à jour. */
export async function validerMaj(db: Db, majId: string, acceptees: number[]) {
  const m = await db.query.majImprimeur.findFirst({ where: eq(majImprimeur.id, majId) });
  if (!m || m.statut !== "proposee") throw new ErreurMetier("Cette mise à jour n’est plus en attente.");
  const ok = new Set(acceptees);
  await db
    .update(majImprimeur)
    .set({ statut: "validee", verifieLe: new Date(), propositions: m.propositions.map((p, i) => ({ ...p, acceptee: ok.has(i) })) })
    .where(eq(majImprimeur.id, majId));
}

export async function rejeterMaj(db: Db, majId: string) {
  const m = await db.query.majImprimeur.findFirst({ where: eq(majImprimeur.id, majId) });
  if (!m || m.statut !== "proposee") throw new ErreurMetier("Cette mise à jour n’est plus en attente.");
  await db.update(majImprimeur).set({ statut: "rejetee" }).where(eq(majImprimeur.id, majId));
}

/** État des mises à jour, par imprimeur : propositions en attente et dernière vérification. */
export async function etatMajs(db: Db) {
  const toutes = await db.query.majImprimeur.findMany({ orderBy: desc(majImprimeur.createdAt) });
  return IMPRIMEURS.map((i) => {
    const siennes = toutes.filter((m) => m.imprimeurId === i.id);
    return {
      imprimeur: i,
      enAttente: siennes.find((m) => m.statut === "proposee") ?? null,
      derniereVerification: siennes.find((m) => m.statut === "validee")?.verifieLe ?? null,
    };
  });
}

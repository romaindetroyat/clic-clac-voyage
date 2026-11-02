import "server-only";
/**
 * REC-10 : l'IA de vision ne sert qu'à départager une rafale quand les mesures locales
 * (netteté, exposition) hésitent. Elle juge ce qu'elles ne voient pas : yeux ouverts,
 * expressions, cadrage. Un choix fait à la main n'est jamais remis en cause.
 */
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { typeImage } from "../../lib/ia/tarifs";
import { scoreQualite } from "../../lib/qualite";
import type { Db } from "../db/client";
import { media, rafaleIa } from "../db/schema";
import type { Stockage } from "../stockage/types";
import { enregistrerDepense, verifierBudget } from "./budget";
import type { AppelIa } from "./client";

/** Écart de score (sur 1) en dessous duquel deux photos sont jugées à égalité. */
export const MARGE_DEPARTAGE = 0.05;
export const CANDIDATES_MAX = 4;
/** Coût maximal estimé d'un départage (4 images moyennes), en dollars. */
export const ESTIMATION_USD = 0.06;
export const LOT = 12;

export type Candidate = { id: string; cle: string; score: number };

/** Rafales encore hésitantes : pas de choix manuel, pas déjà vues par l'IA, deux photos ou plus à égalité. */
export async function rafalesADepartager(db: Db, voyageId: string): Promise<{ rafaleId: string; candidates: Candidate[] }[]> {
  const lignes = await db.query.media.findMany({
    where: and(eq(media.voyageId, voyageId), eq(media.statut, "pret"), isNull(media.doublonDe)),
    columns: { id: true, rafaleId: true, choixManuel: true, nettete: true, exposition: true, versions: true, priseUtc: true },
  });
  const dejaVues = new Set((await db.select({ r: rafaleIa.rafaleId }).from(rafaleIa).where(eq(rafaleIa.voyageId, voyageId))).map((l) => l.r));
  const groupes = new Map<string, typeof lignes>();
  for (const l of lignes) if (l.rafaleId) groupes.set(l.rafaleId, [...(groupes.get(l.rafaleId) ?? []), l]);
  const res: { rafaleId: string; candidates: Candidate[] }[] = [];
  for (const [rafaleId, g] of groupes) {
    if (dejaVues.has(rafaleId) || g.some((p) => p.choixManuel)) continue;
    const notees = g.filter((p) => p.versions.m).map((p) => ({ id: p.id, cle: p.versions.m!, score: scoreQualite(p) }));
    notees.sort((a, b) => b.score - a.score);
    const candidates = notees.filter((p) => notees[0].score - p.score <= MARGE_DEPARTAGE).slice(0, CANDIDATES_MAX);
    if (candidates.length >= 2) res.push({ rafaleId, candidates });
  }
  return res;
}

const SYSTEME = `Tu aides un groupe d’amis à choisir la meilleure photo d’une rafale (plusieurs photos de la même scène prises à quelques secondes d’écart) pour le site et le livre photo de leur voyage. Les mesures automatiques de netteté et d’exposition n’ont pas su les départager : juge ce qu’elles ne voient pas. Dans l’ordre : yeux ouverts et expressions naturelles des personnes, sujet principal net, moment saisi (geste, mouvement), cadrage et composition, horizon droit. Sans personne sur les photos, privilégie le sujet, la composition et la lumière.`;

const reponse = z.object({ photo: z.number().int(), raison: z.string() });

/** Demande à l'IA laquelle garder ; renvoie l'index (0…n-1) et la raison, ou null si elle n'a pas tranché. */
export async function demanderChoix(appel: AppelIa, images: { donnees: Uint8Array }[]) {
  const contenu: BetaContentBlockParam[] = [];
  images.forEach((im, i) => {
    const type = typeImage(im.donnees) ?? "image/jpeg";
    contenu.push({ type: "text", text: `Photo ${i + 1} :` });
    contenu.push({ type: "image", source: { type: "base64", media_type: type, data: Buffer.from(im.donnees).toString("base64") } });
  });
  contenu.push({
    type: "text",
    text: `Quelle photo garder ? Réponds avec son numéro (1 à ${images.length}) et une raison d’une phrase courte en français (moins de 100 caractères), sans nommer ni décrire physiquement les personnes.`,
  });
  const m = await appel({
    max_tokens: 4000,
    system: SYSTEME,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: { photo: { type: "integer" }, raison: { type: "string" } },
          required: ["photo", "raison"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: contenu }],
  });
  const texte = m.content.find((b) => b.type === "text");
  let choix: { index: number; raison: string } | null = null;
  if (m.stop_reason !== "refusal" && texte?.type === "text") {
    try {
      const r = reponse.parse(JSON.parse(texte.text));
      if (r.photo >= 1 && r.photo <= images.length) choix = { index: r.photo - 1, raison: r.raison.trim().slice(0, 160) };
    } catch {
      choix = null;
    }
  }
  return { choix, usage: m.usage };
}

/**
 * Départage jusqu'à `LOT` rafales hésitantes (une requête peut durer, le navigateur relance pour la suite).
 * La photo retenue par l'IA passe dans le site et le livre ; on peut toujours en préférer une autre d'un clic.
 */
export async function departagerRafales(db: Db, stockage: Stockage, appel: AppelIa, voyageId: string, o: { plafondEur?: number } = {}) {
  const a = await rafalesADepartager(db, voyageId);
  let faites = 0;
  let changees = 0;
  for (const r of a.slice(0, LOT)) {
    await verifierBudget(db, ESTIMATION_USD, o.plafondEur);
    const images = await Promise.all(r.candidates.map(async (c) => ({ donnees: await stockage.lire(c.cle) })));
    const { choix, usage } = await demanderChoix(appel, images);
    await enregistrerDepense(db, { voyageId, usage: "rafale", u: usage });
    const retenue = choix ? r.candidates[choix.index] : null;
    await db.transaction(async (tx) => {
      if (retenue) {
        const actuelle = await tx.query.media.findFirst({ where: and(eq(media.voyageId, voyageId), eq(media.rafaleId, r.rafaleId), eq(media.choixRafale, true)), columns: { id: true } });
        if (actuelle?.id !== retenue.id) {
          changees++;
          const ids = (await tx.select({ id: media.id }).from(media).where(and(eq(media.voyageId, voyageId), eq(media.rafaleId, r.rafaleId)))).map((l) => l.id);
          await tx.update(media).set({ choixRafale: false, dansSite: false, dansLivre: false }).where(inArray(media.id, ids));
          await tx.update(media).set({ choixRafale: true, dansSite: true, dansLivre: true }).where(eq(media.id, retenue.id));
        }
      }
      await tx
        .insert(rafaleIa)
        .values({ voyageId, rafaleId: r.rafaleId, mediaId: retenue?.id ?? null, raison: choix?.raison ?? null })
        .onConflictDoNothing();
    });
    faites++;
  }
  return { faites, changees, restantes: a.length - faites };
}

/** Raisons données par l'IA, par photo retenue. */
export async function avisIa(db: Db, voyageId: string): Promise<Map<string, string>> {
  const l = await db.select({ mediaId: rafaleIa.mediaId, raison: rafaleIa.raison }).from(rafaleIa).where(eq(rafaleIa.voyageId, voyageId));
  return new Map(l.filter((x) => x.mediaId && x.raison).map((x) => [x.mediaId!, x.raison!]));
}

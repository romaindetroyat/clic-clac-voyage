import "server-only";
/**
 * L'IA au service de l'éditeur visuel du site : proposer des légendes, proposer une disposition
 * des photos d'une partie de chapitre. Rien n'est appliqué sans l'accord de l'utilisateur :
 * l'éditeur affiche la proposition, qu'on garde, modifie ou annule.
 */
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { typeImage } from "../../lib/ia/tarifs";
import { IDS_TYPES_BLOCS, TYPES_BLOCS, type BlocSite, type TypeBloc } from "../../lib/site/config";
import type { Db } from "../db/client";
import { media } from "../db/schema";
import { ErreurMetier } from "../domaine/voyages";
import type { Stockage } from "../stockage/types";
import { enregistrerDepense, verifierBudget } from "./budget";
import type { AppelIa } from "./client";

export const LEGENDES_MAX = 8;
export const DISPOSITION_MAX = 30;
/** Coûts maximaux estimés (dollars). */
const ESTIMATION_LEGENDES_USD = 0.08;
const ESTIMATION_DISPOSITION_USD = 0.2;

async function images(db: Db, stockage: Stockage, voyageId: string, ids: string[], taille: "s" | "m") {
  const lignes = await db.query.media.findMany({
    where: and(eq(media.voyageId, voyageId), inArray(media.id, ids), eq(media.type, "photo")),
    columns: { id: true, versions: true, largeur: true, hauteur: true, legende: true },
  });
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const res: { id: string; donnees: Uint8Array; ratio: number; legende: string | null }[] = [];
  for (const id of ids) {
    const l = parId.get(id);
    const v = l?.versions as Record<string, string> | undefined;
    const cle = taille === "s" ? (v?.rs ?? v?.s ?? v?.rm ?? v?.m) : (v?.rm ?? v?.m);
    if (!l || !cle) continue;
    res.push({ id, donnees: await stockage.lire(cle), ratio: l.largeur && l.hauteur ? l.largeur / l.hauteur : 1.5, legende: l.legende });
  }
  return res;
}

function bloc(i: number, donnees: Uint8Array, texte: string): BetaContentBlockParam[] {
  return [
    { type: "text", text: texte },
    { type: "image", source: { type: "base64", media_type: typeImage(donnees) ?? "image/jpeg", data: Buffer.from(donnees).toString("base64") } },
  ];
}

function texteJson(m: Awaited<ReturnType<AppelIa>>): unknown {
  const t = m.content.find((b) => b.type === "text");
  if (m.stop_reason === "refusal" || t?.type !== "text") return null;
  try {
    return JSON.parse(t.text);
  } catch {
    return null;
  }
}

const SYSTEME_LEGENDES = `Tu écris les légendes des photos du site d’un voyage entre amis, en français. Une légende par photo : courte (8 à 15 mots), vivante, concrète (le lieu, la lumière, le moment, ce qui se passe), sans formule creuse (« magnifique », « superbe vue »), sans hashtag ni emoji. Ne nomme pas les personnes et ne décris pas leur physique. Reste fidèle à l’image : n’invente pas de lieu précis que le contexte ne donne pas.`;

/** Propose une légende pour chaque photo (le contexte du chapitre aide à nommer le lieu). */
export async function proposerLegendes(
  db: Db,
  stockage: Stockage,
  appel: AppelIa,
  voyageId: string,
  ids: string[],
  contexte: { titre?: string | null; lieu?: string | null; dates?: string | null },
  o: { plafondEur?: number } = {},
) {
  const ims = await images(db, stockage, voyageId, ids.slice(0, LEGENDES_MAX), "m");
  if (!ims.length) throw new ErreurMetier("Aucune photo à légender.");
  await verifierBudget(db, ESTIMATION_LEGENDES_USD, o.plafondEur);
  const contenu: BetaContentBlockParam[] = [];
  const ctx = [contexte.titre && `Chapitre : ${contexte.titre}`, contexte.lieu && `Lieu : ${contexte.lieu}`, contexte.dates && `Date : ${contexte.dates}`].filter(Boolean).join("\n");
  if (ctx) contenu.push({ type: "text", text: ctx });
  ims.forEach((im, i) => contenu.push(...bloc(i, im.donnees, `Photo ${i + 1}${im.legende ? ` (légende actuelle : « ${im.legende} »)` : ""} :`)));
  contenu.push({ type: "text", text: `Propose une légende pour chacune des ${ims.length} photos, dans l’ordre.` });
  const m = await appel({
    max_tokens: 4000,
    system: SYSTEME_LEGENDES,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: { legendes: { type: "array", items: { type: "object", properties: { photo: { type: "integer" }, texte: { type: "string" } }, required: ["photo", "texte"], additionalProperties: false } } },
          required: ["legendes"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: contenu }],
  });
  await enregistrerDepense(db, { voyageId, usage: "site", u: m.usage });
  const r = z.object({ legendes: z.array(z.object({ photo: z.number().int(), texte: z.string() })) }).safeParse(texteJson(m));
  if (!r.success) return { legendes: [] as { id: string; texte: string }[] };
  return {
    legendes: r.data.legendes
      .filter((l) => l.photo >= 1 && l.photo <= ims.length && l.texte.trim())
      .map((l) => ({ id: ims[l.photo - 1].id, texte: l.texte.trim().slice(0, 300) })),
  };
}

const SYSTEME_DISPOSITION = `Tu es directeur artistique. Tu mets en page les photos d’un chapitre du site d’un voyage, comme un beau magazine en ligne. Dispositions possibles (type, nombre de photos) :
- grande (1) : photo sur toute la largeur, pour les images fortes, les paysages, les moments clés ;
- centree (1) : photo centrée moins large, légende à côté, pour une image calme ou un détail ;
- note (1) : photo et ses mots côte à côte, pour une photo qui a une histoire ;
- rangee (2 à 5) : photos côte à côte à la même hauteur, pour une série ;
- duo (2) : deux photos décalées, une grande et une plus petite, pour un contraste (ensemble et détail) ;
- mosaique (3 à 7) : une grande et les autres en petits carrés, pour une scène vue sous plusieurs angles ;
- defilement (2 à 12) : bande qui défile, pour une longue série.
Règles : garde l’ordre chronologique des photos autant que possible ; varie les dispositions (pas deux fois la même de suite) ; alterne les côtés (gauche, droite) ; mets en valeur les meilleures photos ; une photo floue ou faible va dans une rangée ou une mosaïque, jamais en grand. Utilise chaque photo une fois et une seule.`;

const schemaReponse = z.object({
  blocs: z.array(z.object({ type: z.string(), photos: z.array(z.number().int()), cote: z.enum(["gauche", "droite"]).optional() })),
  idee: z.string().optional(),
});

/** Propose une disposition (blocs) pour les photos d'une partie de chapitre. */
export async function proposerDisposition(db: Db, stockage: Stockage, appel: AppelIa, voyageId: string, ids: string[], o: { plafondEur?: number } = {}) {
  const ims = await images(db, stockage, voyageId, ids.slice(0, DISPOSITION_MAX), "s");
  if (ims.length < 2) throw new ErreurMetier("Il faut au moins deux photos à disposer.");
  await verifierBudget(db, ESTIMATION_DISPOSITION_USD, o.plafondEur);
  const contenu: BetaContentBlockParam[] = [];
  ims.forEach((im, i) => contenu.push(...bloc(i, im.donnees, `Photo ${i + 1} (${im.ratio >= 1.15 ? "paysage" : im.ratio < 0.9 ? "portrait" : "carrée"}${im.legende ? `, légende : « ${im.legende} »` : ""}) :`)));
  contenu.push({ type: "text", text: `Mets en page ces ${ims.length} photos. Donne aussi ton idée en une phrase courte (moins de 120 caractères).` });
  const m = await appel({
    max_tokens: 6000,
    system: SYSTEME_DISPOSITION,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            blocs: {
              type: "array",
              items: {
                type: "object",
                properties: { type: { type: "string", enum: IDS_TYPES_BLOCS }, photos: { type: "array", items: { type: "integer" } }, cote: { type: "string", enum: ["gauche", "droite"] } },
                required: ["type", "photos"],
                additionalProperties: false,
              },
            },
            idee: { type: "string" },
          },
          required: ["blocs", "idee"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: contenu }],
  });
  await enregistrerDepense(db, { voyageId, usage: "site", u: m.usage });
  const r = schemaReponse.safeParse(texteJson(m));
  if (!r.success) throw new ErreurMetier("L’IA n’a pas su proposer de disposition : réessayez.");
  return { blocs: nettoyer(r.data.blocs, ims.map((x) => x.id)), idee: r.data.idee?.trim().slice(0, 200) ?? null };
}

/** Réponse de l'IA → dispositions valides : chaque photo une fois, nombres de photos respectés. */
export function nettoyer(blocs: { type: string; photos: number[]; cote?: "gauche" | "droite" }[], ids: string[]): BlocSite[] {
  const vus = new Set<number>();
  const res: BlocSite[] = [];
  for (const b of blocs) {
    if (!(IDS_TYPES_BLOCS as string[]).includes(b.type)) continue;
    const type = b.type as TypeBloc;
    const photos = b.photos.filter((p) => p >= 1 && p <= ids.length && !vus.has(p)).slice(0, TYPES_BLOCS[type].max);
    if (!photos.length) continue;
    photos.forEach((p) => vus.add(p));
    res.push({ type, ids: photos.map((p) => ids[p - 1]), ...(b.cote ? { cote: b.cote } : {}) });
  }
  // Les photos oubliées par l'IA, en rangées à la fin.
  const oubliees = ids.filter((_, i) => !vus.has(i + 1));
  for (let i = 0; i < oubliees.length; i += 3) {
    const lot = oubliees.slice(i, i + 3);
    res.push({ type: lot.length > 1 ? "rangee" : "grande", ids: lot });
  }
  return res;
}

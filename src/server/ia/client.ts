import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { env } from "../env";

export const MODELE_IA = "claude-opus-5-5";

/** Un appel à l'API (injecté pour pouvoir tester sans réseau ni clé). */
export type AppelIa = (params: Omit<MessageCreateParamsNonStreaming, "model">) => Promise<BetaMessage>;

/** L'IA n'est disponible que si une clé d'API est configurée dans Vercel. */
export function iaActive(): boolean {
  return !!env().ANTHROPIC_API_KEY;
}

let client: Anthropic | undefined;

export function appelIa(): AppelIa {
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, maxRetries: 1, timeout: 240_000 });
  const c = client;
  return (params) =>
    c.beta.messages.create({
      ...params,
      model: MODELE_IA,
      // Si le modèle décline une requête, l'API la rejoue sur un modèle de repli adapté.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
}

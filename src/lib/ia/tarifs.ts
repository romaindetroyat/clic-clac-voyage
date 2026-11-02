/**
 * Tarifs de l'API d'IA (Anthropic, modèle Claude Opus 5.5), relevés le 2 novembre 2026,
 * en dollars. Servent à compter chaque appel et à tenir le budget mensuel.
 */
export const TARIFS_IA = {
  releve: "2026-11-02",
  modele: "Claude Opus 5.5",
  /** Dollars par million de jetons. */
  entree: 4,
  sortie: 20,
  ecritureCache: 5,
  lectureCache: 0.2,
  /** Dollars par recherche web. */
  recherche: 0.01,
};

export type UsageIa = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

/** Coût d'un appel, en millionièmes de dollar (entier, arrondi au-dessus). */
export function coutMicroUsd(u: UsageIa): number {
  const t = TARIFS_IA;
  // Un jeton à P dollars le million coûte P millionièmes de dollar.
  const micro =
    u.input_tokens * t.entree +
    u.output_tokens * t.sortie +
    (u.cache_creation_input_tokens ?? 0) * t.ecritureCache +
    (u.cache_read_input_tokens ?? 0) * t.lectureCache +
    (u.server_tool_use?.web_search_requests ?? 0) * Math.round(t.recherche * 1e6);
  return Math.ceil(Math.round(micro * 1000) / 1000);
}

/** Type d'une image d'après ses premiers octets (les versions web sont en WebP, parfois en JPEG). */
export function typeImage(o: Uint8Array): "image/webp" | "image/jpeg" | "image/png" | null {
  if (o[0] === 0xff && o[1] === 0xd8) return "image/jpeg";
  if (o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47) return "image/png";
  if (String.fromCharCode(...o.subarray(0, 4)) === "RIFF" && String.fromCharCode(...o.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

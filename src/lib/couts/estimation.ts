/**
 * Estimation du coût mensuel d'hébergement, d'après les tarifs publics relevés le 2 novembre 2026.
 * Vercel Hobby et Neon Free sont gratuits dans leurs limites ; R2 est gratuit jusqu'à 10 Go.
 */
export const TARIFS = {
  releve: "2026-11-02",
  r2: { gratuitGo: 10, parGoMois: 0.015, devise: "USD" as const, sortieGratuite: true },
  neon: { gratuitGo: 0.5 },
  vercel: { hobby: 0 },
  usdEnEur: 0.92,
};

/** Poids moyen des versions web d'une photo (vignette, moyenne, grande) et d'une vidéo allégée. */
export const VERSIONS_PHOTO_OCTETS = 900_000;
export const VERSION_VIDEO_OCTETS_PAR_SECONDE = 250_000;

export type Usage = { photos: number; videos: number; octetsOriginaux: number; octetsVersions: number; octetsBase: number | null };

export function estimerCout(u: Usage) {
  const go = (u.octetsOriginaux + u.octetsVersions) / 1e9;
  const payant = Math.max(0, go - TARIFS.r2.gratuitGo);
  const r2Eur = Math.round(payant * TARIFS.r2.parGoMois * TARIFS.usdEnEur * 100) / 100;
  const baseGo = u.octetsBase != null ? u.octetsBase / 1e9 : null;
  const alertes: string[] = [];
  if (baseGo != null && baseGo > TARIFS.neon.gratuitGo * 0.8) alertes.push(`Base de données à ${Math.round((baseGo / TARIFS.neon.gratuitGo) * 100)} % de la limite gratuite de Neon.`);
  if (go > TARIFS.r2.gratuitGo * 0.8 && go <= TARIFS.r2.gratuitGo) alertes.push("Stockage proche des 10 Go gratuits de Cloudflare R2.");
  return { stockageGo: Math.round(go * 100) / 100, baseGo, r2Eur, totalEur: r2Eur + TARIFS.vercel.hobby, dansLeBudget: r2Eur <= 5, alertes };
}

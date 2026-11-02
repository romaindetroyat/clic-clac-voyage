/**
 * Heures de prise de vue et recalage d'horloge.
 *
 * L'EXIF note une heure « murale » sans fuseau (DateTimeOriginal), parfois accompagnée
 * de son décalage (OffsetTimeOriginal). On en déduit un instant UTC, puis on applique
 * le décalage de l'appareil saisi par l'administrateur (« l'appareil de Paul avait 1 h 12 de retard »).
 */

const FORMAT_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

/** Décalage (minutes) du fuseau IANA à un instant donné, ex. Europe/Paris en été : +120. */
export function decalageFuseauMinutes(fuseau: string, instant: Date): number {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const v = (t: string) => Number(parties.find((p) => p.type === t)!.value);
  const commeUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return Math.round((commeUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * Instant UTC d'une heure locale « AAAA-MM-JJTHH:mm:ss ».
 * - décalage EXIF connu : on l'utilise ;
 * - sinon : fuseau du voyage (gère l'heure d'été, y compris autour du changement d'heure).
 */
export function priseVersUtc(
  priseLocale: string | null | undefined,
  decalageExifMinutes: number | null | undefined,
  fuseauVoyage: string,
): Date | null {
  if (!priseLocale) return null;
  const m = FORMAT_LOCAL.exec(priseLocale);
  if (!m) return null;
  const [, a, mo, j, h, mi, s] = m.map(Number);
  const commeUtc = Date.UTC(a, mo - 1, j, h, mi, s);
  if (Number.isNaN(commeUtc) || a < 1990 || a > 2100) return null;
  if (decalageExifMinutes != null) return new Date(commeUtc - decalageExifMinutes * 60_000);
  // Deux passes pour tomber juste près d'un changement d'heure.
  let essai = commeUtc - decalageFuseauMinutes(fuseauVoyage, new Date(commeUtc)) * 60_000;
  essai = commeUtc - decalageFuseauMinutes(fuseauVoyage, new Date(essai)) * 60_000;
  return new Date(essai);
}

/** Instant corrigé = instant de l'appareil + décalage saisi pour cet appareil. */
export function instantCorrige(priseUtc: Date | null, decalageAppareilSecondes: number): Date | null {
  return priseUtc ? new Date(priseUtc.getTime() + decalageAppareilSecondes * 1000) : null;
}

/** Tri chronologique stable : instant corrigé, puis nom de fichier ; les médias sans date à la fin. */
export function trierChronologiquement<T extends { instant: Date | null; nomFichier: string; id: string }>(medias: T[]): T[] {
  return [...medias].sort((a, b) => {
    if (a.instant && b.instant) {
      const d = a.instant.getTime() - b.instant.getTime();
      if (d !== 0) return d;
    } else if (a.instant || b.instant) {
      return a.instant ? -1 : 1;
    }
    return a.nomFichier.localeCompare(b.nomFichier, "fr", { numeric: true }) || a.id.localeCompare(b.id);
  });
}

/** « +1 h 12 », « -3 min », « −1 j 2 h » → secondes. Accepte aussi « +01:12:00 ». */
export function lireDecalage(saisie: string): number | null {
  const t = saisie.trim().replace("−", "-").replace(/\s+/g, " ");
  if (!t) return 0;
  const signe = t.startsWith("-") ? -1 : 1;
  const corps = t.replace(/^[+-]\s*/, "");
  const hms = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(corps);
  if (hms) return signe * (Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3] ?? 0));
  // Jetons « nombre + unité » ; un nombre nu juste après des heures vaut des minutes (« 1 h 12 »).
  const re = /(\d+)\s*(j|h|min|mn|m|s)?\s*/gy;
  let total = 0;
  let precedente: string | undefined;
  let lu = 0;
  for (let m = re.exec(corps); m; m = re.exec(corps)) {
    lu = re.lastIndex;
    const n = Number(m[1]);
    const unite = m[2] ?? (precedente === "h" ? "min" : undefined);
    if (!unite) return null;
    total += unite === "j" ? n * 86400 : unite === "h" ? n * 3600 : unite === "s" ? n : n * 60;
    precedente = unite;
  }
  if (lu === 0 || lu !== corps.length) return null;
  return signe * total;
}

/** Secondes → « +1 h 12 min », « −45 s », « aucun ». */
export function formaterDecalage(secondes: number): string {
  if (secondes === 0) return "aucun";
  const signe = secondes < 0 ? "−" : "+";
  let r = Math.abs(secondes);
  const j = Math.floor(r / 86400);
  r -= j * 86400;
  const h = Math.floor(r / 3600);
  r -= h * 3600;
  const m = Math.floor(r / 60);
  const s = r - m * 60;
  const morceaux = [j && `${j} j`, h && `${h} h`, m && `${m} min`, s && `${s} s`].filter(Boolean);
  return `${signe}${morceaux.join(" ")}`;
}

/**
 * Archives WhatsApp (« Exporter la discussion » avec médias).
 * Le fichier texte de la discussion donne, pour chaque média, l'heure d'envoi et l'auteur :
 * c'est la meilleure date disponible, car WhatsApp retire l'EXIF des photos.
 *
 * Formats reconnus (français et anglais) :
 *   iPhone  : [03/08/2026 14:05:12] Paul : ‎<pièce jointe : 00000012-PHOTO-2026-08-03-14-05-12.jpg>
 *   Android : 03/08/2026 14:05 - Paul: IMG-20260803-WA0001.jpg (fichier joint)
 */

export type InfoMedia = { auteur: string | null; priseLocale: string | null };

const LIGNE =
  /^‎?\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\]?\s*(?:-\s*)?([^:]+?)\s*:\s*(.*)$/;
const NOM_MEDIA = /([\w-]+\.(?:jpe?g|png|webp|heic|gif|mp4|mov|3gp|opus|pdf|webm))/i;

const deux = (n: number) => String(n).padStart(2, "0");

export function lireDiscussion(texte: string): Map<string, InfoMedia> {
  const res = new Map<string, InfoMedia>();
  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.replace(/[‎‏‪-‮]/g, "");
    const m = LIGNE.exec(ligne);
    if (!m) continue;
    const nom = NOM_MEDIA.exec(m[9])?.[1];
    if (!nom) continue;
    let [j, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (a < 100) a += 2000;
    // Format américain (mois en premier) : on ne l'adopte que si le jour ne peut pas être un mois.
    if (mo > 12 && j <= 12) [j, mo] = [mo, j];
    let h = Number(m[4]);
    const ampm = m[7]?.toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    res.set(nom, {
      auteur: m[8].trim() || null,
      priseLocale: `${a}-${deux(mo)}-${deux(j)}T${deux(h)}:${m[5]}:${m[6] ?? "00"}`,
    });
  }
  return res;
}

/** Date contenue dans le nom de fichier, quand la discussion ne la donne pas. */
export function dateDepuisNom(nom: string): string | null {
  const ios = /PHOTO-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/.exec(nom) ?? /VIDEO-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/.exec(nom);
  if (ios) return `${ios[1]}-${ios[2]}-${ios[3]}T${ios[4]}:${ios[5]}:${ios[6]}`;
  const android = /(?:IMG|VID)-(\d{4})(\d{2})(\d{2})-WA\d+/.exec(nom);
  if (android) return `${android[1]}-${android[2]}-${android[3]}T12:00:00`;
  return null;
}

export function estMediaWhatsapp(nom: string) {
  return /\.(jpe?g|png|webp|heic|mp4|mov|3gp)$/i.test(nom) && !nom.startsWith("__MACOSX");
}

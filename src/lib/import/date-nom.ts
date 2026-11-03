/**
 * Date de prise de vue écrite dans le nom du fichier, pour les fichiers sans EXIF
 * (reçus par messagerie, enregistrés depuis une appli, exportés, captures d'écran) :
 *   IMG-20260803-WA0001.jpg · WhatsApp Image 2026-08-03 at 14.32.10.jpeg
 *   IMG_20260803_143210.jpg · PXL_20260803_143210123.jpg · 20260803_143210.mp4
 *   Screenshot_20260803-143210.png · Capture d’écran 2026-08-03 à 14.32.10.png
 *   photo_2026-08-03_14-32-10.jpg (Telegram) · signal-2026-08-03-143210.jpg
 * L'heure, quand elle y est, est celle de l'appareil (heure locale). Sans heure, on garde le jour (midi).
 */
export type DateNom = { priseLocale: string; avecHeure: boolean };

const DATE = /(?<![0-9])(20\d{2})([-_.]?)(0[1-9]|1[0-2])\2(0[1-9]|[12]\d|3[01])(?![0-9])/;
const HEURE = /^(?:[ _T-]|\s+(?:at|à)\s+|_at_)?([01]\d|2[0-3])([-_.:h]?)([0-5]\d)\2([0-5]\d)(?:\d{1,3})?(?![0-9])/;

export function dateDepuisNom(nomFichier: string, maintenant = new Date()): DateNom | null {
  const nom = nomFichier.replace(/\.[a-z0-9]{2,5}$/i, "");
  const d = DATE.exec(nom);
  if (!d) return null;
  const [, a, , mo, j] = d;
  const jour = new Date(Date.UTC(Number(a), Number(mo) - 1, Number(j)));
  // 31 février, ou date dans le futur : ce n'est pas une date de prise de vue.
  if (jour.getUTCMonth() !== Number(mo) - 1 || jour.getTime() > maintenant.getTime() + 2 * 86_400_000) return null;
  const suite = nom.slice(d.index + d[0].length);
  const h = HEURE.exec(suite);
  if (h) return { priseLocale: `${a}-${mo}-${j}T${h[1]}:${h[3]}:${h[4]}`, avecHeure: true };
  return { priseLocale: `${a}-${mo}-${j}T12:00:00`, avecHeure: false };
}

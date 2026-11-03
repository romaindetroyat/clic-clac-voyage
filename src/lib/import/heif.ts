/**
 * Bloc EXIF d'un fichier HEIF/HEIC (photos d'iPhone), lu directement dans la structure ISOBMFF :
 * meta → iinf (élément de type « Exif ») → iloc (où sont ses octets). La bibliothèque EXIF
 * utilisée ailleurs échoue sur ces fichiers (« Malformed EXIF data ») : sans ce lecteur,
 * les photos d'iPhone perdaient leur date, leur position et leur appareil.
 * Renvoie l'en-tête TIFF (« II*\0 » ou « MM\0* ») et ce qui suit, ou null.
 */

type Boite = { type: string; debut: number; contenu: number; fin: number };

function boites(v: DataView, debut: number, fin: number): Boite[] {
  const res: Boite[] = [];
  let p = debut;
  while (p + 8 <= fin) {
    let taille = v.getUint32(p);
    const type = String.fromCharCode(v.getUint8(p + 4), v.getUint8(p + 5), v.getUint8(p + 6), v.getUint8(p + 7));
    let entete = 8;
    if (taille === 1) {
      if (p + 16 > fin) break;
      taille = Number(v.getBigUint64(p + 8));
      entete = 16;
    } else if (taille === 0) taille = fin - p;
    if (taille < entete || p + taille > fin) {
      // Boîte tronquée (on ne lit que le début du fichier) : on garde ce qu'on a.
      res.push({ type, debut: p, contenu: p + entete, fin });
      break;
    }
    res.push({ type, debut: p, contenu: p + entete, fin: p + taille });
    p += taille;
  }
  return res;
}

function entier(v: DataView, p: number, octets: number): number {
  if (octets === 0) return 0;
  if (octets === 2) return v.getUint16(p);
  if (octets === 4) return v.getUint32(p);
  if (octets === 8) return Number(v.getBigUint64(p));
  throw new Error("taille invalide");
}

/** Analyse la boîte « meta » (déjà en mémoire) et renvoie où lire l'élément EXIF. */
export function localiserExif(octets: Uint8Array): { origine: "fichier" | "idat"; extents: [number, number][]; idat?: number } | null {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const haut = boites(v, 0, octets.length);
  if (haut[0]?.type !== "ftyp") return null;
  const meta = haut.find((b) => b.type === "meta");
  if (!meta) return null;
  const enfants = boites(v, meta.contenu + 4, meta.fin); // FullBox : version + drapeaux
  const iinf = enfants.find((b) => b.type === "iinf");
  const iloc = enfants.find((b) => b.type === "iloc");
  const idat = enfants.find((b) => b.type === "idat");
  if (!iinf || !iloc) return null;

  // iinf → identifiant de l'élément « Exif »
  const vi = v.getUint8(iinf.contenu);
  const debutEntrees = iinf.contenu + 4 + (vi === 0 ? 2 : 4);
  let idExif: number | null = null;
  for (const infe of boites(v, debutEntrees, iinf.fin)) {
    if (infe.type !== "infe") continue;
    const ve = v.getUint8(infe.contenu);
    if (ve < 2) continue;
    const p = infe.contenu + 4;
    const id = ve === 2 ? v.getUint16(p) : v.getUint32(p);
    const q = p + (ve === 2 ? 2 : 4) + 2;
    const type = String.fromCharCode(v.getUint8(q), v.getUint8(q + 1), v.getUint8(q + 2), v.getUint8(q + 3));
    if (type === "Exif") {
      idExif = id;
      break;
    }
  }
  if (idExif === null) return null;

  // iloc → emplacements de cet élément
  const vl = v.getUint8(iloc.contenu);
  let p = iloc.contenu + 4;
  const t1 = v.getUint8(p++);
  const t2 = v.getUint8(p++);
  const tailleOffset = t1 >> 4;
  const tailleLongueur = t1 & 15;
  const tailleBase = t2 >> 4;
  const tailleIndex = vl === 1 || vl === 2 ? t2 & 15 : 0;
  const nb = vl < 2 ? v.getUint16(p) : v.getUint32(p);
  p += vl < 2 ? 2 : 4;
  for (let i = 0; i < nb; i++) {
    const id = vl < 2 ? v.getUint16(p) : v.getUint32(p);
    p += vl < 2 ? 2 : 4;
    let methode = 0;
    if (vl === 1 || vl === 2) {
      methode = v.getUint16(p) & 15;
      p += 2;
    }
    p += 2; // data_reference_index
    const base = entier(v, p, tailleBase);
    p += tailleBase;
    const nbExtents = v.getUint16(p);
    p += 2;
    const extents: [number, number][] = [];
    for (let e = 0; e < nbExtents; e++) {
      p += tailleIndex;
      const off = entier(v, p, tailleOffset);
      p += tailleOffset;
      const lon = entier(v, p, tailleLongueur);
      p += tailleLongueur;
      extents.push([base + off, lon]);
    }
    if (id !== idExif) continue;
    if (methode === 1) return idat ? { origine: "idat", extents, idat: idat.contenu } : null;
    if (methode !== 0) return null;
    return { origine: "fichier", extents };
  }
  return null;
}

/** Après l'en-tête de l'élément EXIF (décalage sur 4 octets, souvent suivi de « Exif\0\0 »), l'en-tête TIFF. */
export function tiffDepuisElement(el: Uint8Array): Uint8Array | null {
  if (el.length < 12) return null;
  const decalage = new DataView(el.buffer, el.byteOffset, el.byteLength).getUint32(0);
  const estTiff = (i: number) =>
    i + 4 <= el.length &&
    ((el[i] === 0x49 && el[i + 1] === 0x49 && el[i + 2] === 0x2a && el[i + 3] === 0) ||
      (el[i] === 0x4d && el[i + 1] === 0x4d && el[i + 2] === 0 && el[i + 3] === 0x2a));
  if (estTiff(4 + decalage)) return el.subarray(4 + decalage);
  // Écrivains peu rigoureux : on cherche l'en-tête TIFF dans les premiers octets.
  for (let i = 4; i < Math.min(el.length - 4, 64); i++) if (estTiff(i)) return el.subarray(i);
  return null;
}

/** En-tête TIFF de l'EXIF d'un fichier HEIF (ou null si ce n'en est pas un, ou sans EXIF). */
export async function exifHeif(f: Blob): Promise<Uint8Array | null> {
  const lire = async (debut: number, fin: number) => new Uint8Array(await f.slice(debut, fin).arrayBuffer());
  // La boîte « meta » est au début du fichier ; 512 Ko suffisent largement.
  const tete = await lire(0, Math.min(f.size, 512 * 1024));
  const loc = localiserExif(tete);
  if (!loc) return null;
  const morceaux: Uint8Array[] = [];
  for (const [off, lon] of loc.extents) {
    if (lon > 4 * 1024 * 1024) return null;
    if (loc.origine === "idat") morceaux.push(tete.subarray(loc.idat! + off, loc.idat! + off + lon));
    else morceaux.push(await lire(off, off + lon));
  }
  const total = morceaux.reduce((s, m) => s + m.length, 0);
  const el = new Uint8Array(total);
  let p = 0;
  for (const m of morceaux) {
    el.set(m, p);
    p += m.length;
  }
  return tiffDepuisElement(el);
}

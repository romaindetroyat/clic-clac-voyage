/** Date de création d'une vidéo MP4/MOV (iPhone compris), lue dans l'atome « mvhd ». */
const EPOQUE_MP4 = Date.UTC(1904, 0, 1);

/** Date de création UTC notée dans l'atome « mvhd » (MP4, MOV). */
export async function dateMp4(f: { size: number; slice(debut: number, fin: number): { arrayBuffer(): Promise<ArrayBuffer> } }): Promise<Date | null> {
  async function lire(pos: number, n: number) {
    return new DataView(await f.slice(pos, pos + n).arrayBuffer());
  }
  async function chercher(debut: number, fin: number, type: string): Promise<[number, number] | null> {
    let pos = debut;
    while (pos + 8 <= fin) {
      const v = await lire(pos, 16);
      let taille = v.getUint32(0);
      const t = String.fromCharCode(v.getUint8(4), v.getUint8(5), v.getUint8(6), v.getUint8(7));
      let entete = 8;
      if (taille === 1) {
        taille = Number(v.getBigUint64(8));
        entete = 16;
      } else if (taille === 0) taille = fin - pos;
      if (taille < 8) return null;
      if (t === type) return [pos + entete, pos + taille];
      pos += taille;
    }
    return null;
  }
  try {
    const moov = await chercher(0, f.size, "moov");
    if (!moov) return null;
    const mvhd = await chercher(moov[0], moov[1], "mvhd");
    if (!mvhd) return null;
    const v = await lire(mvhd[0], 12);
    const secondes = v.getUint8(0) === 1 ? Number(v.getBigUint64(4)) : v.getUint32(4);
    if (!secondes) return null;
    const d = new Date(EPOQUE_MP4 + secondes * 1000);
    return d.getUTCFullYear() > 1990 && d.getUTCFullYear() < 2100 ? d : null;
  } catch {
    return null;
  }
}


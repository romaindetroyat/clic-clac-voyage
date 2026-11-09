/**
 * Opérations de l'éditeur visuel du site sur les dispositions d'une partie de chapitre.
 * Fonctions pures (testées) : elles renvoient une nouvelle liste de blocs, sans rien modifier.
 */
import { TYPES_BLOCS, type BlocSite, type TypeBloc } from "./config";

const AVEC_COTE: TypeBloc[] = ["note", "centree", "duo", "mosaique"];
const copie = (b: BlocSite[]) => b.map((x) => ({ ...x, ids: [...x.ids] }));
const nettoie = (b: BlocSite[]) => b.filter((x) => x.ids.length);

/** Change la disposition d'un bloc : prend des photos aux blocs suivants s'il en manque, rend le surplus. */
export function changerType(blocs: BlocSite[], i: number, type: TypeBloc): BlocSite[] {
  const r = copie(blocs);
  const b = r[i];
  if (!b) return r;
  const { min, max } = TYPES_BLOCS[type];
  b.type = type;
  if (AVEC_COTE.includes(type)) b.cote ??= "gauche";
  else delete b.cote;
  for (let j = i + 1; b.ids.length < min && j < r.length; ) {
    b.ids.push(r[j].ids.shift()!);
    if (!r[j].ids.length) r.splice(j, 1);
  }
  if (b.ids.length > max) {
    const reste = b.ids.splice(max);
    r.splice(i + 1, 0, { type: reste.length > 1 ? "rangee" : "grande", ids: reste });
  }
  return nettoie(r);
}

export function changerCote(blocs: BlocSite[], i: number): BlocSite[] {
  const r = copie(blocs);
  if (r[i]) r[i].cote = r[i].cote === "droite" ? "gauche" : "droite";
  return r;
}

/** Déplace le bloc `i` pour qu'il occupe la place `vers`. */
export function deplacerBloc(blocs: BlocSite[], i: number, vers: number): BlocSite[] {
  const r = copie(blocs);
  if (!r[i]) return r;
  const [b] = r.splice(i, 1);
  r.splice(Math.max(0, Math.min(r.length, vers)), 0, b);
  return r;
}

/** Une photo par bloc, en grand. */
export function scinder(blocs: BlocSite[], i: number): BlocSite[] {
  const r = copie(blocs);
  if (!r[i]) return r;
  r.splice(i, 1, ...r[i].ids.map((id): BlocSite => ({ type: "grande", ids: [id] })));
  return r;
}

/** Réunit le bloc `i` et le suivant (rangée, mosaïque ou défilement selon le nombre). */
export function fusionner(blocs: BlocSite[], i: number): BlocSite[] {
  const r = copie(blocs);
  if (!r[i] || !r[i + 1]) return r;
  const ids = [...r[i].ids, ...r[i + 1].ids];
  const type: TypeBloc = ids.length <= 5 ? "rangee" : ids.length <= 7 ? "mosaique" : "defilement";
  r.splice(i, 2, { type, ids: ids.slice(0, TYPES_BLOCS[type].max), ...(type === "mosaique" ? { cote: "gauche" as const } : {}) });
  return r;
}

function position(blocs: BlocSite[], id: string): [number, number] | null {
  for (const [i, b] of blocs.entries()) {
    const j = b.ids.indexOf(id);
    if (j >= 0) return [i, j];
  }
  return null;
}

/** Avance ou recule une photo d'un cran ; au bord d'un bloc, elle passe dans le bloc voisin. */
export function deplacerPhoto(blocs: BlocSite[], id: string, sens: -1 | 1): BlocSite[] {
  const r = copie(blocs);
  const p = position(r, id);
  if (!p) return r;
  const [i, j] = p;
  const b = r[i];
  const k = j + sens;
  if (k >= 0 && k < b.ids.length) {
    [b.ids[j], b.ids[k]] = [b.ids[k], b.ids[j]];
    return r;
  }
  const voisin = r[i + sens];
  if (!voisin) return r;
  b.ids.splice(j, 1);
  if (sens < 0) voisin.ids.push(id);
  else voisin.ids.unshift(id);
  if (voisin.ids.length > TYPES_BLOCS[voisin.type].max) voisin.type = voisin.ids.length <= 5 ? "rangee" : voisin.ids.length <= 7 ? "mosaique" : "defilement";
  return nettoie(r);
}

/** Échange deux photos de place (glisser une photo sur une autre). */
export function echanger(blocs: BlocSite[], a: string, b: string): BlocSite[] {
  const r = copie(blocs);
  const pa = position(r, a);
  const pb = position(r, b);
  if (!pa || !pb) return r;
  r[pa[0]].ids[pa[1]] = b;
  r[pb[0]].ids[pb[1]] = a;
  return r;
}

/** Met une photo à la fin du bloc `i` (glisser une photo dans un bloc). */
export function mettreDansBloc(blocs: BlocSite[], id: string, i: number): BlocSite[] {
  const cible = blocs[i];
  if (!cible || cible.ids.includes(id)) return blocs;
  let r = copie(blocs);
  const p = position(r, id);
  if (p) r[p[0]].ids.splice(p[1], 1);
  const vide = p && !r[p[0]].ids.length;
  r = nettoie(r);
  const k = vide && p![0] < i ? i - 1 : i;
  const b = r[k];
  b.ids.push(id);
  if (b.ids.length > TYPES_BLOCS[b.type].max) {
    b.type = b.ids.length <= 5 ? "rangee" : b.ids.length <= 7 ? "mosaique" : "defilement";
    if (b.type === "mosaique") b.cote ??= "gauche";
  }
  return r;
}

/** Une photo sort de son bloc et devient un bloc à part, en grand, juste après. */
export function isoler(blocs: BlocSite[], id: string): BlocSite[] {
  const r = copie(blocs);
  const p = position(r, id);
  if (!p || r[p[0]].ids.length < 2) return r;
  r[p[0]].ids.splice(p[1], 1);
  r.splice(p[0] + 1, 0, { type: "grande", ids: [id] });
  return r;
}

/**
 * Variantes de disposition : des enchaînements de blocs qui changent le rythme de la partie.
 * `n` choisit la variante ; les proportions des photos décident des détails.
 */
const VARIANTES: TypeBloc[][] = [
  ["grande", "duo", "rangee", "mosaique", "note", "rangee"],
  ["mosaique", "centree", "rangee", "duo", "grande", "rangee"],
  ["duo", "grande", "rangee", "centree", "mosaique", "defilement"],
  ["centree", "rangee", "grande", "duo", "rangee", "note"],
  ["rangee", "rangee", "grande", "mosaique", "duo", "centree"],
];
export const NB_VARIANTES = VARIANTES.length;

export function variante(medias: { id: string; ratio: number }[], n: number): BlocSite[] {
  const motif = VARIANTES[((n % NB_VARIANTES) + NB_VARIANTES) % NB_VARIANTES];
  const r: BlocSite[] = [];
  let i = 0;
  let k = 0;
  while (i < medias.length) {
    const type = motif[k % motif.length];
    k++;
    let nb: number;
    if (type === "rangee") nb = medias.slice(i, i + 3).filter((m) => m.ratio < 0.9).length >= 2 ? 3 : 2;
    else if (type === "mosaique") nb = 4;
    else if (type === "defilement") nb = 5;
    else if (type === "duo") nb = 2;
    else nb = 1;
    const ids = medias.slice(i, i + nb).map((m) => m.id);
    i += ids.length;
    if (ids.length < TYPES_BLOCS[type].min) {
      r.push({ type: ids.length > 1 ? "rangee" : "grande", ids });
      continue;
    }
    r.push({ type, ids, ...(AVEC_COTE.includes(type) ? { cote: k % 2 ? "gauche" : "droite" } : {}) });
  }
  return r;
}

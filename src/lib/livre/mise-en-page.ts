/**
 * Mise en page automatique du livre.
 *
 * 1. Pour chaque épisode, programmation dynamique sur la suite chronologique de ses photos :
 *    meilleur[i][p] = coût minimal pour poser les i premières photos sur p pages, en essayant
 *    chaque gabarit (recadrage, importance des photos, densité visée).
 * 2. Entre épisodes, un sac à dos répartit le nombre de pages pour atteindre exactement la cible.
 * La monotonie (même gabarit deux pages de suite) est pénalisée dans la programmation dynamique.
 *
 * Fonction pure, rapide (quelques dizaines de ms pour un livre de 100 pages) : elle tourne
 * dans le navigateur et se teste unitairement.
 */
import type { Format } from "./formats";
import { pagesValides } from "./formats";
import { coutRecadrage, dpiEffectif } from "./cadrage";
import { AMBIANCES, cadresAjustes, gabaritsAmbiance, geometriePage, legendesParPhoto, zoneUtile, type Gabarit } from "./gabarits";
import { nouvelId, type EpisodeLivre, type Livre, type MediaLivre, type PageLivre, type Rythme } from "./modele";

const DENSITE: Record<Rythme, number> = { dense: 4.5, equilibre: 2.8, aere: 1.7 };

export type EntreeMiseEnPage = {
  nom: string;
  periode: string | null;
  fuseau: string;
  format: Format;
  options: Livre["options"];
  episodes: EpisodeLivre[];
  /** Photos du livre, dans l'ordre chronologique. */
  medias: MediaLivre[];
  couverture?: Livre["couverture"];
  fin?: { titre: string; corps: string } | null;
};

export type RapportMiseEnPage = { pages: number; cible: number; photos: number; message: string | null };

function importance(m: MediaLivre): number {
  return 1 + (m.vedette ? 2 : 0) + (m.qualite != null && m.qualite > 0.75 ? 0.3 : 0);
}

type Choix = { gabarit: Gabarit; ordre: number[]; cout: number };

/** Gabarits candidats et leurs cadres, pour un format (mêmes dimensions page paire ou impaire). */
function candidats(f: Format, ambiance: Livre["options"]["ambiance"]) {
  const aireZone = (() => {
    const z = zoneUtile(f, 1);
    return z.l * z.h;
  })();
  return gabaritsAmbiance(ambiance).map((g) => {
    const cadres = geometriePage(f, g.id, 1).photos;
    return {
      gabarit: g,
      ratios: cadres.map((c) => c.l / c.h),
      largeurs: cadres.map((c) => c.l),
      aires: cadres.map((c) => Math.min(1.2, (c.l * c.h) / aireZone)),
      ajustes: cadresAjustes(f, g.id),
    };
  });
}

function permutations(n: number): number[][] {
  if (n <= 1) return [[0]];
  const r: number[][] = [];
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) r.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return r;
}
const PERMS = [1, 2, 3, 4].map(permutations);

/** Coût et ordre des photos pour un gabarit donné (meilleure association photos → cadres). */
function poser(photos: MediaLivre[], c: ReturnType<typeof candidats>[number], densite: number): Choix {
  const k = photos.length;
  const ordres =
    k <= 4
      ? PERMS[k - 1]
      : [
          // Au-delà de 4 : on associe les photos aux cadres par proportions croissantes.
          (() => {
            const cadres = c.ratios.map((r, i) => [r, i] as const).sort((a, b) => a[0] - b[0]);
            const ph = photos.map((p, i) => [p.largeur / p.hauteur, i] as const).sort((a, b) => a[0] - b[0]);
            const ordre = Array<number>(k);
            cadres.forEach(([, ci], j) => (ordre[ci] = ph[j][1]));
            return ordre;
          })(),
        ];
  let meilleur: Choix | null = null;
  for (const ordre of ordres) {
    let cout = 0.35 * Math.abs(k - densite);
    ordre.forEach((pi, ci) => {
      const m = photos[pi];
      // Un cadre qui s'ajuste ne recadre pas : il perd seulement un peu de surface.
      cout += (c.ajustes[ci] ? 0.25 : 1.2) * coutRecadrage(m.largeur / m.hauteur, c.ratios[ci]);
      cout += (importance(m) - 1) * (1 - Math.min(1, c.aires[ci])) * 1.5;
      // Résolution : une photo trop petite pour son cadre serait floue à l'impression.
      const ratio = c.ratios[ci];
      const pixels = c.ajustes[ci] ? m.largeur : Math.min(m.largeur, m.hauteur * ratio);
      const dpi = pixels / (c.largeurs[ci] / 25.4);
      if (dpi < 160) cout += 6;
      else if (dpi < 250) cout += 0.4;
    });
    if (c.gabarit.id === "pleine-page" && !photos[0].vedette) cout += 0.5;
    // Garder à peu près l'ordre chronologique de lecture sur la page.
    for (let i = 1; i < ordre.length; i++) if (ordre[i] < ordre[i - 1]) cout += 0.04;
    if (!meilleur || cout < meilleur.cout) meilleur = { gabarit: c.gabarit, ordre, cout };
  }
  return meilleur!;
}

/** Pénalité de monotonie : même gabarit que la page précédente, ou même nombre de photos. */
const MEME_GABARIT = 0.6;
const MEME_NOMBRE = 0.08;

/**
 * Programmation dynamique d'un épisode. État : (photos posées, pages utilisées, gabarit de la
 * dernière page), pour pénaliser les pages identiques qui se suivent.
 */
function planEpisode(photos: MediaLivre[], cands: ReturnType<typeof candidats>, densite: number) {
  const n = photos.length;
  const G = cands.length;
  const INF = Number.POSITIVE_INFINITY;
  // poses[i][g] : poser les photos (i - k .. i) sur le gabarit g (k = son nombre de cadres).
  const poses: (Choix | null)[][] = Array.from({ length: n + 1 }, (_, i) =>
    cands.map((c) => (c.gabarit.n <= i ? poser(photos.slice(i - c.gabarit.n, i), c, densite) : null)),
  );
  // best[i][p][g], aplati ; g = G pour « aucune page encore ».
  const L = G + 1;
  const idx = (i: number, p: number, g: number) => (i * (n + 1) + p) * L + g;
  const best = new Float64Array((n + 1) * (n + 1) * L).fill(INF);
  const prec = new Int16Array((n + 1) * (n + 1) * L).fill(-1);
  best[idx(0, 0, G)] = 0;
  for (let i = 1; i <= n; i++) {
    for (let g = 0; g < G; g++) {
      const pose = poses[i][g];
      if (!pose) continue;
      const k = cands[g].gabarit.n;
      for (let p = 1; p <= i; p++) {
        for (let h = 0; h <= G; h++) {
          const avant = best[idx(i - k, p - 1, h)];
          if (avant === INF) continue;
          const v = avant + pose.cout + (h === g ? MEME_GABARIT : h < G && cands[h].gabarit.n === k ? MEME_NOMBRE : 0);
          const j = idx(i, p, g);
          if (v < best[j]) {
            best[j] = v;
            prec[j] = h;
          }
        }
      }
    }
  }
  const couts = new Map<number, number>();
  const fin = new Map<number, number>();
  if (n === 0) couts.set(0, 0);
  for (let p = 1; p <= n; p++) {
    for (let g = 0; g < G; g++) {
      const v = best[idx(n, p, g)];
      if (v < (couts.get(p) ?? INF)) {
        couts.set(p, v);
        fin.set(p, g);
      }
    }
  }
  function pages(p: number): { photos: MediaLivre[]; choix: Choix }[] {
    const r: { photos: MediaLivre[]; choix: Choix }[] = [];
    let i = n;
    let g = fin.get(p) ?? G;
    while (p > 0 && g < G) {
      const k = cands[g].gabarit.n;
      const h = prec[idx(i, p, g)];
      r.unshift({ photos: photos.slice(i - k, i), choix: poses[i][g]! });
      i -= k;
      p--;
      g = h;
    }
    return r;
  }
  return { couts, pages };
}

const fmtJour = (fuseau: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: fuseau });

function datesEpisode(e: EpisodeLivre, fuseau: string) {
  if (!e.debut) return "";
  const f = fmtJour(fuseau);
  const a = f.format(new Date(e.debut));
  const b = e.fin ? f.format(new Date(e.fin)) : a;
  return a === b ? a : `${a} – ${b}`;
}

/** Légende d'une page : les légendes de ses photos, et un commentaire si demandé. */
export function legendeAuto(photos: (MediaLivre | undefined)[], commentaires: boolean): string {
  return photos
    .filter((m): m is MediaLivre => !!m)
    .map((m) => [m.legende, commentaires && m.commentaires[0] ? `« ${m.commentaires[0]} »` : null].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" · ");
}

/**
 * Gabarit d'ouverture : ceux de l'ambiance à tour de rôle, sauf si la photo y serait trop peu définie
 * (une pleine page demande beaucoup de pixels) ; on prend alors celui où elle est la plus nette.
 */
function choisirOuverture(f: Format, ouvertures: readonly string[], i: number, m: MediaLivre, numero: number): string {
  const tour = [...ouvertures.slice(i % ouvertures.length), ...ouvertures.slice(0, i % ouvertures.length), "ouverture-galerie", "ouverture"];
  const dpi = (id: string) => {
    const c = geometriePage(f, id, numero, [m.largeur / m.hauteur]).photos[0];
    return c ? dpiEffectif(m.largeur, m.hauteur, c.l, c.h, { zoom: 1, cx: 0.5, cy: 0.5 }) : 0;
  };
  return tour.find((id) => dpi(id) >= 220) ?? tour.reduce((a, b) => (dpi(b) > dpi(a) ? b : a));
}

export function mettreEnPage(e: EntreeMiseEnPage): { livre: Livre; rapport: RapportMiseEnPage } {
  const f = e.format;
  const cible = pagesValides(f, e.options.ciblePages);
  const densite = DENSITE[e.options.rythme];
  const cands = candidats(f, e.options.ambiance);
  const ouvertures = AMBIANCES[e.options.ambiance ?? "melange"].ouvertures;

  // Épisodes, dans l'ordre ; les photos non classées forment un dernier groupe.
  const groupes: { episode: EpisodeLivre | null; photos: MediaLivre[] }[] = e.episodes.map((ep) => ({
    episode: ep,
    photos: e.medias.filter((m) => m.episodeId === ep.id),
  }));
  const ids = new Set(e.episodes.map((x) => x.id));
  const orphelines = e.medias.filter((m) => !m.episodeId || !ids.has(m.episodeId));
  if (orphelines.length) groupes.push({ episode: null, photos: orphelines });
  const actifs = groupes.filter((g) => g.photos.length || g.episode?.recit);

  // La photo d'ouverture : la photo mise en avant, sinon la première.
  const plans = actifs.map((g) => {
    const ouverture = g.photos.find((m) => m.vedette) ?? g.photos[0] ?? null;
    const reste = g.photos.filter((m) => m !== ouverture);
    return { ...g, ouverture, plan: planEpisode(reste, cands, densite), n: reste.length };
  });

  const fixes = 1 + plans.length + (e.fin ? 1 : 0); // titre, ouvertures, fin
  const budget = cible - fixes;

  // Sac à dos entre épisodes : total de pages exact, coût minimal.
  const INF = Number.POSITIVE_INFINITY;
  const maxTotal = plans.reduce((s, p) => s + p.n, 0);
  let dp = new Map<number, { cout: number; choix: number[] }>([[0, { cout: 0, choix: [] }]]);
  for (const p of plans) {
    const suivant = new Map<number, { cout: number; choix: number[] }>();
    for (const [t, v] of dp) {
      for (const [pages, cout] of p.plan.couts) {
        const tt = t + pages;
        const c = v.cout + cout;
        if (c < (suivant.get(tt)?.cout ?? INF)) suivant.set(tt, { cout: c, choix: [...v.choix, pages] });
      }
    }
    dp = suivant;
  }
  const totaux = [...dp.keys()];
  const vise = Math.max(0, Math.min(budget, maxTotal));
  const total = totaux.reduce((a, b) => (Math.abs(b - vise) < Math.abs(a - vise) ? b : a), totaux[0] ?? 0);
  const repartition = dp.get(total)?.choix ?? plans.map(() => 0);

  // Assemblage.
  const pages: PageLivre[] = [{ id: nouvelId(), gabarit: "titre", cellules: [], titre: e.nom, surtitre: e.periode ?? "" }];
  const cellule = (m: MediaLivre, legende = false) => {
    const texte = legende && e.options.legendes ? legendeAuto([m], e.options.commentaires) : "";
    return { mediaId: m.id, zoom: 1, cx: 0.5, cy: 0.5, ...(texte ? { legende: texte } : {}) };
  };
  let numeroEpisode = 0;
  plans.forEach((p, i) => {
    if (p.episode) numeroEpisode++;
    const dates = p.episode ? datesEpisode(p.episode, e.fuseau) : "";
    const gabaritOuverture = p.ouverture ? choisirOuverture(f, ouvertures, i, p.ouverture, pages.length + 1) : "ouverture-texte";
    const parPhoto = legendesParPhoto(gabaritOuverture);
    pages.push({
      id: nouvelId(),
      gabarit: gabaritOuverture,
      cellules: p.ouverture ? [cellule(p.ouverture, parPhoto)] : [],
      surtitre: p.episode ? `Épisode ${numeroEpisode}${dates ? ` · ${dates}` : ""}` : "",
      titre: p.episode ? p.episode.titre : "Et encore…",
      corps: p.episode?.recit ?? "",
      legende: e.options.legendes && p.ouverture && !parPhoto ? legendeAuto([p.ouverture], e.options.commentaires) : "",
      episodeId: p.episode?.id ?? null,
    });
    for (const pg of p.plan.pages(repartition[i])) {
      const photosOrdonnees = pg.choix.ordre.map((j) => pg.photos[j]);
      const parPhoto = legendesParPhoto(pg.choix.gabarit.id);
      pages.push({
        id: nouvelId(),
        gabarit: pg.choix.gabarit.id,
        cellules: photosOrdonnees.map((m) => cellule(m, parPhoto)),
        legende: e.options.legendes && !parPhoto ? legendeAuto(photosOrdonnees, e.options.commentaires) : "",
        episodeId: p.episode?.id ?? null,
      });
    }
  });
  if (e.fin) pages.push({ id: nouvelId(), gabarit: "texte", cellules: [], titre: e.fin.titre, corps: e.fin.corps });

  // Compléter jusqu'à un nombre de pages accepté par le format.
  const obtenu = pages.length;
  const final = pagesValides(f, Math.max(obtenu, cible));
  while (pages.length < final) pages.push({ id: nouvelId(), gabarit: "vierge", cellules: [] });

  const premiere = e.medias.find((m) => m.vedette) ?? e.medias[0];
  const livre: Livre = {
    version: 1,
    formatId: f.id,
    options: e.options,
    couverture: e.couverture ?? {
      titre: e.nom,
      sousTitre: e.periode ?? "",
      photo: premiere ? cellule(premiere) : null,
      quatrieme: "",
    },
    pages,
  };

  let message: string | null = null;
  if (obtenu > cible) message = `Il y a trop de photos pour ${cible} pages : le livre en fait ${pages.length}. Augmentez la cible ou décochez des photos.`;
  else if (obtenu < cible)
    message = `Pas assez de photos pour remplir ${cible} pages : ${cible - obtenu} page(s) blanche(s) ajoutée(s) à la fin. Cochez plus de photos ou baissez la cible.`;
  return { livre, rapport: { pages: pages.length, cible, photos: e.medias.length, message } };
}

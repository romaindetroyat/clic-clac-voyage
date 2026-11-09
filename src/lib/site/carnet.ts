/**
 * Carnet de voyage : découpe le site en chapitres (un par jour, ou un par épisode avec ses jours)
 * et met en page chaque chapitre comme un magazine (grande photo d'ouverture, rangées
 * justifiées qui respectent le format des photos, photos en vedette, photos commentées).
 * Fonctions pures : même rendu en ligne et dans l'archive hors ligne.
 */
import { FORMATS_RECADRAGE, TYPES_BLOCS, type BlocSite, type Presentation, type TypeBloc } from "./config";
import type { DonneesSite, MediaSite } from "./types";

export type Bloc =
  /** Une photo ou une vidéo sur toute la largeur. */
  | { type: "grande"; m: MediaSite }
  /** Deux ou trois photos à la même hauteur (largeurs proportionnelles à leur format). */
  | { type: "rangee"; medias: MediaSite[] }
  /** Une photo et ses mots (légende longue, commentaires) côte à côte. */
  | { type: "note"; m: MediaSite; cote: "gauche" | "droite" }
  /** Une photo centrée, moins large, sa légende à côté. */
  | { type: "centree"; m: MediaSite; cote: "gauche" | "droite" }
  /** Deux photos décalées, comme dans un magazine. */
  | { type: "duo"; medias: MediaSite[]; cote: "gauche" | "droite" }
  /** Une grande photo et les autres en mosaïque à côté. */
  | { type: "mosaique"; medias: MediaSite[]; cote: "gauche" | "droite" }
  /** Une bande de photos qui défile à l'horizontale. */
  | { type: "defilement"; medias: MediaSite[] };

/** `cle` : identifiant stable de la partie (pour les dispositions choisies dans l'éditeur). */
export type SousPartie = { cle: string; jour: string | null; blocs: Bloc[] };

export type Chapitre = {
  id: string;
  /** Identifiant stable (épisode ou jour), même si l'ordre des chapitres change. */
  cle: string;
  /** Épisode du chapitre (titre et récit modifiables). */
  episodeId: string | null;
  /** « Jour 3 » ou « Épisode 2 ». */
  surtitre: string;
  titre: string;
  /** Date ou période, déjà mise en forme. */
  dates: string | null;
  lieu: string | null;
  recit: string | null;
  ouverture: MediaSite | null;
  /** Une sous-partie par jour (une seule, sans intertitre, en mode « jours »). */
  parties: SousPartie[];
  nbMedias: number;
  /** Mode épisodes : présentation choisie pour l'épisode (autre que « carnet ») et ses médias. */
  presentation?: Presentation;
  medias: MediaSite[];
};

/** Format affiché : celui du recadrage choisi, sinon celui de la photo. */
export const ratioDe = (m: MediaSite) => {
  const f = m.cadrage ? FORMATS_RECADRAGE[m.cadrage.format] : null;
  return f ?? (m.largeur && m.hauteur ? m.largeur / m.hauteur : 1.5);
};
const paysage = (m: MediaSite) => ratioDe(m) >= 1.15;
const portrait = (m: MediaSite) => ratioDe(m) < 0.9;
/** Une photo « bavarde » mérite d'être posée à côté de ses mots. */
const bavarde = (m: MediaSite) => (m.legende?.length ?? 0) >= 70 || m.commentaires.length >= 2;

/**
 * Met en page une suite de médias. Rythme : vedettes et vidéos en grand, photos commentées
 * à côté de leurs mots, le reste en rangées de 2 (paysages) ou 3 (portraits), et une grande
 * photo de paysage toutes les trois rangées pour respirer.
 */
export function mettreEnPage(medias: MediaSite[]): Bloc[] {
  const blocs: Bloc[] = [];
  const attente: MediaSite[] = [];
  let rangees = 0;
  let notes = 0;

  const vider = (force = false) => {
    while (attente.length) {
      const nbPortraits = attente.filter(portrait).length;
      const cible = nbPortraits >= 2 || attente.length >= 3 && !paysage(attente[0]) ? 3 : 2;
      if (attente.length < cible && !force) return;
      const rangee = attente.splice(0, Math.min(cible, attente.length));
      if (rangee.length === 1) blocs.push({ type: "grande", m: rangee[0] });
      else blocs.push({ type: "rangee", medias: rangee });
      rangees++;
    }
  };

  for (const m of medias) {
    if (m.vedette || m.type === "video") {
      vider(true);
      blocs.push({ type: "grande", m });
      rangees = 0;
    } else if (bavarde(m)) {
      vider(true);
      blocs.push({ type: "note", m, cote: notes++ % 2 ? "droite" : "gauche" });
    } else if (rangees >= 3 && paysage(m) && attente.length === 0) {
      blocs.push({ type: "grande", m });
      rangees = 0;
    } else {
      attente.push(m);
      vider();
    }
  }
  vider(true);
  // Pas de rangée d'une seule petite photo en fin de chapitre : on l'accole à la précédente.
  const dernier = blocs.at(-1);
  const avant = blocs.at(-2);
  if (dernier?.type === "grande" && !dernier.m.vedette && dernier.m.type === "photo" && !paysage(dernier.m) && avant?.type === "rangee" && avant.medias.length < 4) {
    avant.medias.push(dernier.m);
    blocs.pop();
  }
  return blocs;
}

/** Médias d'un bloc, dans l'ordre. */
export function mediasDuBloc(b: Bloc): MediaSite[] {
  return "medias" in b ? b.medias : [b.m];
}

/** Bloc → disposition enregistrable. */
export function versStocke(b: Bloc): BlocSite {
  return { type: b.type, ids: mediasDuBloc(b).map((m) => m.id), ...("cote" in b ? { cote: b.cote } : {}) };
}

/** Construit un ou plusieurs blocs d'un type, en respectant le nombre de photos qu'il accepte. */
export function construireBlocs(type: TypeBloc, medias: MediaSite[], cote: "gauche" | "droite" = "gauche"): Bloc[] {
  if (!medias.length) return [];
  const { min, max } = TYPES_BLOCS[type];
  if (medias.length < min) return medias.length === 1 ? [{ type: "grande", m: medias[0] }] : construireBlocs("rangee", medias);
  const ici = medias.slice(0, max);
  const reste = medias.slice(max);
  let b: Bloc;
  switch (type) {
    case "grande":
      b = { type, m: ici[0] };
      break;
    case "centree":
    case "note":
      b = { type, m: ici[0], cote };
      break;
    case "rangee":
    case "defilement":
      b = { type, medias: ici };
      break;
    case "duo":
    case "mosaique":
      b = { type, medias: ici, cote };
      break;
  }
  // Ce qui dépasse continue en rangées (une seule photo restante : en grand).
  return [b, ...(reste.length ? (reste.length === 1 ? [{ type: "grande" as const, m: reste[0] }] : construireBlocs("rangee", reste)) : [])];
}

/**
 * Disposition choisie dans l'éditeur, appliquée aux médias actuels de la partie : les photos retirées
 * disparaissent, les nouvelles sont mises en page automatiquement à la suite.
 */
export function appliquerMise(medias: MediaSite[], stockes: BlocSite[] | undefined): Bloc[] {
  if (!stockes?.length) return mettreEnPage(medias);
  const parId = new Map(medias.map((m) => [m.id, m]));
  const vus = new Set<string>();
  const blocs: Bloc[] = [];
  for (const s of stockes) {
    const ms = s.ids.map((id) => parId.get(id)).filter((m): m is MediaSite => !!m && !vus.has(m.id));
    for (const m of ms) vus.add(m.id);
    blocs.push(...construireBlocs(s.type, ms, s.cote));
  }
  return [...blocs, ...mettreEnPage(medias.filter((m) => !vus.has(m.id)))];
}

/** Ajoute à chaque média son recadrage enregistré (à faire une fois, avant de construire les chapitres). */
export function avecCadrages(d: DonneesSite): DonneesSite {
  const c = d.config.cadrages ?? {};
  if (!Object.keys(c).length) return d;
  const memo = new Map<MediaSite, MediaSite>();
  const f = (m: MediaSite) => {
    if (!c[m.id]) return m;
    if (!memo.has(m)) memo.set(m, { ...m, cadrage: c[m.id] });
    return memo.get(m)!;
  };
  return {
    ...d,
    couverture: d.couverture ? f(d.couverture) : null,
    episodes: d.episodes.map((e) => ({ ...e, medias: e.medias.map(f) })),
    horsEpisodes: d.horsEpisodes.map(f),
  };
}

/** Photo d'ouverture d'un chapitre : sa vedette, sinon sa plus belle photo de paysage, sinon la première. */
export function choisirOuverture(medias: MediaSite[], imposee?: string | null): MediaSite | null {
  const photos = medias.filter((m) => m.type === "photo");
  const choisie = imposee ? photos.find((m) => m.id === imposee) : undefined;
  if (choisie) return choisie;
  return photos.find((m) => m.vedette) ?? photos.find(paysage) ?? photos[0] ?? null;
}

const jourDe = (iso: string, fuseau: string) => new Intl.DateTimeFormat("en-CA", { timeZone: fuseau }).format(new Date(iso));
const libelleJour = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`));
const ecartJours = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function parJour(medias: MediaSite[], fuseau: string) {
  const jours = new Map<string, MediaSite[]>();
  const sansDate: MediaSite[] = [];
  for (const m of medias) {
    if (!m.instant) sansDate.push(m);
    else {
      const j = jourDe(m.instant, fuseau);
      jours.set(j, [...(jours.get(j) ?? []), m]);
    }
  }
  return { jours: [...jours.entries()].sort(([a], [b]) => a.localeCompare(b)), sansDate };
}

/** Sort la photo d'ouverture du fil (elle est déjà montrée en grand en tête du chapitre). */
function sansOuverture(medias: MediaSite[], ouverture: MediaSite | null) {
  return ouverture ? medias.filter((m) => m !== ouverture) : medias;
}

export type Organisation = "auto" | "jours" | "episodes";

/** Chapitres du carnet. « auto » : par épisode s'il y en a, sinon par jour. */
export function chapitres(d: DonneesSite, organisation: Organisation): Chapitre[] {
  const mise = d.config.mise ?? {};
  const ouv = d.config.ouvertures ?? {};
  const parEpisode = organisation === "episodes" || (organisation === "auto" && d.episodes.length > 0);
  const tous = [...d.episodes.flatMap((e) => e.medias), ...d.horsEpisodes];
  const premierJour = tous.filter((m) => m.instant).map((m) => jourDe(m.instant!, d.fuseau)).sort()[0];
  const numeroJour = (j: string) => (premierJour ? ecartJours(premierJour, j) + 1 : 1);

  if (!parEpisode) {
    const { jours, sansDate } = parJour(tous, d.fuseau);
    const res: Chapitre[] = jours.map(([jour, medias]) => {
      // Le texte d'un épisode s'affiche au jour où il commence.
      const eps = d.episodes.filter((e) => e.debut && jourDe(e.debut, d.fuseau) === jour);
      const lieux = d.episodes.filter((e) => e.lieu && e.medias.some((m) => medias.includes(m))).map((e) => e.lieu!);
      const cle = `jour-${jour}`;
      const ouverture = choisirOuverture(medias, ouv[cle]);
      return {
        id: `jour-${jour}`,
        cle,
        episodeId: eps[0]?.id ?? null,
        surtitre: `Jour ${numeroJour(jour)}`,
        titre: eps[0]?.titre ?? libelleJour(jour).replace(/^./, (c) => c.toUpperCase()),
        dates: eps[0] ? libelleJour(jour) : null,
        lieu: [...new Set(lieux)].join(" · ") || null,
        recit: eps.map((e) => e.recit).filter(Boolean).join("\n\n") || null,
        ouverture,
        parties: [{ cle: `${cle}|tout`, jour: null, blocs: appliquerMise(sansOuverture(medias, ouverture), mise[`${cle}|tout`]) }],
        nbMedias: medias.length,
        medias,
      };
    });
    if (sansDate.length) res.push(chapitreSansDate(sansDate, "sans-date", mise));
    return res;
  }

  const res: Chapitre[] = d.episodes.map((e, i) => {
    const cle = `ep-${e.id}`;
    const ouverture = choisirOuverture(e.medias, ouv[cle]);
    const { jours: tousJours } = parJour(e.medias, d.fuseau);
    // La photo d'ouverture, déjà montrée en grand, n'est pas répétée dans le fil.
    const { jours, sansDate } = parJour(sansOuverture(e.medias, ouverture), d.fuseau);
    const plusieursJours = tousJours.length > 1;
    const parties: SousPartie[] = jours.map(([jour, medias]) => ({
      cle: `${cle}|${jour}`,
      jour: plusieursJours ? `Jour ${numeroJour(jour)} · ${libelleJour(jour)}` : null,
      blocs: appliquerMise(medias, mise[`${cle}|${jour}`]),
    }));
    if (sansDate.length) parties.push({ cle: `${cle}|sans-date`, jour: plusieursJours ? "Sans date" : null, blocs: appliquerMise(sansDate, mise[`${cle}|sans-date`]) });
    const premier = tousJours[0]?.[0];
    const dernier = tousJours.at(-1)?.[0];
    return {
      id: `episode-${i + 1}`,
      cle,
      episodeId: e.id,
      surtitre: premier ? (premier === dernier ? `Jour ${numeroJour(premier)}` : `Jours ${numeroJour(premier)} à ${numeroJour(dernier!)}`) : `Épisode ${i + 1}`,
      titre: e.titre,
      dates: premier ? (premier === dernier ? libelleJour(premier) : `${libelleJour(premier)} – ${libelleJour(dernier!)}`) : null,
      lieu: e.lieu,
      recit: e.recit,
      ouverture,
      parties,
      nbMedias: e.medias.length,
      presentation: e.presentation,
      medias: e.medias,
    };
  });
  if (d.horsEpisodes.length) {
    const c = chapitreSansDate(d.horsEpisodes, "autres-moments", mise);
    res.push({ ...c, id: "autres-moments", titre: "Autres moments" });
  }
  return res;
}

function chapitreSansDate(medias: MediaSite[], cle: string, mise: Record<string, BlocSite[]>): Chapitre {
  return {
    id: "sans-date",
    cle,
    episodeId: null,
    surtitre: "En vrac",
    titre: "Encore quelques images",
    dates: null,
    lieu: null,
    recit: null,
    ouverture: null,
    parties: [{ cle: `${cle}|tout`, jour: null, blocs: appliquerMise(medias, mise[`${cle}|tout`]) }],
    nbMedias: medias.length,
    medias,
  };
}

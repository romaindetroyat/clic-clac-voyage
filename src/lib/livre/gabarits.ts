/**
 * Gabarits de pages : des fonctions qui découpent la page de n'importe quel format.
 * Changer de format ne casse donc jamais une page : ses cadres sont recalculés, et chaque gabarit
 * s'adapte à l'orientation (portrait, paysage, carré).
 * Toutes les mesures sont en millimètres, origine au coin haut gauche de la page rognée.
 *
 * Un gabarit pose des photos, des textes et des formes (aplats, cadres blancs, bandes de pellicule).
 * Certains cadres « s'ajustent » aux proportions de la photo (pas de recadrage) ; les légendes et
 * les cadres blancs attachés à une photo la suivent, et une photo inclinée entraîne ce qui lui est attaché.
 */
import type { Format } from "./formats";

export type Rect = { x: number; y: number; l: number; h: number };
export type RoleTexte = "titre" | "surtitre" | "corps" | "legende" | "folio";

/** Cadre de photo : rectangle, rotation (degrés, sens horaire, autour de son centre). */
export type CadrePhoto = Rect & { rotation?: number };

export type Teinte = "papier" | "blanc" | "encre" | "douce" | "accent" | "voile" | "clair" | "sombre";

export type Forme = {
  rect: Rect;
  teinte: Teinte;
  opacite?: number;
  /** Contour seulement, de cette épaisseur (mm). */
  trait?: number;
  rotation?: number;
  /** Posée par-dessus les photos (sinon dessous). */
  dessus?: boolean;
};

export type CadreTexte = {
  role: RoleTexte;
  rect: Rect;
  centre?: boolean;
  droite?: boolean;
  /** Texte calé en bas de son cadre. */
  bas?: boolean;
  /** Texte centré verticalement dans son cadre. */
  milieu?: boolean;
  /** Légende propre à cette photo (sinon, légende de la page). */
  photo?: number;
  /** Multiplie la taille du style (citation en grand, par exemple). */
  echelle?: number;
  /** Texte clair (posé sur une photo) ou de la couleur d'accent. */
  teinte?: "clair" | "accent";
  dessus?: boolean;
  rotation?: number;
};

export type Geometrie = { photos: CadrePhoto[]; textes: CadreTexte[]; formes: Forme[] };

/* --------------------------- Plan d'un gabarit (avant résolution) --------------------------- */

type Ajuste = "centre" | "haut" | "bas" | "gauche" | "droite";
type PlanPhoto = CadrePhoto & { ajuste?: Ajuste };
type PlanForme = Omit<Forme, "rect"> & {
  rect?: Rect;
  /** Autour d'une photo : marges haut, droite, bas, gauche ; décalage éventuel (ombre). */
  autour?: { photo: number; marge: [number, number, number, number]; dx?: number; dy?: number };
};
type PlanTexte = Omit<CadreTexte, "rect"> & {
  rect?: Rect;
  /** Sous la photo, ou posé dessus (en bas). */
  attache?: { photo: number; ou: "sous" | "sur"; h: number; ecart?: number };
};
type Plan = { photos: PlanPhoto[]; textes: PlanTexte[]; formes?: PlanForme[] };

/** Ce que reçoit un gabarit pour se construire. */
export type Contexte = {
  /** Zone utile : marges, côté reliure plus large, bas réservé à la légende et au folio. */
  z: Rect;
  /** Zone sans le pied : mêmes marges, bas égal aux côtés. */
  m: Rect;
  /** La page rognée (0, 0, largeur, hauteur). */
  page: Rect;
  /** Fond perdu (mm). */
  b: number;
  /** Gouttière entre les photos (mm). */
  g: number;
  /** Page de droite (la reliure est à gauche, l'extérieur à droite). */
  droite: boolean;
};

export type FamilleGabarit = "photos" | "ouverture" | "texte" | "titre" | "vierge";

/** Ambiances de mise en page : la mise en page automatique pioche dans les gabarits de l'ambiance choisie. */
export const AMBIANCES = {
  melange: { nom: "Variée", description: "Un peu de tout : grilles, galeries, pleines pages, polaroïds.", ouvertures: ["ouverture", "ouverture-cote", "ouverture-pleine", "ouverture-galerie"] },
  classique: { nom: "Classique", description: "Grilles régulières et grandes photos.", ouvertures: ["ouverture"] },
  galerie: { nom: "Galerie", description: "Beaucoup de blanc, photos entières sans recadrage, légende sous chaque photo.", ouvertures: ["ouverture-galerie"] },
  magazine: { nom: "Magazine", description: "Pleines pages, fonds perdus, compositions décalées.", ouvertures: ["ouverture-pleine", "ouverture-cote"] },
  carnet: { nom: "Carnet de voyage", description: "Polaroïds et cartes postales posés de travers.", ouvertures: ["ouverture-carnet"] },
  mosaique: { nom: "Mosaïque", description: "Beaucoup de photos par page, en mosaïques irrégulières.", ouvertures: ["ouverture"] },
  cinema: { nom: "Cinéma", description: "Pellicules, planches-contacts et panoramiques.", ouvertures: ["ouverture-cote", "ouverture-pleine"] },
} as const;
export type Ambiance = keyof typeof AMBIANCES;
export const IDS_AMBIANCES = Object.keys(AMBIANCES) as Ambiance[];

export type Gabarit = {
  id: string;
  nom: string;
  famille: FamilleGabarit;
  /** Nombre de photos. */
  n: number;
  /** Utilisable par la mise en page automatique (les ouvertures, par exemple). */
  auto: boolean;
  /** Ambiances qui l'utilisent en mise en page automatique. */
  ambiances: Ambiance[];
  construire: (c: Contexte) => Plan;
};

export const GOUTTIERE = 4;

function marges(f: Format, numero: number) {
  // Jamais moins que la zone de sécurité de l'imprimeur.
  const exterieur = Math.max(12, f.securite);
  const interieur = exterieur + f.pli;
  // Page impaire = page de droite : la reliure est à gauche.
  const droite = numero % 2 === 1;
  return { exterieur, interieur, droite, x: droite ? interieur : exterieur, l: f.largeur - interieur - exterieur };
}

/** Marges (mm) : côté reliure plus large, bas plus haut pour la légende et le folio. */
export function zoneUtile(f: Format, numero: number): Rect {
  const m = marges(f, numero);
  // Bas : légende (7 mm) puis folio (4 mm), le folio restant dans la zone de sécurité.
  return { x: m.x, y: m.exterieur, l: m.l, h: f.hauteur - 2 * m.exterieur - 15 };
}

/* ---------------------------------------- Outils ---------------------------------------- */

function colonnes(z: Rect, poids: number[], g: number): Rect[] {
  const total = poids.reduce((a, b) => a + b, 0);
  const utile = z.l - g * (poids.length - 1);
  let x = z.x;
  return poids.map((p) => {
    const l = (utile * p) / total;
    const r = { x, y: z.y, l, h: z.h };
    x += l + g;
    return r;
  });
}

function lignes(z: Rect, poids: number[], g: number): Rect[] {
  const total = poids.reduce((a, b) => a + b, 0);
  const utile = z.h - g * (poids.length - 1);
  let y = z.y;
  return poids.map((p) => {
    const h = (utile * p) / total;
    const r = { x: z.x, y, l: z.l, h };
    y += h + g;
    return r;
  });
}

function grille(z: Rect, cols: number, rangs: number, g: number): Rect[] {
  return lignes(z, Array(rangs).fill(1), g).flatMap((r) => colonnes(r, Array(cols).fill(1), g));
}

function retrait(z: Rect, f: number): Rect {
  return { x: z.x + (z.l * f) / 2, y: z.y + (z.h * f) / 2, l: z.l * (1 - f), h: z.h * (1 - f) };
}

/** Partie d'un rectangle, en fractions (x, y, largeur, hauteur). */
function part(z: Rect, x: number, y: number, l: number, h: number): Rect {
  return { x: z.x + z.l * x, y: z.y + z.h * y, l: z.l * l, h: z.h * h };
}

/** Le plus grand rectangle de proportions `ratio` dans `z`, centré. */
function cadrer(z: Rect, ratio: number): Rect {
  if (z.l / z.h > ratio) {
    const l = z.h * ratio;
    return { x: z.x + (z.l - l) / 2, y: z.y, l, h: z.h };
  }
  const h = z.l / ratio;
  return { x: z.x, y: z.y + (z.h - h) / 2, l: z.l, h };
}

/** Diminue la hauteur (place d'une légende sous la photo). */
const sansBas = (r: Rect, h: number): Rect => ({ ...r, h: r.h - h });

const paysage = (z: Rect) => z.l > z.h * 1.12;
const portrait = (z: Rect) => z.h > z.l * 1.12;

/** Bande de légende sous la zone utile, et folio. */
function pied(z: Rect): PlanTexte[] {
  return [{ role: "legende", rect: { x: z.x, y: z.y + z.h + 3, l: z.l, h: 7 } }, folio(z)];
}
function folio(z: Rect): PlanTexte {
  return { role: "folio", rect: { x: z.x, y: z.y + z.h + 11, l: z.l, h: 4 }, centre: true };
}

/** Légende d'une photo, attachée sous elle. */
function legende(i: number, o: { centre?: boolean; h?: number; ecart?: number } = {}): PlanTexte {
  return { role: "legende", photo: i, centre: o.centre ?? true, attache: { photo: i, ou: "sous", h: o.h ?? 7, ecart: o.ecart ?? 2 } };
}

/** Pleine page, fonds perdus compris. */
function pleine(c: Contexte): Rect {
  return { x: -c.b, y: -c.b, l: c.page.l + 2 * c.b, h: c.page.h + 2 * c.b };
}

/** Photo à fond perdu du côté extérieur, sur une fraction de la largeur. */
function exterieur(c: Contexte, frac: number): Rect {
  const l = c.page.l * frac;
  return c.droite ? { x: c.page.l - l, y: -c.b, l: l + c.b, h: c.page.h + 2 * c.b } : { x: -c.b, y: -c.b, l: l + c.b, h: c.page.h + 2 * c.b };
}

/** Côté intérieur laissé libre par `exterieur(c, frac)`, dans la zone `z`. */
function interieur(c: Contexte, z: Rect, frac: number, ecart = 8): Rect {
  const limite = c.page.l * (1 - frac);
  if (c.droite) return { ...z, l: Math.max(10, limite - ecart - z.x) };
  const x = c.page.l * frac + ecart;
  return { ...z, x, l: Math.max(10, z.x + z.l - x) };
}

/**
 * Polaroïd qui remplit `boite` : photo, bord blanc plus large en bas (la légende s'y écrit),
 * ombre légère et filet pour qu'il se détache même sur un fond clair.
 */
function polaroid(i: number, boite: Rect, rotation: number): { photo: PlanPhoto; formes: PlanForme[]; texte: PlanTexte } {
  const s = Math.max(2.5, boite.l * 0.045);
  const bas = Math.max(9, boite.h * 0.15);
  const photo = { x: boite.x + s, y: boite.y + s, l: boite.l - 2 * s, h: boite.h - s - bas, rotation };
  return { photo, formes: entoure(i, [s, s, bas, s]), texte: { ...legende(i, { h: bas - 2, ecart: 1 }), milieu: true } };
}

/** Proportions d'un polaroïd qui remplit au mieux une boîte (carré, un peu en hauteur ou en largeur). */
const formatPolaroid = (b: Rect) => Math.max(0.82, Math.min(1.2, b.l / b.h));

/** Bord blanc, ombre et filet autour d'une photo. */
function entoure(i: number, marge: [number, number, number, number]): PlanForme[] {
  return [
    { teinte: "encre", opacite: 0.1, autour: { photo: i, marge, dx: 0.8, dy: 1.2 } },
    { teinte: "blanc", autour: { photo: i, marge } },
    { teinte: "douce", trait: 0.2, opacite: 0.45, autour: { photo: i, marge } },
  ];
}

/** Bande de pellicule : `n` images 3:2, perforations, verticale sur une page en hauteur. */
function pellicule(c: Contexte, n: number): { photos: PlanPhoto[]; formes: PlanForme[]; bande: Rect } {
  const z = c.z;
  const bord = 7;
  const ecart = 3;
  const formes: PlanForme[] = [];
  const photos: PlanPhoto[] = [];
  if (portrait(z)) {
    const h = Math.min((z.h - (n - 1) * ecart - 2) / n, ((z.l - 2 * bord) * 0.86) / 1.5);
    const l = h * 1.5;
    const bande = { x: z.x + (z.l - l - 2 * bord) / 2, y: -c.b, l: l + 2 * bord, h: c.page.h + 2 * c.b };
    const y0 = z.y + (z.h - n * h - (n - 1) * ecart) / 2;
    for (let i = 0; i < n; i++) photos.push({ x: bande.x + bord, y: y0 + i * (h + ecart), l, h });
    formes.push({ teinte: "sombre", rect: bande });
    for (let y = 1.5; y < c.page.h; y += 4.75) {
      formes.push({ teinte: "papier", opacite: 0.92, rect: { x: bande.x + 2.2, y, l: 2.6, h: 1.9 } });
      formes.push({ teinte: "papier", opacite: 0.92, rect: { x: bande.x + bande.l - 4.8, y, l: 2.6, h: 1.9 } });
    }
    return { photos, formes, bande };
  }
  const l = Math.min((z.l - (n - 1) * ecart) / n, ((z.h - 2 * bord - 14) * 1.5) as number);
  const h = l / 1.5;
  const bande = { x: -c.b, y: z.y + (z.h - h - 2 * bord) / 2, l: c.page.l + 2 * c.b, h: h + 2 * bord };
  const x0 = z.x + (z.l - n * l - (n - 1) * ecart) / 2;
  for (let i = 0; i < n; i++) photos.push({ x: x0 + i * (l + ecart), y: bande.y + bord, l, h });
  formes.push({ teinte: "sombre", rect: bande });
  for (let x = 1.5; x < c.page.l; x += 4.75) {
    formes.push({ teinte: "papier", opacite: 0.92, rect: { x, y: bande.y + 2.2, l: 1.9, h: 2.6 } });
    formes.push({ teinte: "papier", opacite: 0.92, rect: { x, y: bande.y + bande.h - 4.8, l: 1.9, h: 2.6 } });
  }
  return { photos, formes, bande };
}

/** Planche-contact : fond sombre et petites images régulières. */
function planche(c: Contexte, cols: number, rangs: number): Plan {
  const z = c.z;
  const fond = { x: z.x, y: z.y, l: z.l, h: z.h };
  const interieurPlanche = { x: fond.x + 6, y: fond.y + 6, l: fond.l - 12, h: fond.h - 12 };
  return { photos: grille(interieurPlanche, cols, rangs, 3), formes: [{ teinte: "sombre", rect: fond }], textes: pied(z) };
}

/** Galerie : des boîtes où chaque photo garde ses proportions, légende dessous. */
function galerie(boites: Rect[], h = 8): Plan {
  return {
    photos: boites.map((b) => ({ ...sansBas(b, h + 2), ajuste: "centre" as const })),
    textes: boites.map((_, i) => legende(i, { h })),
  };
}

const simple = (photos: Rect[], z: Rect): Plan => ({ photos, textes: pied(z) });

function photos(id: string, nom: string, n: number, ambiances: Ambiance[], auto: boolean, construire: (c: Contexte) => Plan): Gabarit {
  return { id, nom, famille: "photos", n, auto, ambiances, construire };
}

/** Raccourci pour les découpes simples de la zone utile, légende de page en bas. */
const decoupe = (id: string, nom: string, n: number, ambiances: Ambiance[], auto: boolean, f: (z: Rect, g: number) => Rect[]) =>
  photos(id, nom, n, ambiances, auto, (c) => simple(f(c.z, c.g), c.z));

/* -------------------------------------- Les gabarits -------------------------------------- */

export const GABARITS: Gabarit[] = [
  /* ------------------------------ Une photo ------------------------------ */
  photos("pleine-page", "Pleine page", 1, ["melange", "magazine", "cinema", "classique"], true, (c) => ({ photos: [pleine(c)], textes: [] })),
  photos("pleine-page-legende", "Pleine page, légende sur la photo", 1, ["magazine"], false, (c) => {
    const bas = c.m.y + c.m.h;
    const h = c.page.h - bas + 22;
    return {
      photos: [pleine(c)],
      formes: [{ teinte: "voile", opacite: 0.38, dessus: true, rect: { x: -c.b, y: c.page.h - h, l: c.page.l + 2 * c.b, h: h + c.b } }],
      textes: [{ role: "legende", photo: 0, teinte: "clair", dessus: true, bas: true, rect: { x: c.m.x, y: bas - 16, l: c.m.l, h: 16 } }],
    };
  }),
  decoupe("une", "Une photo", 1, ["melange", "classique", "mosaique"], true, (z) => [z]),
  decoupe("une-aeree", "Une photo, aérée", 1, ["classique", "galerie"], false, (z) => [retrait(z, 0.16)]),
  photos("une-galerie", "Une photo entière, légende dessous", 1, ["melange", "galerie"], true, (c) => ({
    ...galerie([retrait(c.z, 0.12)], 9),
    textes: [legende(0, { h: 9 }), folio(c.z)],
  })),
  photos("une-polaroid", "Un polaroïd", 1, ["melange", "carnet"], true, (c) => {
    const p = polaroid(0, cadrer(retrait(c.z, 0.1), 0.86), -2.5);
    return { photos: [p.photo], formes: p.formes, textes: [p.texte, folio(c.z)] };
  }),
  photos("une-carte-postale", "Une carte postale", 1, ["carnet"], true, (c) => ({
    photos: [{ ...sansBas(retrait(c.z, 0.16), 12), ajuste: "centre", rotation: 1.5 }],
    formes: entoure(0, [3.5, 3.5, 3.5, 3.5]),
    textes: [legende(0, { h: 8, ecart: 6 }), folio(c.z)],
  })),
  photos("une-exterieur", "Une photo à fond perdu, légende à côté", 1, ["magazine", "melange"], true, (c) => {
    const frac = paysage(c.z) ? 0.58 : 0.64;
    const libre = interieur(c, c.m, frac);
    return {
      photos: [exterieur(c, frac)],
      textes: [
        { role: "legende", photo: 0, bas: true, droite: !c.droite, rect: { x: libre.x, y: libre.y + libre.h * 0.5, l: libre.l, h: libre.h * 0.5 - 10 } },
        { role: "folio", droite: !c.droite, rect: { x: libre.x, y: libre.y + libre.h - 4, l: libre.l, h: 4 } },
      ],
    };
  }),
  photos("une-panoramique", "Un panoramique", 1, ["cinema", "magazine", "melange"], true, (c) => {
    const l = c.page.l + 2 * c.b;
    const h = Math.min(c.z.h * 0.6, l / 2.3);
    const y = c.z.y + (c.z.h - h) * 0.4;
    return {
      photos: [{ x: -c.b, y, l, h }],
      textes: [{ role: "legende", photo: 0, rect: { x: c.z.x, y: y + h + 4, l: c.z.l * 0.7, h: 14 } }, folio(c.z)],
    };
  }),
  photos("une-bandeau", "Une photo en bandeau, texte dessous", 1, ["magazine", "melange"], true, (c) => {
    const h = c.page.h * (paysage(c.z) ? 0.66 : 0.6);
    return {
      photos: [{ x: -c.b, y: -c.b, l: c.page.l + 2 * c.b, h: h + c.b }],
      textes: [{ role: "legende", photo: 0, rect: { x: c.z.x, y: h + 6, l: c.z.l * 0.75, h: Math.max(8, c.z.y + c.z.h - h - 6) } }, folio(c.z)],
    };
  }),
  photos("une-encadree", "Une photo encadrée de blanc", 1, ["galerie", "classique"], false, (c) => ({
    photos: [{ ...sansBas(retrait(c.z, 0.2), 12), ajuste: "centre" }],
    formes: [{ teinte: "douce", trait: 0.25, opacite: 0.6, autour: { photo: 0, marge: [5, 5, 5, 5] } }],
    textes: [legende(0, { h: 8, ecart: 8 }), folio(c.z)],
  })),

  /* ------------------------------ Deux photos ------------------------------ */
  photos("deux-cartes-postales", "Deux cartes postales", 2, ["carnet", "melange"], true, (c) => {
    const boites = paysage(c.z) ? colonnes(retrait(c.z, 0.08), [1, 1], 14) : lignes(retrait(c.z, 0.04), [1, 1], 14);
    return {
      photos: boites.map((b, i) => ({ ...sansBas(retrait(b, 0.08), 10), ajuste: "centre" as const, rotation: i ? 1.5 : -2 })),
      formes: [...entoure(0, [3, 3, 3, 3]), ...entoure(1, [3, 3, 3, 3])],
      textes: [legende(0, { h: 7, ecart: 5 }), legende(1, { h: 7, ecart: 5 }), folio(c.z)],
    };
  }),
  decoupe("deux-colonnes", "Deux côte à côte", 2, ["melange", "classique", "mosaique"], true, (z, g) => colonnes(z, [1, 1], g)),
  decoupe("deux-lignes", "Deux l’une sur l’autre", 2, ["classique", "mosaique"], true, (z, g) => lignes(z, [1, 1], g)),
  decoupe("deux-inegales", "Une grande, une petite", 2, ["melange", "classique"], true, (z, g) => (portrait(z) ? lignes(z, [2, 1], g) : colonnes(z, [2, 1], g))),
  photos("deux-galerie", "Deux photos entières, légendées", 2, ["melange", "galerie"], true, (c) => {
    const boites = paysage(c.z) ? colonnes(retrait(c.z, 0.06), [1, 1], 10) : lignes(retrait(c.z, 0.06), [1, 1], 8);
    return { ...galerie(boites), textes: [...galerie(boites).textes, folio(c.z)] };
  }),
  photos("deux-polaroids", "Deux polaroïds", 2, ["melange", "carnet"], true, (c) => {
    const z = c.z;
    const boites = paysage(z) ? [part(z, 0, 0, 0.5, 0.88), part(z, 0.5, 0.12, 0.5, 0.88)] : [part(z, 0, 0, 0.72, 0.5), part(z, 0.28, 0.5, 0.72, 0.5)];
    const p = boites.map((b, i) => polaroid(i, cadrer(retrait(b, 0.1), formatPolaroid(retrait(b, 0.1))), i ? 2.5 : -3));
    return { photos: p.map((x) => x.photo), formes: p.flatMap((x) => x.formes), textes: [...p.map((x) => x.texte), folio(z)] };
  }),
  photos("deux-decalees", "Deux photos décalées", 2, ["melange", "magazine"], true, (c) => {
    const z = c.z;
    const g = c.g;
    if (paysage(z)) {
      const a = part(z, 0, 0, 0.56, 0.74);
      const b = { ...part(z, 0.56, 0.3, 0.44, 0.7), x: z.x + z.l * 0.56 + 2 * g, l: z.l * 0.44 - 2 * g };
      return {
        photos: [a, b],
        textes: [
          { role: "legende", photo: 0, rect: { x: a.x, y: a.y + a.h + 3, l: a.l, h: z.h - a.h - 3 } },
          { role: "legende", photo: 1, bas: true, rect: { x: b.x, y: z.y, l: b.l, h: b.y - z.y - 3 } },
          folio(z),
        ],
      };
    }
    const a = part(z, 0, 0, 0.64, 0.56);
    const b = part(z, 0.36, 0.6, 0.64, 0.4);
    return {
      photos: [a, b],
      textes: [
        { role: "legende", photo: 0, bas: true, rect: { x: a.x + a.l + g, y: a.y + a.h * 0.4, l: z.l - a.l - g, h: a.h * 0.6 } },
        { role: "legende", photo: 1, droite: true, rect: { x: z.x, y: b.y, l: b.x - z.x - g, h: b.h * 0.6 } },
        folio(z),
      ],
    };
  }),
  photos("deux-fond-perdu", "Deux à fond perdu", 2, ["magazine", "cinema"], true, (c) => {
    const { l: L, h: H } = c.page;
    const b = c.b;
    const vertical = !paysage(c.page);
    return {
      photos: vertical
        ? [
            { x: -b, y: -b, l: L + 2 * b, h: H / 2 - 1.5 + b },
            { x: -b, y: H / 2 + 1.5, l: L + 2 * b, h: H / 2 - 1.5 + b },
          ]
        : [
            { x: -b, y: -b, l: L / 2 - 1.5 + b, h: H + 2 * b },
            { x: L / 2 + 1.5, y: -b, l: L / 2 - 1.5 + b, h: H + 2 * b },
          ],
      textes: [],
    };
  }),
  photos("deux-pellicule", "Pellicule, deux images", 2, ["cinema"], true, (c) => {
    const p = pellicule(c, 2);
    return { photos: p.photos, formes: p.formes, textes: [folio(c.z)] };
  }),

  /* ------------------------------ Trois photos ------------------------------ */
  decoupe("trois-colonnes", "Trois colonnes", 3, ["classique", "mosaique"], true, (z, g) => colonnes(z, [1, 1, 1], g)),
  decoupe("trois-lignes", "Trois bandeaux", 3, ["classique", "cinema"], true, (z, g) => lignes(z, [1, 1, 1], g)),
  decoupe("trois-heros-gauche", "Une grande et deux", 3, ["melange", "classique", "mosaique"], true, (z, g) => {
    const [a, b] = colonnes(z, [2, 1], g);
    return [a, ...lignes(b, [1, 1], g)];
  }),
  decoupe("trois-heros-haut", "Une grande en haut et deux", 3, ["melange", "classique", "magazine"], true, (z, g) => {
    const [a, b] = lignes(z, [3, 2], g);
    return [a, ...colonnes(b, [1, 1], g)];
  }),
  photos("trois-galerie", "Trois photos entières, légendées", 3, ["galerie", "melange"], true, (c) => {
    const boites = paysage(c.z) ? colonnes(retrait(c.z, 0.05), [1, 1, 1], 8) : lignes(c.z, [1, 1, 1], 6);
    return { ...galerie(boites), textes: [...galerie(boites).textes, folio(c.z)] };
  }),
  photos("trois-polaroids", "Trois polaroïds", 3, ["carnet", "melange"], true, (c) => {
    const z = c.z;
    const boites = paysage(z)
      ? [part(z, 0, 0, 0.33, 0.9), part(z, 0.335, 0.1, 0.33, 0.9), part(z, 0.67, 0.03, 0.33, 0.9)]
      : [part(z, 0, 0, 0.62, 0.33), part(z, 0.38, 0.335, 0.62, 0.33), part(z, 0.06, 0.67, 0.62, 0.33)];
    const angles = [-3, 2.5, -1.5];
    const p = boites.map((b, i) => polaroid(i, cadrer(retrait(b, 0.12), formatPolaroid(retrait(b, 0.12))), angles[i]));
    return { photos: p.map((x) => x.photo), formes: p.flatMap((x) => x.formes), textes: [...p.map((x) => x.texte), folio(z)] };
  }),
  photos("trois-escalier", "Trois en escalier", 3, ["magazine", "melange"], true, (c) => {
    const z = c.z;
    const g = c.g;
    if (paysage(z)) {
      const l = (z.l - 2 * g) / 3;
      const ph = [0, 1, 2].map((i) => ({ x: z.x + i * (l + g), y: z.y + z.h * 0.2 * i, l, h: z.h * 0.6 }));
      return {
        photos: ph,
        textes: [
          ...ph.map((p, i): PlanTexte => (i < 2 ? { role: "legende", photo: i, rect: { x: p.x, y: p.y + p.h + 3, l: p.l, h: z.h * 0.2 - 4 } } : { role: "legende", photo: i, bas: true, rect: { x: p.x, y: z.y, l: p.l, h: p.y - z.y - 3 } })),
          folio(z),
        ],
      };
    }
    const h = (z.h - 2 * g) / 3;
    const l = z.l * 0.62;
    const ph = [0, 1, 2].map((i) => ({ x: z.x + (z.l - l) * (i / 2), y: z.y + i * (h + g), l, h }));
    return {
      photos: ph,
      textes: [
        { role: "legende", photo: 0, bas: true, rect: { x: ph[0].x + l + g, y: ph[0].y + h * 0.3, l: z.l - l - g, h: h * 0.7 } },
        { role: "legende", photo: 1, bas: true, rect: { x: ph[1].x + l + g, y: ph[1].y + h * 0.3, l: z.x + z.l - ph[1].x - l - g, h: h * 0.7 } },
        { role: "legende", photo: 2, droite: true, rect: { x: z.x, y: ph[2].y, l: z.l - l - g, h: h * 0.7 } },
        folio(z),
      ],
    };
  }),
  photos("trois-exterieur", "Une à fond perdu et deux", 3, ["magazine"], true, (c) => {
    const libre = interieur(c, c.z, 0.5, 2 * c.g);
    return { photos: [exterieur(c, 0.5), ...lignes(libre, [1, 1], c.g)], textes: pied(libre) };
  }),
  photos("trois-pellicule", "Pellicule, trois images", 3, ["cinema"], true, (c) => {
    const p = pellicule(c, 3);
    return { photos: p.photos, formes: p.formes, textes: [folio(c.z)] };
  }),

  /* ------------------------------ Quatre photos ------------------------------ */
  decoupe("quatre-grille", "Quatre", 4, ["classique", "mosaique", "melange"], true, (z, g) => grille(z, 2, 2, g)),
  decoupe("quatre-heros", "Une grande et trois", 4, ["melange", "classique", "magazine"], true, (z, g) => {
    if (paysage(z)) {
      const [a, b] = colonnes(z, [2, 1], g);
      return [a, ...lignes(b, [1, 1, 1], g)];
    }
    const [a, b] = lignes(z, [2, 1], g);
    return [a, ...colonnes(b, [1, 1, 1], g)];
  }),
  decoupe("quatre-mosaique", "Mosaïque de quatre", 4, ["mosaique", "melange"], true, (z, g) => {
    const [a, b] = colonnes(z, [3, 2], g);
    return [...lignes(a, [2, 1], g), ...lignes(b, [1, 2], g)];
  }),
  decoupe("quatre-bandes", "Quatre bandes", 4, ["cinema", "mosaique"], true, (z, g) => (portrait(z) ? lignes(z, [1, 1, 1, 1], g) : colonnes(z, [1, 1, 1, 1], g))),
  photos("quatre-galerie", "Quatre photos entières, légendées", 4, ["galerie"], true, (c) => {
    const boites = grille(c.z, 2, 2, 8);
    return { ...galerie(boites, 7), textes: [...galerie(boites, 7).textes, folio(c.z)] };
  }),
  photos("quatre-polaroids", "Quatre polaroïds", 4, ["carnet"], true, (c) => {
    const angles = [-3, 2, 1.5, -2.5];
    const p = grille(c.z, 2, 2, 4).map((b, i) => polaroid(i, cadrer(retrait(b, 0.12), formatPolaroid(retrait(b, 0.12))), angles[i]));
    return { photos: p.map((x) => x.photo), formes: p.flatMap((x) => x.formes), textes: [...p.map((x) => x.texte), folio(c.z)] };
  }),
  photos("quatre-pellicule", "Pellicule, quatre images", 4, ["cinema"], true, (c) => {
    const p = pellicule(c, 4);
    return { photos: p.photos, formes: p.formes, textes: [folio(c.z)] };
  }),

  /* ------------------------------ Cinq photos et plus ------------------------------ */
  decoupe("cinq", "Cinq", 5, ["classique", "mosaique", "melange"], true, (z, g) => {
    const [a, b] = lignes(z, [1, 1], g);
    return [...colonnes(a, [1, 1], g), ...colonnes(b, [1, 1, 1], g)];
  }),
  decoupe("cinq-mosaique", "Une grande et quatre petites", 5, ["mosaique", "melange"], true, (z, g) => {
    const [a, b] = portrait(z) ? lignes(z, [3, 2], g) : colonnes(z, [3, 2], g);
    return [a, ...grille(b, 2, 2, g)];
  }),
  decoupe("cinq-frise", "Une grande et une frise de quatre", 5, ["magazine", "cinema"], true, (z, g) => {
    if (paysage(z)) {
      const [a, b] = colonnes(z, [3, 1], g);
      return [a, ...lignes(b, [1, 1, 1, 1], g)];
    }
    const [a, b] = lignes(z, [3, 1], g);
    return [a, ...colonnes(b, [1, 1, 1, 1], g)];
  }),
  decoupe("six-grille", "Six", 6, ["classique", "mosaique", "melange"], true, (z, g) => (z.l >= z.h ? grille(z, 3, 2, g) : grille(z, 2, 3, g))),
  decoupe("six-mosaique", "Mosaïque de six", 6, ["mosaique", "melange"], true, (z, g) => {
    const [a, b] = portrait(z) ? lignes(z, [1, 1], g) : colonnes(z, [1, 1], g);
    const decoupeA = portrait(z) ? colonnes(a, [2, 1, 1], g) : lignes(a, [2, 1, 1], g);
    const decoupeB = portrait(z) ? colonnes(b, [1, 1, 2], g) : lignes(b, [1, 1, 2], g);
    return [...decoupeA, ...decoupeB];
  }),
  photos("six-galerie", "Six photos entières, légendées", 6, ["galerie"], false, (c) => {
    const boites = c.z.l >= c.z.h ? grille(c.z, 3, 2, 6) : grille(c.z, 2, 3, 6);
    return { ...galerie(boites, 6), textes: [...galerie(boites, 6).textes, folio(c.z)] };
  }),
  decoupe("sept-mosaique", "Mosaïque de sept", 7, ["mosaique", "melange"], true, (z, g) => {
    const [a, b] = portrait(z) ? lignes(z, [3, 2], g) : colonnes(z, [3, 2], g);
    const [a1, a2] = portrait(z) ? colonnes(a, [2, 1], g) : lignes(a, [2, 1], g);
    return [a1, ...(portrait(z) ? lignes(a2, [1, 1], g) : colonnes(a2, [1, 1], g)), ...grille(b, 2, 2, g)];
  }),
  photos("huit-planche", "Planche-contact de huit", 8, ["cinema", "mosaique"], true, (c) => (paysage(c.z) ? planche(c, 4, 2) : planche(c, 2, 4))),
  decoupe("neuf-grille", "Neuf", 9, ["mosaique", "melange", "classique"], true, (z, g) => grille(z, 3, 3, g)),
  photos("neuf-planche", "Planche-contact de neuf", 9, ["cinema"], true, (c) => planche(c, 3, 3)),

  /* ------------------------------ Ouvertures d'épisode ------------------------------ */
  {
    id: "ouverture",
    nom: "Ouverture d’épisode",
    famille: "ouverture",
    n: 1,
    auto: true,
    ambiances: [],
    construire: (c) => {
      const [texte, photo] = lignes(c.z, [2, 3], c.g * 2);
      return {
        photos: [photo],
        textes: [
          { role: "surtitre", rect: { ...texte, h: 6 } },
          { role: "titre", rect: { x: texte.x, y: texte.y + 8, l: texte.l, h: 22 } },
          { role: "corps", rect: { x: texte.x, y: texte.y + 33, l: texte.l, h: Math.max(0, texte.h - 33) } },
          folio(c.z),
        ],
      };
    },
  },
  {
    id: "ouverture-pleine",
    nom: "Ouverture, titre sur la photo",
    famille: "ouverture",
    n: 1,
    auto: true,
    ambiances: [],
    construire: (c) => {
      const h = c.page.h * 0.46;
      const y = c.page.h - h;
      const t = { x: c.m.x, l: c.m.l };
      return {
        photos: [pleine(c)],
        formes: [{ teinte: "voile", opacite: 0.42, dessus: true, rect: { x: -c.b, y, l: c.page.l + 2 * c.b, h: h + c.b } }],
        textes: [
          { role: "surtitre", teinte: "clair", dessus: true, rect: { ...t, y: y + 10, h: 6 } },
          { role: "titre", teinte: "clair", dessus: true, rect: { ...t, y: y + 18, h: 24 } },
          { role: "corps", teinte: "clair", dessus: true, rect: { ...t, y: y + 45, h: Math.max(0, c.m.y + c.m.h - y - 45) } },
        ],
      };
    },
  },
  {
    id: "ouverture-cote",
    nom: "Ouverture, photo à fond perdu",
    famille: "ouverture",
    n: 1,
    auto: true,
    ambiances: [],
    construire: (c) => {
      const frac = paysage(c.z) ? 0.52 : 0.46;
      const t = interieur(c, c.z, frac, 10);
      const y = t.y + t.h * 0.18;
      return {
        photos: [exterieur(c, frac)],
        textes: [
          { role: "surtitre", rect: { x: t.x, y, l: t.l, h: 6 } },
          { role: "titre", rect: { x: t.x, y: y + 8, l: t.l, h: 34 } },
          { role: "corps", rect: { x: t.x, y: y + 46, l: t.l, h: Math.max(0, t.y + t.h - y - 46) } },
          { ...folio(t), droite: !c.droite, centre: false },
        ],
      };
    },
  },
  {
    id: "ouverture-galerie",
    nom: "Ouverture, photo entière",
    famille: "ouverture",
    n: 1,
    auto: true,
    ambiances: [],
    construire: (c) => {
      const [haut, bas] = lignes(c.z, [5, 4], c.g * 3);
      return {
        photos: [{ ...retrait(haut, 0.06), ajuste: "bas" }],
        textes: [
          { role: "surtitre", centre: true, rect: { ...bas, h: 6 } },
          { role: "titre", centre: true, rect: { x: bas.x, y: bas.y + 8, l: bas.l, h: 22 } },
          { role: "corps", rect: { x: bas.x + bas.l * 0.08, y: bas.y + 33, l: bas.l * 0.84, h: Math.max(0, bas.h - 33) } },
          folio(c.z),
        ],
      };
    },
  },
  {
    id: "ouverture-carnet",
    nom: "Ouverture, polaroïd",
    famille: "ouverture",
    n: 1,
    auto: true,
    ambiances: [],
    construire: (c) => {
      const [haut, bas] = lignes(c.z, [11, 9], c.g * 2);
      const p = polaroid(0, cadrer(retrait(haut, 0.06), 0.95), -2);
      return {
        photos: [p.photo],
        formes: p.formes,
        textes: [
          p.texte,
          { role: "surtitre", rect: { ...bas, y: bas.y + 2, h: 7 } },
          { role: "titre", rect: { x: bas.x, y: bas.y + 10, l: bas.l, h: 22 } },
          { role: "corps", rect: { x: bas.x, y: bas.y + 34, l: bas.l, h: Math.max(0, bas.h - 34) } },
          folio(c.z),
        ],
      };
    },
  },
  {
    id: "ouverture-texte",
    nom: "Ouverture, texte seul",
    famille: "ouverture",
    n: 0,
    auto: false,
    ambiances: [],
    construire: (c) => {
      const t = retrait(c.z, 0.1);
      return {
        photos: [],
        textes: [
          { role: "surtitre", rect: { x: t.x, y: t.y + t.h * 0.25, l: t.l, h: 6 } },
          { role: "titre", rect: { x: t.x, y: t.y + t.h * 0.25 + 8, l: t.l, h: 22 } },
          { role: "corps", rect: { x: t.x, y: t.y + t.h * 0.25 + 34, l: t.l, h: t.h * 0.75 - 34 } },
          folio(c.z),
        ],
      };
    },
  },

  /* ------------------------------ Textes ------------------------------ */
  {
    id: "texte",
    nom: "Texte",
    famille: "texte",
    n: 0,
    auto: false,
    ambiances: [],
    construire: (c) => {
      const t = retrait(c.z, 0.12);
      return {
        photos: [],
        textes: [
          { role: "titre", rect: { x: t.x, y: t.y, l: t.l, h: 16 } },
          { role: "corps", rect: { x: t.x, y: t.y + 20, l: t.l, h: t.h - 20 } },
          folio(c.z),
        ],
      };
    },
  },
  {
    id: "citation",
    nom: "Citation en grand",
    famille: "texte",
    n: 0,
    auto: false,
    ambiances: [],
    construire: (c) => {
      const t = retrait(c.z, 0.18);
      return {
        photos: [],
        formes: [{ teinte: "accent", rect: { x: t.x + t.l / 2 - 8, y: t.y + t.h * 0.2, l: 16, h: 0.6 } }],
        textes: [
          { role: "corps", centre: true, echelle: 1.7, rect: { x: t.x, y: t.y + t.h * 0.2 + 8, l: t.l, h: t.h * 0.55 } },
          { role: "titre", centre: true, echelle: 0.5, rect: { x: t.x, y: t.y + t.h * 0.78, l: t.l, h: 10 } },
          folio(c.z),
        ],
      };
    },
  },
  {
    id: "titre",
    nom: "Page de titre",
    famille: "titre",
    n: 0,
    auto: false,
    ambiances: [],
    construire: ({ z }) => ({
      photos: [],
      textes: [
        { role: "titre", rect: { x: z.x, y: z.y + z.h * 0.36, l: z.l, h: 26 }, centre: true },
        { role: "surtitre", rect: { x: z.x, y: z.y + z.h * 0.36 + 30, l: z.l, h: 6 }, centre: true },
      ],
    }),
  },
  {
    id: "titre-photo",
    nom: "Page de titre avec photo",
    famille: "titre",
    n: 1,
    auto: false,
    ambiances: [],
    construire: (c) => {
      const [haut, bas] = lignes(c.m, [3, 1], c.g * 3);
      return {
        photos: [{ ...retrait(haut, 0.08), ajuste: "bas" }],
        textes: [
          { role: "titre", centre: true, rect: { x: bas.x, y: bas.y + 2, l: bas.l, h: 26 } },
          { role: "surtitre", centre: true, rect: { x: bas.x, y: bas.y + 32, l: bas.l, h: 6 } },
        ],
      };
    },
  },
  {
    id: "vierge",
    nom: "Page blanche",
    famille: "vierge",
    n: 0,
    auto: false,
    ambiances: [],
    construire: () => ({ photos: [], textes: [] }),
  },
];

export function gabaritParId(id: string): Gabarit {
  return GABARITS.find((g) => g.id === id) ?? GABARITS.find((g) => g.id === "vierge")!;
}

/** Gabarits de photos d'une ambiance (mise en page automatique). */
export function gabaritsAmbiance(a: Ambiance | undefined): Gabarit[] {
  const id = a ?? "melange";
  return GABARITS.filter((g) => g.famille === "photos" && g.ambiances.includes(id));
}

export function contexte(f: Format, numero: number): Contexte {
  const m = marges(f, numero);
  return {
    z: zoneUtile(f, numero),
    m: { x: m.x, y: m.exterieur, l: m.l, h: f.hauteur - 2 * m.exterieur },
    page: { x: 0, y: 0, l: f.largeur, h: f.hauteur },
    b: f.fondPerdu,
    g: GOUTTIERE,
    droite: m.droite,
  };
}

/* --------------------------------------- Résolution --------------------------------------- */

const centreDe = (r: Rect) => ({ x: r.x + r.l / 2, y: r.y + r.h / 2 });

function ajuster(boite: Rect, ratio: number, a: Ajuste): Rect {
  if (boite.l / boite.h > ratio) {
    const l = boite.h * ratio;
    const x = a === "gauche" ? boite.x : a === "droite" ? boite.x + boite.l - l : boite.x + (boite.l - l) / 2;
    return { x, y: boite.y, l, h: boite.h };
  }
  const h = boite.l / ratio;
  const y = a === "haut" ? boite.y : a === "bas" ? boite.y + boite.h - h : boite.y + (boite.h - h) / 2;
  return { x: boite.x, y, l: boite.l, h };
}

/** Fait tourner `r` autour de `pivot` (son centre se déplace), et lui donne la rotation. */
function tourner<T extends { rect: Rect; rotation?: number }>(el: T, pivot: { x: number; y: number } | null, rotation: number | undefined): T {
  if (!rotation || !pivot) return el;
  const c = centreDe(el.rect);
  const a = (rotation * Math.PI) / 180;
  const dx = c.x - pivot.x;
  const dy = c.y - pivot.y;
  const nx = pivot.x + dx * Math.cos(a) - dy * Math.sin(a);
  const ny = pivot.y + dx * Math.sin(a) + dy * Math.cos(a);
  return { ...el, rect: { ...el.rect, x: nx - el.rect.l / 2, y: ny - el.rect.h / 2 }, rotation };
}

const VIDE: Rect = { x: 0, y: 0, l: 0, h: 0 };

/**
 * Plan → géométrie : ajuste les cadres aux proportions des photos (`ratios`, largeur / hauteur,
 * dans l'ordre des cadres), place ce qui est attaché aux photos et applique les rotations.
 */
function resoudre(plan: Plan, ratios?: readonly (number | null | undefined)[]): Geometrie {
  const ph: CadrePhoto[] = plan.photos.map(({ ajuste: a, ...p }, i) => {
    const r = ratios?.[i];
    return a && r && Number.isFinite(r) && r > 0 ? { ...ajuster(p, r, a), ...(p.rotation ? { rotation: p.rotation } : {}) } : p;
  });
  const formes: Forme[] = (plan.formes ?? []).map(({ autour, rect, ...f }) => {
    if (!autour) return { ...f, rect: rect ?? VIDE };
    const p = ph[autour.photo];
    if (!p) return { ...f, rect: VIDE };
    const [h, d, b, g] = autour.marge;
    const r = { x: p.x - g + (autour.dx ?? 0), y: p.y - h + (autour.dy ?? 0), l: p.l + g + d, h: p.h + h + b };
    return tourner({ ...f, rect: r }, centreDe(p), p.rotation);
  });
  const textes: CadreTexte[] = plan.textes.map(({ attache, rect, ...t }) => {
    if (!attache) return { ...t, rect: rect ?? VIDE };
    const p = ph[attache.photo];
    if (!p) return { ...t, rect: VIDE };
    const e = attache.ecart ?? 2;
    const r = attache.ou === "sous" ? { x: p.x, y: p.y + p.h + e, l: p.l, h: attache.h } : { x: p.x + 4, y: p.y + p.h - attache.h - e, l: p.l - 8, h: attache.h };
    return tourner({ ...t, rect: r }, centreDe(p), p.rotation);
  });
  return { photos: ph, textes, formes };
}

/**
 * Cadres d'une page d'un format donné. `numero` commence à 1 (page de droite).
 * `ratios` : proportions des photos posées (pour les cadres qui s'y ajustent).
 */
export function geometriePage(f: Format, gabaritId: string, numero: number, ratios?: readonly (number | null | undefined)[]): Geometrie {
  if (gabaritId === "couverture") return geometrieCouverture(f).premiere;
  if (gabaritId === "quatrieme") return geometrieCouverture(f).quatrieme;
  return resoudre(gabaritParId(gabaritId).construire(contexte(f, numero)), ratios);
}

/**
 * Couverture : première (photo et titre) et quatrième (texte). Le dos et la couverture
 * complète (rabats, fonds perdus) dépendent de l'imprimeur (voir feuilles.ts).
 */
export function geometrieCouverture(f: Format): { premiere: Geometrie; quatrieme: Geometrie } {
  const m = Math.max(16, f.largeur * 0.08);
  const hPhoto = (f.hauteur - 2 * m) * 0.7;
  return {
    premiere: {
      photos: [{ x: m, y: m, l: f.largeur - 2 * m, h: hPhoto }],
      textes: [
        { role: "titre", rect: { x: m, y: m + hPhoto + 10, l: f.largeur - 2 * m, h: 24 }, centre: true },
        { role: "surtitre", rect: { x: m, y: m + hPhoto + 36, l: f.largeur - 2 * m, h: 6 }, centre: true },
      ],
      formes: [],
    },
    quatrieme: {
      photos: [],
      textes: [{ role: "corps", rect: { x: m * 1.5, y: f.hauteur * 0.3, l: f.largeur - 3 * m, h: f.hauteur * 0.45 }, centre: true }],
      formes: [],
    },
  };
}

/** Texte d'un cadre de texte d'une page (légende de photo ou de page, numéro de page…). */
export function texteDuCadre(
  p: { titre?: string; surtitre?: string; corps?: string; legende?: string; cellules: ({ legende?: string } | null)[] },
  t: Pick<CadreTexte, "role" | "photo">,
  numero: number,
): string {
  switch (t.role) {
    case "titre":
      return p.titre ?? "";
    case "surtitre":
      return p.surtitre ?? "";
    case "corps":
      return p.corps ?? "";
    case "legende":
      return t.photo != null ? (p.cellules[t.photo]?.legende ?? "") : (p.legende ?? "");
    case "folio":
      return String(numero);
  }
}

/** Le gabarit met-il une légende sous chaque photo (plutôt qu'une légende de page) ? */
export function legendesParPhoto(gabaritId: string): boolean {
  const g = gabaritParId(gabaritId);
  if (!g.n) return false;
  const plan = g.construire(contexte({ largeur: 210, hauteur: 280, fondPerdu: 3, securite: 6, pli: 6 } as Format, 1));
  return plan.textes.some((t) => t.role === "legende" && t.photo != null);
}

/** Cadres qui s'ajustent aux proportions de leur photo (pas de recadrage). */
export function cadresAjustes(f: Format, gabaritId: string): boolean[] {
  return gabaritParId(gabaritId)
    .construire(contexte(f, 1))
    .photos.map((p) => !!p.ajuste);
}

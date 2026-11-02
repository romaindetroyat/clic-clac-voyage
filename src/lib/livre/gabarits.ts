/**
 * Gabarits de pages : des fonctions qui découpent la zone utile de n'importe quel format.
 * Changer de format ne casse donc jamais une page : ses cadres sont recalculés.
 * Toutes les mesures sont en millimètres, origine au coin haut gauche de la page rognée.
 */
import type { Format } from "./formats";

export type Rect = { x: number; y: number; l: number; h: number };
export type RoleTexte = "titre" | "surtitre" | "corps" | "legende" | "folio";
export type CadreTexte = { role: RoleTexte; rect: Rect; centre?: boolean };
export type Geometrie = { photos: Rect[]; textes: CadreTexte[] };

export type FamilleGabarit = "photos" | "ouverture" | "texte" | "titre" | "vierge";

export type Gabarit = {
  id: string;
  nom: string;
  famille: FamilleGabarit;
  /** Nombre de photos. */
  n: number;
  /** Utilisé par la mise en page automatique. */
  auto: boolean;
  construire: (zone: Rect, g: number, page: Rect, fondPerdu: number) => Geometrie;
};

export const GOUTTIERE = 4;

/** Marges (mm) : côté reliure plus large, bas plus haut pour la légende et le folio. */
export function zoneUtile(f: Format, numero: number): Rect {
  const exterieur = 12;
  const interieur = 12 + f.pli;
  const haut = 12;
  const bas = 20;
  // Page impaire = page de droite : la reliure est à gauche.
  const droite = numero % 2 === 1;
  const x = droite ? interieur : exterieur;
  return { x, y: haut, l: f.largeur - interieur - exterieur, h: f.hauteur - haut - bas };
}

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

/** Bande de légende sous la zone utile, et folio. */
function pied(z: Rect, page: Rect): CadreTexte[] {
  return [
    { role: "legende", rect: { x: z.x, y: z.y + z.h + 3, l: z.l, h: 7 } },
    { role: "folio", rect: { x: z.x, y: page.h - 9, l: z.l, h: 4 }, centre: true },
  ];
}

const photos = (id: string, nom: string, n: number, decoupe: (z: Rect, g: number) => Rect[]): Gabarit => ({
  id,
  nom,
  famille: "photos",
  n,
  auto: true,
  construire: (z, g, page) => ({ photos: decoupe(z, g), textes: pied(z, page) }),
});

export const GABARITS: Gabarit[] = [
  {
    id: "pleine-page",
    nom: "Pleine page",
    famille: "photos",
    n: 1,
    auto: true,
    construire: (_z, _g, page, b) => ({ photos: [{ x: -b, y: -b, l: page.l + 2 * b, h: page.h + 2 * b }], textes: [] }),
  },
  photos("une", "Une photo", 1, (z) => [z]),
  photos("une-aeree", "Une photo, aérée", 1, (z) => [retrait(z, 0.16)]),
  photos("deux-colonnes", "Deux côte à côte", 2, (z, g) => colonnes(z, [1, 1], g)),
  photos("deux-lignes", "Deux l’une sur l’autre", 2, (z, g) => lignes(z, [1, 1], g)),
  photos("deux-inegales", "Une grande, une petite", 2, (z, g) => colonnes(z, [2, 1], g)),
  photos("trois-colonnes", "Trois colonnes", 3, (z, g) => colonnes(z, [1, 1, 1], g)),
  photos("trois-lignes", "Trois bandeaux", 3, (z, g) => lignes(z, [1, 1, 1], g)),
  photos("trois-heros-gauche", "Une grande et deux", 3, (z, g) => {
    const [a, b] = colonnes(z, [2, 1], g);
    return [a, ...lignes(b, [1, 1], g)];
  }),
  photos("trois-heros-haut", "Une grande en haut et deux", 3, (z, g) => {
    const [a, b] = lignes(z, [3, 2], g);
    return [a, ...colonnes(b, [1, 1], g)];
  }),
  photos("quatre-grille", "Quatre", 4, (z, g) => grille(z, 2, 2, g)),
  photos("quatre-heros", "Une grande et trois", 4, (z, g) => {
    const [a, b] = lignes(z, [2, 1], g);
    return [a, ...colonnes(b, [1, 1, 1], g)];
  }),
  photos("cinq", "Cinq", 5, (z, g) => {
    const [a, b] = lignes(z, [1, 1], g);
    return [...colonnes(a, [1, 1], g), ...colonnes(b, [1, 1, 1], g)];
  }),
  photos("six-grille", "Six", 6, (z, g) => (z.l >= z.h ? grille(z, 3, 2, g) : grille(z, 2, 3, g))),
  photos("neuf-grille", "Neuf", 9, (z, g) => grille(z, 3, 3, g)),
  {
    id: "ouverture",
    nom: "Ouverture d’épisode",
    famille: "ouverture",
    n: 1,
    auto: true,
    construire: (z, g, page) => {
      const [texte, photo] = lignes(z, [2, 3], g * 2);
      return {
        photos: [photo],
        textes: [
          { role: "surtitre", rect: { ...texte, h: 6 } },
          { role: "titre", rect: { x: texte.x, y: texte.y + 8, l: texte.l, h: 22 } },
          { role: "corps", rect: { x: texte.x, y: texte.y + 33, l: texte.l, h: Math.max(0, texte.h - 33) } },
          ...pied(z, page).filter((t) => t.role === "folio"),
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
    construire: (z, _g, page) => {
      const t = retrait(z, 0.1);
      return {
        photos: [],
        textes: [
          { role: "surtitre", rect: { x: t.x, y: t.y + t.h * 0.25, l: t.l, h: 6 } },
          { role: "titre", rect: { x: t.x, y: t.y + t.h * 0.25 + 8, l: t.l, h: 22 } },
          { role: "corps", rect: { x: t.x, y: t.y + t.h * 0.25 + 34, l: t.l, h: t.h * 0.75 - 34 } },
          ...pied(z, page).filter((x) => x.role === "folio"),
        ],
      };
    },
  },
  {
    id: "texte",
    nom: "Texte",
    famille: "texte",
    n: 0,
    auto: false,
    construire: (z, _g, page) => {
      const t = retrait(z, 0.12);
      return {
        photos: [],
        textes: [
          { role: "titre", rect: { x: t.x, y: t.y, l: t.l, h: 16 } },
          { role: "corps", rect: { x: t.x, y: t.y + 20, l: t.l, h: t.h - 20 } },
          ...pied(z, page).filter((x) => x.role === "folio"),
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
    construire: (z) => ({
      photos: [],
      textes: [
        { role: "titre", rect: { x: z.x, y: z.y + z.h * 0.36, l: z.l, h: 26 }, centre: true },
        { role: "surtitre", rect: { x: z.x, y: z.y + z.h * 0.36 + 30, l: z.l, h: 6 }, centre: true },
      ],
    }),
  },
  {
    id: "vierge",
    nom: "Page blanche",
    famille: "vierge",
    n: 0,
    auto: false,
    construire: () => ({ photos: [], textes: [] }),
  },
];

export function gabaritParId(id: string): Gabarit {
  return GABARITS.find((g) => g.id === id) ?? GABARITS.find((g) => g.id === "vierge")!;
}

/** Cadres d'une page d'un format donné. `numero` commence à 1 (page de droite). */
export function geometriePage(f: Format, gabaritId: string, numero: number): Geometrie {
  if (gabaritId === "couverture") return geometrieCouverture(f).premiere;
  if (gabaritId === "quatrieme") return geometrieCouverture(f).quatrieme;
  const page = { x: 0, y: 0, l: f.largeur, h: f.hauteur };
  return gabaritParId(gabaritId).construire(zoneUtile(f, numero), GOUTTIERE, page, f.fondPerdu);
}

/**
 * Couverture : première (photo et titre) et quatrième (texte). Le dos et la couverture
 * complète (rabats, fonds perdus) dépendent de l'imprimeur et viennent en phase 6.
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
    },
    quatrieme: {
      photos: [],
      textes: [{ role: "corps", rect: { x: m * 1.5, y: f.hauteur * 0.3, l: f.largeur - 3 * m, h: f.hauteur * 0.45 }, centre: true }],
    },
  };
}

/**
 * Fiches imprimeurs : données versionnées dans le dépôt, chaque valeur avec sa source,
 * son statut et sa date de relevé. « V » = lu sur le site officiel, « S » = source
 * secondaire, « NV » = non vérifié (à confirmer avant de commander).
 */
export type Statut = "V" | "S" | "NV";
export type Devise = "EUR" | "USD" | "GBP";
export type Source = { statut: Statut; source?: string };

export type Prix = Source & {
  devise: Devise;
  /** Prix d'un exemplaire avec `pagesIncluses` pages. */
  base: number | null;
  pagesIncluses: number;
  /** Prix de chaque page (ou double page) au-delà. */
  parPageSup: number | null;
  parDoublePage?: boolean;
};

export type Produit = {
  id: string;
  nom: string;
  /** Page finie (rognée), en mm. */
  largeur: number;
  hauteur: number;
  reliure: "rigide" | "souple" | "a-plat";
  papier: string;
  pagesMin: number;
  pagesMax: number;
  pas: number;
  prix: Prix;
  /** Grammage et main du papier, pour la formule du dos. */
  grammage?: number;
  main?: number;
  /** Table du dos propre à ce produit (pages max → mm). */
  tableDos?: [number, number][];
};

export type Fichiers =
  /** Intérieur et couverture dans deux PDF. */
  | "separes"
  /** Un seul PDF : couverture étalée, puis l'intérieur (avec gardes vierges si demandé). */
  | "unique"
  /** Deux PDF, intérieur en planches (une page PDF = une double page). */
  | "doubles-pages"
  /** Un seul PDF en pages simples : 1re de couverture, intérieur, 4e de couverture (dos calculé par l'imprimeur). */
  | "unique-pages";

export type Technique = Source & {
  fondPerdu: number;
  fondPerduCouverture: number;
  /** Distance minimale d'un texte au bord rogné. */
  securite: number;
  /** Marge supplémentaire côté reliure. */
  securiteReliure: number;
  couleur: "sRGB" | "CMJN FOGRA39" | "CMJN GRACoL";
  normePdf: "libre" | "PDF/X-4" | "PDF/X-3" | "PDF 1.3";
  fichiers: Fichiers;
  /** PDF unique : gardes vierges après la couverture et à la fin (Gelato). */
  gardesVierges?: boolean;
  dos: "table" | "formule" | "gabarit" | "api";
  dosTitreMin: number;
  poidsMaxMo: number | null;
};

export type Imprimeur = {
  id: string;
  nom: string;
  pays: string;
  site: string;
  lienCommande: string;
  /** Peut-on commander depuis la France en déposant un PDF ? */
  pdfFrance: Source & { valeur: boolean | null };
  /**
   * Livraison en France : « oui » = la France se choisit à la commande ; « procedure » = possible
   * hors du tunnel de commande (service client) ; « non » = pas d'envoi en France.
   */
  livraisonFrance: Source & { valeur: "oui" | "procedure" | "non" | null; detail: string };
  /** Remises de quantité publiées. */
  remises?: Source & { texte: string };
  produits: Produit[];
  technique: Technique;
  port: Source & { devise: Devise; premier: number | null; suivant: number | null; francoDes: number | null; regle?: string };
  /** Jours ouvrés (borne haute). `total` quand l'imprimeur ne donne qu'un délai global. */
  delais: Source & { fabrication: number | null; livraison: number | null; total?: number | null };
  note: (Source & { valeur: number; avis: number; domaine: string }) | null;
  /** Commande par API (V2). */
  api: boolean;
  releve: string;
  remarques: string;
};

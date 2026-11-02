/**
 * Catalogue des imprimeurs retenus (recherche du 2 novembre 2026, voir
 * .planning/research/IMPRIMEURS.md, complétée le même jour par un second relevé). Valeurs « NV » = non vérifiées : le comparateur les
 * signale et ne les utilise pas comme des certitudes.
 */
import type { Imprimeur } from "./types";

const RELEVE = "2026-11-02";

const tableFotofabriekPlat: [number, number][] = [
  [28, 10], [42, 12], [52, 14], [66, 17], [82, 20], [90, 22], [100, 24], [114, 27], [128, 30], [140, 33],
];

const tableFotofabriek: [number, number][] = [
  [34, 6], [46, 7], [60, 8], [70, 9], [82, 10], [98, 11], [114, 12], [126, 13], [138, 14], [154, 15], [170, 16], [186, 17], [196, 18], [200, 19],
];

export const IMPRIMEURS: Imprimeur[] = [
  {
    id: "saal",
    nom: "Saal Digital",
    pays: "Allemagne",
    site: "https://www.saal-digital.fr/livre-photo/",
    lienCommande: "https://www.saal-digital.fr/livre-photo/",
    pdfFrance: { valeur: true, statut: "V", source: "https://www.saal-digital.com/service/professional-zone/create-your-files-in-indesign" },
    produits: [
      // Format fermé réel du « 21 × 28 » : 21,5 × 27,5 cm. Prix catalogue (une promotion à 19,99 € finissait le 2 novembre 2026).
      { id: "21x28", nom: "Livre photo 21 × 28 cm", largeur: 215, hauteur: 275, reliure: "a-plat", papier: "Papier photo Fujifilm 368 g/m²", pagesMin: 26, pagesMax: 160, pas: 2, prix: { devise: "EUR", base: 33.99, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "S", source: "https://www.saal-digital.eu/photo-book/21-x-28-photo-book" } },
      { id: "28x19", nom: "Livre photo 28 × 19 cm", largeur: 280, hauteur: 190, reliure: "a-plat", papier: "Papier photo Fujifilm 368 g/m²", pagesMin: 26, pagesMax: 160, pas: 2, prix: { devise: "EUR", base: 24.99, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "V", source: "https://www.saal-digital.fr/livre-photo/" } },
      { id: "19x19", nom: "Livre photo 19 × 19 cm", largeur: 190, hauteur: 190, reliure: "a-plat", papier: "Papier photo Fujifilm 368 g/m²", pagesMin: 26, pagesMax: 160, pas: 2, prix: { devise: "EUR", base: 14.99, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "V", source: "https://www.saal-digital.fr/livre-photo/" } },
      { id: "28x28", nom: "Livre photo 28 × 28 cm", largeur: 280, hauteur: 280, reliure: "a-plat", papier: "Papier photo Fujifilm 368 g/m²", pagesMin: 26, pagesMax: 160, pas: 2, prix: { devise: "EUR", base: 34.99, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "V", source: "https://www.saal-digital.fr/livre-photo/" } },
      { id: "pro-30x30", nom: "Professional Line 30 × 30 cm", largeur: 300, hauteur: 300, reliure: "a-plat", papier: "Papier photo", pagesMin: 26, pagesMax: 160, pas: 2, prix: { devise: "EUR", base: 75.49, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "V", source: "https://www.saal-digital.fr/livre-photo/" } },
    ],
    technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 10, securiteReliure: 6, couleur: "sRGB", normePdf: "libre", fichiers: "doubles-pages", dos: "gabarit", dosTitreMin: 6, poidsMaxMo: null, statut: "S", source: "https://www.saal-digital.com/service/professional-zone/create-your-files-in-indesign" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV", regle: "Affiché seulement dans le panier." },
    delais: { fabrication: 2, livraison: null, statut: "V", source: "https://www.saal-digital.eu/photo-book/21-x-28-photo-book" },
    note: { valeur: 4.4, avis: 5076, domaine: "saal-digital.fr", statut: "V", source: "https://uk.trustpilot.com/review/www.saal-digital.fr" },
    api: false,
    releve: RELEVE,
    remarques: "Reliure à plat et papier photo sur toute la gamme ; Professional Line haut de gamme. Intérieur attendu en doubles pages. Prix par page supplémentaire et port : configurateur seulement. Fond perdu donné par les gabarits (3 mm supposés).",
  },

  {
    id: "blurb",
    nom: "Blurb",
    pays: "États-Unis",
    site: "https://www.blurb.fr/photo-books",
    lienCommande: "https://www.blurb.fr/pdf-to-book",
    pdfFrance: { valeur: true, statut: "V", source: "https://www.blurb.com/pdf-to-book" },
    produits: [
      { id: "20x25", nom: "Portrait 20 × 25 cm, rigide imprimée, papier Standard", largeur: 203, hauteur: 254, reliure: "rigide", papier: "Standard demi-mat 118 g/m²", pagesMin: 20, pagesMax: 440, pas: 2, grammage: 118, main: 1, prix: { devise: "EUR", base: 38.4, pagesIncluses: 20, parPageSup: 0.48, statut: "V", source: "https://www.blurb.fr/pricing" } },
      { id: "20x25-premium", nom: "Portrait 20 × 25 cm, rigide imprimée, papier Premium", largeur: 203, hauteur: 254, reliure: "rigide", papier: "Premium satiné ou mat 148 g/m²", pagesMin: 20, pagesMax: 240, pas: 2, grammage: 148, main: 0.95, prix: { devise: "EUR", base: 44.4, pagesIncluses: 20, parPageSup: 0.54, statut: "V", source: "https://www.blurb.fr/pricing" } },
      { id: "25x20", nom: "Paysage 25 × 20 cm, rigide imprimée, papier Standard", largeur: 254, hauteur: 203, reliure: "rigide", papier: "Standard demi-mat 118 g/m²", pagesMin: 20, pagesMax: 440, pas: 2, grammage: 118, main: 1, prix: { devise: "EUR", base: 38.4, pagesIncluses: 20, parPageSup: 0.48, statut: "V", source: "https://www.blurb.fr/pricing" } },
      { id: "30x30", nom: "Carré 30 × 30 cm, rigide imprimée, papier Standard", largeur: 305, hauteur: 305, reliure: "rigide", papier: "Standard demi-mat 118 g/m²", pagesMin: 20, pagesMax: 440, pas: 2, grammage: 118, main: 1, prix: { devise: "EUR", base: 61.2, pagesIncluses: 20, parPageSup: 0.64, statut: "V", source: "https://www.blurb.fr/pricing" } },
    ],
    technique: { fondPerdu: 3.2, fondPerduCouverture: 3.2, securite: 6.4, securiteReliure: 6.4, couleur: "sRGB", normePdf: "PDF/X-3", fichiers: "separes", dos: "gabarit", dosTitreMin: 6, poidsMaxMo: null, statut: "S", source: "https://community.adobe.com/t5/lightroom-classic-discussions/how-to-quot-export-book-to-pdf-quot-with-quot-bleed-quot/m-p/9570750/highlight/true" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV", source: "https://www.blurb.fr/shipping", regle: "Calculateur d’expédition seulement." },
    delais: { fabrication: 5, livraison: null, statut: "V", source: "https://www.blurb.fr/shipping" },
    note: { valeur: 2.3, avis: 892, domaine: "blurb.co.uk", statut: "V", source: "https://www.trustpilot.com/review/blurb.co.uk" },
    api: false,
    releve: RELEVE,
    remarques: "Prix en euros publiés (20 pages incluses, déduit du minimum). Reliure à plat de 20 à 110 pages, nettement plus chère. Note Trustpilot faible.",
  },

  {
    id: "fotofabriek",
    nom: "Fotofabriek",
    pays: "Pays-Bas",
    site: "https://www.fotofabriek.nl/fotoboek",
    lienCommande: "https://www.fotofabriek.nl/fotoboek",
    pdfFrance: { valeur: null, statut: "NV", source: "https://www.fotofabriek.nl/levertijden" },
    produits: [
      { id: "a4-portrait", nom: "Fotoboek A4 portrait, rigide", largeur: 210, hauteur: 297, reliure: "rigide", papier: "Standard, mat ou haute brillance", pagesMin: 24, pagesMax: 200, pas: 2, tableDos: tableFotofabriek, prix: { devise: "EUR", base: 29.99, pagesIncluses: 24, parPageSup: null, statut: "V", source: "https://www.fotofabriek.nl/fotoboek" } },
      { id: "a4-paysage", nom: "Fotoboek A4 paysage, rigide", largeur: 297, hauteur: 210, reliure: "rigide", papier: "Standard, mat ou haute brillance", pagesMin: 24, pagesMax: 200, pas: 2, tableDos: tableFotofabriek, prix: { devise: "EUR", base: 29.99, pagesIncluses: 24, parPageSup: null, statut: "V", source: "https://www.fotofabriek.nl/fotoboek" } },
      { id: "a4-plat", nom: "Fotoboek A4 à plat (vlakliggend)", largeur: 210, hauteur: 297, reliure: "a-plat", papier: "Papier photo", pagesMin: 24, pagesMax: 140, pas: 2, tableDos: tableFotofabriekPlat, prix: { devise: "EUR", base: 35.99, pagesIncluses: 24, parPageSup: null, statut: "V", source: "https://www.fotofabriek.nl/fotoboek" } },
    ],
    technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 6, securiteReliure: 10, couleur: "sRGB", normePdf: "libre", fichiers: "separes", dos: "table", dosTitreMin: 6, poidsMaxMo: null, statut: "S", source: "https://www.fotofabriek.nl/faq/rugdiktes" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV", source: "https://www.fotofabriek.nl/verzendtarieven", regle: "Tarifs publiés pour les Pays-Bas et la Belgique ; étranger sur demande au service client." },
    delais: { fabrication: null, livraison: null, statut: "NV", source: "https://www.fotofabriek.nl/levertijden" },
    note: { valeur: 4.5, avis: 1393, domaine: "fotofabriek.nl", statut: "V", source: "https://www.trustpilot.com/review/fotofabriek.nl" },
    api: false,
    releve: RELEVE,
    remarques: "Table de dos officielle. Site en néerlandais ; envoi en France sur demande au service client (tarif et délai non publiés). Prix de base sans le nombre de pages inclus (24 supposé).",
  },

  {
    id: "pixartprinting",
    nom: "Pixartprinting",
    pays: "Italie",
    site: "https://www.pixartprinting.fr/",
    lienCommande: "https://www.pixartprinting.fr/impression-revues-catalogues-livres/finition-couverture-rigide/",
    pdfFrance: { valeur: true, statut: "S", source: "https://www.pixartprinting.fr/blog/impression-livres-photo/" },
    produits: [
      { id: "a4-portrait", nom: "Livre couverture rigide A4", largeur: 210, hauteur: 297, reliure: "rigide", papier: "Classic demi-mat 170 g/m²", pagesMin: 24, pagesMax: 200, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "21x21", nom: "Livre couverture rigide 21 × 21 cm", largeur: 210, hauteur: 210, reliure: "rigide", papier: "Classic demi-mat 170 g/m²", pagesMin: 24, pagesMax: 200, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "30x30", nom: "Livre couverture rigide 30 × 30 cm", largeur: 300, hauteur: 300, reliure: "rigide", papier: "Classic demi-mat 170 g/m²", pagesMin: 24, pagesMax: 200, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "a4-paysage", nom: "Livre couverture rigide A4 paysage", largeur: 297, hauteur: 210, reliure: "rigide", papier: "Classic demi-mat 170 g/m²", pagesMin: 24, pagesMax: 200, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
    ],
    technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 5, securiteReliure: 15, couleur: "CMJN FOGRA39", normePdf: "PDF/X-4", fichiers: "unique", dos: "gabarit", dosTitreMin: 6, poidsMaxMo: null, statut: "S", source: "https://www.pixartprinting.fr/blog/impression-livres-photo/" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: null, livraison: null, statut: "S", source: "https://ebuyclub.com/avis/pixartprinting-7392" },
    note: { valeur: 4.4, avis: 3398, domaine: "pixartprinting.fr", statut: "V", source: "https://ca.trustpilot.com/review/pixartprinting.fr" },
    api: false,
    releve: RELEVE,
    remarques: "Formats publiés (A4, A5, 21 × 21, 16,5 × 24, 30 × 30 cm, format personnalisé) ; prix, pages et port dans le configurateur seulement. Fichiers attendus en CMJN FOGRA39, avec contrôle gratuit du fichier.",
  },

  {
    id: "cewe",
    nom: "CEWE",
    pays: "Allemagne",
    site: "https://www.cewe.fr/",
    lienCommande: "https://cewe.co.uk/pdf-to-photobook.html",
    pdfFrance: { valeur: false, statut: "S", source: "https://cewe.co.uk/pdf-to-photobook.html" },
    produits: [
      { id: "21x28", nom: "Livre photo 21 × 28 cm", largeur: 210, hauteur: 280, reliure: "rigide", papier: "Impression numérique", pagesMin: 26, pagesMax: 178, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 26, parPageSup: null, statut: "NV" } },
      { id: "30x30", nom: "Livre photo 30 × 30 cm", largeur: 300, hauteur: 300, reliure: "rigide", papier: "Impression numérique", pagesMin: 26, pagesMax: 178, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 26, parPageSup: null, statut: "NV" } },
    ],
    technique: { fondPerdu: 3, fondPerduCouverture: 10, securite: 6, securiteReliure: 6, couleur: "sRGB", normePdf: "PDF 1.3", fichiers: "separes", dos: "gabarit", dosTitreMin: 6, poidsMaxMo: null, statut: "S", source: "https://cdn.cewe.co.uk/downloads/user-guide.pdf" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: null, livraison: null, statut: "NV" },
    note: { valeur: 4.5, avis: 129829, domaine: "cewe.fr", statut: "V", source: "https://www.trustpilot.com/review/www.cewe.fr" },
    api: false,
    releve: RELEVE,
    remarques: "Aucun dépôt de PDF trouvé sur cewe.fr (seulement « PDF to Book » sur CEWE Royaume-Uni) : en France, CEWE impose son logiciel. À revoir si contact@cewe.fr confirme le contraire.",
  },

  {
    id: "lulu",
    nom: "Lulu",
    pays: "États-Unis",
    site: "https://www.lulu.com/fr/",
    lienCommande: "https://www.lulu.com/fr/pricing",
    pdfFrance: { valeur: true, statut: "V", source: "https://help.api.lulu.com/en/support/solutions/articles/64000254609-pdf-creation-settings" },
    produits: [
      { id: "11x8.5", nom: "Livre photo 11 × 8,5 pouces paysage, rigide", largeur: 279, hauteur: 216, reliure: "rigide", papier: "Couché blanc 80# Premium Color", pagesMin: 24, pagesMax: 240, pas: 2, prix: { devise: "USD", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "8.5x8.5", nom: "Livre photo 8,5 × 8,5 pouces carré, rigide", largeur: 216, hauteur: 216, reliure: "rigide", papier: "Couché blanc 80# Premium Color", pagesMin: 24, pagesMax: 240, pas: 2, prix: { devise: "USD", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
    ],
    technique: { fondPerdu: 3.2, fondPerduCouverture: 3.2, securite: 12.7, securiteReliure: 5.1, couleur: "sRGB", normePdf: "libre", fichiers: "separes", dos: "api", dosTitreMin: 6, poidsMaxMo: null, statut: "V", source: "https://help.api.lulu.com/en/support/solutions/articles/64000254609-pdf-creation-settings" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: null, livraison: null, statut: "NV" },
    note: { valeur: 4.5, avis: 6547, domaine: "lulu.com", statut: "V", source: "https://www.trustpilot.com/review/lulu.com" },
    api: true,
    releve: RELEVE,
    remarques: "Pas de livre photo portrait. Prix, pages et port : calculateur ou API seulement. Couverture rigide : 19 mm de sécurité. Commande possible par API (V2).",
  },

  {
    id: "gelato",
    nom: "Gelato",
    pays: "Norvège",
    site: "https://www.gelato.com/photo-books",
    lienCommande: "https://www.gelato.com/photo-books",
    pdfFrance: { valeur: true, statut: "V", source: "https://support.gelato.com/en/articles/8996282-how-do-i-design-a-photo-book" },
    produits: [
      { id: "8x11", nom: "Livre photo rigide 8 × 11 pouces", largeur: 203, hauteur: 279, reliure: "rigide", papier: "Standard", pagesMin: 30, pagesMax: 200, pas: 2, prix: { devise: "EUR", base: null, pagesIncluses: 30, parPageSup: null, statut: "NV" } },
      { id: "11x8", nom: "Livre photo rigide 11 × 8 pouces", largeur: 279, hauteur: 203, reliure: "rigide", papier: "Standard", pagesMin: 30, pagesMax: 200, pas: 2, prix: { devise: "EUR", base: null, pagesIncluses: 30, parPageSup: null, statut: "NV" } },
      { id: "11x11", nom: "Livre photo rigide 11 × 11 pouces", largeur: 279, hauteur: 279, reliure: "rigide", papier: "Standard", pagesMin: 30, pagesMax: 200, pas: 2, prix: { devise: "EUR", base: null, pagesIncluses: 30, parPageSup: null, statut: "NV" } },
    ],
    technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 10, securiteReliure: 6, couleur: "sRGB", normePdf: "libre", fichiers: "unique", gardesVierges: true, dos: "gabarit", dosTitreMin: 6, poidsMaxMo: null, statut: "NV", source: "https://support.gelato.com/en/articles/8996282-how-do-i-design-a-photo-book" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: null, livraison: null, statut: "NV" },
    note: { valeur: 4.2, avis: 3443, domaine: "gelato.com", statut: "V", source: "https://www.trustpilot.com/review/gelato.com" },
    api: true,
    releve: RELEVE,
    remarques: "Un seul PDF : couverture étalée, garde vierge, intérieur, garde vierge. Prix et port dans le tableau de bord connecté seulement. Commande possible par API (V2).",
  },

  {
    id: "prodigi",
    nom: "Prodigi",
    pays: "Royaume-Uni",
    site: "https://www.prodigi.com/",
    lienCommande: "https://www.prodigi.com/",
    pdfFrance: { valeur: true, statut: "S", source: "https://www.prodigi.com/blog/photo-books-now-available/" },
    produits: [
      { id: "a4-portrait", nom: "Livre rigide A4 portrait", largeur: 210, hauteur: 297, reliure: "rigide", papier: "Brillant 150 ou 200 g/m²", pagesMin: 24, pagesMax: 300, pas: 2, prix: { devise: "GBP", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "a4-paysage", nom: "Livre rigide A4 paysage", largeur: 297, hauteur: 210, reliure: "rigide", papier: "Brillant 150 ou 200 g/m²", pagesMin: 24, pagesMax: 300, pas: 2, prix: { devise: "GBP", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "21x21", nom: "Livre rigide 21 × 21 cm", largeur: 210, hauteur: 210, reliure: "rigide", papier: "Brillant 150 ou 200 g/m²", pagesMin: 24, pagesMax: 300, pas: 2, prix: { devise: "GBP", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
    ],
    // Pas de fond perdu : Prodigi l'ajoute lui-même.
    technique: { fondPerdu: 0, fondPerduCouverture: 0, securite: 10, securiteReliure: 6, couleur: "sRGB", normePdf: "PDF/X-4", fichiers: "unique-pages", dos: "api", dosTitreMin: 6, poidsMaxMo: null, statut: "V", source: "https://www.prodigi.com/blog/photo-books-technical-guide/" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: 5, livraison: null, statut: "V", source: "https://www.prodigi.com/blog/photo-books-technical-guide/" },
    note: { valeur: 4.0, avis: 146, domaine: "prodigi.com", statut: "V", source: "https://au.trustpilot.com/review/prodigi.com" },
    api: true,
    releve: RELEVE,
    remarques: "A repris les livres photo de Peecho. Un seul PDF en pages simples (1re de couverture, intérieur, 4e), sans fond perdu ; dos calculé par Prodigi. Production en Europe possible. Prix et port : outil connecté seulement.",
  },

];

export function imprimeurParId(id: string): Imprimeur | undefined {
  return IMPRIMEURS.find((i) => i.id === id);
}

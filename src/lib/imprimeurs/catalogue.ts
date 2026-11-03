/**
 * Catalogue des imprimeurs retenus (recherche du 2 novembre 2026, revérifiée site par site le
 * 3 novembre 2026 : voir .planning/research/IMPRIMEURS.md). Valeurs « NV » = non vérifiées :
 * le comparateur les signale et ne les utilise pas comme des certitudes.
 */
import type { Imprimeur } from "./types";

const RELEVE = "2026-11-03";

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
    pdfFrance: { valeur: true, statut: "V", source: "https://www.saal-digital.fr/service/infos-pro/telechargez-votre-pdf-dans-la-boutique-en-ligne/" },
    livraisonFrance: { valeur: "oui", detail: "Envoi depuis l’Allemagne (intra-UE, sans douane) : Colis Privé en standard, DHL en express.", statut: "V", source: "https://www.saal-digital.fr/service/frais-dexpedition-delai-de-livraison/" },
    produits: [
      // Format fermé réel du « 21 × 28 » : 21,5 × 27,5 cm. Prix catalogue (promotion à 22,99 € jusqu'au 9 novembre 2026).
      { id: "21x28", nom: "Livre photo 21 × 28 cm", largeur: 215, hauteur: 275, reliure: "a-plat", papier: "Papier photo Fujifilm 368 g/m²", pagesMin: 26, pagesMax: 160, pas: 2, prix: { devise: "EUR", base: 33.99, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "V", source: "https://www.saal-digital.fr/album-photo/album-photo-21-x-28/" } },
      { id: "28x19", nom: "Livre photo 28 × 19 cm", largeur: 280, hauteur: 190, reliure: "a-plat", papier: "Papier photo Fujifilm 368 g/m²", pagesMin: 26, pagesMax: 160, pas: 2, prix: { devise: "EUR", base: 19.99, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "V", source: "https://www.saal-digital.fr/livre-photo/" } },
      { id: "19x19", nom: "Livre photo 19 × 19 cm", largeur: 190, hauteur: 190, reliure: "a-plat", papier: "Papier photo Fujifilm 368 g/m²", pagesMin: 26, pagesMax: 160, pas: 2, prix: { devise: "EUR", base: 16.99, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "V", source: "https://www.saal-digital.fr/livre-photo/" } },
      { id: "28x28", nom: "Livre photo 28 × 28 cm", largeur: 280, hauteur: 280, reliure: "a-plat", papier: "Papier photo Fujifilm 368 g/m²", pagesMin: 26, pagesMax: 160, pas: 2, prix: { devise: "EUR", base: 29.99, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "V", source: "https://www.saal-digital.fr/livre-photo/" } },
      { id: "pro-30x30", nom: "Professional Line 30 × 30 cm", largeur: 300, hauteur: 300, reliure: "a-plat", papier: "Papier photo", pagesMin: 26, pagesMax: 130, pas: 2, prix: { devise: "EUR", base: 99.99, pagesIncluses: 26, parPageSup: null, parDoublePage: true, statut: "V", source: "https://www.saal-digital.fr/album-photo/album-photo-30-x-30-professional-line/" } },
    ],
    technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 10, securiteReliure: 6, couleur: "sRGB", normePdf: "libre", fichiers: "doubles-pages", dos: "gabarit", dosTitreMin: 6, poidsMaxMo: null, statut: "S", source: "https://www.saal-digital.com/service/professional-zone/create-your-files-in-indesign" },
    // 5,99 € par envoi selon un test d'octobre 2025 ; compté par exemplaire faute de mieux (estimation prudente).
    port: { devise: "EUR", premier: 5.99, suivant: null, francoDes: null, statut: "S", source: "https://virusphoto.com/test-complet-saal-digital-livre-photo-grand-format-avis-detaille/", regle: "5,99 € en standard « quel que soit le format » selon un test ; montant exact au panier" },
    delais: { fabrication: 2, livraison: 5, statut: "V", source: "https://www.saal-digital.fr/service/frais-dexpedition-delai-de-livraison/" },
    note: { valeur: 4.4, avis: 5077, domaine: "saal-digital.fr", statut: "V", source: "https://fr.trustpilot.com/review/www.saal-digital.fr" },
    api: false,
    releve: RELEVE,
    remises: { texte: "Professional Line : −20 % dès 26 pages, −25 % dès 70, −30 % dès 100.", statut: "V", source: "https://www.saal-digital.fr/album-photo/album-photo-30-x-30-professional-line/" },
    remarques: "Reliure à plat et papier photo Fujifilm sur toute la gamme. Dépôt du PDF dans la boutique (« Concevoir » puis « PDF Upload ») : couverture et intérieur en doubles pages, sRGB, sans traits de coupe. Fabrication 1 à 2 jours (Professional Line 2 à 3), livraison 4 à 5 jours ouvrés (express 1 à 2). Prix de la double page supplémentaire : configurateur seulement. Fond perdu donné par les gabarits (3 mm supposés).",
  },

  {
    id: "blurb",
    nom: "Blurb",
    pays: "États-Unis",
    site: "https://www.blurb.fr/photo-books",
    lienCommande: "https://www.blurb.fr/pdf-to-book",
    pdfFrance: { valeur: true, statut: "V", source: "https://support.blurb.com/hc/en-us/articles/207792946" },
    livraisonFrance: { valeur: "oui", detail: "Livres photo imprimés dans l’UE : pas de douane, TVA collectée par Blurb. Les Layflat (sauf Premium Lustre) viennent des États-Unis : droits de douane possibles à la livraison.", statut: "V", source: "https://support.blurb.com/hc/en-us/articles/207794426" },
    produits: [
      { id: "20x25", nom: "Portrait 20 × 25 cm, rigide imprimée, papier Standard", largeur: 203, hauteur: 254, reliure: "rigide", papier: "Standard demi-mat 118 g/m²", pagesMin: 20, pagesMax: 440, pas: 2, grammage: 118, main: 1, prix: { devise: "EUR", base: 38.4, pagesIncluses: 20, parPageSup: 0.48, statut: "V", source: "https://www.blurb.fr/pricing" } },
      { id: "20x25-premium", nom: "Portrait 20 × 25 cm, rigide imprimée, papier Premium", largeur: 203, hauteur: 254, reliure: "rigide", papier: "Premium satiné ou mat 148 g/m²", pagesMin: 20, pagesMax: 240, pas: 2, grammage: 148, main: 0.95, prix: { devise: "EUR", base: 44.4, pagesIncluses: 20, parPageSup: 0.54, statut: "V", source: "https://www.blurb.fr/pricing" } },
      { id: "25x20", nom: "Paysage 25 × 20 cm, rigide imprimée, papier Standard", largeur: 254, hauteur: 203, reliure: "rigide", papier: "Standard demi-mat 118 g/m²", pagesMin: 20, pagesMax: 440, pas: 2, grammage: 118, main: 1, prix: { devise: "EUR", base: 38.4, pagesIncluses: 20, parPageSup: 0.48, statut: "V", source: "https://www.blurb.fr/pricing" } },
      { id: "30x30", nom: "Carré 30 × 30 cm, rigide imprimée, papier Standard", largeur: 305, hauteur: 305, reliure: "rigide", papier: "Standard demi-mat 118 g/m²", pagesMin: 20, pagesMax: 440, pas: 2, grammage: 118, main: 1, prix: { devise: "EUR", base: 61.2, pagesIncluses: 20, parPageSup: 0.64, statut: "V", source: "https://www.blurb.fr/pricing" } },
      { id: "30x30-premium", nom: "Carré 30 × 30 cm, rigide imprimée, papier Premium", largeur: 305, hauteur: 305, reliure: "rigide", papier: "Premium satiné ou mat 148 g/m²", pagesMin: 20, pagesMax: 240, pas: 2, grammage: 148, main: 0.95, prix: { devise: "EUR", base: 72, pagesIncluses: 20, parPageSup: 0.72, statut: "V", source: "https://www.blurb.fr/pricing" } },
      { id: "20x25-layflat", nom: "Portrait 20 × 25 cm, Layflat (à plat)", largeur: 203, hauteur: 254, reliure: "a-plat", papier: "Papier photo Layflat", pagesMin: 20, pagesMax: 110, pas: 2, prix: { devise: "EUR", base: 116.57, pagesIncluses: 20, parPageSup: 3.74, statut: "V", source: "https://www.blurb.fr/pricing" } },
      { id: "30x30-layflat", nom: "Carré 30 × 30 cm, Layflat (à plat)", largeur: 305, hauteur: 305, reliure: "a-plat", papier: "Papier photo Layflat", pagesMin: 20, pagesMax: 110, pas: 2, prix: { devise: "EUR", base: 159.35, pagesIncluses: 20, parPageSup: 4.81, statut: "V", source: "https://www.blurb.fr/pricing" } },
    ],
    // CMJN recommandé, sRGB accepté ; aucune norme PDF/X imposée. Pages jusqu'à 2 Go, couverture 90 Mo.
    technique: { fondPerdu: 3.2, fondPerduCouverture: 3.2, securite: 6.35, securiteReliure: 6.35, couleur: "sRGB", normePdf: "libre", fichiers: "separes", dos: "gabarit", dosTitreMin: 6, poidsMaxMo: 2048, statut: "V", source: "https://support.blurb.com/hc/en-us/articles/207792946" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV", source: "https://www.blurb.fr/shipping", regle: "Calculateur d’expédition seulement." },
    delais: { fabrication: 5, livraison: null, statut: "V", source: "https://www.blurb.fr/shipping" },
    note: { valeur: 2.3, avis: 194, domaine: "blurb.fr", statut: "V", source: "https://fr.trustpilot.com/review/blurb.fr" },
    api: false,
    releve: RELEVE,
    remises: { texte: "Livres photo : −20 % de 10 à 49 exemplaires, −25 % de 50 à 99.", statut: "V", source: "https://support.blurb.com/hc/en-us/articles/207813766" },
    remarques: "« PDF to Book » : pages simples, couverture à part (ou un seul PDF), CMJN recommandé mais sRGB accepté, sans traits de coupe. Prix TTC publiés en euros (20 pages incluses, déduit du minimum). Fabrication 4 à 5 jours ouvrés, sans accélération possible. Note Trustpilot faible (2,3 / 5 en France comme au Royaume-Uni).",
  },

  {
    id: "fotofabriek",
    nom: "Fotofabriek",
    pays: "Pays-Bas",
    site: "https://www.fotofabriek.nl/fotoboek",
    lienCommande: "https://www.fotofabriek.nl/fotoboek",
    pdfFrance: { valeur: true, statut: "V", source: "https://www.fotofabriek.nl/faq/bestellen-via-pdf-uploader/" },
    livraisonFrance: { valeur: "procedure", detail: "La France ne se choisit pas à la commande : commander en « retrait chez Fotofabriek », écrire au service client par chat avec le numéro de commande, puis payer le port PostNL qu’il calcule (montant et délai non publiés).", statut: "V", source: "https://www.fotofabriek.nl/faq/pakketje-naar-buitenland/" },
    produits: [
      { id: "a4-portrait", nom: "Fotoboek A4 portrait, rigide", largeur: 210, hauteur: 297, reliure: "rigide", papier: "Standard, mat ou haute brillance", pagesMin: 24, pagesMax: 200, pas: 2, tableDos: tableFotofabriek, prix: { devise: "EUR", base: 29.99, pagesIncluses: 24, parPageSup: 0.65, statut: "V", source: "https://www.fotofabriek.nl/prijslijst/" } },
      { id: "a4-paysage", nom: "Fotoboek A4 paysage, rigide", largeur: 297, hauteur: 210, reliure: "rigide", papier: "Standard, mat ou haute brillance", pagesMin: 24, pagesMax: 200, pas: 2, tableDos: tableFotofabriek, prix: { devise: "EUR", base: 29.99, pagesIncluses: 24, parPageSup: 0.65, statut: "V", source: "https://www.fotofabriek.nl/prijslijst/" } },
      { id: "a4-plat", nom: "Fotoboek A4 à plat (vlakliggend)", largeur: 210, hauteur: 297, reliure: "a-plat", papier: "Papier photo 380 g/m²", pagesMin: 24, pagesMax: 140, pas: 2, tableDos: tableFotofabriekPlat, prix: { devise: "EUR", base: 35.99, pagesIncluses: 24, parPageSup: 0.9, statut: "V", source: "https://www.fotofabriek.nl/prijslijst/" } },
      { id: "30x30", nom: "Fotoboek 30 × 30 cm, rigide", largeur: 300, hauteur: 300, reliure: "rigide", papier: "Standard, mat ou haute brillance", pagesMin: 24, pagesMax: 200, pas: 2, tableDos: tableFotofabriek, prix: { devise: "EUR", base: 44.99, pagesIncluses: 24, parPageSup: 1.1, statut: "V", source: "https://www.fotofabriek.nl/prijslijst/" } },
      { id: "30x30-plat", nom: "Fotoboek 30 × 30 cm à plat (vlakliggend)", largeur: 300, hauteur: 300, reliure: "a-plat", papier: "Papier photo 380 g/m²", pagesMin: 24, pagesMax: 140, pas: 2, tableDos: tableFotofabriekPlat, prix: { devise: "EUR", base: 54.99, pagesIncluses: 24, parPageSup: 1.4, statut: "V", source: "https://www.fotofabriek.nl/prijslijst/" } },
    ],
    // Textes à 20 mm au moins de la ligne de fond perdu ; charnière de 10 mm de part et d'autre du dos.
    technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 20, securiteReliure: 10, couleur: "sRGB", normePdf: "libre", fichiers: "separes", dos: "table", dosTitreMin: 6, poidsMaxMo: null, statut: "V", source: "https://www.fotofabriek.nl/faq/bestellen-via-pdf-uploader/" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV", source: "https://www.fotofabriek.nl/verzendtarieven", regle: "Pays-Bas et Belgique : 5,45 € (A4) ou 6,45 € (30 × 30 et à plat), gratuit dès 50 € ; France au tarif PostNL, sur demande" },
    delais: { fabrication: null, livraison: null, statut: "NV", source: "https://www.fotofabriek.nl/levertijden" },
    note: { valeur: 4.5, avis: 1393, domaine: "fotofabriek.nl", statut: "V", source: "https://www.trustpilot.com/review/fotofabriek.nl" },
    api: false,
    releve: RELEVE,
    remarques: "Site en néerlandais. « PDF-uploader » : couverture et intérieur en pages simples, sRGB, dimensions fond perdu compris. Chaque livre commence à 24 pages ; le prix « extra pagina » ne précise pas s’il s’agit d’une page ou d’un feuillet (compté ici par page). Table de dos officielle (la FAQ donne un exemple qui la contredit). Expédition le jour même pour une commande passée avant 11 h.",
  },

  {
    id: "pixartprinting",
    nom: "Pixartprinting",
    pays: "Italie",
    site: "https://www.pixartprinting.fr/",
    lienCommande: "https://www.pixartprinting.fr/impression-revues-catalogues-livres/finition-couverture-rigide/",
    pdfFrance: { valeur: true, statut: "V", source: "https://www.pixartprinting.fr/impression-revues-catalogues-livres/finition-couverture-rigide/" },
    livraisonFrance: { valeur: "oui", detail: "Site français ; port calculé au panier selon le poids, le volume et la date de livraison choisie. TVA française pour un particulier.", statut: "V", source: "https://support.pixartprinting.com/hc/fr/articles/360018431059" },
    produits: [
      { id: "a4-portrait", nom: "Livre couverture rigide A4", largeur: 210, hauteur: 297, reliure: "rigide", papier: "Classic demi-mat 170 g/m²", pagesMin: 24, pagesMax: 200, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "21x21", nom: "Livre couverture rigide 21 × 21 cm", largeur: 210, hauteur: 210, reliure: "rigide", papier: "Classic demi-mat 170 g/m²", pagesMin: 24, pagesMax: 200, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "30x30", nom: "Livre couverture rigide 30 × 30 cm", largeur: 300, hauteur: 300, reliure: "rigide", papier: "Classic demi-mat 170 g/m²", pagesMin: 24, pagesMax: 200, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "a4-paysage", nom: "Livre couverture rigide A4 paysage", largeur: 297, hauteur: 210, reliure: "rigide", papier: "Classic demi-mat 170 g/m²", pagesMin: 24, pagesMax: 200, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
    ],
    technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 5, securiteReliure: 15, couleur: "CMJN FOGRA39", normePdf: "libre", fichiers: "unique", dos: "gabarit", dosTitreMin: 6, poidsMaxMo: null, statut: "V", source: "https://www.pixartprinting.fr/impression-revues-catalogues-livres/finition-couverture-rigide/" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: null, livraison: null, statut: "NV", source: "https://support.pixartprinting.com/hc/fr/articles/360018431059" },
    note: { valeur: 4.4, avis: 3402, domaine: "pixartprinting.fr", statut: "V", source: "https://www.trustpilot.com/review/pixartprinting.fr" },
    api: false,
    releve: RELEVE,
    remarques: "Imprimeur offset et numérique sur papier couché (pas de papier photo) : couverture carton 2 mm, pelliculage brillant, mat ou soft touch, dorure possible. Un seul PDF (couverture puis intérieur) ou deux PDF, à l’échelle 1:1, CMJN Fogra 39, 300 dpi, sans traits de coupe. Prix, pages minimum et maximum (24 à 200 par 4 supposés) et port : configurateur seulement.",
  },

  {
    id: "cewe",
    nom: "CEWE",
    pays: "Allemagne",
    site: "https://www.cewe.fr/",
    lienCommande: "https://www.cewe.fr/",
    pdfFrance: { valeur: false, statut: "V", source: "https://www.cewe.fr/sitemap.xml" },
    livraisonFrance: { valeur: "oui", detail: "Colissimo ou Colis Privé en 48 h, point relais en 48 à 72 h, Chronopost en 24 h — mais seulement pour un livre fait avec le logiciel CEWE.", statut: "V", source: "https://www.cewe.fr/service/modes-de-livraison.html" },
    produits: [
      { id: "21x28", nom: "Livre photo 21 × 28 cm", largeur: 210, hauteur: 280, reliure: "rigide", papier: "Impression numérique", pagesMin: 26, pagesMax: 178, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 26, parPageSup: null, statut: "NV" } },
      { id: "30x30", nom: "Livre photo 30 × 30 cm", largeur: 300, hauteur: 300, reliure: "rigide", papier: "Impression numérique", pagesMin: 26, pagesMax: 178, pas: 4, prix: { devise: "EUR", base: null, pagesIncluses: 26, parPageSup: null, statut: "NV" } },
    ],
    technique: { fondPerdu: 3, fondPerduCouverture: 10, securite: 6, securiteReliure: 6, couleur: "sRGB", normePdf: "PDF 1.3", fichiers: "separes", dos: "gabarit", dosTitreMin: 6, poidsMaxMo: null, statut: "S", source: "https://cdn.cewe.co.uk/downloads/user-guide.pdf" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: null, livraison: null, statut: "NV" },
    note: { valeur: 4.5, avis: 129844, domaine: "cewe.fr", statut: "V", source: "https://www.trustpilot.com/review/www.cewe.fr" },
    api: false,
    releve: RELEVE,
    remises: { texte: "Environ −10 % pour 2 livres, −15 % pour 3, −20 % dès 5.", statut: "V", source: "https://www.cewe.fr/" },
    remarques: "Aucune page de dépôt PDF sur cewe.fr (plan du site relu le 3 novembre 2026) : en France, CEWE impose son logiciel. La voie InDesign (gabarits CEWE, deux PDF) existe sur cewe.lu/fr et cewe.kruidvat.be/fr, mais un PDF fait ailleurs n’y est pas accepté tel quel, et la livraison en France depuis ces sites n’est pas confirmée.",
  },

  {
    id: "lulu",
    nom: "Lulu",
    pays: "États-Unis",
    site: "https://www.lulu.com/fr/",
    lienCommande: "https://www.lulu.com/fr/pricing",
    pdfFrance: { valeur: true, statut: "V", source: "https://help.api.lulu.com/en/support/solutions/articles/64000254609-pdf-creation-settings" },
    livraisonFrance: { valeur: "oui", detail: "Lulu imprime notamment en France (chez l’imprimeur le plus proche quand c’est possible) et collecte la TVA française.", statut: "V", source: "https://help.lulu.com/en/support/solutions/articles/64000255307" },
    produits: [
      { id: "11x8.5", nom: "Livre photo 11 × 8,5 pouces paysage, rigide", largeur: 279, hauteur: 216, reliure: "rigide", papier: "Couché blanc 80# Premium Color", pagesMin: 24, pagesMax: 240, pas: 2, prix: { devise: "USD", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV", source: "https://www.lulu.com/create/photo-books" } },
      { id: "8.5x8.5", nom: "Livre photo 8,5 × 8,5 pouces carré, rigide", largeur: 216, hauteur: 216, reliure: "rigide", papier: "Couché blanc 80# Premium Color", pagesMin: 24, pagesMax: 240, pas: 2, prix: { devise: "USD", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
    ],
    technique: { fondPerdu: 3.2, fondPerduCouverture: 3.2, securite: 12.7, securiteReliure: 5.1, couleur: "sRGB", normePdf: "libre", fichiers: "separes", dos: "api", dosTitreMin: 6, poidsMaxMo: null, statut: "V", source: "https://help.api.lulu.com/en/support/solutions/articles/64000254609-pdf-creation-settings" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: 5, livraison: null, statut: "V", source: "https://help.lulu.com/en/support/solutions/articles/64000255307" },
    note: { valeur: 4.5, avis: 6553, domaine: "lulu.com", statut: "V", source: "https://www.trustpilot.com/review/lulu.com" },
    api: true,
    releve: RELEVE,
    remarques: "Pas de livre photo portrait ni de 30 × 30. Papier 80# « dès 14,76 USD » (page probablement ancienne) ; prix, port et maximum de pages du livre photo (240 supposé) : calculateur ou API seulement. Fabrication 3 à 5 jours ouvrés, plus pour un livre rigide. Commande possible par API (V2).",
  },

  {
    id: "gelato",
    nom: "Gelato",
    pays: "Norvège",
    site: "https://www.gelato.com/photo-books",
    lienCommande: "https://www.gelato.com/photo-books",
    pdfFrance: { valeur: true, statut: "V", source: "https://support.gelato.com/en/articles/8996282-how-do-i-design-a-photo-book" },
    livraisonFrance: { valeur: null, detail: "Réseau d’impression mondial ; production en Europe pour une commande française non confirmée. Compte gratuit et carte bancaire requis, commande depuis le tableau de bord.", statut: "NV", source: "https://support.gelato.com/en/articles/8996044" },
    produits: [
      { id: "8x11", nom: "Livre photo rigide 8 × 11 pouces", largeur: 203, hauteur: 279, reliure: "rigide", papier: "Standard", pagesMin: 30, pagesMax: 200, pas: 2, prix: { devise: "EUR", base: null, pagesIncluses: 30, parPageSup: null, statut: "NV" } },
      { id: "11x8", nom: "Livre photo rigide 11 × 8 pouces", largeur: 279, hauteur: 203, reliure: "rigide", papier: "Standard", pagesMin: 30, pagesMax: 200, pas: 2, prix: { devise: "EUR", base: null, pagesIncluses: 30, parPageSup: null, statut: "NV" } },
      { id: "11x11", nom: "Livre photo rigide 11 × 11 pouces", largeur: 279, hauteur: 279, reliure: "rigide", papier: "Standard", pagesMin: 30, pagesMax: 200, pas: 2, prix: { devise: "EUR", base: null, pagesIncluses: 30, parPageSup: null, statut: "NV" } },
    ],
    technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 4, securiteReliure: 6, couleur: "CMJN GRACoL", normePdf: "PDF/X-4", fichiers: "unique", gardesVierges: true, dos: "gabarit", dosTitreMin: 6, poidsMaxMo: null, statut: "V", source: "https://support.gelato.com/en/articles/8996349" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: null, livraison: null, statut: "NV" },
    note: { valeur: 4.2, avis: 3444, domaine: "gelato.com", statut: "V", source: "https://www.trustpilot.com/review/gelato.com" },
    api: true,
    releve: RELEVE,
    remarques: "Outil pensé pour les vendeurs en ligne. Un seul PDF : couverture étalée, garde vierge, intérieur (30 à 200 pages), garde vierge ; PDF/X-4 avec intention de sortie GRACoL 2006 (CMJN). Prix (30 pages incluses selon une source secondaire) et port : tableau de bord connecté seulement. Commande possible par API (V2).",
  },

  {
    id: "prodigi",
    nom: "Prodigi",
    pays: "Royaume-Uni",
    site: "https://www.prodigi.com/",
    lienCommande: "https://www.prodigi.com/",
    pdfFrance: { valeur: true, statut: "V", source: "https://www.prodigi.com/blog/photo-books-technical-guide/" },
    livraisonFrance: { valeur: "oui", detail: "Expédition dans le monde entier, depuis le laboratoire le plus proche (Royaume-Uni, UE, États-Unis…) : une commande française devrait partir de l’UE, à vérifier. Compte requis.", statut: "V", source: "https://www.prodigi.com/products/books-and-magazines/hardcover-photo-book/" },
    produits: [
      { id: "a4-portrait", nom: "Livre rigide 21 × 30 cm portrait", largeur: 210, hauteur: 300, reliure: "rigide", papier: "Mohawk mat 120 g/m², brillant 150 ou 200 g/m²", pagesMin: 24, pagesMax: 300, pas: 2, prix: { devise: "GBP", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "a4-paysage", nom: "Livre rigide A4 paysage", largeur: 297, hauteur: 210, reliure: "rigide", papier: "Mohawk mat 120 g/m², brillant 150 ou 200 g/m²", pagesMin: 24, pagesMax: 300, pas: 2, prix: { devise: "GBP", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "21x21", nom: "Livre rigide 21 × 21 cm", largeur: 210, hauteur: 210, reliure: "rigide", papier: "Mohawk mat 120 g/m², brillant 150 ou 200 g/m²", pagesMin: 24, pagesMax: 300, pas: 2, prix: { devise: "GBP", base: null, pagesIncluses: 24, parPageSup: null, statut: "NV" } },
      { id: "layflat-30x30", nom: "Layflat 29,7 × 29,7 cm (à plat)", largeur: 297, hauteur: 297, reliure: "a-plat", papier: "E-Photo Lustre 190 g/m²", pagesMin: 18, pagesMax: 122, pas: 2, prix: { devise: "GBP", base: null, pagesIncluses: 18, parPageSup: null, statut: "NV", source: "https://www.prodigi.com/products/books-and-magazines/layflat-photo-book/" } },
    ],
    // Pas de fond perdu : Prodigi l'ajoute lui-même.
    technique: { fondPerdu: 0, fondPerduCouverture: 0, securite: 10, securiteReliure: 6, couleur: "sRGB", normePdf: "PDF/X-4", fichiers: "unique-pages", dos: "api", dosTitreMin: 6, poidsMaxMo: null, statut: "V", source: "https://www.prodigi.com/blog/photo-books-technical-guide/" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV" },
    delais: { fabrication: 5, livraison: null, statut: "V", source: "https://www.prodigi.com/blog/photo-books-technical-guide/" },
    note: { valeur: 4.0, avis: 148, domaine: "prodigi.com", statut: "V", source: "https://au.trustpilot.com/review/prodigi.com" },
    api: true,
    releve: RELEVE,
    remarques: "Maison mère de Peecho. Un seul PDF en pages simples (1re de couverture, intérieur, 4e), sans fond perdu, RVB exporté en PDF/X-4 ; dos calculé par Prodigi. Rigide en A5, 21 × 30 et 21 × 21 seulement (pas de 30 × 30) ; Layflat dès 17,51 £ HT hors port (prix de gros, plus petit format). Prix et port : compte requis.",
  },

  {
    id: "flexilivre",
    nom: "Flexilivre",
    pays: "France",
    site: "https://www.flexilivre.com/",
    lienCommande: "https://www.flexilivre.com/fichier/",
    pdfFrance: { valeur: true, statut: "V", source: "https://www.flexilivre.com/fichier/" },
    livraisonFrance: { valeur: "oui", detail: "Fabriqué en France (Hauts-de-France) : Colissimo ou Chronopost, express 48 h en France métropolitaine (sauf ouverture à plat).", statut: "V", source: "https://www.flexilivre.com/delais-de-livraison/" },
    produits: [
      // Prix publiés pour 24 à 30 pages (relevé de Flexilivre du 29 octobre 2026) ; prix de la page au-delà non publié.
      { id: "a4-rigide", nom: "Album A4 portrait, couverture rigide", largeur: 210, hauteur: 297, reliure: "rigide", papier: "Novatech Gloss 200 g/m²", pagesMin: 24, pagesMax: 400, pas: 2, prix: { devise: "EUR", base: 29.9, pagesIncluses: 30, parPageSup: null, statut: "V", source: "https://www.flexilivre.com/tarifs/" } },
      { id: "a4-souple", nom: "Album A4 portrait, couverture souple", largeur: 210, hauteur: 297, reliure: "souple", papier: "Novatech Gloss 200 g/m²", pagesMin: 24, pagesMax: 400, pas: 2, prix: { devise: "EUR", base: 24.9, pagesIncluses: 30, parPageSup: null, statut: "V", source: "https://www.flexilivre.com/tarifs/" } },
      { id: "a4-plat", nom: "Album A4 portrait, rigide à ouverture à plat", largeur: 210, hauteur: 297, reliure: "a-plat", papier: "400 g/m²", pagesMin: 24, pagesMax: 400, pas: 2, prix: { devise: "EUR", base: 42.9, pagesIncluses: 30, parPageSup: null, statut: "V", source: "https://www.flexilivre.com/tarifs/" } },
      { id: "a4-paysage", nom: "Album A4 paysage (29,7 × 21 cm), couverture rigide", largeur: 297, hauteur: 210, reliure: "rigide", papier: "Novatech Gloss 200 g/m²", pagesMin: 24, pagesMax: 400, pas: 2, prix: { devise: "EUR", base: null, pagesIncluses: 30, parPageSup: null, statut: "NV", source: "https://www.flexilivre.com/tarifs/" } },
      { id: "30x30-rigide", nom: "Album 30 × 30 cm, couverture rigide", largeur: 300, hauteur: 300, reliure: "rigide", papier: "Novatech Gloss 200 g/m²", pagesMin: 24, pagesMax: 400, pas: 2, prix: { devise: "EUR", base: 38.9, pagesIncluses: 30, parPageSup: null, statut: "V", source: "https://www.flexilivre.com/tarifs/" } },
      { id: "30x30-souple", nom: "Album 30 × 30 cm, couverture souple", largeur: 300, hauteur: 300, reliure: "souple", papier: "Novatech Gloss 200 g/m²", pagesMin: 24, pagesMax: 400, pas: 2, prix: { devise: "EUR", base: 29.9, pagesIncluses: 30, parPageSup: null, statut: "V", source: "https://www.flexilivre.com/tarifs/" } },
      { id: "30x30-plat", nom: "Album 30 × 30 cm, rigide à ouverture à plat", largeur: 300, hauteur: 300, reliure: "a-plat", papier: "400 g/m²", pagesMin: 24, pagesMax: 400, pas: 2, prix: { devise: "EUR", base: 49.9, pagesIncluses: 30, parPageSup: null, statut: "V", source: "https://www.flexilivre.com/tarifs/" } },
    ],
    // Pas de traits de coupe, contenu important à 5 mm des bords ; RVB (CMJN sur demande), PDF jusqu'à 3 Go. Fond perdu non précisé (3 mm supposés).
    technique: { fondPerdu: 3, fondPerduCouverture: 3, securite: 5, securiteReliure: 5, couleur: "sRGB", normePdf: "libre", fichiers: "unique-pages", dos: "api", dosTitreMin: 6, poidsMaxMo: 3072, statut: "V", source: "https://www.flexilivre.com/fichier/" },
    port: { devise: "EUR", premier: null, suivant: null, francoDes: null, statut: "NV", regle: "Affiché au panier" },
    // Délai global constaté (fabrication et envoi) : 3 à 5 jours ouvrés, 5 à 8 pour l'ouverture à plat.
    delais: { fabrication: null, livraison: null, total: 5, statut: "V", source: "https://www.flexilivre.com/delais-de-livraison/" },
    note: { valeur: 4.7, avis: 39191, domaine: "flexilivre.com", statut: "V", source: "https://fr.trustpilot.com/review/flexilivre.com" },
    api: false,
    releve: RELEVE,
    remarques: "Imprimeur français. Le PDF importé est converti en livre, modifiable en ligne : 1re et dernière pages du PDF = couverture, dos non imprimable. Formats 21 × 15, 15 × 21, 21 × 29,7, 29,7 × 21, 21 × 21 et 30 × 30 cm. Prix TTC pour 24 à 30 pages ; page au-delà et port non publiés. Délai 3 à 5 jours ouvrés en tout (ouverture à plat 5 à 8), express 48 h en France métropolitaine.",
  },
];

export function imprimeurParId(id: string): Imprimeur | undefined {
  return IMPRIMEURS.find((i) => i.id === id);
}

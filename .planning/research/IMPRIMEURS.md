# Imprimeurs de livres photo : recherche initiale

> Relevé du **2 novembre 2026**. Recherche courte : environ 25 recherches et lectures de pages.
> Légende : **[V]** = vérifié sur la source citée à cette date. **[S]** = source secondaire (forum, tiers, ancien guide). **[NV]** = non vérifié, à confirmer avant de coder la règle.
> Toutes les valeurs servent de **point de départ** pour les fiches imprimeurs de l'app. Chaque fiche doit ensuite être revérifiée avec l'action « mettre à jour avec l'IA » et validée par l'administrateur.

## 0. Revérification site par site du 3 novembre 2026 (prioritaire sur la suite)

Ces corrections sont appliquées dans `src/lib/imprimeurs/catalogue.ts` (champ `livraisonFrance` sur chaque fiche, Flexilivre ajouté, Pumbo non retenu faute de prix publiés).

**Statuts :**
- **V** : valeur lue sur le site officiel le 3 novembre 2026. Cela inclut leur centre d'aide (Zendesk ou Intercom).
- **S** : source secondaire (blog, test, résumé d'un moteur de recherche).
- **NV** : non trouvé ou non vérifié.

**Limites de la recherche :**
- Plusieurs prix et frais de port ne s'affichent que dans un configurateur JavaScript. C'est le cas chez Saal, CEWE, Pixartprinting, Blurb (port), Pumbo et Flexilivre (port).
- Gelato et Mixam renvoient une erreur 403 aux outils de lecture.
- Lulu, Gelato et Prodigi affichent leurs prix seulement dans un calculateur ou après connexion.
- Ces valeurs restent donc NV. Pour Saal, j'ai trouvé le service interne qui calcule les frais de port. Je n'ai pas continué à l'interroger directement , donc ces frais restent S.

---

### 0.1 Saal Digital (Allemagne)

**Livraison en France :** oui. **V**, https://www.saal-digital.fr/service/frais-dexpedition-delai-de-livraison/
- La France figure dans la liste des pays du tableau des délais.
- Transporteurs cités : Colis Privé, DHL, DHL Express, Transoflex, UPS.

**Délais pour la France, commande d'un seul produit** (tableau officiel du 03/11/2026, **V**) :

| Produit | Fabrication | Livraison standard | Livraison express |
|---|---|---|---|
| Livre photo standard | 1 à 2 j ouvrés | 4 à 5 j ouvrés | 1 à 2 j ouvrés |
| Professional Line | 2 à 3 j ouvrés | 4 à 5 j ouvrés | 1 à 2 j ouvrés |
| 15×15, 15×21, 21×15 | 3 j ouvrés | 4 à 5 j ouvrés | 1 à 2 j ouvrés |

**Frais de port :**
- Aucun montant publié sur une page statique (NV officiellement).
- 5,99 € « quel que soit le format » en standard Colis Privé, DHL en express (**S**, test d'octobre 2025 : https://virusphoto.com/test-complet-saal-digital-livre-photo-grand-format-avis-detaille/).
- Pas de douane : envoi intra-UE.

**Commande à partir d'un PDF : oui.** **V**, https://www.saal-digital.fr/service/infos-pro/telechargez-votre-pdf-dans-la-boutique-en-ligne/
- Procédure : boutique, puis Livre photo, puis « Concevoir », puis option « PDF Upload ».
- Deux PDF : couverture et intérieur.
- Pas de PDF pour les couvertures spéciales.
- Spécifications **V** (https://www.saal-digital.com/service/professional-zone/create-your-files-in-indesign) :
  - sRGB IEC61966-2.1 ;
  - intérieur en planches (une page du PDF = une double page) ;
  - pas de traits de coupe ;
  - environ 1 cm de marge de sécurité ;
  - le fond perdu et le dos sont donnés par les gabarits (valeur en mm : NV).

**Produits et prix TTC hors port** (**V**, https://www.saal-digital.fr/livre-photo/) :
- Reliure à plat (layflat) offerte.
- Papier photo Fujifilm 368 g/m², brillant, mat ou satiné, ou papier impression mat.
- Pages : 26 à 160, par 2.

| Format | Prix « dès » |
|---|---|
| 21×28 (format réel 21,5×27,5) | 22,99 € (promo jusqu'au 09/11), prix catalogue 33,99 € (**V**, https://www.saal-digital.fr/album-photo/album-photo-21-x-28/) |
| 28×28 | 29,99 € |
| 28×19 | 19,99 € |
| 19×19 | 16,99 € |
| Pro Line 30×30 | 99,99 € (26 à 130 pages, **V**, https://www.saal-digital.fr/album-photo/album-photo-30-x-30-professional-line/) |

- Pro Line : remise −20 % dès 26 pages, −25 % dès 70, −30 % dès 100 (**V**).
- Prix de la double page supplémentaire : **non trouvé** (configurateur seulement).
- Remise par quantité : NV (page « Commande en volume »).

**Note :** 4,4/5, 5 077 avis, saal-digital.fr. **V**, https://fr.trustpilot.com/review/www.saal-digital.fr

---

### 0.2 Blurb (États-Unis)

**Livraison en France :** oui. La France figure dans la liste des pays desservis. **V**, https://support.blurb.com/hc/en-us/articles/207794346 (mis à jour le 28/09/2026)
- Tarif de port : calculateur seulement (NV). Un blog annonce « livraison offerte dès 70 € » : **S** peu fiable.
- Fabrication : 4 à 5 jours ouvrés, sans possibilité d'accélérer. **V**, https://www.blurb.fr/shipping

**Douane et TVA** (**V**, https://support.blurb.com/hc/en-us/articles/207794426, mis à jour le 03/11/2026, et https://support.blurb.com/hc/en-us/articles/207794476) :
- Les livres photo et les Layflat Premium Lustre sont imprimés dans l'UE : pas de droits de douane.
- Les autres **Layflat sont imprimés aux États-Unis** : droits possibles, payés par le destinataire.
- La TVA est collectée par Blurb.

**Commande à partir d'un PDF : oui (« PDF to Book »).** **V**, https://support.blurb.com/hc/en-us/articles/207792946 (28/10/2026)
- Pages simples, pas de doubles pages. Nombre de pages pair.
- Couverture séparée, ou un seul PDF accepté.
- Dimensions données par l'outil de calcul de format de Blurb.
- **CMJN recommandé, sRGB accepté**, noir 100 % K, pas de tons directs, pas de traits de coupe.
- Taille maximale : 2 Go pour les pages, 90 Mo pour la couverture.
- Zone de sécurité ≥ 0,25" (6,35 mm). **V**, article 360000087206
- Aucune norme PDF/X n'est imposée pour un PDF ordinaire.

**Prix en € (V, https://www.blurb.fr/pricing).** Ils sont cohérents avec un montant TTC à 20 % (38,40 = 32,00 × 1,2).

| Produit | Prix | Page supplémentaire |
|---|---|---|
| 20×25 rigide, papier Standard 118 g | 38,40 € | 0,48 € |
| 20×25 rigide, papier Premium 148 g | 44,40 € | 0,54 € |
| 30×30 rigide, papier Standard | 61,20 € | 0,64 € |
| 30×30 rigide, papier Premium | 72,00 € | 0,72 € |
| Layflat 20×25 | 116,57 € | 3,74 € |
| Layflat 30×30 | 159,35 € | 4,81 € |

- Papiers d'art : Mohawk Eggshell et proPhoto Pearl.
- Pages, **V** (article 7607055286541) : Standard 20 à 440 ; Premium et Mohawk 20 à 240 ; Layflat 20 à 110.
- Nombre de pages inclus dans le prix de base : 20 (**S**, déduit du minimum).
- Remises de quantité, livres photo : −20 % de 10 à 49 exemplaires, −25 % de 50 à 99 (**V**, https://support.blurb.com/hc/en-us/articles/207813766).

**Note :** 2,3/5, 194 avis, blurb.fr (**V**, https://fr.trustpilot.com/review/blurb.fr). Sur blurb.co.uk : 2,3/5, 892 avis.

---

### 0.3 Fotofabriek (Pays-Bas) — la livraison en France est possible, mais hors du tunnel de commande

**Livraison en France :** oui, avec une procédure manuelle. **V**, https://www.fotofabriek.nl/faq/pakketje-naar-buitenland/
- Seuls la Belgique, l'Allemagne et l'Autriche se saisissent directement.
- Pour la France :
  1. commander en choisissant « retrait chez Fotofabriek » ;
  2. envoyer un message au service client par chat avec le numéro de commande ;
  3. Fotofabriek calcule le port au tarif PostNL et envoie une demande de paiement par e-mail ;
  4. l'envoi part après paiement.
- Tarif et délai pour la France : NV.
- Tarifs des Pays-Bas et de la Belgique (**V**, https://www.fotofabriek.nl/verzendtarieven) :
  - tarif D : 5,45 € (+1 € par produit supplémentaire) ;
  - tarif E : 6,45 € (+2 €) ;
  - gratuit dès 50 €.
- La plupart des produits partent le jour même s'ils sont commandés avant 11 h (**V**, /levertijden).

**Commande à partir d'un PDF : oui (« PDF-uploader »).** **V**, https://www.fotofabriek.nl/faq/bestellen-via-pdf-uploader/
- Deux PDF : couverture et intérieur, en pages simples.
- sRGB.
- Les dimensions des spécifications incluent déjà le fond perdu.
- Textes à au moins 20 mm à l'intérieur de la ligne de fond perdu.
- Charnière de 10 mm de part et d'autre du dos. Pas de traits de coupe.
- Incohérence : l'exemple de la FAQ (60 pages, dos de 14 mm) ne correspond pas à la table des dos (48 à 60 pages = 8 mm).

**Prix TTC** (**V**, https://www.fotofabriek.nl/prijslijst/). « Chaque livre commence à 24 pages » (**V**, /producten/fotoboeken/hardcover/).

| Produit | Prix de base | « Extra pagina » | Tarif de port |
|---|---|---|---|
| A4 rigide, portrait ou paysage | 29,99 € | 0,65 € | D |
| 30×30 rigide | 44,99 € | 1,10 € | E |
| A4 à plat (papier photo 380 g, 24 à 140 p.) | 35,99 € | 0,90 € | E |
| 30×30 à plat | 54,99 € | 1,40 € | E |

- L'unité du prix « extra pagina » (page ou feuillet) n'est pas précisée.
- Rigide : jusqu'à « ruim 400 pagina's » selon la page produit, mais la table des dos s'arrête à 200.

**Note :** 4,5/5, 1 393 avis. **V**, https://www.trustpilot.com/review/fotofabriek.nl

---

### 0.4 Pixartprinting (Italie)

**Livraison en France :** oui (site .fr). **V**, https://support.pixartprinting.com/hc/fr/articles/360018431059
- Le port est calculé selon le poids, le volume et la combinaison de produits, et ne s'affiche qu'au panier.
- Le prix varie aussi selon la date de livraison choisie.
- TVA du pays de destination pour un particulier. **V**, /articles/17469089487122
- Montants : NV.

**Commande à partir d'un PDF : oui.** **V**, https://www.pixartprinting.fr/impression-revues-catalogues-livres/finition-couverture-rigide/
- Un seul PDF (couverture puis intérieur) **ou** deux PDF séparés.
- PDF à l'échelle 1:1, **CMJN Fogra 39**, 300 dpi, sans traits de coupe.
- Fond perdu de 3 mm pour l'intérieur. Couverture préparée sur le gabarit fourni.
- Textes à 15 mm du côté de la reliure et à 5 mm des autres bords.

**Produits :** **V**
- Formats : A4, A5, 21×21, 16,5×24, 30×30 cm, ou format personnalisé.
- Couverture : carton de 2 mm couvert de couché mat 170 g ; pelliculage brillant, mat ou soft touch ; options dorure or ou argent, vernis 3D.
- Papiers intérieurs : Classic Demimatt 170, Classic Gloss 170, Extraprint 160, Rembrandt 120, Underwood 170, Recyclé 120.
- Impression offset/numérique sur papier couché, **pas de papier photo**.
- Pages minimum/maximum et pas, prix : **non trouvés**.

**Note :** 4,4/5, 3 402 avis. **V**, https://www.trustpilot.com/review/pixartprinting.fr

---

### 0.5 CEWE (Allemagne) — pas de PDF sur cewe.fr

**Pas de dépôt PDF sur cewe.fr :**
- Le plan du site cewe.fr (556 adresses, relu le 03/11/2026) ne contient aucune page PDF ou InDesign.
- Les adresses équivalentes à celles des autres pays renvoient 404 (`/livre-photo-cewe/indesign.html`, `/pdf2book.html`).
- Statut : **V** par absence.

**Voie PDF ailleurs :** elle existe en français sur **cewe.lu/fr** et **cewe.kruidvat.be/fr** (V, https://www.cewe.lu/fr/livre-photo-cewe/indesign.html).
- Il faut le générateur de gabarits InDesign de CEWE et le préréglage d'export, puis déposer deux PDF.
- Un PDF produit hors d'InDesign n'est donc pas pris en charge directement.
- Livraison en France depuis ces sites : **NV**.

**Livraison en France (cewe.fr) :** **V**, https://www.cewe.fr/service/modes-de-livraison.html
- Standard Colissimo ou Colis Privé en 48 h ; point relais Colissimo en 48 à 72 h ; express Chronopost ou Colis Privé en 24 h.
- Tarifs : NV (chargés en JavaScript).

**Prix :** NV (liste de prix dynamique).

**Remise par quantité affichée :** environ −10 % pour 2 livres, −15 % pour 3, −20 % dès 5 (V, page A4 portrait).

**Note :** 4,5/5, 129 844 avis. **V**, https://www.trustpilot.com/review/www.cewe.fr

---

### 0.6 Lulu (États-Unis)

**Livraison en France :** oui.
- Lulu a des sites d'impression notamment en **France**. Le livre est fabriqué par l'imprimeur le plus proche « whenever possible ».
- Fabrication : 3 à 5 jours ouvrés ; plus long pour un livre rigide.
- **V**, https://help.lulu.com/en/support/solutions/articles/64000255307
- TVA française collectée par Lulu (OSS FR90524670213, IOSS IM2500024850). **V**, https://help.lulu.com/en/support/solutions/articles/64000255321
- Tarif de port : calculateur seulement (NV).

**Commande à partir d'un PDF : oui, par le site et par l'API.** Spécifications déjà au catalogue, statut V.

**Produits :** **V**, https://www.lulu.com/create/photo-books
- Paysage 11×8,5" (279×216 mm) rigide.
- Carré 8,5×8,5" (216×216 mm) rigide.
- Petit paysage 9×7" souple.
- Papier 80#, « dès 14,76 USD » (page probablement ancienne).
- Couverture rigide (casewrap) : 24 à 800 pages (**V**, help Lulu « paper stocks »). Maximum propre au livre photo : NV.
- Pas de format portrait ni de 30×30.

**Note :** 4,5/5, 6 553 avis. **V**

---

### 0.7 Gelato (Norvège, réseau d'impression à la demande)

**Commande :** compte gratuit et carte bancaire requis ; commande « manuelle » depuis le tableau de bord. **V**, https://support.gelato.com/en/articles/8996044
- C'est un outil orienté vendeurs. L'accès direct pour un particulier n'est pas documenté.

**PDF : un seul fichier.** **V**, https://support.gelato.com/en/articles/8996282
- Page 1 : couverture étalée.
- Page 2 et dernière page : gardes laissées vierges.
- Entre les deux : pages intérieures. 30 à 200 pages, nombre fixe.

**Spécifications :** **V**, https://support.gelato.com/en/articles/8996349
- Fond perdu de 3 mm pour un livre photo.
- **PDF/X-4, intention de sortie GRACoL 2006 (CMJN)**.
- Sécurité de 4 mm (règle générale).
- 150 à 300 dpi, pages simples.

**Prix, frais de port, sites de production en France :** **non trouvés** (pages produit bloquées en 403).
- Le prix inclut les 30 premières pages (**S**).

**Note :** 4,2/5, 3 444 avis. **V**

---

### 0.8 Prodigi (Royaume-Uni, absorbe Peecho)

**Production :** livre rigide fabriqué au Royaume-Uni, dans l'UE, aux États-Unis, au Mexique et en Australie, par le laboratoire le plus proche ; 120 h. **V**, https://www.prodigi.com/products/books-and-magazines/hardcover-photo-book/
- Expédition partout dans le monde.
- Une commande française devrait donc partir de l'UE. C'est une déduction, à vérifier.

**TVA :** sans numéro de TVA, le client est traité comme particulier et la TVA est appliquée (**S**, support Prodigi). Commande et prix : **connexion requise**.

**Livre rigide :** **V**
- Formats : **A5 15×21, A4 21×30, carré 21×21 seulement** (pas de 30×30 en rigide).
- Pages : 24 à 300 ; jusqu'à 500 en brillant 150 g.
- Papiers : Mohawk 120 g mat, brillant 150 ou 200 g.
- Reliure PUR.

**Layflat :** **V**, /layflat-photo-book/
- Formats : 210×210, **297×297**, A4 portrait ou paysage.
- Pages : 18 à 122. Papier E-Photo Lustre 190 g.
- Fabriqué dans l'UE ou aux États-Unis, en 96 à 144 h.
- **Dès 17,51 £** prix de gros, hors taxes et hors port.

**Fichiers :** **V**, https://www.prodigi.com/blog/photo-books-technical-guide/
- Pas de fond perdu (ajouté par Prodigi). Marge de sécurité de 10 mm. Environ 6 mm masqués dans la gouttière.
- **RVB**, export PDF/X-4 (Coated FOGRA39).
- Un seul PDF en pages simples : 1re de couverture, intérieur, 4e de couverture. Nombre de pages pair.
- Dos fourni à part par l'API.

**Note :** 4,0/5, 148 avis. **V**

Peecho se présente désormais comme « a Prodigi Group print on demand company » (**V**, peecho.com).

---

### 0.9 Alternatives accessibles depuis la France

**A. Flexilivre (France, Hauts-de-France) : la plus pertinente.**
- **Import de PDF : oui.** **V**, https://www.flexilivre.com/fichier/
  - PDF converti en livre, modifiable en ligne.
  - Formats : 21×15, 29,7×21, 15×21, **21×29,7**, 21×21, **30×30**.
  - Couverture en 1re et dernière page du PDF ; dos non imprimable.
  - Pas de traits de coupe, contenu important à 5 mm des bords.
  - RVB par défaut, CMJN sur demande. PDF jusqu'à 3 Go.
- **Prix TTC, 24 à 30 pages**, relevés par Flexilivre le 29/10/2026 (**V**, https://www.flexilivre.com/tarifs/) :

| Couverture | A4 portrait | 30×30 |
|---|---|---|
| Souple | 24,90 € | 29,90 € |
| Rigide | 29,90 € | 38,90 € |
| Rigide, ouverture à plat | 42,90 € | 49,90 € |

- Pages : 24 à 400, par 2. Papier Novatech Gloss 200 g ; 400 g pour l'ouverture à plat (**V**, /album-photo/xxl/). Prix de la page supplémentaire : non trouvé.
- **Délais :** 3 à 5 j ouvrés en standard (Colissimo ou Chronopost) ; express 48 h Chronopost en France métropolitaine ; ouverture à plat 5 à 8 j (**V**, /delais-de-livraison/).
- **Frais de port :** non trouvés.
- **Note :** 4,7/5, 39 191 avis (**V**, fr.trustpilot.com/review/flexilivre.com).

**B. Pumbo (France, Nice).**
- Livre relié rigide imprimé à partir d'un PDF.
- Formats de A6 à 300×300 mm (21×21 et 30×30 en format personnalisé).
- Papiers couchés ou non, de 80 à 200 g, dont des papiers pour photos. Minimum 18 pages.
- Prix TTC. Port minimum 3 € TTC.
- Fabrication 5 j ouvrés ; expédition 5 à 7 j ouvrés ; transporteur GLS.
- Sources **V** : https://www.pumbo.fr/tarifs, /aide/livraison, /imprimer-un-livre/livre-photo
- Prix : **non trouvés** (calculateur).
- **Note :** 4,5/5 sur seulement 19 avis.

**C. Pixartprinting :** déjà au catalogue (point 4). C'est l'imprimeur offset en CMJN de la liste.

**Écartés :**
- **Photobox, Monalbumphoto, Photoweb :** aucune page d'import PDF trouvée. Monalbumphoto a été absorbé par Photobox.
- **Realisaprint :** « 100 % revendeur ».
- **Exaprint :** réservé aux professionnels.
- **Mixam :** mixam.fr redirige vers mixam.co.uk. Expédition hors UE, donc TVA d'import à 20 % et douane possible. Non vérifié, page en 403.
- **Doxdirect :** papier de 100 à 130 g, pas un livre photo.
- **Onlineprinters :** livre rigide de 48 à 328 pages, sans prix publiés.
- **Booksline :** dès 10 exemplaires seulement.

---

### Synthèse

**Livrent effectivement en France et acceptent un PDF fourni :**
- Saal Digital.
- Blurb.
- Pixartprinting (CMJN).
- Flexilivre.
- Pumbo.
- Lulu, avec une usine en France.
- Prodigi et Gelato :
  - réseau UE confirmé pour Prodigi, non confirmé pour Gelato ;
  - compte de type professionnel requis ;
  - prix accessibles seulement après connexion.
- Fotofabriek : seulement par la procédure manuelle (retrait, puis chat, puis paiement du port PostNL).

**À écarter ou à rétrograder :**
- **CEWE :** pas de PDF sur cewe.fr ; la voie InDesign passe par la Belgique ou le Luxembourg, livraison en France non confirmée. À retirer, ou à marquer « non disponible en France ».
- **Fotofabriek :** à garder seulement avec un avertissement (envoi en France hors tunnel, prix du port inconnu).
- **Blurb :** à garder, mais signaler la note de 2,3/5 et la douane sur les Layflat imprimés aux États-Unis.

---

### Corrections appliquées à `src/lib/imprimeurs/catalogue.ts`

**Saal**
- `21x28` : base 33,99 en S → prix catalogue 33,99 € en **V** (promo 22,99 € jusqu'au 09/11). Source : https://www.saal-digital.fr/album-photo/album-photo-21-x-28/
- `28x19` : 24,99 → **19,99**.
- `19x19` : 14,99 → **16,99**.
- `28x28` : 34,99 → **29,99**.
- `pro-30x30` : 75,49 → **99,99**, et pagesMax 160 → **130**. Remise Pro Line −20 % dès 26 pages, −25 % dès 70, −30 % dès 100.
- `pdfFrance.source` → https://www.saal-digital.fr/service/infos-pro/telechargez-votre-pdf-dans-la-boutique-en-ligne/
- `delais` :
  - fabrication 2 → **1 à 2 jours** (Pro Line 2 à 3) ;
  - livraison null → **4 à 5 jours ouvrés** en standard, 1 à 2 en express ;
  - statut **V**, source : page frais d'expédition.
- `port.premier` : null → **5,99 € (S)**, source virusphoto.
- `note` : 5 076 → **5 077** avis, source fr.trustpilot.

**Blurb**
- `technique.couleur` : « sRGB » → **CMJN recommandé, sRGB accepté** (V).
- `technique.normePdf` : « PDF/X-3 » → **libre**. Aucune norme n'est imposée, selon l'article 207792946.
- `technique.fichiers` : « separes » → séparés **ou un seul PDF**.
- `technique.poidsMaxMo` : → **2 048 Mo** pour les pages, **90 Mo** pour la couverture.
- `technique` : marge de sécurité 6,35 mm (V).
- `delais.fabrication` : 5 → **4 à 5 jours ouvrés** (V).
- Ajouter : livres photo imprimés dans l'UE, sans douane ; Layflat imprimés aux États-Unis, droits possibles.
- Ajouter les remises : −20 % de 10 à 49 exemplaires, −25 % de 50 à 99.
- `note` : 2,3/5 sur 892 avis (blurb.co.uk) → **2,3/5 sur 194 avis (blurb.fr)**.

**Fotofabriek**
- `pdfFrance` : null NV → **oui, procédure manuelle (V)**. Source : https://www.fotofabriek.nl/faq/pakketje-naar-buitenland/
- `a4-portrait` et `a4-paysage` : pagesIncluses 24 désormais **V** ; parPageSup null → **0,65 €** (unité à confirmer).
- `a4-plat` : parPageSup null → **0,90 €**.
- Ajouter le **30×30 rigide** (44,99 € + 1,10 €) et le **30×30 à plat** (54,99 € + 1,40 €).
- `technique.securite` : 6 → **20 mm du fond perdu** pour les textes (V).
- `technique.couleur` : sRGB, désormais **V**.
- `port` : tarifs NL/BE D 5,45 € et E 6,45 €, gratuit dès 50 € ; France au tarif PostNL sur demande.

**Pixartprinting**
- `pdfFrance` : S → **V** (page produit).
- `technique.fichiers` : « unique » → **unique ou deux PDF**.
- `technique` : statut S → **V** (CMJN Fogra 39, fond perdu 3 mm, 15 et 5 mm, 300 dpi).
- `technique.normePdf` : « PDF/X-4 » → **PDF 1:1, norme non imposée** sur la page produit.
- Pages 24 à 200, pas de 4 : à signaler comme **NV**.
- `note` : 3 398 → **3 402** avis.

**CEWE**
- `pdfFrance` : false en S → **false en V** (absent du plan du site cewe.fr).
- `lienCommande` : cewe.co.uk → à supprimer. Mentionner cewe.lu/fr et cewe.kruidvat.be/fr (InDesign seulement).
- Livraison : Colissimo ou Colis Privé 48 h, Chronopost 24 h.
- Remise : −10 % pour 2 exemplaires, −15 % pour 3, −20 % dès 5.
- `note` : 129 829 → **129 844** avis.

**Lulu**
- Produits : 11×8,5 et 8,5×8,5 désormais **V**, « dès 14,76 USD » en V (page probablement ancienne).
- pagesMax 240 → **NV** (rigide 24 à 800 en général).
- `delais.fabrication` : → **3 à 5 jours ouvrés (V)**.
- Ajouter : impression en France possible ; TVA française collectée par Lulu.
- `note` : 6 547 → **6 553** avis.

**Gelato**
- `technique.couleur` : sRGB → **CMJN (sortie GRACoL 2006)**.
- `technique.normePdf` : libre → **PDF/X-4**.
- `technique.securite` : 10 → **4 mm**.
- `technique` : fond perdu de 3 mm confirmé, statut NV → **V**. Source : https://support.gelato.com/en/articles/8996349
- Ajouter : compte et carte bancaire requis.

**Prodigi**
- `a4-portrait` : 210×297 → **210×300** (« 21×30 cm »).
- Supprimer toute idée de 30×30 en rigide. Ajouter le **Layflat 297×297** (18 à 122 pages, dès 17,51 £ HT hors port, fabriqué dans l'UE).
- `technique.couleur` : préciser **RVB, export PDF/X-4 FOGRA39** (V).
- Fabrication 120 h pour le livre rigide, 96 h pour le souple.
- `note` : 146 → **148** avis.
- Peecho : « a Prodigi Group company » (V).

**Nouvelles fiches proposées**
- **Flexilivre** :
  - PDF V ;
  - A4 rigide 29,90 €, 30×30 rigide 38,90 €, à plat 42,90 / 49,90 € ;
  - 24 à 400 pages, par 2 ;
  - marge de 5 mm, RVB ;
  - note 4,7/5 sur 39 191 avis.
- **Pumbo** :
  - livre relié à partir d'un PDF ;
  - minimum 18 pages, jusqu'à 300×300 mm ;
  - port minimum 3 € TTC, GLS ;
  - prix NV.

**Encore NV après cette recherche :**
- frais de port exacts pour la France chez Blurb, Pixartprinting, CEWE, Lulu, Gelato, Prodigi et Flexilivre ;
- prix par page chez Saal, Pixartprinting, Lulu, Gelato et Prodigi ;
- prix de Pumbo ;
- livraison en France depuis cewe.lu.

Ces valeurs demandent une simulation de panier ou un compte.

---

## 1. Tri des candidats

| Candidat | PDF libre accepté ? | Décision |
|---|---|---|
| Saal Digital | **Oui** : dépôt PDF ou JPG via la boutique en ligne, avec gabarits InDesign/Photoshop et preset PDF [V] | **Retenu** (haut de gamme possible : Professional Line) |
| Blurb | **Oui** : « PDF to Book », intérieur et couverture séparés [V] | **Retenu** |
| Fotofabriek (NL, appelé « Fotofabrik » dans le brief) | **Oui** : « PDF-Uploader » [V] | **Retenu**, livraison en France à confirmer [NV] |
| Pixartprinting | **Oui** : dépôt PDF avec contrôle automatique du fichier [S, blog Pixartprinting] | **Retenu** (seul profil CMJN) |
| CEWE | **Oui, mais seulement CEWE UK confirmé** : « PDF to Book » (logiciel Java + gabarits InDesign, puis dépôt de 2 PDF) [V, guide 2021] | **Retenu sous réserve**. Disponibilité sur cewe.fr non confirmée [NV] |
| Lulu (Print API) | **Oui** : PDF intérieur + PDF couverture, par le site ou par l'API [V] | **Retenu** (API V2) |
| Gelato | **Oui** : un seul PDF (couverture + pages intérieures) [V] | **Retenu** (API V2) |
| Prodigi | **Oui** : PDF, et API (dimensions du dos fournies par l'API) [V] | **Retenu** (API V2) |
| Peecho | Oui, mais **racheté par Prodigi** ; ses livres photo migrent vers Prodigi (billet du 9 janvier 2025) [V] | **Fusionné avec Prodigi** |
| Photobox | Aucune trace de dépôt PDF trouvée : création seulement dans l'éditeur maison [NV] | **Écarté** (logiciel maison seulement, à reconfirmer) |
| Albelli | Idem : aucune trace de dépôt PDF trouvée [NV] | **Écarté** (logiciel maison seulement, à reconfirmer) |
| Photoweb | Idem : aucune trace de dépôt PDF trouvée [NV] | **Écarté** (logiciel maison seulement, à reconfirmer) |
| Printler | Plateforme d'affiches et de tirages d'art, pas de livre photo [NV] | **Écarté** (hors sujet) |

Résultat : **8 imprimeurs retenus** (dont 1 sous réserve). Options haut de gamme : Saal Digital Professional Line (papier photo, reliure à plat), Blurb Layflat (papiers Eggshell et Mohawk proPhoto Pearl), CEWE papier photo à plat, Fotofabriek « vlakliggend ».

## 2. Tableau de synthèse

| Imprimeur | Formats repères | Pages | Fond perdu | Zone de sécurité | Couleur | Fichiers | Dos | Prix indicatif ~100 p. rigide | Trustpilot (relevé 02/11/2026) | Commande |
|---|---|---|---|---|---|---|---|---|---|---|
| Saal Digital | 19x19 à 42x28 cm ; Pro Line 21x21 à 40x30 | 26–160 (selon format/papier), par 2 [V] | valeur mm [NV] (gabarits) | ~10 mm conseillés [V] | **sRGB** [V] | Intérieur **en doubles pages** + couverture 1 PDF (dos inclus), séparés ou combinés [V] | gabarit (formule [NV]) | 21x21 Pro Line dès 52,49 € (26 p.) ; page sup. [NV] | 4,5/5 (1 153 avis, .co.uk) ; 4,7/5 (6 455, .it) [S] | Dépôt PDF |
| Blurb | 18x18, 20x25, 25x20, 30x30, 33x28 cm | min. 20, pair [V] ; max [NV] | 3,175 mm (0,125") [S] | 6,35 mm (0,25") [S] | RVB, profil ICC Blurb dispo [V] | Intérieur + couverture séparés [S] | gabarit selon pages [S] | 20x25 Premium Lustre : 46 $ + 0,45 $/p. → ~82 $ (100 p.) [V calcul] | 2,5/5 (~890 avis, blurb.co.uk) [S] | Dépôt PDF |
| Fotofabriek | [NV] | 24–200 (rigide), 24–140 (à plat) [V] | 3 mm [S] | charnière 10 mm en couverture [V] | [NV] | PDF-Uploader [V] | **Table officielle** [V] | [NV] | [NV] | Dépôt PDF |
| Pixartprinting | [NV] | [NV] | 3 mm [S] | 15 mm côté reliure, 5 mm ailleurs [S] | **CMJN FOGRA39** [S] | 1 PDF : couverture étalée puis pages [S] | gabarit [NV] | [NV] | ~2 340 avis sur pixartprinting.fr, note [NV] | Dépôt PDF |
| CEWE (UK) | [NV] | min. 26, par 4 ; max 178 (numérique) / 114 (photo à plat) [V] | 3 mm intérieur, 10 mm couverture [V] | zone « design » dans gabarit [V] | **sRGB**, PDF 1.3 via preset [V] | 2 PDF : contenu + couverture [V] | gabarit selon pages et papier [V] | [NV] | 4,5/5 (~33 347 avis, cewe.co.uk) [S] | Dépôt PDF (UK) |
| Lulu | 7x7", 8,5x8,5" ?, 10x8", 12x12" [S/NV] | [NV] | 3,175 mm [V] | 12,7 mm intérieur + 5,08 mm reliure ; couverture rigide 19,05 mm [V] | **sRGB préféré**, TAC ≤ 270 % [V] | 1 PDF intérieur pages simples + 1 PDF couverture [V] | gabarit / API [V/NV] | [NV] | ~4 à 4,5/5 (~6 000) [S, non confirmé] | Dépôt PDF + **API** |
| Gelato | [NV] | 30–200 [V] | [NV] | zone code-barres à éviter [V] | [NV] | **1 seul PDF** : p.1 couverture étalée, p.2 et dernière vierges [V] | dans la couverture, largeur [NV] | [NV] | 4,3–4,5/5 (~3 200) [S] | **API** (+ dépôt) |
| Prodigi (+Peecho) | A5 à 29x29 cm ; à plat 20x20 à 29x29 [V] | rigide 24–504 ; souple 20–300 ; à plat 24–122 [V] | souple : ne pas en mettre [V] ; rigide [NV] | 10 mm (souple) [V] | RVB 300 dpi, **PDF/X-4** [V] | pages simples ; **dos fourni à part via API** [V] | **API** [V] | [NV] | 3,5/5 (~160) [S] | Dépôt + **API** |

## 3. Fiches par imprimeur

### 3.1 Saal Digital (Allemagne)
- **Sources** (02/11/2026) : https://www.saal-digital.fr/livre-photo/ ; https://www.saal-digital.com/service/professional-zone/create-your-files-in-indesign ; Trustpilot https://www.trustpilot.com/review/saal-digital.co.uk et https://www.trustpilot.com/review/saal-digital.it
- **PDF libre** : oui. PDF ou JPG déposés dans la boutique ; couverture et intérieur en deux PDF ou un seul [V]. Couvertures spéciales (cuir, acrylique, métal) : **pas de PDF**, texte et clipart seulement (sauf cuir blanc, acrylique et métal brossé en Professional Line) [V].
- **Formats** [V] : 21x28, 28x28, 28x19, 19x19, 15x15, 15x21, 21x15, 42x28 cm ; Professional Line 40x30, 30x30, 30x21, 22x30, 21x21 cm. Valeurs exactes en mm des gabarits [NV].
- **Reliure** : reliure à plat (layflat) sur tous les livres photo [S, Phototrend].
- **Papiers** [V] : Fujifilm Crystal Archive HD Album brillant 368 g/m², mat 368 g/m², satiné, papier mat non couché (jet d'encre).
- **Pages** [V] : 26 à 160 selon format et papier ; 42x28 jusqu'à 130 ; ajout par **2**. Le nombre de pages n'inclut pas la couverture. Les pages de garde intérieures sont imprimées (laisser vide la 1re page de la 1re double page et la dernière page de la dernière double page pour du blanc).
- **Fond perdu** : présent dans les gabarits, valeur en mm [NV]. Doubler la valeur sur les doubles pages.
- **Zone de sécurité** [V] : ~1 cm entre éléments importants et ligne de fond perdu (ou remplir toute la page).
- **Couleur** [V] : **sRGB IEC61966-2.1**, toujours. Profils ICC par surface disponibles (pour épreuvage écran). CMJN non mentionné.
- **PDF** [V] : pas de norme PDF/X citée ; preset « Saal Digital » ou « Qualité impression ». Polices incorporées, **pas de traits de coupe**. Intérieur **en planches (doubles pages)** : une page PDF = une double page.
- **Dos** : repères dans le gabarit de couverture, formule [NV]. Code-barres imprimé sur le dos/3e de couverture [S].
- **Poids max** : [NV] (« optimiser le PDF »).
- **Typo minimale** [V] : 8 pt sans empattement, 10 pt avec empattement, 12 pt pour les graisses fines, 14 pt en texte clair sur fond foncé ; filets ≥ 1 pt.
- **Prix** [V, TTC hors port] : 19x19 dès 14,99 € ; 21x28 dès 19,99 € ; 28x28 dès 34,99 € ; Pro Line 21x21 dès 52,49 € ; Pro Line 30x30 dès 75,49 €. Remise Pro Line −30 % dès 100 pages jusqu'au 02/11/2026. Prix de la page supplémentaire [NV] : à relever dans le configurateur.
- **Port France** : variable, page « Frais d'expédition » [NV]. **Délais** : fabrication 1 à 2 jours ouvrés, express possible [V].
- **Trustpilot** [S] : 4,5/5 (1 153 avis, saal-digital.co.uk), 4,7/5 (6 455 avis, saal-digital.it). Page .fr non trouvée.
- **Commande** : dépôt PDF. Pas d'API publique connue [NV].

### 3.2 Blurb (États-Unis, impression aussi en Europe [NV])
- **Sources** (02/11/2026) : https://www.blurb.com/pdf-to-book ; https://www.blurb.com/pricing ; Trustpilot https://www.trustpilot.com/review/blurb.co.uk ; fil Adobe citant la fiche Blurb 8x10 (https://community.adobe.com/t5/lightroom-classic-discussions/how-to-quot-export-book-to-pdf-quot-with-quot-bleed-quot/m-p/9570750/highlight/true) ; guide non-Adobe (https://www.blurb.com/downloads/pdf_to_book/NonAdobe_Workflow.pdf, 2010)
- **PDF libre** : oui, PDF to Book [V].
- **Formats** [V] : 18x18 (7x7"), 20x25 (8x10"), 25x20 (10x8"), 30x30 (12x12"), 33x28 cm (13x11"). Mini 13x13 en souple.
- **Reliure** [V] : rigide ImageWrap ; **layflat** en ImageWrap rigide seulement.
- **Papiers** [V] : Standard 80# semi-mat, Premium Lustre 100# (brillant ou mat), Pro Mohawk proPhoto Pearl 140# ; à plat : Premium Lustre 295#, Eggshell 402#, proPhoto Pearl 506#.
- **Pages** [V] : livre photo min. **20**, nombre **pair**. Max [NV].
- **Fond perdu** [S] : 0,125" (3,175 mm) haut, bas, extérieur (8x10 : PDF final 8,125 x 10,25").
- **Zone de sécurité** [S] : 0,25" (6,35 mm) haut, bas, extérieur ; 0,5" côté reliure (à confirmer).
- **Couleur** [V] : RVB, profil ICC Blurb téléchargeable ; texte en noir 100 % ; pas de tons directs.
- **PDF/X** [S] : **PDF/X-3:2002** (preset Blurb, guide 2010 et Pixellu). PDF/X-4 accepté ? [NV]
- **Fichiers** [S] : intérieur et couverture séparés ; couverture = gabarit téléchargé selon format et nombre de pages.
- **Dos** : gabarit Blurb selon pages et papier [S]. Formule [NV].
- **Poids max** : [NV].
- **Prix** [V, USD, base = 20 pages] : 20x25 Premium Lustre 46 $ + 0,45 $/page → **~82 $ pour 100 pages** ; 30x30 Premium Lustre 74 $ + 0,84 $/p. → ~141 $ ; 20x25 à plat Premium Lustre 70 $ + 1,85 $/p. → ~218 $ ; à plat Eggshell/proPhoto 109 $ + 3,50 $/p. Prix en euros [NV].
- **Port France, délais** : [NV].
- **Trustpilot** [S] : **2,5/5 (~892 avis**, blurb.co.uk ; un autre instantané donne 2,9/890).
- **Commande** : dépôt PDF. API pour partenaires [NV].

### 3.3 Fotofabriek (Pays-Bas)
- **Sources** (02/11/2026) : https://www.fotofabriek.nl/faq/rugdiktes ; https://www.fotofabriek.nl/content/pdf/fotofabriek-templates-handleiding-indesign.pdf
- **PDF libre** : oui, « PDF-Uploader » (Photoshop, InDesign) [V].
- **Formats, papiers, prix, port France, délais, Trustpilot** : [NV]. Le site est néerlandais : livraison en France à confirmer.
- **Fond perdu** [S] : 3 mm (guide InDesign) ; ne pas ajouter de traits de coupe.
- **Charnière** [V] : zone de 1 cm à côté du dos, sur la 1re et la 4e de couverture.
- **Dos (rigide)** [V] (souple : retirer 3 mm) :
  - Standard / UV brillant : 24–34 p. = 6 mm ; 36–46 = 7 ; 48–60 = 8 ; 62–70 = 9 ; 72–82 = 10 ; 84–98 = 11 ; **100–114 = 12** ; 116–126 = 13 ; 128–138 = 14 ; 140–154 = 15 ; 156–170 = 16 ; 172–186 = 17 ; 188–196 = 18 ; 200 = 19 mm.
  - À plat (vlakliggend) : 24–28 = 10 mm ; 30–42 = 12 ; 44–52 = 14 ; 54–66 = 17 ; 68–82 = 20 ; 84–90 = 22 ; **92–100 = 24** ; 102–114 = 27 ; 116–128 = 30 ; 130–140 = 33 mm.
- **Pages** [V, déduit de la table] : 24 à 200 (rigide standard), 24 à 140 (à plat), nombre pair.
- **Commande** : dépôt PDF.

### 3.4 Pixartprinting (Italie)
- **Sources** (02/11/2026) : https://www.pixartprinting.fr/blog/impression-livres-photo/ ; https://www.pixartprinting.fr/impression-revues-catalogues-livres/finition-couverture-rigide/ ; https://www.pixartprinting.fr/blog/impression-de-livres-en-ligne-guide/ ; Trustpilot https://ca.trustpilot.com/review/pixartprinting.fr
- **PDF libre** : oui, dépôt PDF après choix du format, papier et reliure, avec contrôle préalable gratuit [S, blog Pixartprinting].
- **Couleur** [S] : **CMJN, profil FOGRA39**, 300 dpi.
- **PDF** [S] : PDF/X recommandé ; échelle 1:1 ; pas de mot de passe ; pas de traits de coupe ; polices incorporées.
- **Fond perdu** [S] : 3 mm par côté. **Sécurité** [S] : 15 mm côté reliure, 5 mm aux autres bords.
- **Fichiers** [S] : rigide premium = **un seul PDF** : couverture étalée (4e + 1re) puis pages intérieures dans l'ordre. Un ancien guide (reliure cousue) parle d'une couverture séparée : vérifier selon la reliure.
- **Formats, pages min/max, dos, poids max, prix, port, délais** : [NV]. Gabarits téléchargeables par produit.
- **Trustpilot** : ~2 340 avis sur pixartprinting.fr, note [NV] ; avis mitigés selon les pays [S].
- **Commande** : dépôt PDF.

### 3.5 CEWE (Allemagne) : sous réserve
- **Sources** (02/11/2026) : https://cewe.co.uk/pdf-to-photobook.html ; guide https://cdn.cewe.co.uk/downloads/user-guide.pdf (Word 2018, modifié en juillet 2021) ; Trustpilot https://fr-be.trustpilot.com/review/cewe.co.uk
- **PDF libre** : oui sur **CEWE UK** (« PDF to Book ») : installer le logiciel (Java), choisir couverture, papier, format et pages, générer les gabarits InDesign, exporter avec le preset CEWE_PDF_v3.0, déposer 2 PDF [V]. **Sur cewe.fr : non confirmé** [NV]. Sans ce service en France, CEWE n'accepte que son logiciel.
- **Reliures/papiers** [V] : impression numérique (classique, brillant, mat), rigide ou souple, dos collé ; papier photo argentique (classique, mat, brillant) en **reliure à plat**.
- **Pages** [V] : min. **26** pages intérieures ; ajout par **4** (le logiciel propose des gabarits par 8) ; max **178** (numérique), **114** (papier photo).
- **Fond perdu** [V] : **3 mm** intérieur, **10 mm** couverture. Tolérance de coupe 3 mm.
- **Couleur** [V] : **sRGB** ; le preset convertit tout en sRGB (AdobeRGB toléré). Pas de tons directs.
- **PDF** [V] : PDF 1.3, RVB, polices incorporées (preset imposé, ne pas modifier). 300 à 360 dpi.
- **Fichiers** [V] : 2 PDF (contenu + couverture). 1re page intérieure à droite, dernière à gauche.
- **Dos** [V] : selon nombre de pages et papier, via le gabarit (pas de formule publiée).
- **Prix, port, délais, poids max** : [NV].
- **Trustpilot** [S] : 4,5/5 (~33 347 avis, cewe.co.uk).

### 3.6 Lulu (États-Unis ; Print API)
- **Sources** (02/11/2026) : https://help.api.lulu.com/en/support/solutions/articles/64000254609-pdf-creation-settings ; https://assets.lulu.com/media/guides/en/luluapi-getting-started-guide.pdf ; https://www.lulu.com/fr/products
- **PDF libre** : oui, site et **Print API** [V].
- **Produit** [V] : album photo rigide, papier couché blanc 80# « premium color », couverture brillante ou mate. Production 3 à 5 jours ouvrés. Formats en mm [NV] (sources tierces : 7x7", 10x8", 12x12").
- **Fond perdu** [V] : **0,125" = 3,175 mm** par côté (page 6x9" → PDF 6,25x9,25").
- **Sécurité** [V] : intérieur **12,7 mm** (0,5") + **5,08 mm** côté reliure (0,2") ; couverture 6,35 mm, **19,05 mm (0,75") en rigide « casewrap »**.
- **Couleur** [V] : **sRGB préféré** (converti en CMJN par l'imprimeur) ; contenu sRGB + profil GRACoL ; si CMJN, rester en CMJN ; **TAC ≤ 270 %** ; pas d'aplats < 20 % ; N&B en niveaux de gris gamma 2,2–2,4.
- **Résolution** [V] : 300 ppi intérieur ; couverture 300–600 ppi.
- **PDF** [V] : norme PDF/X non imposée (joboptions Lulu) ; polices incorporées ; transparences aplaties ; pas de traits de coupe ; pas de mot de passe.
- **Fichiers** [V] : **1 PDF intérieur en pages simples portrait** + **1 PDF couverture d'une seule pièce** (4e + dos + 1re).
- **Dos** : gabarit généré selon le nombre de pages [V] ; l'API expose un calcul des dimensions de couverture (endpoint « cover dimensions ») [NV, connu mais non revérifié].
- **Pages min/max, poids max, prix (base + page), port France, délais** : [NV]. Calculateur de prix et API de devis.
- **Trustpilot** : ~4 à 4,5/5 (~6 000 avis) vu en lien depuis la page Blurb [S, non confirmé].

### 3.7 Gelato (Norvège ; réseau mondial, API)
- **Sources** (02/11/2026) : https://support.gelato.com/en/articles/8996282-how-do-i-design-a-photo-book ; https://support.gelato.com/en/articles/8996349 ; Trustpilot https://www.trustpilot.com/review/gelato.com
- **PDF libre** : oui ; **API** de commande (plateforme print-on-demand) [V pour le PDF ; API connue].
- **Pages** [V] : 30 à 200 pages intérieures, nombre fixe choisi à la commande.
- **Fichier** [V] : **un seul PDF** couverture + intérieur. Exemple 30 pages : PDF de 33 pages = p.1 couverture étalée (4e, dos, 1re) ; p.2 garde vierge ; p.3–32 pages intérieures ; p.33 garde vierge.
- **Couverture** [V] : éviter la zone du code-barres.
- **Formats** : souple confirmé (exemple 8x11") ; rigide [NV]. Fond perdu, sécurité, couleur, dos, poids, prix : [NV] (article « design requirements » existant, valeurs non lues).
- **Trustpilot** [S] : 4,3 à 4,5/5 (~3 200 avis).

### 3.8 Prodigi (Royaume-Uni ; a absorbé Peecho ; API)
- **Sources** (02/11/2026) : https://www.prodigi.com/blog/photo-books-now-available/ (9 janvier 2025) ; https://www.prodigi.com/download/print-guides/softcover-photo-book-print-guide.pdf ; https://support.peecho.com/hc/en-us/articles/19730953142428-Hardcover-books-File-set-up-guideline ; Trustpilot https://au.trustpilot.com/review/prodigi.com
- **PDF libre** : oui, commande manuelle ou **API** [V].
- **Gamme** [V] : rigide (couverture pelliculée mate, dos collé PUR, 24–504 p., 120–200 g/m², brillant ou Mohawk Superfine Eggshell non couché, A5 à 29x29 cm) ; souple (20–300 p., A5 à A4) ; **à plat** (24–122 p., E-Photo lustre 190 g/m², 20x20 à 29x29 cm, paysage ou carré).
- **Formats souple** [V] : A5 148x210 / 210x148 ; A4 210x297 / 297x210 ; carré 210x210 mm.
- **Souple** [V] : nombre de pages pair ; **pas de fond perdu ni traits de coupe** (ajoutés par Prodigi) ; **sécurité 10 mm** ; 300 dpi RVB ; pages simples ; gardes blanches ajoutées ; 1re page du PDF = 1re de couverture, dernière = 4e.
- **PDF** [V] : **PDF/X-4** recommandé ; polices incorporées ; transparences aplaties. FOGRA39 mentionné pour Peecho [S].
- **Dos** [V] : en API, **fourni à part**, dimensions **demandées à l'API** (dépend du nombre de pages et du laboratoire).
- **Rigide** : fond perdu, sécurité [NV]. Lieux de production en Europe, prix, port, délais : [NV].
- **Trustpilot** [S] : 3,5/5 (~160 avis).

## 4. Recommandation

### V1 (export PDF + lien direct)
1. **Saal Digital** : meilleur compromis qualité/note, papier photo et reliure à plat, sRGB, production en Allemagne en 1 à 2 jours. Gamme Professional Line = **option haut de gamme**. Attention : intérieur **en doubles pages**.
2. **Pixartprinting** : seul profil **CMJN FOGRA39** ; utile pour tester la chaîne CMJN et pour un prix au volume. À vérifier : prix, limites de pages.
3. **Blurb** : PDF to Book bien documenté, layflat sur papiers d'art (Eggshell, proPhoto Pearl). **Note Trustpilot faible (2,5/5)** : à afficher clairement dans le comparateur.
4. **Fotofabriek** : seule **table de dos officielle** trouvée, idéale pour tester le calcul du dos. Confirmer la livraison en France.
5. **CEWE** : seulement si le dépôt PDF existe sur cewe.fr (sinon, écarter : logiciel seul). Sinon proposer CEWE UK pour les livraisons au Royaume-Uni.

### V2 (commande par API)
1. **Lulu Print API** : spécifications les plus complètes et publiques, devis et calcul de couverture par API. Prévoir les marges de sécurité les plus larges (19 mm en couverture rigide).
2. **Prodigi** (+ Peecho) : gamme la plus large (24–504 p., layflat), dos donné par l'API. Note Trustpilot moyenne.
3. **Gelato** : bonne note, réseau mondial, mais structure de fichier particulière (PDF unique avec gardes vierges) et rigide à confirmer.

**À faire avant de coder les règles** : relever les [NV] prioritaires : prix par page (Saal, Lulu, Gelato, Prodigi, Pixartprinting), fond perdu Saal, max pages Blurb, rigide Gelato/Prodigi, cewe.fr, livraison France de Fotofabriek. Valider aussi par un appel réel à chaque API (Lulu, Prodigi, Gelato) en mode sandbox.

## 5. Règles techniques communes à modéliser dans l'éditeur

Le modèle de livre reste indépendant de l'imprimeur ; chaque **profil imprimeur** déclare :

1. **Format fini** (largeur × hauteur en mm) par produit, et orientation.
2. **Pages** : `min`, `max` (selon format **et** papier), `pas` (2, 4…), et ce que compte « une page » (hors couverture partout).
3. **Fond perdu** intérieur et couverture séparés (ex. CEWE 3 mm / 10 mm ; Lulu 3,175 mm ; Prodigi souple 0 mm car ajouté par l'imprimeur).
4. **Zones de sécurité** : extérieur, côté reliure (gouttière), couverture, **charnière** (Fotofabriek 10 mm) et **zone code-barres** (Gelato, Saal). L'alerte « texte trop près du massicot » doit lire ces valeurs.
5. **Dos** selon 3 modes : `table` (Fotofabriek : tranches de pages → mm), `formule` (épaisseur papier × pages + constante), `api` (Lulu, Prodigi). Seuil de texte au dos configurable.
6. **Couleur de sortie** : `sRGB` (défaut : Saal, CEWE, Lulu, Prodigi, Blurb) ou `CMJN FOGRA39` (Pixartprinting) avec conversion côté serveur ; limite d'encrage (Lulu TAC 270 %) ; N&B en niveaux de gris.
7. **Norme PDF** : `PDF/X-4` (Prodigi), `PDF/X-3:2002` (Blurb), `PDF 1.3 RVB` (CEWE), libre (Saal, Lulu). Toujours : polices incorporées, transparences aplaties si demandé, **pas de traits de coupe**, pas de mot de passe, TrimBox/BleedBox renseignées.
8. **Découpage des fichiers** : `intérieur + couverture séparés` (Blurb, Lulu, CEWE, Saal), `PDF unique` (Gelato, Pixartprinting) avec l'ordre des pages imposé, et **gardes vierges** à insérer (Gelato p.2 et dernière ; Saal : pages de garde imprimées).
9. **Mise en page des pages** : pages simples (la plupart) ou **planches en doubles pages** (Saal) ; 1re page intérieure à droite.
10. **Résolution** : 300 dpi visés (alerte < 250, blocage < 150, comme prévu au §6) ; plafond 600 ppi en couverture Lulu.
11. **Typo minimale** (repère Saal) : 8 pt sans empattement, 10 pt avec empattement, filets ≥ 1 pt.
12. **Poids max de fichier** : aucune valeur trouvée ; prévoir un champ par imprimeur, et compresser les images à la résolution utile.
13. **Fraîcheur** : chaque valeur porte sa source URL, sa date de relevé et son statut (vérifié, secondaire, non vérifié).

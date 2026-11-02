# Recherche : PDF du livre photo, impression et mise en page automatique

Recherche courte (environ 20 recherches), 2 novembre 2026. Périmètre : sections 6 et 8 de `docs/PROMPT-LANCEMENT.md`.
Légende : **[vérifié]** = lu dans une source primaire (docs officielles, registre npm) ; **[à confirmer]** = source secondaire, ancienne ou estimation, à valider pendant le spike.

---

## 0. Recommandation (ferme)

1. **Moteur PDF : Typst** (version 0.15.x, sortie le 15 juin 2026), piloté depuis TypeScript, **et pas Chromium + Paged.js**.
   - Typst 0.15 gère nativement le **fond perdu** (paramètre `bleed` de `page`) et écrit une **TrimBox** dès que le fond perdu n'est pas nul **[vérifié]**. Chromium ne gère ni `bleed` ni `marks` de `@page` et n'écrit ni TrimBox ni BleedBox **[à confirmer, mais convergent]**.
   - Polices embarquées et sous-ensemblées, rendu déterministe, aucun navigateur à lancer, un binaire natif de 52 Mo (`@myriaddreamin/typst-ts-node-compiler` 0.7.0, linux-x64) au lieu des 70 Mo de `@sparticuz/chromium` 153 **[vérifié, npm]**.
   - Paged.js est figé depuis la 0.4.3 (juillet 2023) **[vérifié, npm]**.
2. **Une seule source de vérité géométrique** : le moteur de mise en page (TypeScript) produit pour chaque page des cadres en millimètres (x, y, l, h, recadrage, texte). L'éditeur React affiche ces cadres à l'écran ; Typst ne fait que **placer** ces cadres (`place` + `image` + blocs de texte). On ne dépend pas de la pagination automatique du moteur PDF, sauf pour faire couler le texte dans un cadre.
3. **Images préparées avant le rendu** : chaque photo est recadrée et ré-échantillonnée par `sharp` à la taille exacte de son cadre à 300 dpi (fond perdu compris), en JPEG sRGB qualité 85-90. Le PDF n'embarque jamais l'original de 24 Mpx. C'est la principale clé du poids des fichiers et de la mémoire.
4. **Couleur : RVB sRGB par défaut** (PDF 1.7, polices embarquées, TrimBox, profil sRGB). C'est ce que demandent CEWE et Saal Digital **[vérifié, guides officiels]**. CMJN et PDF/X en option par imprimeur, en post-traitement Ghostscript, seulement si un imprimeur retenu l'exige.
5. **Exécution de l'export final : GitHub Actions (plan A pour le PDF imprimeur)**, déclenché par l'API (`workflow_dispatch`), runner public gratuit, une seule passe Typst sur le livre entier, upload direct sur R2, rappel (webhook) vers l'app. **Vercel** sert à l'aperçu, au déclenchement, au suivi de progression et aux petits exports (≤ 60-80 pages) découpés en lots. **Plan B** : la même image Docker sur Cloudflare Containers (forfait Workers Paid à 5 $/mois, en limite de budget) ou Fly.io à la demande.
6. **Mise en page auto** : bibliothèque de gabarits (cadres en proportions) + **programmation dynamique** sur la suite chronologique des photos de chaque épisode, avec un coût (recadrage, importance, rythme) et une contrainte de nombre de pages total.
7. **Polices** : titrage **Cormorant Garamond** (ou **Newsreader** si on veut un texte courant plus robuste), légendes **Inter** ou **Source Sans 3**. Toutes sous licence OFL, embarquables.

**Ce qu'il faut prouver en 1 à 2 jours** : voir § 7 (spike).

---

## 1. Moteur de rendu

### 1.1 Comparatif

| Critère | Chromium headless (+ Paged.js ou `@page` natif) | **Typst 0.15** | pdf-lib / PDFKit | react-pdf | pdfme |
|---|---|---|---|---|---|
| Maintenance | Chromium : oui. `@sparticuz/chromium` 153.0.0 (sept. 2026). **Paged.js 0.4.3, juillet 2023** | Actif (0.14 en oct. 2025, 0.15 en juin 2026) ; binding Node 0.7.0 (mai 2026) | pdf-lib figé depuis 2021 (fork actif `@cantoo/pdf-lib` 2.11.1) ; PDFKit 0.20.2 (août 2026) | 4.9.0 (août 2026) | Actif, mais orienté formulaires |
| Fond perdu, TrimBox, BleedBox | Non natifs : il faut agrandir la page et écrire les boîtes après coup (pdf-lib) | `bleed` natif, **TrimBox écrite** ; BleedBox non mentionnée → à ajouter en post-traitement si un imprimeur l'exige | Tout à la main (pdf-lib sait poser TrimBox/BleedBox) | Non | Non |
| Polices | Embarquées, sous-ensemble | Embarquées, sous-ensemble | Embarquées (fontkit) | Embarquées | Embarquées |
| Images haute résolution | Mémoire du navigateur élevée (400-600 Mo par appel cité pour des documents simples **[à confirmer]**) ; risque de ré-encodage | Charge les images en mémoire ; WebP ré-encodé en PNG (PDF énorme) → **n'envoyer que du JPEG** | Bon contrôle (JPEG intégré tel quel) | Lent et gourmand sur gros volumes | — |
| Texte, typographie | Excellente (césure, crénage) | Excellente (césure FR, crénage, OpenType) | Pauvre (pas de mise en page de texte) | Correcte (yoga) | Faible |
| CMJN | Non | Couleurs et images CMJN gérées, couleurs d'accompagnement ; pas de PDF/X | Possible à la main | Non | Non |
| PDF/X, OutputIntent | Non | Non (PDF/A et PDF/UA seulement) | À la main | Non | Non |
| Aperçu dans le navigateur | Même HTML | typst.ts en wasm (SVG/canvas), plus lent que le natif | — | Oui | Oui |
| Temps pour 200 pages | Lancement 3-6 s + rendu, limité par la mémoire **[à confirmer]** | Inconnu, attendu en dizaines de secondes, dominé par la lecture des images **[à mesurer au spike]** | Rapide | Lent | — |

### 1.2 Pourquoi pas Chromium + Paged.js

- Le seul avantage réel est la parité HTML entre l'écran et le PDF. Mais avec une géométrie calculée en TypeScript (recommandation 2), l'écran et le PDF partagent déjà le même modèle ; seule la mise en forme du texte peut différer (voir risques).
- Fonctions Vercel : 250 Mo décompressés maximum par fonction, 300 s et 2 Go/1 vCPU maximum sur Hobby, 800 s et 4 Go/2 vCPU sur Pro **[vérifié, docs Vercel, juin 2026]**. Chromium y fonctionne mais de façon fragile (binaire introuvable après le traçage des fichiers Next.js, démarrages à froid, délais) **[sources communautaires]**.
- Pas de fond perdu ni de boîtes d'impression natifs : il faudrait tout reconstruire avec pdf-lib.
- Paged.js n'évolue plus et a des problèmes connus de synchronisation en headless.

### 1.3 Rôle des autres bibliothèques

- **pdf-lib (`@cantoo/pdf-lib`)** : outil de post-traitement en JavaScript (poser BleedBox/TrimBox, métadonnées, fusion de petits lots). Pas comme moteur.
- **qpdf** (binaire) : fusion et linéarisation de gros fichiers en flux, sans tout charger en mémoire. À privilégier sur le runner.
- **pikepdf** (Python, sur qpdf) : injecter un OutputIntent sRGB, vérifier les boîtes, contrôler les polices embarquées.
- **PDFKit, react-pdf, pdfme** : écartés (pas de fond perdu, typographie faible ou performances faibles sur gros volumes).

---

## 2. Conformité impression

### 2.1 Ce que demandent les imprimeurs grand public

- **CEWE** : conception en RVB/sRGB, export avec ses préréglages (PDF 1.3, RVB, polices embarquées), pas de traits de coupe **[vérifié, guide CEWE PDF-to-book]**.
- **Saal Digital** : toujours sRGB, profil de sortie « sRGB IEC61966-2.1 », réglages d'export fournis ; couverture en un seul PDF, intérieur séparé ; le nombre de pages n'inclut pas la couverture **[vérifié, Professional Zone Saal]**.
- **Blurb** : sources contradictoires (PDF/X-3 ou PDF/X-4, RVB accepté puis converti en CMJN chez eux) **[à confirmer sur la page officielle Blurb]**.
- **Lulu** : PDF avec polices embarquées et fond perdu, gabarit de couverture généré selon le nombre de pages.

**Conclusion : oui, on peut rester en RVB sRGB** pour la plupart des imprimeurs de livres photo grand public (qui impriment en numérique et gèrent eux-mêmes la conversion). Le CMJN ne sert que pour un imprimeur offset ou un imprimeur qui l'exige explicitement.

### 2.2 PDF/X-1a vs PDF/X-4

- **PDF/X-1a** : tout en CMJN (ou ton direct), pas de transparence, polices embarquées. Vieux mais universel en offset.
- **PDF/X-4** : RVB + profils ICC autorisés, transparence native, OutputIntent obligatoire. Préféré par les imprimeurs récents.
- **OutputIntent** : profil ICC de la condition d'impression visée (sRGB pour du numérique RVB ; **FOGRA39** = ISO Coated v2, couché, ancien ; **FOGRA51** = PSO Coated v3, couché, actuel).

### 2.3 Outils (tous gratuits)

| Outil | Usage |
|---|---|
| **Ghostscript** (`pdfwrite`) | Conversion CMJN (`-sColorConversionStrategy=CMYK`) et PDF/X via `-dPDFX=` + fichier `PDFX_def.ps` qui pointe vers le profil ICC. La doc officielle dit à la fois « versions 1, 3 et 4 » et « seuls PDF/X-1 et PDF/X-3 sont pris en charge » ; un changelog de paquet (avril 2025, probablement Ghostscript 10.05) annonce PDF/X-1a et PDF/X-4a **[vérifié en partie, contradictoire]**. RVB interdit en mode PDF/X dans Ghostscript. |
| **qpdf** | Fusion, linéarisation, réparation, en flux. |
| **pikepdf** | Écrire un OutputIntent, poser les boîtes, contrôler le fichier. |
| **mutool** (MuPDF) | Rendu de vignettes, inspection, nettoyage. Licence AGPL : à n'utiliser qu'en outil de traitement, pas à embarquer dans l'app. |
| **cpdf** | Boîtes, fusion ; licence non commerciale gratuite. Redondant avec qpdf/pikepdf. |

Où les faire tourner : **sur le runner GitHub Actions** (`apt-get install ghostscript qpdf`, `pip install pikepdf`) ou dans l'image Docker du plan B. Pas sur Vercel (binaires absents, et inutile pour l'export RVB courant).

Validation : il n'existe pas de validateur PDF/X libre et fiable (veraPDF ne couvre que PDF/A et PDF/UA). Pour un imprimeur en PDF/X, faire valider le premier fichier par son outil en ligne ou son service client.

Profils ICC : les profils ECI (FOGRA39/51) sont téléchargeables gratuitement chez l'ECI ; **ne pas les committer dans le dépôt public sans vérifier leur licence de redistribution**, les télécharger pendant le job.

---

## 3. Architecture pour les gros livres

### 3.1 Ordres de grandeur

- Page 21 × 28 cm + 3 mm de fond perdu à 300 dpi ≈ 2 550 × 3 380 px ≈ 2 à 3 Mo en JPEG q85. Un livre de 200 pages pleines ≈ **400 à 700 Mo**. Les pages à 4-9 photos pèsent à peu près autant (même surface imprimée).
- Conséquence : on ne peut ni renvoyer le PDF dans une réponse HTTP Vercel (limite de quelques Mo), ni le fusionner confortablement en mémoire dans 2 Go. **Le PDF va toujours directement sur R2.**

### 3.2 Pipeline commun (identique partout)

1. **Gel du livre** : l'app produit un `book.json` versionné (format imprimeur, pages, cadres en mm, textes, identifiants des photos, recadrages) et le stocke sur R2.
2. **Préparation des images** (parallélisable, reprenable) : pour chaque cadre, `sharp` recadre et ré-échantillonne l'original à 300 dpi exacts, en JPEG sRGB, clé de cache = hachage (photo + recadrage + taille du cadre). Les images déjà prêtes sont sautées, ce qui donne la **reprise**.
3. **Rendu Typst** : un `main.typ` générique lit `book.json` et place les cadres. Intérieur et couverture compilés séparément (dos calculé, § 4).
4. **Post-traitement** : BleedBox si demandée, OutputIntent sRGB (pikepdf), linéarisation (qpdf) ; en option, CMJN/PDF/X (Ghostscript).
5. **Contrôles automatiques** : nombre de pages, taille de page = format + fond perdu, polices toutes embarquées, aucune image sous 250 dpi effectifs.
6. **Upload R2**, nommage imposé par l'imprimeur, puis rappel vers l'app (statut + URL signée).

Progression : chaque étape écrit son état (`préparation 340/812 images`, `rendu`, `contrôles`, `envoi`) dans la base via un petit point d'API authentifié ; l'interface interroge ce statut.

### 3.3 Plan A pour l'export final : GitHub Actions

- `workflow_dispatch` déclenché par l'API GitHub depuis une route Vercel (jeton à portée minimale stocké dans les variables d'environnement Vercel).
- Runners standard gratuits sur dépôt public, 6 h maximum par job **[à confirmer sur docs.github.com]**. Le runner Linux public offre plusieurs vCPU et ~16 Go de RAM : un seul `typst compile` du livre entier tient, donc pas besoin de découper ni de fusionner.
- Délai attendu : 10 à 60 s de mise en file + 2 à 6 min de traitement **[à mesurer]**. Coût : 0 €.
- **Précautions spécifiques au dépôt public** (bloquantes) :
  - Les entrées de `workflow_dispatch` et les journaux sont visibles publiquement : ne passer qu'un **identifiant de tâche opaque**. Le job récupère la description du travail auprès de l'app avec un secret (secret GitHub Actions), télécharge ses images via des URLs signées courtes, **sans jamais les afficher**.
  - Ne jamais utiliser `actions/upload-artifact` pour le PDF ou les photos (les artefacts d'un dépôt public sont téléchargeables) : envoyer sur R2 uniquement.
  - Lire les conditions d'utilisation de GitHub Actions : l'usage doit rester lié au projet du dépôt. Rendre le livre de l'app du dépôt est défendable, mais c'est une zone grise → c'est la raison d'être du plan B.

### 3.4 Vercel (aperçus, petits exports, plan de secours)

- Hobby : 300 s, 2 Go ; Pro : 800 s, 4 Go ; 250 Mo de paquet **[vérifié]**. Le binding Typst natif (52 Mo) tient largement.
- Pour un livre ≤ 60-80 pages, ou pour un aperçu basse définition (images à 150 dpi), rendu par **lots de 20 à 40 pages** (une invocation par lot, déclenchée en chaîne ou par file), puis fusion avec `@cantoo/pdf-lib` si le total reste sous ~300 Mo. Au-delà, fusion impossible à garantir en 2 Go : basculer vers le runner.
- Hobby est réservé à un usage personnel non commercial : cohérent avec une app familiale, à garder en tête.

### 3.5 Plan B : conteneur dédié

- **Cloudflare Containers** : réservé au forfait Workers Paid (5 $/mois, avec un volume inclus de mémoire et de vCPU) **[à confirmer sur la page officielle]**. Proche de R2, aucune sortie facturée. Consomme tout le budget mensuel à lui seul.
- **Fly.io** : machines facturées à la seconde, démarrées à la demande puis arrêtées ; quelques centimes par export, pas d'offre gratuite pour les nouveaux comptes **[à confirmer]**.
- Même image Docker que le runner (Node + Typst + qpdf + Ghostscript + pikepdf), donc bascule sans réécriture.

---

## 4. Calcul du dos

Formule générique (Cloudprinter, valeurs moyennes) **[vérifié]** :

```
dos (mm) = grammage (g/m²) × main du papier × (nombre de pages / 2) / 1000 + 2 × épaisseur de couverture
```

- Main (bulk) : couché mat 0,80 ; couché satiné 0,90 ; offset 1,20-1,22.
- Couverture : rigide 3 mm (par face, défaut) ou 2 mm ; souple 0,5 mm.
- Exemple : 200 pages, 90 g, satiné, couverture rigide 3 mm → 8,1 + 6,0 = **14,1 mm**.

Autres formes rencontrées :
- **Par épaisseur de feuille** : dos = (pages / 2) × épaisseur d'une feuille (+ couverture).
- **Lulu** : formule publiée seulement pour son papier 460 PPI (pages / 460 + 0,06 pouce) ; pour les couvertures rigides, Lulu renvoie à un tableau et génère un gabarit de couverture selon le nombre de pages **[vérifié]**.
- **Blurb, Saal** : pas de formule publique trouvée ; le dos vient de leurs gabarits par produit et par nombre de pages. Le papier photo et le layflat sont beaucoup plus épais (forfait par tranche de pages).

Conception retenue : chaque fiche imprimeur porte **soit un tableau (nombre de pages → dos en mm), soit les paramètres de la formule**, le tableau ayant priorité. Fonction pure testée unitairement (cf. `testing.focus` dans `.planning/config.json`). Titre sur le dos seulement si dos ≥ ~6 mm (seuil réglable par imprimeur).

---

## 5. Polices libres (OFL, embarquables)

Toutes ci-dessous sont sous **SIL Open Font License** (Google Fonts) : usage, embarquement dans le PDF et sous-ensemble autorisés ; seule la revente isolée de la police est interdite.

| Rôle | Choix principal | Alternatives | Remarques |
|---|---|---|---|
| Titrage serif | **Cormorant Garamond** | Cormorant (display), Fraunces, Playfair Display | Très chic en grand corps ; trop fin en dessous de ~11 pt à l'impression : réservé aux titres, dates, ouvertures d'épisode. |
| Texte de récit serif | **Newsreader** (axe optique) | EB Garamond, Spectral, Source Serif 4 | Newsreader et Source Serif 4 ont des tailles optiques : plus robustes en petit corps que Cormorant. EB Garamond pour un ton plus classique. |
| Légendes sans | **Inter** | Source Sans 3, IBM Plex Sans | Inter en 7-8 pt, interlettrage léger, gris foncé ; Source Sans 3 un peu plus chaleureuse. |

Identité proposée : **Cormorant Garamond (titres) + Newsreader (récit) + Inter (légendes, folios)**, deux graisses maximum par famille. Fichiers de polices stockés dans le dépôt (licence OFL jointe) et passés à Typst via `font-paths` : pas de dépendance aux polices système, et rendu identique sur Vercel, le runner et le navigateur (typst.ts en wasm n'utilise que les polices fournies).

---

## 6. Mise en page automatique

### 6.1 Approches connues

1. **Gabarits + affectation** (Blurb/Lightroom, CEWE, Saal) : une bibliothèque de pages types (1 à 9 cadres, doubles pages), choix selon le nombre de photos, leur orientation et leur importance. Prévisible et « propre », c'est ce qu'il faut pour un rendu sobre.
2. **Justified layout / partition linéaire** (Flickr `justified-layout`, MIT, 4.1.0 de 2021) : rangées de hauteur variable qui respectent les proportions, partition optimale par programmation dynamique. Idéal pour les **pages denses** (6 à 9 photos) sans recadrage.
3. **Partition hiérarchique de la page** (travaux académiques type « adaptive photo collection page layout ») : découpe récursive de la page en contrôlant proportions et aires relatives. Puissant mais moins « gabarit ».
4. **Optimisation avec fonction de coût** (cf. le paquet Typst *automosaic*, brevets d'album automatique) : on évalue chaque arrangement candidat par un coût esthétique.

### 6.2 Algorithme proposé (combinaison 1 + 2 + 4)

- **Entrées** : photos cochées par épisode, dans l'ordre chronologique, avec proportion et **importance** (étoile, choix de rafale, note IA), nombre de pages cible, catalogue de gabarits (cadres en proportions de page, rôle « héros » ou « secondaire »).
- **Programmation dynamique par épisode** : `best[i][p]` = coût minimal pour placer les `i` premières photos sur `p` pages. Transition : choisir un gabarit `g` à `k` cadres pour les photos `i..i+k`, coût = recadrage (écart de proportion photo/cadre) + importance mal servie (photo forte dans un petit cadre) + monotonie (même gabarit que la page précédente) + densité (écart à la densité visée).
- **Pages de respiration** imposées : ouverture d'épisode, et une pleine page toutes les N pages si une photo forte est disponible.
- **Nombre de pages global** : répartir le budget entre épisodes (proportionnellement au nombre de photos, ajusté), ou ajouter une pénalité λ × nombre de pages et chercher λ par dichotomie pour atteindre la cible. Arrondir au multiple exigé par l'imprimeur (souvent 2 ou 4, minimum 20 à 26 pages).
- **Complexité** : photos × pages × gabarits, quelques millions d'opérations au pire : quelques dizaines de ms en TypeScript, donc exécutable **dans le navigateur** pour recalculer en direct.
- **Recadrage** : point d'intérêt (visages, centre de netteté) calculé à l'import, sinon centre ; l'utilisateur peut corriger dans le cadre.
- **Indépendance du format** : les gabarits sont en proportions, chaque gabarit déclare les plages de proportion de page qu'il accepte (carré, portrait, paysage). Changer de format = relancer l'affectation en gardant les choix manuels verrouillés.

Bibliothèques utiles : `justified-layout` (ou une réimplémentation de la partition linéaire, ~100 lignes), `sharp` (recadrage, attention.strategy pour le point d'intérêt), `smartcrop` éventuellement. Le cœur (DP + coût) est à écrire soi-même et à tester unitairement (déjà dans `testing.focus`).

---

## 7. Plan de spike (1 à 2 jours)

Objectif : prouver la chaîne complète sur un livre réaliste avant de construire l'éditeur.

**Jour 1 : qualité et faisabilité du rendu**
1. Jeu d'essai : 800 photos réelles (iPhone HEIC converties + reflex), un `book.json` de **200 pages** au format 21 × 28 cm, mélange pleines pages / 2-4 / 6-9 photos, 10 ouvertures d'épisode avec texte long, légendes.
2. Préparation `sharp` à 300 dpi + 3 mm de fond perdu. Mesurer : temps, poids total.
3. `main.typ` minimal (5 gabarits) qui lit `book.json`. Compiler avec le CLI Typst 0.15 puis avec `@myriaddreamin/typst-ts-node-compiler`. Mesurer **temps, mémoire maximale, poids du PDF**.
4. Vérifier dans le PDF (pikepdf + Acrobat ou un outil de contrôle en ligne) : **MediaBox = format + fond perdu, TrimBox correcte**, polices embarquées, **JPEG intégrés tels quels (DCTDecode) et non ré-encodés**, 300 dpi effectifs.
5. Ajouter BleedBox et OutputIntent sRGB avec pikepdf ; tester une conversion **PDF/X-1a ou X-3 CMJN FOGRA39** avec Ghostscript sur un extrait de 10 pages et vérifier le rendu des photos.

**Jour 2 : exécution et intégration**
6. Workflow GitHub Actions `workflow_dispatch` (identifiant opaque en entrée, secrets, téléchargement R2 signé, upload R2, rappel HTTP) ; mesurer le délai total de bout en bout ; vérifier qu'aucune URL ni donnée n'apparaît dans les journaux publics.
7. Route Vercel Hobby : rendu d'un lot de 40 pages avec le binding natif (temps, mémoire, taille du paquet après traçage Next.js) ; rendu d'un aperçu basse définition de 200 pages.
8. Parité texte écran / PDF : un même bloc de récit rendu en HTML et en Typst ; décider qui fait foi pour l'alerte « texte trop long » (recommandation : Typst, via un petit rendu de contrôle, ou des marges de sécurité généreuses).
9. Couverture : dos calculé pour 200 pages, gabarit couverture complète (4e + dos + 1re + fonds perdus + rabats rigides), comparé au gabarit officiel d'un imprimeur retenu (Saal ou Blurb).
10. Envoyer le PDF d'essai à l'outil de contrôle en ligne d'un imprimeur retenu, si disponible.

**Critères de réussite du spike**
- 200 pages compilées en moins de 5 min sur le runner, mémoire < 8 Go, PDF < 1 Go, toutes les vérifications du point 4 vertes.
- Un lot de 40 pages tient dans 300 s / 2 Go sur Vercel Hobby.
- Aucune fuite de données dans les journaux GitHub.
- Si l'un échoue : JPEG ré-encodés par Typst → injecter les images en post-traitement ou basculer vers PDFKit pour la couche image ; TrimBox absente ou fausse → la poser avec pikepdf ; runner inadapté → plan B conteneur.

---

## 8. Risques

| Risque | Probabilité | Parade |
|---|---|---|
| Typst ré-encode les JPEG (poids et qualité) | Moyenne | Vérifier au spike ; sinon pré-encoder en JPEG exact et contrôler `DCTDecode`, ou post-traitement. |
| Pas de BleedBox native dans Typst | Certaine | La poser avec pikepdf/pdf-lib (calcul trivial). |
| Pas de PDF/X natif ; PDF/X-4 incertain dans Ghostscript | Certaine / moyenne | Rester en RVB sRGB pour les imprimeurs grand public ; PDF/X-1a ou X-3 CMJN par Ghostscript seulement à la demande ; faire valider par l'imprimeur. |
| Écart de mise en forme du texte entre l'éditeur (HTML) et Typst | Moyenne | Mêmes polices, mêmes réglages ; Typst fait foi pour les alertes de débordement ; zones de texte généreuses. |
| Conditions d'utilisation GitHub Actions / visibilité publique | Faible à moyenne | Identifiant opaque, aucun artefact, aucun log de donnée ; plan B conteneur prêt (même image Docker). |
| PDF très lourds (500 Mo à 1 Go) refusés ou lents à l'upload chez l'imprimeur | Moyenne | JPEG q85, pas plus de 300 dpi ; vérifier la taille maximale acceptée dans chaque fiche imprimeur ; découpage de fichiers si l'imprimeur le permet. |
| Dos faux (papier photo, layflat) | Moyenne | Tableau par imprimeur prioritaire sur la formule ; vérification avec le gabarit officiel. |
| Typst évolue vite (0.x, changements cassants) | Moyenne | Version figée (binaire et binding), tests de non-régression visuelle sur quelques pages. |
| Budget : Cloudflare Containers = 5 $/mois | Si plan B activé | Ne l'activer qu'en cas de besoin ; Fly.io à la seconde en alternative. |

---

## 9. Sources

Moteurs et plateformes
- Limites des fonctions Vercel (durée, mémoire, taille de paquet) : https://vercel.com/docs/functions/limitations
- Registre npm (versions et dates vérifiées le 2 nov. 2026) : https://www.npmjs.com/package/@sparticuz/chromium , https://www.npmjs.com/package/pagedjs , https://www.npmjs.com/package/pdf-lib , https://www.npmjs.com/package/@cantoo/pdf-lib , https://www.npmjs.com/package/pdfkit , https://www.npmjs.com/package/@react-pdf/renderer , https://www.npmjs.com/package/@myriaddreamin/typst-ts-node-compiler , https://www.npmjs.com/package/justified-layout
- Chromium sur Vercel, retours d'expérience : https://community.vercel.com/t/sparticuz-chromium-min-working-with-vercel-for-pdf/7877 , https://dev.to/iurii_rogulia/pdf-generation-on-the-server-puppeteer-vs-react-pdfrenderer-a-production-comparison-44cg , https://dev.to/joelgriffith/vercel-puppeteer-4l7c
- Support de `bleed`/`marks` dans les navigateurs, Prince/DocRaptor : https://developer.chrome.com/blog/print-margins , https://docraptor.com/documentation/tutorial/printers-marks , https://www.w3docs.com/learn-css/bleed
- Paged.js : https://pagedjs.org/posts/en/a-new-chapter-in-paged.js-life/ , https://github.com/pagedjs/pagedjs/issues/183
- Typst, export PDF (standards) : https://typst.app/docs/reference/pdf/
- Typst, paramètre `bleed` et TrimBox : https://typst.app/docs/reference/layout/page/
- Typst 0.15.0 (15 juin 2026) : https://typst.app/docs/changelog/0.15.0/ ; Typst 0.14.0 (24 oct. 2025, export PDF réécrit avec krilla, CMJN) : https://typst.app/docs/changelog/0.14.0/
- typst.ts (Node natif vs wasm) : https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one-node.html
- Typst et images WebP ré-encodées : https://forum.typst.app/t/why-my-pdf-is-to-big-typst-export-webp-images-to-png/8590
- Paquet Typst automosaic : https://forum.typst.app/t/automosaic-automatic-aspect-preserving-layouting-for-photos/9642

Impression
- Ghostscript, PDF/X avec pdfwrite : https://ghostscript.readthedocs.io/en/latest/VectorDevices.html
- Changelog openSUSE de Ghostscript (PDF/X-1a, PDF/X-4a) : https://build.opensuse.org/projects/openSUSE/packages/ghostscript/files/ghostscript.changes?expand=0
- ConTeXt, intentions de sortie PDF/X (FOGRA39) : https://www.contextgarden.net/Input_and_compilation/PDF/PDFX
- Saal Digital, espace colorimétrique et formats : https://saal-digital.com/service/professional-zone/resolution-colour-space-and-file-formats , https://saal-digital.com/service/professional-zone/create-your-files-in-indesign
- CEWE, PDF vers livre : https://cewe.co.uk/pdf-to-book-user-guide.html
- Blurb (sources secondaires contradictoires) : https://www.thebookdesigner.com/?p=4384 , https://openlab.citytech.cuny.edu/csanchez-eportfolio/academics/courses/sample-course/blurbbookspecs/
- Exigences type PDF/X-1a/X-4 et fonds perdus : https://docs.heypoplar.com/creative-guides

Dos
- Cloudprinter, formule du dos : https://docs.cloudprinter.com/client/how-to-calculate-spine-width
- Lulu, calcul du dos : https://help.api.lulu.com/en/support/solutions/articles/64000254616-how-is-spine-width-calculated-
- Prodigi, dos selon laboratoire : https://support.prodigi.com/hc/en-us/articles/17150417510940

Exécution
- Limites GitHub Actions (6 h par job) : https://docs.github.com/en/enterprise-server@3.17/actions/reference/limits
- Cloudflare Containers (forfait payant) : https://developers.cloudflare.com/containers/pricing/ , https://flarecalc.com/calculators/containers/

Mise en page
- Mise en page adaptative de collections de photos : https://core.ac.uk/works/16984341
- Principes esthétiques pour l'album automatique (OFFIS) : https://www.offis.de/en/offis/publication/employing-aesthetic-principles-for-automatic-photo-book-layout-1.html
- Brevet, mise en page d'album en une passe : https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8065627
- Saal, mode de mise en page automatique : https://www.saal-digital.com/help-center/design-modes-for-photo-books

Polices : pages Google Fonts de Cormorant Garamond, Newsreader, EB Garamond, Fraunces, Inter, Source Sans 3 (licence SIL OFL 1.1) : https://fonts.google.com , https://openfontlicense.org

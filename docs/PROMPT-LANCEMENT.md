# Clic-Clac Voyage : prompt de lancement

## 1. Vision

**Clic-Clac Voyage** est une application web installable (PWA) qui permet à un petit groupe (2 à 15 personnes) de **mettre en commun toutes les photos et vidéos d'un voyage**, d'en tirer **le récit** (légendes, commentaires, réactions), puis de produire deux choses :

1. **Un site du voyage**, responsive et PWA, qu'on peut modifier, partager par lien secret et exporter en archive HTML autonome.
2. **Un livre photo prêt à imprimer**, mis en page automatiquement puis retouchable page par page. Il est exporté dans le format exact attendu par **l'imprimeur choisi pour ce voyage**, et ce choix se fait en comparant coût, nombre de pages, délais et notes clients.

L'application sert pour tous les voyages, passés et futurs. Chaque voyage est un espace séparé.

**Valeur centrale :** après un voyage, le groupe passe de « 3 000 photos éparpillées sur 8 téléphones » à « un beau site et un livre commandé » en quelques soirées, sans compétence technique.

**Exigence de livraison :** j'ai un vrai voyage à traiter. **Tout le parcours doit fonctionner**, de l'import à la commande du livre. Pas de version au rabais : on livre par phases, mais le périmètre complet est attendu.

Interface **en français uniquement**.

## 2. Utilisateurs, rôles, accès

- **Accès sur invitation seulement**, par e-mail. Une invitation donne accès à **un seul voyage**. Une même personne peut avoir été invitée sur plusieurs voyages et passer de l'un à l'autre.
- **Connexion sans mot de passe** : lien magique ou code à 6 chiffres reçu par e-mail. Connexion Google en option.
- Rôles **par voyage** :
  - **Administrateur** : crée le voyage, invite et retire des participants, structure les épisodes, valide le site et le livre, choisit l'imprimeur, centralise la commande.
  - **Contributeur** : importe ses photos et vidéos, légende les siennes, commente et réagit à celles des autres, coche des photos, commande ses exemplaires.
  - **Lecteur** : n'a pas de compte. Il consulte le site par un **lien secret** révocable, avec un mot de passe en option.
- Celui qui propose une photo écrit sa **légende**. Les autres **commentent** (commentaires signés) et ajoutent des **réactions emoji**.

## 3. Voyages et récit

- Un voyage se découpe en **épisodes**. Un épisode est un jour, une étape ou un événement (« Le mariage », « Traversée en bateau »).
- **Découpage automatique proposé** à partir des dates, des écarts de temps et du GPS, puis **modifiable** : fusionner, scinder, renommer, réordonner, déplacer des photos.
- Chaque épisode a un titre, des dates, un lieu (facultatif) et un **texte de récit** libre.
- **Carte de l'itinéraire** facultative, activable par voyage. Elle est inutile pour un séjour en un seul lieu.
- **Sélection** :
  - cases à cocher manuelles « dans le site » et « dans le livre » ;
  - **regroupement automatique des rafales** (même scène, prises à quelques secondes d'écart) avec **proposition de la meilleure photo** du groupe (netteté, exposition, yeux ouverts, cadrage). La proposition reste modifiable d'un clic.
  - **Dédoublonnage** : la même photo envoyée par deux personnes, ou par WhatsApp puis en original, n'apparaît qu'une fois et l'original de meilleure qualité est gardé.

## 4. Import des photos et vidéos

**Objectif : n'importe quelle source, sans friction, y compris depuis un téléphone pendant le voyage.**

- **Sources** (à couvrir toutes. Si une source est vraiment trop coûteuse, la documenter et proposer un contournement) :
  - galerie du téléphone (sélection multiple) et **menu « Partager » du téléphone vers la PWA** (Web Share Target) ;
  - ordinateur : glisser-déposer de fichiers et de **dossiers entiers**, carte SD ;
  - **Google Photos** (via la Picker API, la seule autorisée depuis 2025), **Google Drive**, **Dropbox**, **OneDrive** (via leurs sélecteurs officiels) ;
  - **iCloud** : partage depuis l'iPhone vers la PWA, ou lien d'album partagé si c'est faisable de façon fiable ;
  - **WhatsApp** : import d'une archive exportée, avec détection des photos compressées pour les remplacer par l'original s'il arrive plus tard.
- **Formats** : JPEG, HEIC/HEIF, PNG, WebP, AVIF, RAW courants (récupérer l'aperçu intégré pour l'affichage, garder le RAW), et **vidéos** (MOV, MP4, HEVC) pour le site seulement, jamais dans le livre.
- **Volume** : prévoir large. Repère : jusqu'à **10 000 fichiers et 50 Go par voyage**.
- **Envoi solide** : directement vers le stockage par URL signée, en plusieurs morceaux, **qui reprend après une coupure**, file d'attente persistante (l'envoi reprend à la réouverture de l'app si le réseau a coupé : c'est le cas normal en voyage), progression visible, compression facultative pour économiser les données mobiles avec renvoi de l'original plus tard en Wi-Fi.
- **Originaux conservés à vie en pleine résolution** (indispensable pour l'impression), plus des **versions web** générées : miniature, moyenne, grande, poster vidéo, vidéo allégée.
- **Métadonnées EXIF** : date, GPS, appareil, orientation.
- **Recalage d'horloge par appareil** : l'administrateur ou le propriétaire indique « l'appareil photo de Paul avait 1 h 12 de décalage » et toutes ses photos se réordonnent. Fuseaux horaires gérés.
- **Retouches non destructives** (paramètres enregistrés, original intact) : recadrage, rotation, redressement, **lumière, noirs, blancs, hautes lumières, ombres, couleurs (température, teinte, saturation), contraste** et **quelques filtres sobres** (noir et blanc, argentique doux, chaud, froid). **Le rendu doit être identique** à l'écran, dans le site et dans le PDF d'impression : une seule chaîne de traitement d'image partagée, ou une vérification d'équivalence testée.

## 5. Le site du voyage

- Adresse : **`clic-clac-voyage.fr/v/<nom-du-voyage>`** (domaine à vérifier et réserver).
- **Responsive** (téléphone d'abord, aussi soigné sur ordinateur) et **PWA installable**, **consultable hors ligne** une fois ouvert.
- **Deux sorties** :
  1. le site en ligne (lien secret pour les lecteurs) ;
  2. un **export HTML autonome** (archive .zip : `index.html` et ses fichiers, images optimisées, vidéos allégées) qui s'ouvre sans serveur, à garder ou graver.
- **Modularité** :
  - **(a) thèmes prêts à l'emploi** selon le genre de voyage, au moins 5 : mer et îles, montagne, ville et culture, désert ou safari, road-trip, plus un thème neutre élégant ;
  - **(b) personnalisation** : palette, couples de polices, photo de couverture ;
  - **(c) sections à activer et réordonner** : couverture, présentation, carte, épisodes, galerie complète, chiffres du voyage (km, jours, photos, participants), participants, mot de la fin ;
  - **(d) un peu de mise en page libre** : pour chaque épisode, choisir une présentation (mosaïque, plein écran, défilement horizontal, photo et texte alternés, photo vedette) et mettre en avant certaines photos. Pas de placement au pixel.
- Visionneuse plein écran avec balayage, légendes, commentaires et réactions visibles (affichage réglable).
- Les **positions GPS précises** sont retirées de tout ce qui est public : site partagé et export. La carte montre seulement le niveau de la ville ou du lieu.
- Le site sert aussi de **journal en direct pendant le voyage** : il s'alimente au fil de l'eau.

## 6. Le livre photo

### Style
**Classique, chic, sobre, de qualité**, mais **dense** : il faut pouvoir montrer beaucoup de photos sans multiplier les pages.
- Gouttières fines entre photos (3 à 5 mm), marges extérieures nettes sans être larges, pleine page pour les photos fortes.
- Grilles de **1 à 9 photos par page** et de **doubles pages**, avec un rythme qui alterne pages denses et respirations.
- Typographie à empattements de qualité pour les titres (Garamond ou Cormorant, par exemple), une police sans empattement discrète pour les légendes, pas de clipart ni de fonds décoratifs, fonds blanc cassé ou noir.
- Ouverture de chaque épisode (titre, dates, lieu, texte de récit), légendes sobres sous ou à côté des photos, commentaires en option.
- Couverture, quatrième de couverture et dos (titre sur le dos si l'épaisseur le permet).

**Créer une identité typographique et une bibliothèque de gabarits originales.** Aucune référence imposée : être créatif tout en restant sobre.

### Création et édition
1. **Mise en page automatique** à partir de la bibliothèque de gabarits : ordre chronologique par épisode, photos cochées, choix des gabarits selon l'orientation, l'importance et le nombre de photos, objectif de nombre de pages réglable (« ce voyage en 60 pages »).
2. **Édition page par page** : permuter, remplacer, recadrer dans un cadre, changer de gabarit, modifier les textes, ajouter, supprimer ou déplacer des pages. **Pas de placement libre au pixel**, pour garantir la qualité.
3. **Contrôles en direct** : résolution effective de chaque photo (alerte sous 250 dpi, blocage sous 150 dpi), textes trop près du massicot ou dans le pli, nombre de pages compatible avec l'imprimeur.
4. Un livre par voyage (une version suffit), avec un historique qui permet de revenir à une version précédente.

### Formats
- Le livre est décrit par un **modèle indépendant de l'imprimeur** (pages, gabarits, cadres en proportions). Quand on **change de format ou d'imprimeur, la mise en page s'adapte automatiquement**, puis on retouche.
- **Formats disponibles = ceux des imprimeurs retenus** : carré, paysage, portrait, petits et grands formats, couverture rigide ou souple, papiers (mat, brillant, satiné, papier photo, layflat si disponible).

### Export
- **Pour chaque imprimeur, le format de fichier qu'il accepte le plus facilement** : PDF intérieur et couverture séparés ou PDF unique, PDF/X-1a ou PDF/X-4, RVB ou CMJN avec son profil ICC, fonds perdus et zones de sécurité, **dos calculé selon le nombre de pages et le papier**, nommage et découpage de fichiers imposés, images à 300 dpi.
- Le PDF est généré **côté serveur**, de façon fiable pour 200 pages et plus, avec progression et reprise.
- Aperçu feuilletable du livre avant export.

## 7. Imprimeurs, comparateur, commandes

### Recherche (à faire en début de projet)
- Repérer **6 à 10 imprimeurs de livres photo** qui livrent en France et en Europe, **parmi les mieux notés et les plus pertinents**, en mêlant :
  - des imprimeurs grand public qui **acceptent un PDF** : par exemple Saal Digital, CEWE, Blurb, Photobox, Fotofabrik, Albelli, Pixartprinting, Printler, Photoweb… (à vérifier un par un) ;
  - des imprimeurs avec une **API de commande** : par exemple Lulu, Gelato, Peecho, Prodigi… (à vérifier) ;
  - au moins une option **haut de gamme** (papier d'art, layflat).
- Pour chacun, relever les **contraintes techniques** et en faire des **règles appliquées par l'éditeur de livre** : formats, nombre de pages minimum, maximum et multiple imposé, fonds perdus, zone de sécurité, profil couleur, calcul du dos, type de fichier, poids maximum.

### Fiches imprimeurs (tenues à jour avec l'aide de l'IA)
- Une **fiche par imprimeur** : formats et finitions, **grille de prix** (prix de base, prix par page supplémentaire, options), **frais de port** par pays et dégressifs, **délais** de fabrication et de livraison, **notes clients** (Trustpilot, Google… avec la date du relevé et le nombre d'avis), lien de commande, mode de commande (PDF déposé ou API).
- Une action « **mettre à jour avec l'IA** » propose les nouvelles valeurs (recherche web) et **l'administrateur valide**. La date de dernière vérification est toujours affichée.

### Comparateur, voyage par voyage
- Pour **le livre de CE voyage** (format, nombre de pages, finition, nombre total d'exemplaires, adresses de livraison), l'app **calcule le coût total réel** de chaque imprimeur compatible et **exclut les incompatibles en disant pourquoi** (« 260 pages > 200 max »).
- Classement réglable : moins cher, mieux noté, plus rapide, ou un score combiné.
- Le choix de l'imprimeur **réadapte le livre** à ses contraintes.

### Commandes par personne
- Chaque participant indique **combien d'exemplaires** il veut et **son adresse de livraison**, ou une livraison groupée chez l'administrateur.
- L'app calcule le **coût par personne** (exemplaires plus part des frais de port), un **récapitulatif « qui doit combien à qui »** et l'état de chaque commande (demandée, payée à l'administrateur, commandée, expédiée).
- **V1** : export du ou des PDF conformes, **lien direct** vers la commande chez l'imprimeur, suivi manuel. **V2** : **commande par API** chez les imprimeurs qui le permettent (envoi des fichiers, devis, commande, suivi).
- **Pas de paiement en ligne dans l'app.** Seulement le suivi des remboursements entre participants.

## 8. Contraintes techniques

- **Hébergement de l'app : Vercel** (imposé). **Next.js** (App Router, TypeScript strict).
- **Le moins cher possible**, tout en restant efficace et simple. Calculer le coût et **viser 0 à 5 € par mois** hors nom de domaine. Stack de départ proposée, à confirmer ou corriger pendant la recherche :
  - **Photos et vidéos** : **Cloudflare R2** (sans frais de sortie, environ 0,015 $ par Go et par mois, 10 Go gratuits ; 100 Go ≈ 1,5 $ par mois). Envoi direct en plusieurs morceaux par URL signée. **Ne pas utiliser Vercel Blob** (trop cher à ce volume).
  - **Base de données** : Postgres serverless gratuit (Neon via la marketplace Vercel), ou Supabase. Attention : le projet Supabase gratuit **se met en pause après 7 jours d'inactivité**, ce qui est gênant pour une app utilisée par à-coups. Trancher.
  - **Authentification** : Better Auth ou Auth.js (lien magique ou code par e-mail, Google), e-mails par **Resend** (offre gratuite), ou Supabase Auth si Supabase est retenu.
  - **Traitement d'image** : décodage HEIC et RAW (les binaires précompilés de `sharp` ne lisent pas le HEIC). Arbitrer entre le traitement dans le navigateur (wasm) à l'import, des fonctions serveur, ou Cloudflare Images.
  - **Vidéo** : versions allégées pour le web. Arbitrer entre conversion dans le navigateur, Cloudflare Media Transformations ou Stream, et une tâche par lots, **au coût le plus bas**.
  - **PDF du livre** : HTML/CSS paginé (Paged.js ou équivalent) rendu en PDF par un Chromium headless (fonction Vercel avec `@sparticuz/chromium`, pages traitées par lots), avec post-traitement PDF/X et ICC si l'imprimeur l'exige. Prévoir un plan B pour les gros livres (tâche GitHub Actions gratuite ou worker dédié). **Faire un essai technique (spike) tôt.**
  - **IA** (meilleure photo d'une rafale, aide à la mise à jour des fiches imprimeurs) : analyse d'image locale d'abord (netteté, exposition, empreinte perceptuelle pour les doublons). Appel à un modèle de vision léger seulement pour départager, avec un budget plafonné.
- **Sécurité** : chaque requête vérifie le voyage et le rôle, URLs de fichiers signées et à durée limitée, liens secrets révocables, aucune donnée d'un voyage visible depuis un autre. Le dépôt GitHub est public : aucun secret ni aucune donnée personnelle dans le dépôt.
- **RGPD et vie privée** : positions GPS précises gardées en privé, suppression complète d'un compte et de ses photos, suppression d'un voyage entier, mention simple sur le droit à l'image, aucun traçage publicitaire.
- **Accessibilité et performance** : bonne note Lighthouse sur mobile, images responsives (AVIF ou WebP), chargement progressif des galeries de milliers de photos.

## 9. Découpage proposé (phases larges, mode GSD light)

1. **Fondations** : dépôt, Next.js, base de données, authentification par invitation, voyages et rôles, déploiement Vercel, domaine, squelette PWA.
2. **Import et stockage** : envoi qui reprend après coupure vers R2, toutes les sources, formats HEIC, RAW et vidéo, versions web, EXIF, recalage d'horloge, dédoublonnage.
3. **Tri et récit** : épisodes automatiques et modifiables, rafales et meilleure photo, cases à cocher, légendes, commentaires, réactions, retouches non destructives.
4. **Site du voyage** : thèmes, personnalisation, sections, présentations par épisode, carte, lien secret, hors ligne, export HTML autonome.
5. **Livre** : modèle indépendant de l'imprimeur, gabarits, mise en page automatique, éditeur page par page, contrôles, aperçu, export PDF (spike PDF au début de la phase).
6. **Imprimeurs et commandes** : recherche, fiches, mise à jour assistée par l'IA, comparateur, adaptation du livre, commandes par personne, liens de commande (V1), puis API (V2).
7. **Finition sur le vrai voyage** : import réel complet, performance à grand volume, RGPD, corrections.

Chaque phase se termine par quelque chose **utilisable sur mon vrai voyage**.

## 10. Critères de réussite

- Un participant invité se connecte depuis son téléphone en moins d'une minute, sans mot de passe.
- 1 000 photos envoyées depuis un téléphone sur un réseau instable arrivent toutes, sans doublon, dans le bon ordre chronologique malgré des horloges d'appareils décalées.
- L'administrateur obtient un découpage en épisodes et une sélection de départ correcte sans effort, et ajuste le reste en une soirée.
- Le site partagé est beau sur téléphone et sur ordinateur, s'installe en PWA, se consulte hors ligne, et son export .zip s'ouvre sans serveur.
- Le livre d'environ 100 pages est généré automatiquement, retouché, puis exporté en fichiers **acceptés du premier coup** par l'imprimeur choisi.
- Le comparateur affiche pour ce livre le coût total réel de chaque imprimeur compatible, et chaque participant voit ce qu'il doit.
- Coût d'hébergement mesuré : ≤ 5 € par mois pour l'usage prévu.

## 11. Réglages GSD

- Mode **autonome (yolo)**, phases **larges** (environ 7), **recherche courte** au démarrage (imprimeurs, PDF et print, stockage et coûts, import Google, iCloud et WhatsApp, HEIC, RAW et vidéo), **relecture de plan désactivée**, **vérification en fin de phase activée**, tests sur l'essentiel (règles des imprimeurs et calcul du dos, moteur de mise en page, calcul des prix et des parts, droits d'accès, recalage d'horloge et dédoublonnage) plus quelques tests de bout en bout Playwright sur le parcours principal.
- Commits atomiques, en français ou en anglais au choix mais de façon cohérente. Interface 100 % en français.

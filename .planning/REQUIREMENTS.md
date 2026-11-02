# Exigences : Clic-Clac Voyage

Dérivées de [`docs/PROMPT-LANCEMENT.md`](../docs/PROMPT-LANCEMENT.md). Chaque exigence porte un identifiant repris dans `ROADMAP.md`. Tout est **V1** (périmètre complet attendu) sauf la section « V2 ».

## Accès et voyages (ACC)

- **ACC-01** : un administrateur crée un voyage (nom, slug d'URL, dates, couverture).
- **ACC-02** : l'administrateur invite par e-mail ; une invitation donne accès à un seul voyage ; il peut retirer un participant.
- **ACC-03** : connexion sans mot de passe par lien magique **ou** code à 6 chiffres, en moins d'une minute depuis un téléphone.
- **ACC-04** : connexion Google en option.
- **ACC-05** : rôles par voyage (administrateur, contributeur) ; une personne peut appartenir à plusieurs voyages et passer de l'un à l'autre.
- **ACC-06** : chaque requête serveur vérifie voyage et rôle ; aucune donnée d'un voyage n'est visible depuis un autre (tests automatisés).
- **ACC-07** : lecteurs sans compte via lien secret révocable, mot de passe en option.
- **ACC-08** : PWA installable (manifeste, icônes, service worker), interface 100 % française.

## Import et stockage (IMP)

- **IMP-01** : envoi direct vers R2 par URL signée, en plusieurs morceaux, avec reprise après coupure.
- **IMP-02** : file d'attente persistante (survit à la fermeture de l'app), progression visible, reprise à la réouverture.
- **IMP-03** : mode « économie de données » (envoi compressé) avec renvoi de l'original plus tard en Wi-Fi.
- **IMP-04** : galerie du téléphone (sélection multiple).
- **IMP-05** : menu « Partager » du téléphone vers la PWA (Web Share Target) ; contournement documenté là où il n'est pas supporté (iOS).
- **IMP-06** : ordinateur : glisser-déposer de fichiers et de dossiers entiers (carte SD).
- **IMP-07** : Google Photos (Picker API).
- **IMP-08** : Google Drive, Dropbox, OneDrive (sélecteurs officiels).
- **IMP-09** : iCloud : partage depuis l'iPhone ; lien d'album partagé si fiable, sinon contournement documenté.
- **IMP-10** : WhatsApp : import d'une archive exportée ; détection des copies compressées et remplacement par l'original s'il arrive plus tard.
- **IMP-11** : formats JPEG, HEIC/HEIF, PNG, WebP, AVIF ; RAW courants (aperçu intégré pour l'affichage, RAW conservé).
- **IMP-12** : vidéos MOV, MP4, HEVC : poster et version allégée pour le web ; jamais dans le livre.
- **IMP-13** : originaux conservés à vie ; versions web générées (miniature, moyenne, grande en AVIF/WebP).
- **IMP-14** : extraction EXIF (date, fuseau, GPS, appareil, orientation).
- **IMP-15** : recalage d'horloge par appareil (décalage saisi, réordonnancement immédiat), fuseaux horaires gérés.
- **IMP-16** : dédoublonnage (hash exact + empreinte perceptuelle) ; l'original de meilleure qualité est gardé.
- **IMP-17** : volume cible : 10 000 fichiers et 50 Go par voyage.

## Tri et récit (REC)

- **REC-01** : découpage automatique en épisodes (dates, écarts de temps, GPS).
- **REC-02** : épisodes modifiables : fusionner, scinder, renommer, réordonner, déplacer des photos.
- **REC-03** : épisode = titre, dates, lieu facultatif, texte de récit libre.
- **REC-04** : cases « dans le site » et « dans le livre ».
- **REC-05** : regroupement des rafales et proposition de la meilleure photo (netteté, exposition, yeux ouverts, cadrage), modifiable d'un clic.
- **REC-06** : légende écrite par l'auteur de la photo ; commentaires signés et réactions emoji par les autres.
- **REC-07** : retouches non destructives : recadrage, rotation, redressement, lumière, noirs, blancs, hautes lumières, ombres, température, teinte, saturation, contraste, filtres sobres (N&B, argentique doux, chaud, froid).
- **REC-08** : rendu des retouches identique écran / site / PDF (chaîne unique ou équivalence testée).
- **REC-09** : galeries de milliers de photos fluides (virtualisation, chargement progressif).
- **REC-10** : IA de vision seulement pour départager, avec budget plafonné.

## Site du voyage (SITE)

- **SITE-01** : adresse `<APP_URL>/v/<slug>` ; au départ l'URL Vercel par défaut, `clic-clac-voyage.fr` plus tard sans changement de code. Aucune URL absolue codée en dur.
- **SITE-02** : responsive, téléphone d'abord, soigné sur ordinateur ; bonne note Lighthouse mobile.
- **SITE-03** : au moins 6 thèmes : mer et îles, montagne, ville et culture, désert ou safari, road-trip, neutre élégant.
- **SITE-04** : personnalisation : palette, couple de polices, photo de couverture.
- **SITE-05** : sections activables et réordonnables : couverture, présentation, carte, épisodes, galerie complète, chiffres du voyage, participants, mot de la fin.
- **SITE-06** : présentation par épisode : mosaïque, plein écran, défilement horizontal, photo et texte alternés, photo vedette ; mise en avant de photos.
- **SITE-07** : visionneuse plein écran avec balayage, légendes, commentaires et réactions (affichage réglable).
- **SITE-08** : carte de l'itinéraire facultative, au niveau ville ou lieu seulement.
- **SITE-09** : GPS précis retiré de tout ce qui est public (site, export, métadonnées des fichiers servis).
- **SITE-10** : consultable hors ligne une fois ouvert.
- **SITE-11** : journal en direct pendant le voyage (s'alimente au fil de l'eau).
- **SITE-12** : export HTML autonome (.zip) qui s'ouvre sans serveur.

## Livre photo (LIV)

- **LIV-01** : modèle de livre indépendant de l'imprimeur (pages, gabarits, cadres en proportions).
- **LIV-02** : identité typographique et bibliothèque de gabarits originales : 1 à 9 photos par page, doubles pages, pleine page, gouttières 3 à 5 mm, fonds blanc cassé ou noir.
- **LIV-03** : ouvertures d'épisode, légendes sobres, commentaires en option ; couverture, quatrième, dos (titre si l'épaisseur le permet).
- **LIV-04** : mise en page automatique (chronologie par épisode, photos cochées, orientation, importance) avec objectif de nombre de pages réglable et rythme dense / respiration.
- **LIV-05** : éditeur page par page : permuter, remplacer, recadrer dans le cadre, changer de gabarit, modifier les textes, ajouter, supprimer, déplacer des pages. Pas de placement au pixel.
- **LIV-06** : contrôles en direct : dpi effectif (alerte < 250, blocage < 150), textes près du massicot ou dans le pli, nombre de pages compatible.
- **LIV-07** : changement de format ou d'imprimeur : la mise en page s'adapte automatiquement.
- **LIV-08** : historique des versions avec retour en arrière.
- **LIV-09** : aperçu feuilletable.
- **LIV-10** : export PDF côté serveur, fiable pour 200 pages et plus, avec progression et reprise.
- **LIV-11** : export conforme à chaque imprimeur : PDF unique ou intérieur + couverture, PDF/X-1a ou X-4, RVB ou CMJN + ICC, fonds perdus, zones de sécurité, dos calculé, nommage imposé, images à 300 dpi.

## Imprimeurs et commandes (IMPR)

- **IMPR-01** : 6 à 10 imprimeurs retenus après recherche (grand public PDF, API, au moins un haut de gamme).
- **IMPR-02** : contraintes techniques de chaque imprimeur encodées en règles appliquées par l'éditeur.
- **IMPR-03** : fiche par imprimeur : formats, finitions, grille de prix, frais de port, délais, notes clients datées, lien et mode de commande.
- **IMPR-04** : « mettre à jour avec l'IA » : propositions issues d'une recherche web, validées par l'administrateur ; date de dernière vérification affichée.
- **IMPR-05** : comparateur pour le livre de ce voyage : coût total réel par imprimeur compatible, incompatibles exclus avec la raison.
- **IMPR-06** : classement réglable : prix, note, délai, score combiné.
- **IMPR-07** : choisir un imprimeur réadapte le livre à ses contraintes.
- **IMPR-08** : chaque participant indique ses exemplaires et son adresse, ou la livraison groupée.
- **IMPR-09** : coût par personne (exemplaires + part du port), récapitulatif « qui doit combien à qui ».
- **IMPR-10** : état de chaque commande : demandée, payée à l'administrateur, commandée, expédiée.
- **IMPR-11** : V1 : export des PDF conformes et lien direct vers la commande chez l'imprimeur.

## Vie privée et exploitation (RGPD)

- **RGPD-01** : suppression complète d'un compte et de ses photos.
- **RGPD-02** : suppression d'un voyage entier (base + R2).
- **RGPD-03** : mention simple sur le droit à l'image ; aucun traçage publicitaire.
- **RGPD-04** : coût d'hébergement mesuré ≤ 5 € par mois pour l'usage prévu.
- **RGPD-05** : aucun secret ni donnée personnelle dans le dépôt public (contrôle automatisé).

## V2

- **V2-01** : commande par API chez les imprimeurs qui le permettent (envoi des fichiers, devis, commande, suivi).

## Hors périmètre

- Paiement en ligne dans l'app.
- Placement libre au pixel (site et livre).
- Vidéos dans le livre.
- Interface dans une autre langue que le français.
- Plusieurs livres par voyage (une version + historique suffit).

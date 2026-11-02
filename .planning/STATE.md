# État du projet

**Phase en cours** : 3, Tri et récit (tranches 1 à 3 livrées)
**Dernière action** : phase 1 en production (connexion Gmail vérifiée par Romain) ; phase 2, tranche 1 : envoi reprenable vers R2, analyse dans le navigateur, galerie, recalage d'horloge, dédoublonnage
**Prochaine étape** : tester l'import réel sur téléphone, puis tranche 2 (partage Android et Raccourci iOS, WhatsApp, Google Photos, Drive, Dropbox, OneDrive, vidéo allégée, mode économie de données)

## Phase 7 : où on en est

| Exigence | État |
|---|---|
| RGPD-01 suppression d'un compte et de ses photos | ✅ photos et vidéos de la personne (fichiers R2 compris), commentaires, réactions, invitations, codes de connexion, commandes, voyages où elle est seule ; refusé si elle est le seul administrateur d'un voyage partagé |
| RGPD-02 suppression d'un voyage | ✅ base (cascades) + tout le préfixe `voyages/<id>/` du stockage (originaux, versions, images du livre, exports) |
| RGPD-03 droit à l'image, aucun traçage | ✅ page `/confidentialite` (données, hébergeurs, droit à l'image, aucun traçage), rappel à l'import |
| RGPD-04 coût ≤ 5 € par mois | ✅ estimation en direct dans Réglages (espace mesuré en base, tarifs datés) ; ⏳ mesure réelle sur un mois avec le vrai voyage (`docs/RECETTE.md` §7) |
| Volume 10 000 fichiers | ✅ test de charge `pnpm test:charge` : découpage 1 s, galerie 0,6 s, site 1 s, livre 0,3 s, mise en page de 200 pages 0,7 s (base en mémoire) ; les pages ne signent plus d'URL d'avance (20 000 signatures = 2,2 s et plusieurs Mo) : route protégée qui redirige, mise en cache |
| E2E du parcours principal | ✅ `parcours-complet.spec.ts` : invitation, import par deux personnes, épisodes, site par lien secret, livre et PDF, comparateur et choix de l'imprimeur, commande, suppression du compte puis du voyage |
| Les 7 critères sur le vrai voyage | ⏳ à faire avec le vrai voyage : `docs/RECETTE.md` |

## Phase 6 : où on en est

| Exigence | État |
|---|---|
| IMPR-01 imprimeurs retenus | ✅ 8 fiches (Saal Digital, Blurb, Fotofabriek, Pixartprinting, CEWE, Lulu, Gelato, Prodigi) dans `src/lib/imprimeurs/catalogue.ts`, relevées le 2 novembre 2026 (second relevé le même jour) |
| IMPR-02 règles appliquées par l'éditeur | ✅ choisir un produit donne au livre son format, ses pages (min, max, pas), ses marges de sécurité et de reliure, son fond perdu et son dos (table Fotofabriek) ; les contrôles du livre suivent |
| IMPR-03 fiches | ✅ formats, papier, prix (base + page supplémentaire), port, délais, note Trustpilot datée, lien ; chaque valeur porte sa source et son statut (vérifié, secondaire, non vérifié) ; ⏳ beaucoup de prix et de ports sont derrière des configurateurs : non vérifiés, affichés comme tels |
| IMPR-04 mise à jour par l'IA | ✅ recherche web (Claude Opus 5.5), propositions sourcées validées par un administrateur de l'app, date de vérification affichée |
| IMPR-05, 06 comparateur, classement | ✅ coût réel pour le livre et le nombre d'exemplaires du groupe, exclusions motivées (CEWE : pas de PDF en France ; forme ; pages max), tri prix / note / délai / score combiné, incertitudes listées |
| IMPR-07 le choix réadapte le livre | ✅ version gardée avant, gabarits recalculés, alertes à jour |
| LIV-11 export par imprimeur | ✅ profils : intérieur et couverture séparés ; doubles pages (Saal) ; PDF unique couverture étalée + gardes (Gelato, Pixartprinting) ; PDF unique en pages simples sans fond perdu (Prodigi) ; fond perdu de couverture propre (CEWE 10 mm) ; ⏳ conversion CMJN et PDF/X (Ghostscript indisponible sur Vercel) : signalée dans le comparateur |
| IMPR-08 exemplaires et livraison | ✅ chacun choisit ses exemplaires, envoi groupé ou à domicile (adresse visible par lui et les organisateurs seulement) |
| IMPR-09 coût par personne, qui doit combien à qui | ✅ calcul au centime, port groupé au prorata, envoi à domicile payé par chacun, le payeur (un organisateur) ne se doit rien |
| IMPR-10 états | ✅ demandée, commandée, expédiée ; remboursement noté à part ; montants figés quand la commande est passée |
| IMPR-11 V1 | ✅ export conforme + lien direct vers l'imprimeur |
| V2-01 commande par API | ⏳ plus tard (Lulu, Prodigi, Gelato) |

## Phase 5 : où on en est

| Exigence | État |
|---|---|
| LIV-01 modèle indépendant de l'imprimeur | ✅ `src/lib/livre` : pages → gabarit + cellules (photo, zoom, centre) + textes ; aucune coordonnée au pixel |
| LIV-02 gabarits originaux 1 à 9 photos, gouttière 4 mm, fond blanc cassé ou noir | ✅ 15 gabarits photo + ouverture, texte, titre, page blanche ; ⏳ doubles pages (panoramiques) |
| LIV-03 ouvertures d'épisode, légendes, commentaires en option, couverture, quatrième, dos | ✅ ; dos calculé (formule ou tableau d'imprimeur) ; ⏳ couverture complète (rabats, dos titré) avec les imprimeurs |
| LIV-04 mise en page automatique, cible de pages, rythme | ✅ programmation dynamique par épisode (état = gabarit précédent, contre la monotonie) + sac à dos entre épisodes : cible exacte ; 1 000 photos < 1 s |
| LIV-05 éditeur page par page | ✅ gabarit, échanger, remplacer, retirer, recadrer (zoom, position), textes, ajouter, supprimer, déplacer ; annulation |
| LIV-06 contrôles en direct | ✅ dpi (alerte < 250, blocage < 150), texte trop long, trop près du bord ou du pli, pages (min, max, multiple), photo en double ou absente |
| LIV-07 changement de format | ✅ les gabarits sont des fonctions de la zone utile : les cadres se recalculent, rien ne casse |
| LIV-08 historique des versions | ✅ enregistrement automatique avec détection d'édition concurrente ; versions nommées, retour en arrière lui-même annulable (60 gardées) |
| LIV-09 aperçu feuilletable | ✅ plein écran, clavier, balayage |
| LIV-10 export PDF fiable, progression et reprise | ✅ photos préparées dans le navigateur de l'administrateur avec le moteur de retouche de l'écran (rendu identique), 300 dpi sans agrandir, envoyées sur R2 ; clé = empreinte (photo, retouche, recadrage, taille) : une préparation interrompue reprend où elle s'était arrêtée ; assemblage dans une fonction Vercel (300 s) |
| LIV-11 export conforme | ✅ générique : intérieur + couverture (quatrième, dos, première) séparés, RVB sRGB, fonds perdus 3 mm, TrimBox et BleedBox, polices EB Garamond et Inter intégrées (OFL, dans `polices/`), JPEG intégrés sans réencodage ; ⏳ PDF/X, CMJN, nommage et rabats propres à chaque imprimeur en phase 6 |

**Spike PDF (2 novembre 2026)** : Typst 0.14 (binding npm 0.7.0) garde chaque image décodée en mémoire : 6,7 Go pour 200 pages réelles, intenable. Architecture retenue : Typst compose le fond et les textes (PDF de quelques centaines de Ko), pdf-lib pose ensuite les JPEG tels quels et les boîtes d'impression. Mesuré : 200 pages distinctes, PDF de 628 Mo, **5 s et 1,4 Go de mémoire au pic** (moitié moins avec des photos de poids réel). Tient dans une fonction Vercel Hobby (2 Go) : pas besoin de GitHub Actions ni de jeton supplémentaire. Le binding n'accepte pas `bleed` : page = format + 2 × fond perdu, boîtes posées par pdf-lib.

## Phase 4 : où on en est

| Exigence | État |
|---|---|
| SITE-01 adresse `<APP_URL>/v/<slug>`, lien secret révocable, mot de passe en option | ✅ les membres connectés voient aussi le site sans lien |
| SITE-02 téléphone d'abord, soigné sur ordinateur | ✅ ; ⏳ note Lighthouse à mesurer en production |
| SITE-03 six thèmes | ✅ mer et îles, montagne, ville et culture, désert ou safari, road-trip, neutre élégant (contrastes WCAG AA testés) |
| SITE-04 palette, polices, couverture | ✅ six paires de polices, fond et accent personnalisables (encre recalculée pour rester lisible) |
| SITE-05 sections activables et réordonnables | ✅ couverture, présentation, carte, épisodes, galerie, chiffres, participants, mot de la fin |
| SITE-06 présentations par épisode, mise en avant | ✅ mosaïque, plein écran, défilement, alterné, photo vedette ; « Mise en avant » dans la visionneuse de l'app |
| SITE-07 visionneuse plein écran, affichage réglable | ✅ balayage, clavier, bouton retour ; légendes, auteurs, commentaires, réactions affichables ou non |
| SITE-08 carte au niveau ville | ✅ une étape par épisode (médiane arrondie au dixième de degré), tracé SVG sans fond de carte |
| SITE-09 GPS précis jamais public | ✅ testé : HTML, JSON, images servies (WebP sans EXIF), export ; jamais l'original |
| SITE-10 hors ligne | ✅ service worker : pages et images gardées ; bouton « Garder ce site pour le lire hors ligne » ; manifeste propre au site ; testé en E2E réseau coupé |
| SITE-11 journal en direct | ✅ pendant les dates du voyage (ou forcé) : plus récent d'abord, rafraîchi toutes les 2 min |
| SITE-12 export .zip autonome | ✅ fabriqué dans le navigateur de l'administrateur (pas de GitHub Actions : ni coût ni secret) ; photos en 1 200 px, vidéos en option ; testé ouvert en file:// |

## Phase 3 : où on en est

| Exigence | État |
|---|---|
| REC-01, 02, 03 épisodes automatiques et modifiables | ✅ nuits, silences ≥ 6 h, étapes ≥ 50 km ; fusionner, scinder, renommer, réordonner, déplacer, supprimer |
| REC-04 cases site et livre | ✅ une par une ou par lot |
| REC-06 légende de l'auteur, commentaires signés, réactions | ✅ |
| REC-09 galeries fluides | ✅ virtualisées ; visionneuse avec balayage et clavier |
| REC-05 rafales et meilleure photo | ✅ netteté (variance du laplacien) et exposition mesurées dans le navigateur ; rafale = même appareil, ≤ 10 s, même scène ; choix d'un clic conservé |
| REC-10 IA de vision pour départager (yeux ouverts, cadrage) | ✅ seulement les rafales à égalité (écart ≤ 5 points), jamais un choix manuel ; budget mensuel plafonné (IA_BUDGET_MENSUEL_EUR) |
| REC-07 retouches non destructives | ✅ recadrage (proportions, zoom, position), quarts de tour, redressement, lumière, contraste, hautes lumières, ombres, blancs, noirs, température, teinte, saturation, 4 filtres sobres |
| REC-08 rendu identique écran / site / PDF | ✅ un seul moteur (shader WebGL2) pour l'aperçu et les versions web ; référence CPU ; équivalence testée en E2E (ΔE ≈ 0) ; page /verification-rendu pour les vrais téléphones ; ⏳ rendu PDF par le même moteur en phase 5 |

## Phase 2 : où on en est

| Exigence | État |
|---|---|
| IMP-01, 02 envoi reprenable, file persistante | ✅ multipart R2 signé, file IndexedDB, reprise testée en E2E (coupure + rechargement) |
| IMP-04, 06 galerie du téléphone, glisser-déposer de dossiers | ✅ |
| IMP-11 JPEG, HEIC, PNG, WebP, AVIF, RAW (aperçu intégré) | ✅ HEIC via wasm hors Safari ; ⏳ à vérifier sur de vrais fichiers |
| IMP-12 vidéos | ✅ original + affiche ; ⏳ version allégée 720p |
| IMP-13 originaux + versions web | ✅ WebP 400/1200/2400 |
| IMP-14, 15 EXIF, recalage d'horloge, fuseaux | ✅ testés |
| IMP-16 dédoublonnage exact et perceptuel | ✅ testé (copie WhatsApp remplacée par l'original) |
| IMP-03 économie de données | ⏳ |
| IMP-05, 07–10 partage, Google Photos, Drive, Dropbox, OneDrive, iCloud, WhatsApp | ⏳ tranche 2 |
| IMP-17 volume 10 000 fichiers / 50 Go | ⏳ à mesurer (galerie virtualisée en place) |

## Phase 1 : où on en est

| Critère | État |
|---|---|
| Connexion sans mot de passe en moins d'une minute | ✅ testé en E2E (code et lien par e-mail) ; Google prêt, à activer |
| Plusieurs voyages, cloisonnement, 404 pour un non-membre | ✅ tests unitaires (pglite) et E2E |
| PWA installable | ✅ manifeste, icônes, service worker ; ⏳ installation à vérifier sur un vrai téléphone après déploiement |
| Pas d'URL codée en dur, CI anti-secrets | ✅ `APP_URL` partout ; gitleaks en CI |
| Déploiement Vercel | ✅ projet créé à la main (le connecteur n'a pas les droits), prévisualisation déployée ; production à la fusion de la PR #1 |

## Décisions prises

Voir `PROJECT.md` (cadrage) et `research/SUMMARY.md` (stack). En bref : Vercel Hobby, Neon + Drizzle, Better Auth + e-mails Gmail (SMTP), R2 + Uppy, versions web dans le navigateur, `render-core` WebGL2, Typst pour le PDF, GitHub Actions pour les tâches longues, `APP_URL` sans domaine personnalisé au départ.

## À fournir par Romain (bloquant au moment indiqué)

| Quand | Quoi |
|---|---|
| Phase 1 | ✅ Projet Vercel, base Neon (neon-carmine-notebook), secrets ; Gmail par mot de passe d'application ; identifiants OAuth Google (facultatif, plus tard) |
| Phase 2 | ✅ Bucket R2 et clé d'API dans Vercel ; ⏳ clés d'application Dropbox et OneDrive ; projet Google Cloud (Picker Photos et Drive) |
| Phase 5 | Secrets GitHub Actions pour l'accès R2 et le rappel vers l'app |
| Phase 6 | Clés sandbox Lulu, Prodigi et Gelato (V2) |

Les secrets vont uniquement dans les variables d'environnement Vercel et les secrets GitHub, jamais dans le dépôt.

## Points ouverts

- CEWE accepte-t-il le PDF sur `cewe.fr` ? (phase 6)
- Limites exactes de Neon quand il est créé via la marketplace Vercel (phase 1)
- Taille minimale des parts multipart R2 et nettoyage automatique des envois incomplets (spike phase 2)

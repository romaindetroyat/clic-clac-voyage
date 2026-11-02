# État du projet

**Phase en cours** : 3, Tri et récit (tranches 1 à 3 livrées)
**Dernière action** : phase 1 en production (connexion Gmail vérifiée par Romain) ; phase 2, tranche 1 : envoi reprenable vers R2, analyse dans le navigateur, galerie, recalage d'horloge, dédoublonnage
**Prochaine étape** : tester l'import réel sur téléphone, puis tranche 2 (partage Android et Raccourci iOS, WhatsApp, Google Photos, Drive, Dropbox, OneDrive, vidéo allégée, mode économie de données)

## Phase 3 : où on en est

| Exigence | État |
|---|---|
| REC-01, 02, 03 épisodes automatiques et modifiables | ✅ nuits, silences ≥ 6 h, étapes ≥ 50 km ; fusionner, scinder, renommer, réordonner, déplacer, supprimer |
| REC-04 cases site et livre | ✅ une par une ou par lot |
| REC-06 légende de l'auteur, commentaires signés, réactions | ✅ |
| REC-09 galeries fluides | ✅ virtualisées ; visionneuse avec balayage et clavier |
| REC-05 rafales et meilleure photo | ✅ netteté (variance du laplacien) et exposition mesurées dans le navigateur ; rafale = même appareil, ≤ 10 s, même scène ; choix d'un clic conservé |
| REC-10 IA de vision pour départager (yeux ouverts, cadrage) | ⏳ nécessite une clé d'API et un budget plafonné : à décider |
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

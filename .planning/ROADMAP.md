# Feuille de route : Clic-Clac Voyage

7 phases larges. Chacune se termine par quelque chose **utilisable sur le vrai voyage** et par une vérification de fin de phase contre ses critères. Choix techniques : [`research/SUMMARY.md`](research/SUMMARY.md).

- [~] **Phase 1 : Fondations** (code fait, déploiement en attente)
- [ ] **Phase 2 : Import et stockage**
- [ ] **Phase 3 : Tri et récit**
- [ ] **Phase 4 : Site du voyage**
- [ ] **Phase 5 : Livre photo**
- [ ] **Phase 6 : Imprimeurs et commandes**
- [ ] **Phase 7 : Finition sur le vrai voyage**

---

## Phase 1 : Fondations

**Objectif** : l'administrateur crée le vrai voyage, invite le groupe, et chacun se connecte depuis son téléphone sans mot de passe.

**Exigences** : ACC-01 à ACC-08, RGPD-05.

**Décisions d'exécution** : le lien magique réutilise le code à 6 chiffres (un seul e-mail contient le code et un lien qui le saisit), et la limitation de débit est stockée en base pour tenir sur Vercel.

**Contenu** : dépôt Next.js (TS strict, pnpm, ESLint, Vitest, Playwright), Neon + Drizzle (schéma : utilisateurs, voyages, adhésions avec rôle, invitations, liens secrets), Better Auth (lien magique, OTP à 6 chiffres, Google) avec inscription réservée aux invitations, e-mails Resend en français, couche d'autorisation unique `requireTripRole(tripId, role)`, `APP_URL` pour tous les liens absolus, squelette PWA (manifeste, icônes, service worker), déploiement Vercel sur l'URL par défaut, CI GitHub (lint, types, tests, recherche de secrets), `.env.example` sans valeurs.

**Critères de réussite**
1. Un invité reçoit l'e-mail, se connecte par code ou lien en moins d'une minute sur téléphone et arrive sur le voyage.
2. Un utilisateur membre de deux voyages passe de l'un à l'autre ; un non-membre reçoit une 404 sur toute ressource d'un autre voyage (tests d'accès automatisés).
3. L'app s'installe en PWA sur Android et iOS.
4. Aucune URL absolue codée en dur ; la CI échoue si un secret est commité.

## Phase 2 : Import et stockage

**Objectif** : tout le groupe envoie ses photos et vidéos depuis n'importe quelle source, de façon fiable même sur un réseau instable.

**Exigences** : IMP-01 à IMP-17.

**Contenu** : *spike en premier* (multipart R2 reprenable, HEIC et RAW dans le navigateur, Raccourci iOS). Bucket R2 privé et CORS, URLs présignées émises après contrôle du rôle, Uppy + file IndexedDB persistante, mode économie de données, versions web WebP générées dans le navigateur, extraction EXIF (exifr), vidéo avec Mediabunny, rattrapage sur GitHub Actions, glisser-déposer de dossiers, Web Share Target (Android) et Raccourci iOS, sélecteurs Google Photos (avec un Worker Cloudflare vers R2), Drive, Dropbox et OneDrive, import d'archive WhatsApp, recalage d'horloge par appareil avec fuseaux, dédoublonnage (SHA-256 + dHash, l'original de meilleure qualité est gardé), galerie virtualisée simple. Page d'aide pour l'iPhone et iCloud.

**Critères de réussite**
1. 1 000 photos envoyées depuis un téléphone avec coupures réseau et fermeture de l'app arrivent toutes, sans doublon.
2. Après un recalage d'horloge (« appareil de Paul : +1 h 12 »), l'ordre chronologique est correct.
3. HEIC, RAW (aperçu), MOV/MP4 s'affichent ; les originaux sont intacts sur R2.
4. Une archive WhatsApp puis les originaux : les copies sont remplacées automatiquement.
5. Tests unitaires : recalage d'horloge, dédoublonnage, parsing WhatsApp.

## Phase 3 : Tri et récit

**Objectif** : l'administrateur obtient des épisodes et une sélection de départ sans effort, le groupe raconte le voyage.

**Exigences** : REC-01 à REC-10.

**Contenu** : découpage auto en épisodes (écarts de temps, jours, distance GPS) + édition (fusionner, scinder, renommer, réordonner, déplacer), titre, dates, lieu, récit, cases « site » et « livre », rafales et meilleure photo (netteté, exposition, cadrage en local ; modèle de vision seulement pour départager, avec budget plafonné), légendes, commentaires, réactions, éditeur de retouches avec `render-core` WebGL2 (*spike d'équivalence au début*) et versions web cuites, tests ΔE en CI.

**Critères de réussite**
1. Sur le vrai voyage, le découpage proposé est juste à quelques retouches près, ajusté en une soirée.
2. Chaque rafale propose une meilleure photo, modifiable d'un clic.
3. Une retouche donne le même rendu dans l'éditeur, dans la version web et dans le rendu SwiftShader (ΔE2000 moyen < 0,5).
4. Une galerie de 3 000 photos défile sans à-coups sur téléphone.

## Phase 4 : Site du voyage

**Objectif** : un beau site partageable, installable, consultable hors ligne et exportable.

**Exigences** : SITE-01 à SITE-12.

**Contenu** : rendu public `/v/<slug>` protégé par lien secret (mot de passe en option, révocable), 6 thèmes, personnalisation (palette, polices, couverture), sections activables et réordonnables, présentations par épisode, mise en avant de photos, visionneuse plein écran avec balayage, carte au niveau ville (positions arrondies côté serveur, EXIF GPS retiré des fichiers servis), chiffres du voyage, mode journal en direct, service worker hors ligne, export .zip autonome (généré sur GitHub Actions, déposé sur R2).

**Critères de réussite**
1. Le site est beau sur téléphone et sur ordinateur ; Lighthouse mobile ≥ 90 en performance et en accessibilité.
2. Il s'installe en PWA et se consulte hors ligne après une première visite.
3. Le .zip exporté s'ouvre par double-clic sans serveur.
4. Aucune coordonnée GPS précise n'est présente dans le HTML, le JSON, les images servies ou l'export (test automatisé).

## Phase 5 : Livre photo

**Objectif** : un livre d'environ 100 pages généré automatiquement, retouché page par page, exporté en PDF conforme.

**Exigences** : LIV-01 à LIV-11.

**Contenu** : *spike Typst en premier* (200 pages, mémoire, temps, TrimBox, pipeline GitHub Actions → R2 → rappel). Modèle `book.json` indépendant de l'imprimeur, identité typographique et bibliothèque de gabarits originales (1 à 9 photos, doubles pages, pleine page, ouvertures d'épisode, couverture, dos), moteur de mise en page par programmation dynamique avec cible de pages, éditeur page par page (sans placement au pixel), contrôles en direct (dpi, massicot, pli, pages), historique des versions, aperçu feuilletable, pipeline d'export (images cuites par `render-core`, Typst, post-traitement pikepdf / qpdf / Ghostscript, contrôles automatiques, progression et reprise). Profils de format génériques en attendant les imprimeurs.

**Critères de réussite**
1. La mise en page auto d'un livre de 100 pages se fait en quelques secondes et respecte la cible de pages.
2. Un changement de format réadapte la mise en page sans casse.
3. Un PDF de 200 pages est généré de façon fiable, reprend après interruption, et passe les contrôles (taille de page = format + fond perdu, polices embarquées, aucune image sous 250 dpi effectifs).
4. Tests unitaires : moteur de mise en page, calcul du dos, contrôles dpi et zones de sécurité.

## Phase 6 : Imprimeurs et commandes

**Objectif** : choisir l'imprimeur sur des chiffres réels, exporter des fichiers acceptés du premier coup, organiser la commande du groupe.

**Exigences** : IMPR-01 à IMPR-11 (V2-01 en fin de phase si le temps le permet).

**Contenu** : compléter les fiches (prix par page, port vers la France, délais, poids maximum, CEWE France) et les encoder en données versionnées avec date de relevé et niveau de certitude ; règles imprimeur appliquées par l'éditeur ; profils d'export par imprimeur (fichiers, couleur, nommage) ; « mettre à jour avec l'IA » (recherche web, propositions validées par l'administrateur) ; comparateur (coût total réel, exclusions motivées, classement réglable) ; choix de l'imprimeur qui réadapte le livre ; commandes par personne, partage du port, récapitulatif « qui doit combien à qui », états de commande ; lien direct de commande. **V2** : commande par API chez Lulu, puis Prodigi et Gelato.

**Critères de réussite**
1. Pour le livre du vrai voyage, le comparateur affiche le coût total réel de chaque imprimeur compatible et explique chaque exclusion.
2. Le PDF exporté pour l'imprimeur choisi passe son contrôle à la première commande.
3. Chaque participant voit ce qu'il doit et à qui.
4. Tests unitaires : règles imprimeurs, calcul du dos par imprimeur, prix, port et parts.

## Phase 7 : Finition sur le vrai voyage

**Objectif** : le vrai voyage traité de bout en bout, à grand volume, dans le budget.

**Exigences** : RGPD-01 à RGPD-04, et la reprise de toutes les exigences sous charge réelle.

**Contenu** : import réel complet, performance à 10 000 fichiers et 50 Go, suppression de compte et de voyage (base + R2), mention droit à l'image, mesure du coût réel sur un mois, tests E2E Playwright du parcours principal (invitation → import → épisodes → site → livre → comparateur → commande), corrections.

**Critères de réussite** : les 7 critères de [`docs/PROMPT-LANCEMENT.md` §10](../docs/PROMPT-LANCEMENT.md#10-critères-de-réussite), vérifiés sur le vrai voyage, dont un coût mesuré ≤ 5 € par mois.

---

## Couverture des exigences

| Phase | Exigences |
|---|---|
| 1 | ACC-01…08, RGPD-05 |
| 2 | IMP-01…17 |
| 3 | REC-01…10 |
| 4 | SITE-01…12 |
| 5 | LIV-01…11 |
| 6 | IMPR-01…11, V2-01 |
| 7 | RGPD-01…04 |

Toutes les exigences de `REQUIREMENTS.md` sont affectées à une phase.

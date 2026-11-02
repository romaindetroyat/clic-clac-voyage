# Synthèse de la recherche

Relevé du 2 novembre 2026. Détails et sources dans les quatre fichiers voisins :
[STACK-ET-COUTS](STACK-ET-COUTS.md) · [IMPORT-ET-MEDIAS](IMPORT-ET-MEDIAS.md) · [PDF-ET-LIVRE](PDF-ET-LIVRE.md) · [IMPRIMEURS](IMPRIMEURS.md).

## Stack retenue

| Brique | Choix | Pourquoi (résumé) |
|---|---|---|
| App | Next.js (App Router, TS strict) sur **Vercel Hobby** | Imposé ; Hobby suffit pour un usage familial sans paiement ni publicité (300 s et 2 Go par fonction, requêtes ≤ 4,5 Mo). Aucun lien d'affiliation vers les imprimeurs. |
| URL | `APP_URL` (URL Vercel par défaut au départ) | Passage à `clic-clac-voyage.fr` plus tard sans changement de code. |
| Base | **Neon Free** + **Drizzle** (driver HTTP Neon) | Veille après 5 min, réveil en quelques centaines de ms ; Supabase gratuit se met en pause après 7 jours sans activité, rédhibitoire pour un usage par à-coups. |
| Auth | **Better Auth** : lien magique, code OTP à 6 chiffres, Google | Auth.js n'est plus qu'en maintenance. Inscription seulement avec une invitation valide (une organisation Better Auth = un voyage, ou tables maison). |
| E-mails | **Gmail en SMTP** (mot de passe d’application), Resend en alternative | Décision du 2 novembre 2026 : pas de domaine, peu d’e-mails ; Resend n’envoie pas depuis une adresse gmail.com. |
| Médias | **Cloudflare R2**, multipart par URL présignée depuis le navigateur | Aucun fichier ne transite par Vercel. CORS avec l'en-tête `ETag` exposé. Originaux passés en Infrequent Access après 30 jours. |
| Envoi | **Uppy** + `@uppy/aws-s3`, file persistante maison en IndexedDB | tus impossible sans serveur. La reprise des gros fichiers est à écrire nous-mêmes. Background Sync n'existe pas sur iOS : la reprise se fait à la réouverture. |
| Versions web | Générées **dans le navigateur** à l'import (WebP 400 / 1 200 / 2 400 px) | HEIC natif sur Safari, libheif wasm ailleurs, RAW par leur aperçu JPEG intégré. Rattrapage par une tâche GitHub Actions. Pas de `next/image` ni de Cloudflare Images sur les photos (coût). |
| Vidéo | **Mediabunny** (WebCodecs) dans le navigateur, ffmpeg sur GitHub Actions en secours | Stream hors budget ; Media Transformations limité à 1 min ; ffmpeg.wasm trop lent. |
| Retouches | **Un seul moteur `render-core` en WebGL2** (paramètres JSON par photo) | Le même shader sert à l'éditeur, aux versions web « cuites » et aux images du PDF, préparées dans un Chromium sans écran avec SwiftShader. Équivalence testée en CI (ΔE2000 moyen < 0,5). Secours : portage CPU en wasm. |
| PDF | **Typst 0.15** piloté depuis TS ; `book.json` → cadres en mm → `main.typ` | Gère le fond perdu et écrit la TrimBox, polices embarquées, rendu déterministe. Paged.js est figé depuis 2023 et Chromium n'écrit pas de boîtes d'impression. Post-traitement pikepdf / qpdf, Ghostscript pour le CMJN si un imprimeur l'exige. |
| Tâches longues | **GitHub Actions** (`workflow_dispatch`) pour le PDF final, la vidéo et le rattrapage ; **QStash** gratuit comme file ; cron Vercel quotidien pour le ménage | Gratuit (dépôt public). **Aucune donnée personnelle dans les journaux ni les artefacts** : on ne passe qu'un identifiant opaque, les entrées et sorties passent par R2. Plan B : la même image Docker sur Fly.io ou Cloudflare Containers. |
| Google Photos | Picker API, plus un petit **Cloudflare Worker** qui copie vers R2 | Il faut télécharger avec le jeton dans les 60 min. `=d` retire le GPS et les vidéos arrivent transcodées. Le mode test OAuth (100 utilisateurs) suffit. |
| Polices du livre | Cormorant Garamond (titres), Newsreader (récit), Inter (légendes), toutes en OFL | Embarquables. |
| Mise en page auto | Gabarits en proportions + **programmation dynamique** par épisode, avec une pénalité pour tenir la cible de pages | Une seule source géométrique, partagée par l'éditeur et le PDF. |

**Budget estimé** (3 voyages, 150 Go, 15 utilisateurs) : **environ 2 € par mois** hors domaine. Le plafond de 5 € est atteint vers 370 Go.

## Sources d'import : ce qui change par rapport au brief

- **iOS ne gère pas le partage vers une PWA** (Web Share Target, bug WebKit ouvert depuis 2019). Contournements : un **Raccourci iOS** fourni par l'app, qui envoie les originaux HEIC avec leur EXIF, et le sélecteur de fichiers. Attention, ce sélecteur convertit souvent en JPEG et retire des métadonnées : il faut un mode « original » guidé.
- **Lien d'album iCloud partagé : déconseillé.** L'endpoint n'est pas officiel et les albums ne contiennent que des versions réduites, inutilisables pour l'impression. Contournement documenté dans l'app.
- **WhatsApp** : photos de 1 600 px (4 096 px en HD), sans EXIF. L'auteur et l'heure viennent du fichier `_chat.txt`. On rapproche la copie de l'original par dHash, ratio et date.
- **Google Photos** : 2 000 éléments au plus par session du sélecteur, GPS retiré. La position doit venir d'un autre envoi de la même photo ou rester vide.

## Imprimeurs

- **Retenus (8)** : Saal Digital, Blurb, Fotofabriek, Pixartprinting, Lulu, Gelato, Prodigi (qui a absorbé Peecho), et **CEWE sous réserve** : le dépôt PDF n'est confirmé qu'au Royaume-Uni.
- **Écartés** : Photobox, Albelli et Photoweb (logiciel maison seulement, à reconfirmer), Printler (affiches).
- **V1 (lien direct)** : Saal, Pixartprinting, Blurb, Fotofabriek, et CEWE si `cewe.fr` accepte le PDF. **V2 (API)** : Lulu, Prodigi, Gelato.
- **Haut de gamme** : Saal Professional Line (reliure à plat), Blurb layflat proPhoto Pearl.
- **Couleur** : tous attendent du sRGB sauf Pixartprinting (CMJN FOGRA39). Le PDF/X-4 est demandé par Prodigi.
- **Trous à combler en phase 6** : prix par page supplémentaire, frais de port vers la France, plusieurs délais, poids maximum des fichiers, fond perdu Saal, maximum de pages Blurb.

## Spikes à faire tôt (dans leur phase)

1. **Phase 2** : envoi multipart R2 reprenable de fichiers de 2 Go après fermeture de l'onglet ; décodage HEIC et RAW dans le navigateur sur un téléphone Android moyen ; Raccourci iOS.
2. **Phase 3** : `render-core` WebGL2, équivalence iPhone / Android / SwiftShader.
3. **Phase 5 (au début)** : Typst sur 200 pages (temps, mémoire, JPEG intégrés sans ré-encodage, TrimBox), puis pipeline GitHub Actions → R2 → rappel.

## Risques majeurs

| Risque | Parade |
|---|---|
| Rendu des retouches différent selon les GPU | Tests ΔE en CI ; secours CPU en wasm pour les rendus cuits et le PDF |
| iPhone : originaux HEIC dégradés par le sélecteur de fichiers | Raccourci iOS + mode guidé ; détection des JPEG convertis et invitation à renvoyer |
| Fuite de données dans les journaux GitHub Actions (dépôt public) | Identifiant opaque seulement, journaux muets, aucun artefact ; test qui inspecte les sorties |
| Fiches imprimeurs incomplètes ou périmées | Champs « non vérifié » visibles, date de relevé, mise à jour assistée par l'IA validée par l'administrateur |
| Limites Neon ou Vercel Hobby dépassées | Mesure du coût réel en phase 7 ; plan de passage au Pro documenté |

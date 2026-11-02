# Recherche : import et médias

Date : 2 novembre 2026. Recherche courte (environ 25 requêtes web). Ce document couvre les sections 4 et 8 de `docs/PROMPT-LANCEMENT.md`.

Légende : **[vérifié]** = confirmé par une source officielle citée en bas ; **[à vérifier]** = connaissance générale ou source secondaire, à confirmer pendant un essai technique (spike).

---

## 0. Recommandations (à retenir)

1. **Un seul tuyau d'envoi pour toutes les sources** : la file d'envoi du navigateur (Uppy Core + `@uppy/aws-s3`) envoie vers R2 par URL signée : un PUT simple sous environ 64 Mo, du multipart au-delà, avec des morceaux de 8 à 16 Mio. Les sources « cloud » (Drive, Dropbox, OneDrive) sont d'abord téléchargées dans le navigateur, puis passent par ce même tuyau. **Exception : Google Photos.** On le transfère côté serveur par un petit **Cloudflare Worker « ingest »** (binding R2 direct), car l'URL expire au bout de 60 minutes, demande un jeton dans l'en-tête et le CORS n'est pas garanti. Ne pas faire transiter les octets par les fonctions Vercel (limites de durée et de taille, coût).
2. **Pas de tus.** Il faut un serveur tus, impossible sur Vercel. Le multipart S3 signé suffit et R2 le gère nativement.
3. **File persistante maison** : IndexedDB (Dexie) stocke l'état de chaque fichier (`uploadId`, morceaux terminés et leurs ETags, empreinte). Il faut aussi garder une **copie des octets dans l'OPFS** pour tout fichier choisi sur mobile, sinon l'objet `File` disparaît à la fermeture de l'app. Sur Chromium ordinateur, on stocke plutôt des `FileSystemFileHandle`. Sinon, on demande à l'utilisateur de resélectionner le fichier (rapprochement par nom, taille et `lastModified`). **Ne pas compter sur Background Sync ni Background Fetch** : ils n'existent que sur Chromium, pas sur iOS. Sur iOS, l'envoi ne progresse que tant que l'app est au premier plan : on affiche « gardez l'app ouverte » et on active le Wake Lock.
4. **iPhone** : iOS Safari ne gère pas le Web Share Target. Le contournement repose sur deux voies :
   - **(a)** un **Raccourci iOS** fourni par l'app (feuille de partage → « Obtenir le contenu de l'URL » vers notre API, avec un jeton personnel révocable). Il envoie les originaux HEIC avec leur EXIF.
   - **(b)** le sélecteur `<input type=file multiple>` dans la PWA. Attention : Safari iOS **transcode en JPEG** et peut retirer des métadonnées. On le présente comme le « mode rapide » et on garde le Raccourci comme « mode original ».
5. **iCloud, lien d'album partagé : ne pas le faire.** L'endpoint `webstream` n'est pas officiel et casse sans préavis. Surtout, les albums partagés iCloud ne contiennent **que des versions réduites**, inutilisables pour l'impression. On passe par le Raccourci, le sélecteur ou l'export depuis Photos sur Mac suivi d'un glisser-déposer du dossier.
6. **WhatsApp** : on importe le `.zip` exporté, on le lit dans le navigateur (fflate) et on analyse le `.txt` de la discussion pour récupérer l'auteur et l'heure de chaque média. Chaque photo est marquée « copie compressée ». On l'associe ensuite à un original par **dHash 64 bits** (distance de Hamming ≤ 8), avec le même ratio (±1 %) et une date compatible (±36 h). Quand l'original arrive, il remplace automatiquement la copie (retouches et placement conservés).
7. **Versions web générées dans le navigateur à l'import** (Web Worker) :
   - décodage : natif (Safari décode le HEIC), sinon `heic-to`/libheif wasm pour le HEIC, et l'aperçu JPEG intégré pour les RAW ;
   - redimensionnement : 3 tailles (environ 400, 1200 et 2400 px) ;
   - encodage : **WebP** avec `@jsquash/webp`, plus rapide et partout identique. L'AVIF reste facultatif, en tâche de fond.

   Un **« réparateur » par lots sur GitHub Actions** (Ubuntu : `libvips` + `libheif` + libde265 via apt, ou sharp compilé contre ce libvips) produit les versions qui manquent : fichiers venus du Raccourci, de Google Photos, ou envois depuis un appareil trop lent. **Pas de Cloudflare Images** : il accepte le HEIC, mais 10 000 photos × 3 tailles dépassent largement les 5 000 transformations gratuites par mois.
8. **Vidéo** : transcodage dans le navigateur avec **Mediabunny (WebCodecs)** vers une version allégée en 720p H.264/AAC d'environ 2,5 Mb/s, plus une image d'affiche. En repli (navigateur sans encodeur, vidéo très longue), **ffmpeg sur GitHub Actions**, gratuit car le dépôt est public. **Exclus** : Cloudflare Stream (5 $ par tranche prépayée de 1 000 minutes stockées, hors budget) et Media Transformations (entrée limitée à 100 Mo et 10 minutes, sortie à 1 minute : inadapté). ffmpeg.wasm est trop lent et trop lourd sur mobile.
9. **Retouches : un seul moteur, un shader WebGL2**, avec les mêmes sources GLSL partout :
   - aperçu interactif dans l'éditeur ;
   - versions web « cuites » dans le navigateur à l'enregistrement ;
   - rendu pleine résolution pour le PDF dans le **même Chromium sans écran** (headless) qui produit déjà le livre, avec un WebGL logiciel (SwiftShader) et un traitement par tuiles.

   **Pas de seconde implémentation avec sharp.** L'équivalence se vérifie par des images de référence (« golden ») et un test ΔE2000 en CI.
10. **Google Photos dès la v1 : coût OAuth à anticiper.** Le scope `photospicker.mediaitems.readonly` impose un écran de consentement Google. En mode « test », l'app est limitée à 100 utilisateurs déclarés, ce qui suffit pour une famille ou des amis **[à vérifier]**. Au-delà, il faut une vérification de l'app par Google. **Le GPS est retiré** des fichiers téléchargés par `=d` **[vérifié]**.

---

## A. Sources d'import

### A1. Google Photos Picker API

**Flux complet [vérifié sauf mention]** :
1. OAuth Google côté client (Google Identity Services, jeton d'accès) avec le scope `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
2. `POST https://photospicker.googleapis.com/v1/sessions`, qui renvoie `id`, `pickerUri` et `pollingConfig`. `pickingConfig.maxItemCount` vaut **2 000 au maximum et par défaut**, et ne peut pas être modifié après la création de la session.
3. Ouvrir `pickerUri` dans un nouvel onglet ou sur l'app Google Photos du téléphone. Ajouter `/autoclose` pour que l'onglet se ferme seul **[à vérifier]**.
4. Interroger `GET sessions/{id}` au rythme donné par `pollingConfig`, jusqu'à `mediaItemsSet = true`.
5. `GET /v1/mediaItems?sessionId=…` (paginé avec `nextPageToken`) renvoie des `PickedMediaItem` avec `mediaFile.baseUrl`, `mimeType` et `filename`.
6. Téléchargement :
   - photo : `baseUrl + "=d"`, qui conserve l'EXIF **sauf la localisation** ;
   - vidéo : `baseUrl + "=dv"`, qui renvoie une **version transcodée** « haute qualité », pas le fichier original. Attendre `mediaMetadata.status = READY`.
   - Il faut l'en-tête `Authorization: Bearer`. Les `baseUrl` **expirent après 60 minutes**, ou plus tôt si l'accès est révoqué.
7. Supprimer la session (`DELETE sessions/{id}`).

**Quotas** : 100 000 requêtes par minute et par projet pour l'API, 1 000 000 par minute pour l'accès aux octets. Il existe aussi une limite non chiffrée sur la création de sessions. Aucun risque à notre échelle.

**Pleine résolution** : `=d` renvoie l'image d'origine avec ses métadonnées (hors GPS) d'après la documentation. Il faut vérifier pendant le spike que le HEIC d'un iPhone arrive bien en HEIC original et pas en JPEG recompressé **[à vérifier]**. Si le compte Google est en « Économiseur d'espace », l'« original » est déjà compressé chez Google.

**Où transférer** : dans un Worker Cloudflare `ingest`. Le navigateur lui envoie `{baseUrl, token, clé R2 cible}`, et le Worker fait un `fetch` en flux puis un `env.BUCKET.put()` (connaître la taille avec `FixedLengthStream`, ou faire un multipart R2 côté Worker pour les grosses vidéos). Le jeton Google n'est jamais stocké. Le plan Workers gratuit (100 000 requêtes par jour) suffit, et le CPU consommé par un simple relais en flux reste très faible. Le navigateur pilote la boucle (une requête par média, 4 en parallèle). Le GPS manquant se complète ensuite par rapprochement avec d'autres appareils ou à la main.

**Vérification OAuth** : `photospicker.mediaitems.readonly` est probablement classé « sensible » **[à vérifier dans la console]**.
- En mode « Testing », jusqu'à 100 utilisateurs de test déclarés, avec un écran « application non validée ». Les jetons de rafraîchissement expirent au bout de 7 jours, ce qui n'est pas gênant car on n'en a pas besoin : un jeton d'accès ponctuel suffit.
- Pour une ouverture publique, il faut une vérification (politique de confidentialité, domaine vérifié, vidéo de démonstration) : quelques jours à semaines, gratuite pour un scope sensible.

### A2. Google Drive Picker

- Google Picker (gapi `picker`) avec le scope **`drive.file`**, non sensible et recommandé par Google avec le Picker. Il ne donne accès qu'aux fichiers choisis.
- Téléchargement : `GET https://www.googleapis.com/drive/v3/files/{id}?alt=media` avec `Authorization: Bearer`. L'API autorise le CORS, donc le fichier peut être téléchargé directement dans le navigateur, puis passé à la file Uppy. Pour les très gros fichiers, passer par le Worker `ingest`, comme pour Photos.
- Dossiers : le Picker permet de choisir un dossier, puis `files.list?q='ID' in parents`. Avec `drive.file`, l'accès aux enfants d'un dossier choisi n'est pas garanti **[à vérifier]**. Le plus simple est d'autoriser la sélection multiple de fichiers.

### A3. Dropbox Chooser

- Script `dropins.js` et une clé d'app (gratuite, sans revue pour le Chooser). `linkType: "direct"` renvoie un lien vers le contenu qui **expire au bout de 4 heures** et qui autorise le CORS : téléchargement possible dans le navigateur, puis la file Uppy. `multiselect: true`. **Le choix de dossiers n'est pas possible en lien `direct`.**

### A4. OneDrive File Picker v8

- Il faut enregistrer une app dans Microsoft Entra (gratuit), avec des comptes personnels et professionnels. Le sélecteur v8 s'ouvre dans une fenêtre ou une iframe et communique par `postMessage`. Il renvoie des références `{driveId, id}` **[à vérifier : prise en charge des comptes personnels en v8]**.
- Téléchargement :
  - `GET https://graph.microsoft.com/v1.0/drives/{driveId}/items/{id}/content`, qui redirige vers une URL pré-authentifiée ;
  - ou lire `@microsoft.graph.downloadUrl` sur l'élément. Cette URL est valable **environ 1 heure** et se télécharge sans jeton, donc depuis le navigateur ou le Worker.
- Plus coûteux à intégrer que Dropbox ou Drive. À placer **en dernier** dans l'ordre de réalisation.

### A5. Web Share Target

- **Android Chrome : oui.** Le manifeste déclare `share_target` avec `method: "POST"`, `enctype: "multipart/form-data"` et `files: [{name: "media", accept: ["image/*","video/*"]}]`. Le service worker intercepte le POST, range les fichiers dans l'OPFS ou IndexedDB, puis redirige vers `/import`. La PWA doit être **installée**.
- **iOS Safari : non**, y compris en 2026. Le bug WebKit 194593 est ouvert depuis 2019 et n'a pas d'assigné. Comme tous les navigateurs iOS utilisent WebKit, aucun autre navigateur ne peut contourner le problème.
- **Contournements iPhone :**
  1. **Raccourci iOS** (app Raccourcis, préinstallée), recommandé pour les originaux. Il s'affiche dans la feuille de partage de Photos et accepte images et vidéos. Pour chaque élément :
     - `POST /api/import/presign` avec un jeton personnel lié au voyage et révocable, qui renvoie une URL PUT signée ;
     - puis `PUT` du fichier vers R2.

     Il envoie le HEIC original avec son EXIF, GPS compris si l'option « Localisation » du partage est active **[à vérifier]**. On le distribue par un lien iCloud vers le raccourci. Limites : il faut l'installer une fois, la progression est peu visible, et l'envoi est séquentiel. Le jeton se colle une fois dans le raccourci, par une question à l'import.
  2. **`<input type="file" accept="image/*,video/*" multiple>`** dans la PWA (la galerie iOS). Safari iOS **convertit les photos en JPEG** quelle que soit la valeur de `accept`. D'après un retour de 2025, il peut aussi supprimer des métadonnées. Pour garder le HEIC, utiliser « Parcourir » (app Fichiers) **[à vérifier sur iOS 26]**. Attention : sur macOS, Safari 17 et plus convertit parfois les fichiers **en HEIC** si `accept` contient `image/heic` (bug WebKit 303803). Il ne faut donc pas mettre `image/heic` dans `accept` sur Safari.
  3. Sur Mac, exporter les originaux depuis Photos (« Exporter l'original non modifié »), puis glisser-déposer le dossier.

### A6. iCloud : lien d'album partagé

- Fonctionnement non officiel : `POST https://pNN-sharedstreams.icloud.com/{token}/sharedstreams/webstream` avec `{"streamCtag":null}`. Il faut suivre la redirection 330 ou `X-Apple-MMe-Host`, puis appeler `webasseturls` pour obtenir les URLs. Plusieurs scripts communautaires le font.
- **Risques** : aucune documentation, aucun contrat, aucune garantie ; possible conflit avec les conditions d'Apple. Surtout, les **albums partagés iCloud stockent des versions réduites** (environ 2 048 px pour les photos, 720p pour les vidéos **[à vérifier]**), donc **inutilisables pour l'impression**.
- Les liens « Copier le lien iCloud » (`icloud.com/photos/#…`, 30 jours) donnent bien les originaux, mais passent par une API privée encore moins stable.
- **Recommandation** : ne pas l'implémenter en v1. Documenter le Raccourci iOS et l'export depuis Photos. Éventuellement, un « import aperçu » depuis un album partagé, signalé comme qualité réduite et remplaçable par l'original plus tard, en réutilisant le mécanisme WhatsApp.

### A7. WhatsApp

**Structure de l'archive (« Exporter la discussion » › « Joindre les médias »)** **[à vérifier sur un vrai export]** :
- **Android** :
  - archive `WhatsApp Chat with <Nom>.zip` (ou un ensemble de fichiers partagés) contenant `WhatsApp Chat with <Nom>.txt` ;
  - médias nommés `IMG-AAAAMMJJ-WA0001.jpg`, `VID-AAAAMMJJ-WA0002.mp4`, `PTT-…opus` (audio), `STK-…webp` (autocollants) ;
  - dans le `.txt`, une ligne par message, du type `02/11/2026 14:22 - Paul: IMG-20261102-WA0001.jpg (fichier joint)` (le libellé dépend de la langue).
- **iOS** :
  - `WhatsApp Chat - <Nom>.zip` contenant `_chat.txt` ;
  - médias nommés `00000012-PHOTO-2026-11-02-14-22-31.jpg` ou `…-VIDEO-….mp4` ;
  - lignes du type `[02/11/2026 14:22:31] Paul: <pièce jointe : 00000012-PHOTO-….jpg>`.
- Le **nom de fichier ne contient que la date** sur Android, l'heure n'apparaît que dans le `.txt` (sur iOS, le nom porte la date et l'heure). L'**EXIF est supprimé** : ni date de prise de vue, ni appareil, ni GPS.
- Résolution :
  - qualité standard : **côté long ≤ 1 600 px** ;
  - qualité **HD** (depuis 2023) : côté long ≤ 4 096 px.

  La date `AAAAMMJJ` est la date d'**envoi ou de réception**, pas celle de la prise de vue. L'export « avec médias » est limité aux messages récents (environ 10 000).

**Détection d'une copie WhatsApp (score)** : correspondance du nom avec `^(IMG|VID)-\d{8}-WA\d{4}` ou `^\d{8}-(PHOTO|VIDEO)-` ; absence d'EXIF `Make`/`Model`/`DateTimeOriginal` ; côté long ∈ {1 600, 2 560, 4 096} ou ≤ 1 600 ; JPEG ≤ 400 Ko. Source = `whatsapp` si l'import vient d'un zip.

**Association à l'original :**
1. Candidats : originaux du même voyage dont la `DateTimeOriginal` (après recalage) précède le message d'au plus 36 h, avec un ratio identique à ±1 % (en tenant compte de l'orientation EXIF et d'une éventuelle rotation de 90°).
2. Empreinte : **dHash 64 bits**, calculé sur l'image réduite à 9×8 en niveaux de gris, **après application de l'orientation**. On calcule aussi un pHash (DCT 32×32) pour départager. On les stocke tous deux en base pour chaque photo, ce qui servira aussi pour les doublons et les rafales.
3. Seuils de départ :
   - distance de Hamming dHash ≤ 6 : sûr ;
   - de 7 à 12 : à confirmer par une SSIM ≥ 0,9 sur 256 px, ou par l'utilisateur.

   À calibrer sur un jeu de test réel. WhatsApp recadre parfois, et la HD reste comparable.
4. Remplacement : l'original devient la source et la copie devient « masquée ». On conserve l'auteur, l'heure du message et la légende extraits du `.txt`, ainsi que les retouches. Le recadrage est exprimé en coordonnées relatives, donc il reste compatible.

### A8. Glisser-déposer de dossiers, carte SD

- `DataTransferItem.webkitGetAsEntry()` est disponible dans tous les navigateurs, Safari compris. On parcourt l'arbre de manière récursive. **`readEntries()` renvoie les entrées par lots d'environ 100** : il faut l'appeler en boucle jusqu'à obtenir un tableau vide.
- `getAsFileSystemHandle()` (Chromium) permet de **conserver un handle** dans IndexedDB et de relire le fichier après un redémarrage. C'est la meilleure option pour reprendre l'envoi d'une carte SD de 30 Go.
- Bouton complémentaire : `<input type="file" webkitdirectory multiple>` (ordinateur).
- Filtrer `.DS_Store`, `._*`, `Thumbs.db`, les `.THM`/`.LRV` (sidecars GoPro et DJI) et les XMP (à conserver éventuellement à côté du RAW).

### A9. Envoi qui reprend après une coupure

**R2 multipart [vérifié]** :
- morceaux de 5 Mio minimum (sauf le dernier) et 5 Gio maximum, **tous de taille égale** ;
- 10 000 morceaux au maximum ;
- les envois incomplets expirent au bout de 7 jours (configurable) ;
- les URLs signées ne fonctionnent qu'avec l'endpoint S3 `<compte>.r2.cloudflarestorage.com`, pas avec un domaine personnalisé ;
- CORS sur le bucket : `AllowedMethods: PUT, GET, HEAD`, `ExposeHeaders: ["ETag"]`, origines de l'app.

Chaque morceau compte comme une opération de classe A : 1 million gratuites par mois. 50 Go en morceaux de 16 Mio représentent environ 3 200 opérations : négligeable.

**Uppy (recommandé)** : `@uppy/core` + `@uppy/aws-s3` (v4 et suivantes, plugin unifié avec `shouldUseMultipart(file)`) + une interface sur mesure (pas besoin du Dashboard).
- Routes Next.js à écrire :
  - `createMultipartUpload` ;
  - `signPart` (signature locale avec `@aws-sdk/s3-request-presigner` ou `aws4fetch`, sans appel à R2) ;
  - `listParts` ;
  - `completeMultipartUpload` ;
  - `abortMultipartUpload` ;
  - `getUploadParameters`, pour le PUT simple.
- Chaque route vérifie le voyage, le rôle et le quota. Les clés R2 suivent le format `trips/{tripId}/orig/{mediaId}`.
- Golden Retriever (le plugin de reprise d'Uppy) ne restaure de façon fiable que les petits fichiers (≤ 5 Mio dans IndexedDB par défaut). Son stockage par service worker ne survit pas à un redémarrage, et la reprise d'un `uploadId` S3 n'est pas officiellement prise en charge (issue #4992). **On écrit donc notre propre persistance** :
  - table `queue` (Dexie) : `{mediaId, source, name, size, lastModified, sha1 rapide (premier et dernier Mio), key, uploadId, parts: [{n, etag}], état}` ;
  - octets :
    - ordinateur Chromium : `FileSystemFileHandle` ;
    - mobile, partage Android ou ZIP WhatsApp : copie dans l'**OPFS**. Le quota par origine sur iOS 17 et suivants est d'environ 60 % du disque, et l'éviction après 7 jours **ne s'applique pas** aux PWA installées. Demander `navigator.storage.persist()` ;
    - sinon : fichier « fantôme » à resélectionner ;
  - au redémarrage : `listParts` sur R2, puis reprise au morceau manquant.
- **Économie de données** : en réseau mobile (`navigator.connection.saveData` ou réglage manuel), on envoie d'abord les versions web et un « aperçu » JPEG de 2 400 px, puis l'original est mis en attente « Wi-Fi seulement ». L'état `original_pending` est visible.
- **tus** : écarté. Il faut un serveur tusd ou une implémentation tus sur Workers et Durable Objects, soit plus de pièces pour un gain nul face au multipart S3.
- **Background Sync / Background Fetch** : Chromium uniquement. Background Fetch n'existe sur aucune version d'iOS Safari jusqu'à la 27. Bonus possible sur Android, mais **l'architecture ne doit pas en dépendre**. Sur iOS : envoi au premier plan, `navigator.wakeLock.request('screen')` pendant l'envoi, notification à la réouverture.

---

## B. Formats

### B1. HEIC/HEIF

- **Navigateur** : Safari (macOS et iOS 17 et suivants) décode nativement, avec `<img>` et `createImageBitmap`. Chrome, Firefox et Edge **ne décodent pas** le HEIC en 2026 (licence HEVC). Il faut alors **`heic-to`** (libheif 1.19+ en wasm, maintenu) ou `libheif-js`/`heic-decode` pour obtenir les pixels RGBA. heic2any est vieillissant. On détecte le format par les octets `ftyp` (`heic`, `heix`, `mif1`), pas par le type MIME.
- **Serveur** : les binaires précompilés de sharp **n'incluront jamais le HEVC** (brevets). Il faut un libvips global avec libheif et libde265, puis compiler sharp à partir des sources (fragile : conflits de versions de libheif). Sur GitHub Actions (Ubuntu 24.04), `apt install libvips-tools libheif-plugin-libde265` permet d'appeler la ligne de commande `vips` directement **[à vérifier : nom du paquet]**. `heic-convert` (JS pur, lent) peut servir de dépannage.
- **Cloudflare Images** accepte le HEIC en entrée et sort de l'AVIF, du WebP ou du JPEG. Formule gratuite : 5 000 transformations uniques par mois, puis 0,50 $ par tranche de 1 000. Pour 10 000 photos × 3 tailles = 30 000 transformations, environ 12,50 $ par voyage : **hors budget**.
- **Où générer les versions web** : **dans le navigateur, à l'import**, dans un Web Worker :
  1. décodage (natif, ou wasm pour le HEIC ou l'aperçu RAW) ;
  2. application de l'orientation ;
  3. redimensionnement avec `OffscreenCanvas` + `drawImage` en plusieurs passes (ou `pica`) ;
  4. encodage WebP avec `@jsquash/webp` (wasm, résultat identique partout ; Safari ne sait pas encoder en WebP avec `canvas.toBlob`) ;
  5. envoi des 3 versions, quelques centaines de Ko au total.

  L'AVIF (`@jsquash/avif`) est 3 à 10 fois plus lent : on le réserve au réparateur par lots si on le veut. Le **réparateur GitHub Actions** (planifié et déclenché par un webhook) régénère ce qui manque.

### B2. RAW (CR2, CR3, NEF, ARW, DNG, RAF)

- On garde le RAW tel quel dans R2. L'**aperçu JPEG intégré**, en général en taille réelle ou à environ 1 620 px selon les boîtiers, alimente les versions web et l'éditeur.
- Le JPEG est rangé sous le tag `JpgFromRaw` ou `PreviewImage` selon la marque. Les CR2, NEF, ARW et DNG sont des conteneurs TIFF, le CR3 est un conteneur ISO-BMFF (`crx`). `exifr` lit l'EXIF de tous ces formats ; l'extraction de l'aperçu par `exifr.thumbnail()` ne renvoie que la **petite** vignette IFD1 **[à vérifier]**. Pour la grande, il faut un extracteur dédié : lire `PreviewImageStart`/`Length`, `JpgFromRawStart`, ou parcourir les boîtes du CR3. Il existe des implémentations en JS (portage de `exiftool -b -JpgFromRaw`) et `libraw-wasm` en secours (lourd, environ 1 à 2 Mo de wasm).
- Certains fichiers n'ont **aucun aperçu** (certains DNG de smartphone, Cinema DNG). Dans ce cas, le dématriçage se fait par le réparateur par lots (`dcraw_emu`/`darktable-cli`), ou on se contente d'une vignette « RAW sans aperçu ».
- Pour le livre, imprimer à partir de l'aperçu JPEG en taille réelle est acceptable. Les RAW sans aperçu complet sont signalés.

### B3. EXIF

- **`exifr`** (navigateur et Node, lit uniquement les premiers Ko) :
  - `DateTimeOriginal`, `OffsetTimeOriginal` (fuseau, disponible sur les iPhone récents et beaucoup d'hybrides) et `SubSecTimeOriginal` ;
  - GPS (`latitude`/`longitude` calculés), `Orientation`, `Make`, `Model` ;
  - `BodySerialNumber`/`SerialNumber` et `LensModel`.
- Clé « appareil » pour le recalage d'horloge : `Make|Model|SerialNumber`. À défaut, `Make|Model|propriétaire de l'import`.
- Sans fuseau dans l'EXIF : déduire le fuseau du GPS (`tz-lookup`, petit jeu de données hors ligne), ou à défaut prendre le fuseau du voyage défini par l'organisateur.
- Les vidéos utilisent les atomes QuickTime (`com.apple.quicktime.creationdate`, location ISO6709). Mediabunny ou `mp4box.js` lisent les métadonnées sans tout décoder.
- **Vie privée** : le GPS et le numéro de série restent en base, en privé. Les versions web générées **ne contiennent aucun EXIF**, car l'encodeur n'en écrit pas.

### B4. Vidéo

| Option | Coût | Limites | Verdict |
|---|---|---|---|
| **Mediabunny + WebCodecs (navigateur)** | 0 € | Encodage matériel H.264 sur Chrome, Edge, Android et Safari 17+ **[à vérifier : VideoEncoder sur iOS 26]**. 5 à 60 fois plus rapide que ffmpeg.wasm. Le décodage HEVC dépend de l'appareil. | **Choix principal** |
| ffmpeg.wasm | 0 € | Lent (environ 25 i/s en 1080p sur un portable, beaucoup moins sur mobile), environ 30 Mo de wasm, mémoire | Non |
| Cloudflare Media Transformations | Facturé comme Images (5 000 gratuites par mois) | Entrée ≤ 100 Mo et ≤ 10 min, **sortie ≤ 1 min** | Non (seulement pour une affiche ou un extrait si besoin) |
| Cloudflare Stream | 5 $ par 1 000 min stockées (prépayé), 1 $ par 1 000 min diffusées | — | Hors budget |
| **GitHub Actions + ffmpeg** | 0 € (dépôt public, minutes illimitées sur les exécuteurs standards) | Les journaux sont **publics** : n'y écrire aucune URL ni aucun nom. Les médias transitent par l'exécuteur (éphémère). Environ 6 h maximum par tâche. | **Repli par lots** |

Paramètres : 720p (côté long 1 280), H.264 High, environ 2,5 Mb/s, AAC 128 kb/s, `faststart`, et une affiche WebP extraite à 1 s. Une vidéo originale de 4K/HEVC est conservée dans R2, mais n'apparaît jamais dans le livre.

---

## C. Retouches non destructives au rendu identique

**Principe** : un fichier de paramètres JSON versionné par photo :
```json
{v:1, crop, rotate, straighten, exposure, blacks, whites, highlights, shadows, temp, tint, saturation, vibrance?, contrast, filter, filterAmount}
```
Un **seul moteur de rendu : des shaders WebGL2**, avec le module `render-core`, ses sources GLSL et l'ordre des passes.

**Chaîne :**
1. Décodage sRGB, puis passage en **linéaire, en float 16 ou 32 bits** ;
2. balance des blancs (température et teinte, matrice de Bradford simplifiée) ;
3. exposition ;
4. courbe tonale paramétrique : noirs, ombres, hautes lumières, blancs, contraste. Il s'agit d'une courbe globale **sans filtre local**, pour garantir le déterminisme ; pour un vrai « hautes lumières/ombres » local, utiliser un flou gaussien séparable à rayon fixe en fraction de l'image, ce qui reste reproductible ;
5. saturation ;
6. filtre : LUT 3D 33³ embarquée, de type « argentique doux », etc. ;
7. retour en sRGB avec tramage (dither) ;
8. recadrage, rotation et redressement en coordonnées **relatives** (de 0 à 1) appliqués à l'échantillonnage.

**Trois usages du même code :**
1. **Éditeur** : rendu en direct sur un aperçu d'environ 2 400 px.
2. **Versions web « cuites »** : à l'enregistrement, le navigateur rend 400, 1 200 et 2 400 px avec le même shader dans un OffscreenCanvas. L'image est encodée en WebP, puis envoyée en remplacement des versions web (clé suffixée par le hachage des paramètres, ce qui évite les problèmes de cache).
3. **PDF** : le Chromium sans écran qui rend le livre (Paged.js) exécute **la même page de rendu** sur l'original en pleine résolution, avec WebGL logiciel (SwiftShader : `--use-gl=angle --use-angle=swiftshader`). Il traite les images **par tuiles**, en recoupant les bords pour le flou, si l'image dépasse `MAX_TEXTURE_SIZE`. Il écrit un JPEG qualité 95 et insère le profil sRGB ICC. La conversion PDF/X et CMJN se fait en aval, si l'imprimeur l'exige.

**Pourquoi pas WebGL + sharp ?** Les opérations de sharp (`linear`, `modulate`, `recomb`, `gamma`) ne correspondent pas exactement aux ombres et hautes lumières, ni aux LUT. Il faudrait maintenir deux implémentations et rapprocher en continu leurs écarts. Avec un seul moteur, l'équivalence est garantie par construction, au bruit des pilotes GPU près.

**Tester l'équivalence :**
- Un jeu d'environ 20 images de référence (ciel, peau, nuit, contre-jour, néons) × environ 15 jeux de paramètres. Rendus de référence produits en CI (Chromium + SwiftShader, Playwright) et versionnés, de petite taille.
- Test CI : ΔE2000 moyen < 0,5 et 99ᵉ centile < 2 entre le rendu actuel et la référence (régression), ainsi qu'entre le rendu de l'aperçu réduit et le rendu en pleine résolution réduit (cohérence d'échelle).
- Test manuel ponctuel sur les vrais GPU (iPhone, Android Mali/Adreno, Mac) : une page `/dev/render-check` rend la grille et renvoie les écarts. Exiger `precision highp float` et éviter les fonctions sensibles aux pilotes (`pow` sur des négatifs, `mediump`).
- Option de secours, si le déterminisme entre GPU s'avère insuffisant : porter `render-core` en TypeScript ou en wasm, sur le CPU et en float32, et l'utiliser pour les rendus cuits et pour le PDF, avec WebGL seulement pour l'aperçu, testé contre la version CPU.

---

## Risques principaux

| Risque | Impact | Parade |
|---|---|---|
| iOS : pas de partage vers la PWA, JPEG et métadonnées perdus via `<input>` | Expérience iPhone dégradée, perte du HEIC ou du GPS | Raccourci iOS « mode original » + avertissement + spike sur iOS 26 |
| iOS : aucun envoi en arrière-plan | Envois longs interrompus | File persistante (OPFS) + reprise par `listParts` + Wake Lock + reprise auto à l'ouverture |
| Google Photos : GPS retiré, vidéo transcodée, vérification OAuth | Métadonnées incomplètes, friction | Marquer la source, compléter le GPS, rester en mode test avec 100 utilisateurs maximum |
| Quota OPFS ou mémoire sur mobile pour de gros lots | Échec de copie | Copie au fil de l'eau, purge après confirmation de R2, lots de 200 fichiers |
| Décodage HEIC wasm lent sur Android d'entrée de gamme | Import lent | Concurrence 2, laisser le réparateur par lots s'en charger si l'appareil est lent (mesurer) |
| WebGL : écarts entre GPU | Rendu différent écran/PDF | Tests ΔE, highp, repli CPU |
| GitHub Actions dans un dépôt public | Fuite d'informations dans les journaux | Journaux muets, clés R2 en secrets, URLs signées jamais affichées |
| Endpoint iCloud non officiel | Cassure soudaine | Non implémenté |
| Limite de 2 000 éléments par session Google Photos | Gros voyages | Enchaîner les sessions |

---

## Spikes à prévoir (ordre conseillé)

1. iPhone (iOS 26) : `<input>` (format, EXIF, GPS), Raccourci (HEIC, EXIF), reprise de l'envoi après fermeture de la PWA, `VideoEncoder` disponible.
2. Google Photos Picker : `=d` renvoie-t-il bien le HEIC original ? CORS des `baseUrl` ? Classement du scope.
3. Réalisation du rendu de retouches WebGL dans Chromium sans écran (SwiftShader) : temps pour un JPEG de 48 Mpx par tuiles.
4. dHash WhatsApp sur 50 paires réelles (standard et HD) pour fixer les seuils.

---

## Sources

- Google Photos Picker : [Media items](https://developers.google.com/photos/picker/guides/media-items) · [Sessions](https://developers.google.com/photos/picker/guides/sessions?hl=en) · [REST sessions (maxItemCount)](https://developers.google.com/photos/picker/reference/rest/v1/sessions?hl=bn) · [Limites et quotas](https://developers.google.com/photos/overview/api-limits-quotas?authuser=9) · [Accès aux médias (base URL)](https://developers.google.com/photos/library/guides/access-media-items)
- Google Drive Picker : [Picker, intégration](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker) · [Discussion drive.file + Picker](https://groups.google.com/g/google-apps-script-community/c/5Ll7dY9ibmw)
- Dropbox : [Chooser (liens direct, 4 h)](https://www.dropbox.com/developers/dropins/chooser) · [Forum : expiration](https://www.dropboxforum.com/discussions/101000014/im-saving-a-file-url-by-using-dropin-api-after-a-while-that-url-starts-to-give-4/96398)
- OneDrive : [Exemple de sélecteur](https://www.meziantou.net/using-onedrive-file-picker-in-a-website) · [Issue downloadUrl](https://github.com/OneDrive/samples/issues/2)
- Web Share Target : [Bug WebKit 194593](https://bugs.webkit.org/show_bug.cgi?id=194593) · [Note de recherche iOS PWA, déc. 2025](https://tangled.org/zzstoatzz.io/plyr.fm/blob/main/docs/research/2025-12-19-web-share-target-ios-pwa.md) · [web-features : share](https://web-platform-dx.github.io/web-features-explorer/features/share)
- `<input>` iOS et HEIC : [Test zenn.dev (2025)](https://zenn.dev/link/comments/c356d4558e16ad) · [Bug WebKit 303803](https://bugs.webkit.org/show_bug.cgi?id=303803) · [Forum Apple](https://developer.apple.com/forums/thread/743049)
- iCloud : [Gist webstream](https://gist.github.com/WildDIC/73e2c955863fd657ca4b2500bf954fe9) · [pyicloud #395](https://github.com/picklepete/pyicloud/issues/395) · [Forum Apple : pas d'API](https://developer.apple.com/forums/thread/717066)
- WhatsApp : [PhotoPrism #1102](https://github.com/photoprism/photoprism/issues/1102) · [Réparer les dates WhatsApp](https://holwech.github.io/blog/Fixing-WhatsApp-Backup) · [HD 4096×2692 / standard 1600×1052](https://www.channelnews.com.au/whatsapp-can-now-finally-send-higher-resolution-photos/) · [TechRadar, réglage HD](https://www.techradar.com/phones/this-whatsapp-setting-will-upgrade-your-photos-and-videos-heres-how-to-use-it)
- Envoi : [R2 multipart](https://developers.cloudflare.com/r2/objects/multipart-objects) · [Codes d'erreur R2](https://developers.cloudflare.com/r2/api/error-codes/) · [Uppy Golden Retriever](https://uppy.io/docs/golden-retriever/) · [Uppy #4992](https://www.github.com/transloadit/uppy/issues/4992) · [Transloadit : R2 depuis le navigateur](https://transloadit.com/devtips/browser-uploads-to-cloudflare-r2-with-aws-sdk/) · [r2-bucket-uploader](https://github.com/datopian/r2-bucket-uploader)
- Arrière-plan et stockage : [caniuse Background Fetch](https://caniuse.com/mdn-api_backgroundfetchmanager_fetch) · [Politique de stockage WebKit](https://webkit.org/updates) · [MDN quotas](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- HEIC : [sharp #4050](https://github.com/lovell/sharp/issues/4050) · [sharp #2518](https://github.com/lovell/sharp/issues/2518) · [libvips #3173](https://github.com/libvips/libvips/discussions/3173) · [heic-to](https://awesome.ecosyste.ms/projects/github.com%2Fhoppergee%2Fheic-to) · [libheif-js](https://awesome.ecosyste.ms/projects/github.com%2Fcatdad-experiments%2Flibheif-js) · [Support HEIC dans les navigateurs](https://www.testmuai.com/learning-hub/heif-browser-support/) · [HEIC et createImageBitmap](https://dev.to/forze-dev/why-heic-breaks-websites-and-how-i-built-a-browser-only-converter-to-fix-it-gp0)
- Cloudflare Images : [Tarifs](https://developers.cloudflare.com/images/pricing) · [Changelog HEIC](https://developers.cloudflare.com/changelog/heic-support/) · [Limites et formats](https://developers.cloudflare.com/images/get-started/limits/index.md)
- RAW : [Extraction des JPEG intégrés](https://havecamerawilltravel.com/extract-jpg-raw-2/) · [LibRaw RawPreviewExtractor](https://diglloyd.com/blog/2021/20211029_0700-LibRAW-RawPreviewExtractor.html) · [raw-preview-extractor (CR3)](https://packagist.org/packages/ronanlenouvel/raw-preview-extractor)
- Vidéo : [Media Transformations](https://developers.cloudflare.com/stream/transform-videos/) · [Changelog limites juin 2025](https://developers.cloudflare.com/changelog/2025-06-10-media-transformations-limits-increase/) · [Tarifs Stream](https://developers.cloudflare.com/stream/pricing) · [Mediabunny (SVTA)](https://university.svta.org/conference-proceedin/performant-and-accessible-client-side-media-processing-with-mediabunny/) · [Benchmark WebCodecs Remotion](https://awesome.ecosyste.ms/projects/github.com%2Fremotion-dev%2Fwebcodecs-benchmark) · [ffmpeg.wasm et GPU](https://dayverse.pages.dev/en/articles/why-ffmpeg-wasm-fails-leverage-gpu-acceleration)

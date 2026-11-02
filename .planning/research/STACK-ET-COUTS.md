# Stack et coûts : Clic-Clac Voyage

Recherche du 2 novembre 2026. Contraintes : Vercel + Next.js imposés, 0 à 5 € par mois, jusqu'à 50 Go et 10 000 fichiers par voyage, quelques voyages, 2 à 15 personnes par voyage.
Conversion utilisée : 1 $ ≈ 0,92 € (ordre de grandeur, à recalculer au moment de payer).

## Décisions recommandées

| Sujet | Décision | Coût |
|---|---|---|
| Hébergement | **Vercel Hobby** (gratuit). Le Pro (20 $/mois) n'est **pas nécessaire**. | 0 € |
| Stockage | **Cloudflare R2**, un seul bucket privé, envoi direct du navigateur par **URLs présignées** (PUT simple ou multipart). Originaux passés en **Infrequent Access** au bout de 30 jours (option d'économie). | 150 Go ≈ 1,9 €/mois |
| Base | **Neon Free** (via la marketplace Vercel ou en direct). Pas Supabase. | 0 € |
| ORM | **Drizzle** + driver `@neondatabase/serverless` (HTTP). | 0 € |
| Auth | **Better Auth** : plugins `magicLink` + `emailOTP` (6 chiffres) + Google ; invitations par voyage (tables maison ou plugin `organization` avec 1 organisation = 1 voyage). Pas Auth.js. | 0 € |
| E-mails | **Resend Free** (3 000/mois, 100/jour), domaine d'envoi `clic-clac-voyage.fr` vérifié (SPF + DKIM). | 0 € |
| Tâches | **QStash Free** pour la file d'événements (déclenche des fonctions Vercel), **GitHub Actions** (dépôt public = gratuit) pour les traitements lourds (PDF de gros livre, vidéo, lots d'images), **Vercel Cron** une fois par jour pour le ménage. | 0 € |
| Domaine | `clic-clac-voyage.fr` **semble libre** (RDAP AFNIC : 404). Prendre chez **OVHcloud** (~6 € TTC la 1re année, ~9,35 € TTC/an ensuite). | ≈ 0,80 €/mois amorti |

**Budget du scénario « 3 voyages, 150 Go, 15 utilisateurs » : ≈ 1,9 € par mois hors domaine, ≈ 2,7 € avec le domaine.** Le plafond de 5 € est atteint vers 370 Go en stockage standard, et bien plus loin si les originaux passent en Infrequent Access.

Trois règles d'architecture découlent directement des limites gratuites :
1. **Aucun fichier ne transite par Vercel** : ni en envoi (limite de 4,5 Mo par requête), ni en lecture (100 Go de transfert par mois). Tout passe en direct entre le navigateur et R2.
2. **Pas de `next/image` sur les photos** : le Hobby inclut seulement 5 000 transformations d'image par mois. Les versions web (miniature, moyenne, grande) sont générées par l'app et rangées dans R2.
3. **Pas de calcul lourd dans les fonctions Vercel** : le Hobby inclut 4 h de CPU actif par mois. Le décodage HEIC et RAW et la génération des miniatures se font dans le navigateur (wasm) à l'import, et le reste part sur GitHub Actions.

---

## 1. Stockage : Cloudflare R2

### Tarifs (page mise à jour le 30 octobre 2026)

| | Standard | Infrequent Access |
|---|---|---|
| Stockage | 0,015 $/Go-mois | 0,01 $/Go-mois |
| Opérations classe A | 4,50 $/million | 9,00 $/million |
| Opérations classe B | 0,36 $/million | 0,90 $/million |
| Récupération des données | gratuite | 0,01 $/Go |
| Sortie vers Internet | **gratuite** | **gratuite** |

- **Offre gratuite mensuelle (stockage Standard uniquement)** : 10 Go-mois, 1 million d'opérations A, 10 millions d'opérations B.
- **Classe A** (écritures) : PutObject, CopyObject, ListObjects, CreateMultipartUpload, UploadPart, CompleteMultipartUpload, ListParts…
- **Classe B** (lectures) : GetObject, HeadObject…
- **Gratuit** : DeleteObject, AbortMultipartUpload.
- Infrequent Access : durée minimale de 30 jours.

### Coût estimé

| Volume | Calcul | Par mois |
|---|---|---|
| 100 Go | (100 − 10) × 0,015 | **1,35 $ ≈ 1,25 €** |
| 150 Go | (150 − 10) × 0,015 | **2,10 $ ≈ 1,95 €** |
| 300 Go | (300 − 10) × 0,015 | **4,35 $ ≈ 4,00 €** |
| 150 Go, originaux en IA | ~20 Go de versions web en Standard (10 Go gratuits) + 130 Go d'originaux en IA | ≈ 0,15 + 1,30 = **1,45 $ ≈ 1,35 €** |

**Opérations, en pratique gratuites.** Un voyage de 10 000 fichiers et 50 Go représente environ 10 000 PUT pour les originaux (plus environ 5 000 parts multipart pour les vidéos et les gros RAW) et 30 à 40 000 PUT pour les versions web, soit ~55 000 opérations A. Trois voyages font ~165 000 opérations A, très en dessous du million gratuit. Les lectures de 15 personnes restent loin des 10 millions d'opérations B.

**IA pour les originaux :** une règle de cycle de vie bascule les originaux en IA au bout de 30 jours. On ne les relit que pour l'export du livre ou une archive : 50 Go relus coûtent 0,50 $. À activer quand le volume dépasse ~100 Go.

### Envoi multipart par URLs présignées

- Les URLs présignées acceptent GET, HEAD, PUT et DELETE. Durée : **de 1 seconde à 7 jours** (604 800 s).
- Elles **ne marchent qu'avec le domaine S3** `<ACCOUNT_ID>.r2.cloudflarestorage.com`, pas avec un domaine personnalisé.
- **Multipart** : 10 000 parts au maximum, 5 Gio au maximum par PUT simple. Taille de part : 5 Mio minimum (sauf la dernière), à vérifier dans la doc S3 de R2. Recommandation : parts de 8 à 16 Mio.
  - Le serveur Next.js fait CreateMultipartUpload, puis signe une URL PUT par part (`partNumber` + `uploadId`).
  - Le navigateur envoie les parts et garde l'ETag de chaque part.
  - Le serveur fait CompleteMultipartUpload.
  - Pour reprendre après une coupure, l'app garde `uploadId` + parts terminées dans IndexedDB, puis appelle `ListParts` côté serveur.
- **CORS** à poser sur le bucket :
  - AllowedOrigins = le domaine de l'app (plus les aperçus Vercel si besoin) ;
  - AllowedMethods = PUT, GET, HEAD ;
  - AllowedHeaders = `content-type` ;
  - **ExposeHeaders = `ETag`** (indispensable pour finir un multipart depuis le navigateur).

  Il faut signer le `Content-Type` et renvoyer exactement le même à l'envoi, sinon on obtient une erreur 403 SignatureDoesNotMatch.
- **Durée de vie conseillée** :
  - URLs d'envoi : 1 h, renouvelées à la demande pendant la reprise ;
  - URLs de lecture : 1 h à 24 h ;
  - fichiers d'un site partagé : URLs courtes générées à l'ouverture, ou petit Worker (voir plus bas).
- **Ménage** : prévoir une règle de cycle de vie AbortIncompleteMultipartUpload à 7 jours. Des sources tierces disent que c'est le comportement par défaut, ce qui n'est pas vérifié dans la doc officielle.
- **Lecture des galeries** : les URLs présignées sur le domaine S3 se mettent mal en cache. Option gratuite : un **Cloudflare Worker** sur `media.clic-clac-voyage.fr` qui vérifie un jeton HMAC court (voyage + clé + expiration), lit R2 par binding et profite du cache CDN. Gratuit jusqu'à 100 000 requêtes par jour. Conditions : un domaine géré par Cloudflare DNS, ou un sous-domaine délégué.

## 2. Base de données : Neon vs Supabase

| | Neon Free | Supabase Free |
|---|---|---|
| Stockage | 1 Go par projet (20 Go par compte) | 500 Mo (source tierce) |
| Calcul | 100 CU-heures par projet et par mois, jusqu'à 2 CU | instance partagée |
| Inactivité | **mise en veille après 5 min**, réveil en « quelques centaines de ms » | **projet en pause après 7 jours**, réveil manuel selon certaines sources |
| Transfert sortant | 5 Go par projet et par mois | — |
| Branches / historique | 10 branches, 6 h d'historique | — |
| Payant | Launch à l'usage (0,106 $/CU-h, 0,35 $/Go-mois) | Pro 25 $/mois |

**Choix : Neon.**
- La mise en veille de Neon coûte une latence au premier appel (quelques centaines de ms), alors que la pause Supabase casse l'app après une semaine sans visite. C'est rédhibitoire pour un usage par à-coups.
- 100 CU-h suffisent largement : l'instance minimale de 0,25 CU allumée 24 h/24 consommerait 180 CU-h, mais la mise en veille la coupe dès 5 minutes sans activité.
- Les métadonnées de 30 000 fichiers (EXIF, empreintes, légendes, commentaires) tiennent en quelques dizaines à quelques centaines de Mo : on reste sous 1 Go.
- Par la marketplace Vercel, la base est créée et facturée via Vercel, et les variables d'environnement sont injectées automatiquement. Je n'ai pas trouvé de doc officielle qui confirme que les limites du plan Free sont identiques par cette voie. À vérifier à la création, sinon créer le projet Neon en direct et le relier.
- Sauvegarde : 6 h d'historique seulement en Free. Ajouter un `pg_dump` hebdomadaire via GitHub Actions vers R2. Attention : le fichier ne doit **pas** être un artefact public.

**ORM : Drizzle.**
- Bundle minuscule, pas de génération de code, schéma en TypeScript.
- Driver HTTP Neon (`drizzle-orm/neon-http`) adapté aux fonctions serverless : pas de pool de connexions à gérer.
- Migrations avec `drizzle-kit`.
- Prisma 7 a supprimé son moteur Rust et réduit fortement l'écart, mais reste plus lourd (environ 0,6 à 1,6 Mo selon la mesure) et impose `prisma generate`. Ces chiffres viennent de comparatifs tiers.
- Better Auth fournit un adaptateur Drizzle.

## 3. Authentification

**Choix : Better Auth.**
- Auth.js est maintenu par l'équipe Better Auth depuis septembre 2025. Il ne reçoit plus que les correctifs de sécurité, et l'équipe recommande Better Auth pour les nouveaux projets.
- Better Auth couvre le besoin avec ses plugins officiels :
  - **`emailOTP`** : code à **6 chiffres par défaut** (`otpLength`), valable **300 s** (`expiresIn`), **3 essais** (`allowedAttempts`). L'inscription automatique se désactive avec `disableSignUp`.
  - **`magicLink`** : lien magique (plugin séparé, documenté sur better-auth.com/docs/plugins/magic-link).
  - **Google** : fournisseur social intégré.
  - **Invitations** : deux options.
    - Option A, plus rapide : le plugin `organization`, avec 1 organisation = 1 voyage. Il fournit `inviteMember`, une expiration à 48 h par défaut (modifiable, par exemple 7 jours) et un callback `sendInvitationEmail`. L'invité accepte avec `acceptInvitation`, et l'e-mail de la session doit correspondre à celui de l'invitation. Les rôles se personnalisent par contrôle d'accès : `admin` et `contributeur`.
    - Option B, plus lisible : des tables maison `voyage`, `membre_voyage(role)` et `invitation(token, voyage, email, role, expire_le)`.
    - Dans les deux cas, **l'inscription n'est ouverte qu'avec une invitation valide** : un hook `databaseHooks.user.create.before` refuse les e-mails sans invitation en attente.
  - **Lecteur** : pas de compte. Il passe par un lien secret (jeton aléatoire stocké haché, révocable, mot de passe facultatif). Ce mécanisme est hors Better Auth.

**Resend (offre gratuite)**
- **3 000 e-mails par mois, 100 par jour, 3 domaines**, 30 jours de journaux.
- Pro : 20 $/mois pour 50 000 e-mails.
- Le quota de **100 e-mails par jour** est la seule limite à surveiller : par exemple 15 invitations et des codes OTP le même soir. Il reste largement suffisant.
- Domaine d'envoi : vérifier `clic-clac-voyage.fr`, ou un sous-domaine comme `mail.clic-clac-voyage.fr`, avec les enregistrements DNS SPF, DKIM et DMARC fournis par Resend. Expéditeur : `Clic-Clac Voyage <bonjour@clic-clac-voyage.fr>`.
- Sans domaine vérifié, Resend n'envoie qu'à l'adresse du compte. **Le domaine est donc nécessaire dès la phase 1.**

## 4. Vercel Hobby

| Limite Hobby | Valeur | Conséquence |
|---|---|---|
| Durée max d'une fonction | **300 s**, défaut et maximum | Traiter le PDF par lots de pages, sinon GitHub Actions |
| Mémoire / CPU | **2 Go / 1 vCPU** | Suffisant pour Chromium sur de petits lots |
| Taille du bundle | **250 Mo** non compressés (bêta « large functions » jusqu'à 5 Go) | `@sparticuz/chromium` tient (~60 à 70 Mo) |
| Corps de requête / réponse | **4,5 Mo** | Aucun fichier ne passe par les fonctions |
| Cron | 100 par projet, **1 fois par jour maximum**, précision ±59 min | Ménage quotidien seulement |
| Inclus par mois | 100 Go de transfert, 1 M d'invocations, **4 h de CPU actif**, 360 Go-h de mémoire, **5 000 transformations d'image**, 1 M de requêtes CDN | Pas de traitement d'image côté serveur |
| Dépassement | Fonction bloquée jusqu'à la fin des 30 jours | Surveiller l'usage |
| Divers | 100 déploiements par jour, 1 h de journaux, Vercel Workflows 50 000 événements par mois inclus | — |

**Usage commercial.** Le Hobby est réservé à un « usage personnel non commercial ». Est commercial tout déploiement qui sert le gain financier de quelqu'un : paiements sur le site, publicité, liens d'affiliation en usage principal, rémunération pour créer ou héberger le site. Les dons ne sont pas un usage commercial.

**Une app familiale et entre amis, gratuite, sans paiement ni publicité, est donc conforme.** Points de vigilance :
1. Les commandes de livres se règlent **chez l'imprimeur**, pas dans l'app. L'app calcule seulement les parts de chacun.
2. **Aucun lien d'affiliation** vers les imprimeurs.
3. Si l'app devient un jour un service ouvert ou payant, il faudra passer au Pro (20 $ par développeur et par mois).

**Le Pro n'est pas obligatoire.** Ses seuls apports utiles seraient des fonctions de 800 s, un cron à la minute et 4 Go de mémoire, et tous ont un contournement gratuit (section 6).

## 5. Domaine `clic-clac-voyage.fr`

- **Disponibilité** : la requête RDAP de l'AFNIC (`rdap.nic.fr/domain/clic-clac-voyage.fr`) répond **404** (non enregistré), alors que `google.fr` répond 200. Le domaine **semble libre** au 2 novembre 2026. `clicclacvoyage.fr` et `clic-clac-voyage.com` semblent libres aussi. À confirmer au moment de l'achat.
- **Prix d'un .fr** :
  - OVHcloud : ~4,99 € HT (5,99 € TTC) la 1re année, puis ~7,79 € HT (9,35 € TTC) par an. Relevé tiers du 24 octobre 2026.
  - Gandi : bien plus cher au renouvellement (~28,78 € TTC).
  - Cloudflare Registrar : ne propose pas le .fr, ou ne l'affiche pas.

  **Recommandation : OVHcloud.** On peut ensuite déléguer les DNS à Cloudflare (gratuit) si on veut le Worker média sur un sous-domaine.
- Coût amorti : **≈ 0,80 € par mois**.

## 6. Tâches et traitements longs à coût nul

| Outil | Offre gratuite | Usage recommandé |
|---|---|---|
| **Vercel Cron** | 1 fois par jour, ±59 min | Ménage nocturne : invitations expirées, multipart abandonnés, statistiques de coût |
| **Upstash QStash** | **1 000 messages par jour**, 1 Mo par message, 10 files (parallélisme 2), 10 planifications, délai jusqu'à 7 jours, réponse jusqu'à 15 min (bornée à 300 s par Vercel), 3 jours de DLQ et de journaux ; au-delà, 1 $ pour 100 000 messages | File d'événements : « fichier envoyé » vers EXIF, dédoublonnage, rafales, avec reprises automatiques. Remplace un cron fréquent |
| **GitHub Actions** | **Gratuit et sans quota de minutes** sur les runners standard d'un dépôt public. 6 h par job, 20 jobs en parallèle | Traitements lourds déclenchés par l'API (`workflow_dispatch`) : PDF de gros livres (Chromium + Ghostscript pour PDF/X et ICC), transcodage vidéo ffmpeg, rattrapage HEIC et RAW, `pg_dump` |
| **Cloudflare Workers** | 100 000 requêtes par jour, **10 ms de CPU** par requête, 128 Mo | Proxy média signé devant R2. Trop court pour du traitement d'image |
| **Cloudflare Queues** | 10 000 opérations par jour, rétention 24 h | Utile seulement si le traitement vit chez Cloudflare. Pas nécessaire ici |
| Vercel Workflows | 50 000 événements par mois inclus en Hobby | Option pour des orchestrations durables sans 2e fournisseur. À évaluer pendant la phase 2 |

**⚠ Dépôt public et GitHub Actions** : les **journaux et artefacts des workflows sont publics**.
- Ne jamais y écrire de nom, d'e-mail, de légende ou d'URL signée.
- Ne pas publier de résultat en artefact : les fichiers produits partent directement dans R2.
- Les clés restent dans les GitHub Secrets.
- Le workflow reçoit seulement un identifiant de tâche, puis relit le détail en base.

**Schéma retenu** : l'app inscrit une tâche en base, puis QStash appelle une route Vercel (≤ 300 s).
- Si la tâche est trop lourde, la route déclenche un `workflow_dispatch` GitHub.
- Le résultat revient dans R2 et en base.
- Le cron quotidien relance les tâches restées bloquées.

## 7. Budget mensuel : 3 voyages, 150 Go, 15 utilisateurs

| Poste | Hypothèse | Coût par mois |
|---|---|---|
| Vercel Hobby | Usage personnel, fichiers hors Vercel | 0 € |
| R2 stockage | 150 Go Standard (10 Go gratuits) | 2,10 $ ≈ **1,95 €** |
| R2 opérations | ~165 000 A une seule fois, < 1 M de B par mois | 0 € |
| R2 sortie | Gratuite | 0 € |
| Neon | Free, < 1 Go | 0 € |
| Better Auth | Bibliothèque open source | 0 € |
| Resend | < 3 000 e-mails par mois | 0 € |
| QStash | < 1 000 messages par jour (lisser les gros imports en lots) | 0 € |
| GitHub Actions | Dépôt public | 0 € |
| Cloudflare Worker média | < 100 000 requêtes par jour | 0 € |
| IA vision (départage des rafales) | Budget plafonné, facultatif | 0 à 1 € |
| **Total hors domaine** | | **≈ 2 €** (≈ 1,4 € avec les originaux en IA) |
| Domaine .fr (OVH, amorti) | 9,35 € TTC par an | ≈ 0,80 € |
| **Total avec domaine** | | **≈ 2,8 €** |

Sensibilité :
- 300 Go : ≈ 4 € hors domaine (≈ 2,7 € avec IA).
- Le plafond de 5 € est atteint vers 370 Go en Standard, ou vers 500 Go avec les originaux en IA.
- Risque principal de dépassement : un usage de calcul côté serveur sur Vercel (4 h de CPU) ou de `next/image`. Les deux sont exclus par conception.

## Sources

- Cloudflare R2, tarifs (mis à jour le 30/10/2026) : https://developers.cloudflare.com/r2/pricing/
- R2, URLs présignées : https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- R2, limites : https://developers.cloudflare.com/r2/platform/limits/
- Cloudflare Workers, limites : https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Queues, tarifs : https://developers.cloudflare.com/queues/platform/pricing/
- Vercel Hobby (14/09/2026) : https://vercel.com/docs/plans/hobby
- Vercel, limites des fonctions (24/08/2026) : https://vercel.com/docs/functions/limitations
- Vercel, Cron (15/07/2026) : https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel, usage équitable et commercial : https://vercel.com/docs/limits/fair-use-guidelines
- Neon, tarifs : https://neon.com/pricing
- Neon, mise en veille : https://neon.com/docs/introduction/scale-to-zero
- Supabase Free (sources tierces, non confirmées sur supabase.com) : https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/ et https://automationatlas.io/answers/supabase-free-tier-limits-2026/
- Prisma 7 vs Drizzle (comparatifs tiers) : https://makerkit.dev/blog/tutorials/drizzle-vs-prisma et https://techsy.io/blog/prisma-vs-drizzle-orm
- Auth.js rejoint Better Auth : https://better-auth.com/blog/authjs-joins-better-auth et https://github.com/nextauthjs/next-auth/discussions/13252
- Better Auth, plugin Email OTP : https://www.better-auth.com/docs/plugins/email-otp
- Better Auth, plugin Organization : https://www.better-auth.com/docs/plugins/organization
- Resend, tarifs : https://resend.com/pricing
- Upstash QStash, tarifs : https://upstash.com/pricing/qstash
- GitHub Actions, facturation : https://docs.github.com/en/billing/concepts/product-billing/github-actions
- AFNIC RDAP (vérification de disponibilité) : https://rdap.nic.fr/domain/clic-clac-voyage.fr
- Prix .fr : https://hackceleration.com/fr/labs/meilleur/nom-de-domaine et https://www.ovhcloud.com/fr/domains/tld/fr/

## Points non vérifiés (à confirmer en phase 1)

- Taille minimale d'une part multipart R2 et abandon automatique des multipart incomplets à 7 jours : sources tierces seulement.
- Limites exactes du plan Neon Free quand il est créé par la marketplace Vercel.
- Chiffres Supabase Free, pris dans des sources tierces. Sans effet sur la décision.
- Prix .fr OVH : relevé tiers du 24/10/2026, à voir sur la page de commande.

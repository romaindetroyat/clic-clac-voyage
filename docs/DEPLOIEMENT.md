# Déploiement

L'app tourne sur **Vercel** (offre Hobby), avec une base **Neon** et des e-mails **Resend**.
Aucun secret n'est dans le dépôt : tout se règle dans Vercel.

## 1. Projet Vercel

1. vercel.com → **Add New… → Project** → importer `romaindetroyat/clic-clac-voyage`.
2. Framework : Next.js (détecté). Laisser les commandes par défaut : `pnpm build` applique les migrations puis construit l'app.
3. Branche de production : `main`.

## 2. Base Neon

Dans le projet Vercel : **Storage → Create Database → Neon** (offre gratuite, région Francfort `fra1` ou Paris).
L'intégration ajoute `DATABASE_URL` toute seule. Les tables sont créées au premier déploiement.

## 3. Variables d'environnement (Settings → Environment Variables)

| Variable | Valeur | Obligatoire |
|---|---|---|
| `BETTER_AUTH_SECRET` | 32 caractères aléatoires : `openssl rand -base64 32` | oui |
| `ADMIN_EMAILS` | ton adresse (ex. `romain@…`), séparées par des virgules | oui |
| `GMAIL_USER` | ton adresse Gmail : les e-mails partent de là | oui (ou Resend) |
| `GMAIL_APP_PASSWORD` | mot de passe d'application Google (voir ci-dessous) | oui (ou Resend) |
| `RESEND_API_KEY`, `EMAIL_FROM` | alternative à Gmail, seulement avec un domaine vérifié | non |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | compte Cloudflare et clé d'API R2 (Object Read & Write, limitée au bucket) | oui |
| `R2_BUCKET` | `clic-clac-voyage` | oui |
| `R2_JURIDICTION` | `eu` si le bucket est sous juridiction Union européenne | selon le bucket |
| `APP_URL` | vide : l'URL de production Vercel est utilisée. À remplir le jour où un domaine est branché (`https://clic-clac-voyage.fr`) | non |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | identifiants OAuth Google, URI de redirection `<APP_URL>/api/auth/callback/google` | non |

### Mot de passe d'application Gmail

1. La validation en deux étapes doit être active sur le compte Google.
2. Aller sur https://myaccount.google.com/apppasswords, créer un mot de passe nommé « Clic-Clac Voyage ».
3. Copier les 16 caractères dans `GMAIL_USER`/`GMAIL_APP_PASSWORD` sur Vercel (jamais dans le dépôt).

Gmail accepte environ 500 envois par jour : largement assez pour les codes de connexion et les invitations.
Les e-mails partent de ton adresse, avec « Clic-Clac Voyage » comme nom d'expéditeur.

## 4. Bucket Cloudflare R2

- Juridiction **European Union** (garantit que les photos restent dans l'UE ; un simple « location hint » n'est qu'indicatif).
- CORS : origines de l'app, méthodes `GET, PUT, HEAD`, en-têtes `*`, en-tête exposé `ETag` (indispensable à l'envoi en morceaux).
- Règle de cycle de vie : « Abort incomplete multipart uploads after 7 days ».

## 5. Export PDF du livre

- Rien à configurer : l'assemblage tourne dans une fonction Vercel (`/api/voyages/[slug]/livre/impression`, 300 s au plus, 2 Go sur Hobby), avec le compilateur Typst natif et les polices du dossier `polices/`.
- Les photos à 300 dpi sont préparées dans le navigateur de l'administrateur puis déposées sous `voyages/<id>/livre/images/` ; les PDF sous `voyages/<id>/livre/export/` (le précédent est supprimé à chaque nouvel export).
- Les images préparées ne sont pas effacées automatiquement (elles servent de cache pour la reprise). Une règle de cycle de vie R2 sur le préfixe `voyages/` + `livre/images/` peut les supprimer au bout de 90 jours si l'espace devient un sujet.
- Limite connue : au-delà d'environ 250 pages de photos très lourdes, la mémoire de la fonction (2 Go) pourrait ne plus suffire ; il faudrait alors découper l'assemblage.

## 6. Développement local

```bash
pnpm install
cp .env.example .env.local   # puis remplir BETTER_AUTH_SECRET et ADMIN_EMAILS
pnpm dev                     # base pglite embarquée dans .data/, e-mails écrits dans .data/outbox.jsonl
pnpm test                    # tests unitaires (Postgres embarqué)
pnpm build && pnpm test:e2e  # parcours complet dans un navigateur
```

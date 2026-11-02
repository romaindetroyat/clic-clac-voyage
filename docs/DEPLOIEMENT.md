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
| `RESEND_API_KEY` | clé d'API Resend | oui |
| `EMAIL_FROM` | `Clic-Clac Voyage <bonjour@ton-domaine>` (domaine vérifié chez Resend) | oui pour inviter d'autres personnes |
| `APP_URL` | vide : l'URL de production Vercel est utilisée. À remplir le jour où un domaine est branché (`https://clic-clac-voyage.fr`) | non |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | identifiants OAuth Google, URI de redirection `<APP_URL>/api/auth/callback/google` | non |

Sans domaine vérifié chez Resend, l'expéditeur de test `onboarding@resend.dev` n'envoie qu'à l'adresse du compte Resend.

## 4. Développement local

```bash
pnpm install
cp .env.example .env.local   # puis remplir BETTER_AUTH_SECRET et ADMIN_EMAILS
pnpm dev                     # base pglite embarquée dans .data/, e-mails écrits dans .data/outbox.jsonl
pnpm test                    # tests unitaires (Postgres embarqué)
pnpm build && pnpm test:e2e  # parcours complet dans un navigateur
```

# État du projet

**Phase en cours** : 1, Fondations (code terminé, déploiement en attente)
**Dernière action** : phase 1 codée et testée en local (2 novembre 2026)
**Prochaine étape** : vérifier la connexion Gmail et l'installation sur téléphone, puis phase 2

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
| Phase 2 | Compte Cloudflare : bucket R2, jetons d'API, Worker ; clés d'application Dropbox et OneDrive ; projet Google Cloud (Picker Photos et Drive) |
| Phase 5 | Secrets GitHub Actions pour l'accès R2 et le rappel vers l'app |
| Phase 6 | Clés sandbox Lulu, Prodigi et Gelato (V2) |

Les secrets vont uniquement dans les variables d'environnement Vercel et les secrets GitHub, jamais dans le dépôt.

## Points ouverts

- CEWE accepte-t-il le PDF sur `cewe.fr` ? (phase 6)
- Limites exactes de Neon quand il est créé via la marketplace Vercel (phase 1)
- Taille minimale des parts multipart R2 et nettoyage automatique des envois incomplets (spike phase 2)

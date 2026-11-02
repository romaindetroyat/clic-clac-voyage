# État du projet

**Phase en cours** : 1, Fondations (pas encore planifiée)
**Dernière action** : initialisation du projet et recherche courte terminées (2 novembre 2026)
**Prochaine étape** : planifier puis exécuter la phase 1

## Décisions prises

Voir `PROJECT.md` (cadrage) et `research/SUMMARY.md` (stack). En bref : Vercel Hobby, Neon + Drizzle, Better Auth + Resend, R2 + Uppy, versions web dans le navigateur, `render-core` WebGL2, Typst pour le PDF, GitHub Actions pour les tâches longues, `APP_URL` sans domaine personnalisé au départ.

## À fournir par Romain (bloquant au moment indiqué)

| Quand | Quoi |
|---|---|
| Phase 1 | Projet Vercel relié au dépôt ; base Neon (via la marketplace Vercel) ; compte Resend et domaine d'envoi vérifié (ou expéditeur de test) ; identifiants OAuth Google (facultatif) |
| Phase 2 | Compte Cloudflare : bucket R2, jetons d'API, Worker ; clés d'application Dropbox et OneDrive ; projet Google Cloud (Picker Photos et Drive) |
| Phase 5 | Secrets GitHub Actions pour l'accès R2 et le rappel vers l'app |
| Phase 6 | Clés sandbox Lulu, Prodigi et Gelato (V2) |

Les secrets vont uniquement dans les variables d'environnement Vercel et les secrets GitHub, jamais dans le dépôt.

## Points ouverts

- CEWE accepte-t-il le PDF sur `cewe.fr` ? (phase 6)
- Limites exactes de Neon quand il est créé via la marketplace Vercel (phase 1)
- Taille minimale des parts multipart R2 et nettoyage automatique des envois incomplets (spike phase 2)

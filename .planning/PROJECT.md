# Clic-Clac Voyage

> Source de vérité du besoin : [`docs/PROMPT-LANCEMENT.md`](../docs/PROMPT-LANCEMENT.md). Ce fichier en est la synthèse de travail : il ne le remplace pas.

## Ce que c'est

Une application web installable (PWA), en français, qui permet à un petit groupe (2 à 15 personnes) de mettre en commun les photos et vidéos d'un voyage, d'en écrire le récit (légendes, commentaires, réactions), puis de produire :

1. **un site du voyage** partageable par lien secret, consultable hors ligne et exportable en archive HTML autonome ;
2. **un livre photo prêt à imprimer**, mis en page automatiquement, retouchable page par page, exporté au format exact de l'imprimeur choisi grâce à un comparateur coût, pages, délais et notes.

Chaque voyage est un espace séparé. L'app sert pour tous les voyages, passés et futurs.

## Valeur centrale

Passer de « 3 000 photos éparpillées sur 8 téléphones » à « un beau site et un livre commandé » en quelques soirées, sans compétence technique.

## Contexte de livraison

- Un **vrai voyage** attend d'être traité : chaque phase doit se terminer par quelque chose d'utilisable dessus.
- **Périmètre complet attendu**, livré par phases. Pas de version au rabais.
- Interface **100 % en français**.

## Utilisateurs

| Rôle (par voyage) | Peut |
|---|---|
| Administrateur | créer le voyage, inviter et retirer, structurer les épisodes, valider le site et le livre, choisir l'imprimeur, centraliser la commande |
| Contributeur | importer, légender ses photos, commenter et réagir, cocher, commander ses exemplaires |
| Lecteur (sans compte) | consulter le site par lien secret révocable, mot de passe en option |

Accès sur invitation par e-mail, une invitation = un voyage. Connexion sans mot de passe (lien magique ou code à 6 chiffres), Google en option.

## Contraintes fermes

- **Vercel** + **Next.js** (App Router, TypeScript strict).
- **Coût d'hébergement visé : 0 à 5 € par mois** hors domaine. Pas de Vercel Blob.
- Stockage des médias sur **Cloudflare R2**, envoi direct par URL signée en plusieurs morceaux.
- **Originaux conservés à vie** en pleine résolution.
- **Dépôt GitHub public** : aucun secret, aucune donnée personnelle dans le dépôt.
- **RGPD** : GPS précis jamais public, suppression complète d'un compte ou d'un voyage, aucun traçage publicitaire.
- **Pas de paiement en ligne** : seulement le suivi « qui doit combien à qui ».
- Rendu des retouches **identique** à l'écran, dans le site et dans le PDF d'impression.

## Décisions de cadrage (déjà prises, ne pas rouvrir)

| Sujet | Décision |
|---|---|
| Langue de l'interface | Français uniquement |
| Hébergement | Vercel, Next.js App Router, TS strict |
| Stockage médias | Cloudflare R2 |
| Paiement | Aucun dans l'app |
| Commande imprimeur | V1 : PDF conformes + lien direct + suivi manuel. V2 : commande par API |
| Livre | Un par voyage, avec historique des versions ; modèle indépendant de l'imprimeur ; pas de placement au pixel |
| Site | Thèmes + personnalisation + sections + présentation par épisode ; pas de placement au pixel |
| Vidéos | Site uniquement, jamais dans le livre |
| Mode GSD | Autonome, ~7 phases larges, recherche courte, pas de relecture de plan, vérification en fin de phase |
| Tests | Unitaires sur l'essentiel (règles imprimeurs, dos, mise en page, prix et parts, droits, horloge, dédoublonnage) + quelques E2E Playwright |
| Commits | Atomiques, **en français** |

## Décisions techniques ouvertes (tranchées par la recherche, voir `research/SUMMARY.md`)

Base de données (Neon ou Supabase), bibliothèque d'authentification, chaîne de traitement d'image (HEIC, RAW), conversion vidéo, moteur PDF et plan B pour les gros livres, liste finale des imprimeurs.

## Critères de réussite

Voir [`docs/PROMPT-LANCEMENT.md` §10](../docs/PROMPT-LANCEMENT.md#10-critères-de-réussite). Ils sont repris comme critères de vérification dans `ROADMAP.md`.

---
*Initialisé le 2 novembre 2026.*

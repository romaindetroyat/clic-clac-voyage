# Recette sur le vrai voyage

Ce qui reste à vérifier **avec le vrai voyage et de vrais téléphones** : les tests automatiques couvrent
la logique, pas les vrais appareils, les vraies photos ni les vrais imprimeurs. Cochez au fur et à mesure.

## 1. Connexion (critère 1)

- [ ] Un invité reçoit l'e-mail, se connecte depuis son téléphone **en moins d'une minute**, sans mot de passe.
- [ ] L'e-mail n'est pas arrivé dans les indésirables (Gmail, Outlook, iCloud).
- [ ] L'app s'installe sur l'écran d'accueil (Android : menu ⋮ → Installer ; iPhone : Partager → Sur l'écran d'accueil).

## 2. Import (critère 2)

- [ ] Depuis un téléphone, envoyer **un gros lot (1 000 photos si possible)**, couper le réseau en cours (mode avion), fermer l'app, la rouvrir : tout finit par arriver, sans doublon.
- [ ] iPhone : photos HEIC bien affichées ; pas de JPEG dégradés (voir la page d'aide iPhone de l'onglet Importer).
- [ ] Vidéos : affiche et lecture dans la galerie (la version allégée dépend du navigateur).
- [ ] Recaler l'horloge d'un appareil décalé (onglet Appareils) : l'ordre chronologique devient juste.
- [ ] Archive WhatsApp : les copies sont remplacées quand les originaux arrivent.

## 3. Tri et récit (critère 3)

- [ ] « Proposer un découpage » donne des épisodes sensés ; les ajuster prend une soirée au plus.
- [ ] Rafales : la meilleure photo est proposée ; changer d'avis en un clic.
- [ ] Retouches : ouvrir https://clic-clac-voyage.vercel.app/verification-rendu **sur chaque téléphone** : « identique » attendu.

## 4. Site (critère 4)

- [ ] Beau sur téléphone et sur ordinateur, avec le thème choisi.
- [ ] Lighthouse mobile (Chrome → Outils de développement → Lighthouse) ≥ 90 en performance et en accessibilité.
- [ ] Lien secret ouvert par un proche sans compte ; « Garder ce site pour le lire hors ligne », puis mode avion : le site s'affiche.
- [ ] Export .zip depuis un ordinateur ; décompressé, `index.html` s'ouvre par double-clic.

## 5. Livre (critère 5)

- [ ] Mise en page automatique d'environ 100 pages, puis retouches page par page.
- [ ] Aucune alerte bloquante ; peu d'alertes de résolution.
- [ ] Export PDF **depuis un ordinateur** (les originaux sont préparés dans le navigateur) ; le PDF s'ouvre et ressemble à l'aperçu.
- [ ] Soumettre les fichiers à l'outil de contrôle de l'imprimeur choisi : **acceptés du premier coup**.

## 6. Imprimeur et commande (critère 6)

- [ ] Vérifier sur le site de l'imprimeur choisi le **prix et le port** affichés « non vérifiés » dans le comparateur.
- [ ] Chacun saisit ses exemplaires ; chacun voit ce qu'il doit et à qui.
- [ ] Après la commande, noter « commande passée », puis les remboursements.

## 7. Coût (critère 7)

- [ ] Au bout d'un mois d'usage : onglet **Réglages** du voyage, section « Espace et coût » (visible par les adresses de `ADMIN_EMAILS`).
- [ ] Recouper avec les tableaux de bord : Cloudflare (R2 → Metrics : stockage, opérations), Vercel (Usage), Neon (Usage).
- [ ] Coût mensuel mesuré **≤ 5 €**.

## 8. Effacement (RGPD)

- [ ] Un compte de test supprimé depuis « Mon compte » : ses photos disparaissent du voyage et du stockage R2.
- [ ] Un voyage de test supprimé depuis « Réglages » : le dossier `voyages/<id>/` du bucket est vide.

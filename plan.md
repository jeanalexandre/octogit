# Plan : Octogit

> Produit par `/plan` à partir de `brief.md` et des specs. Fichier : `plan.md`. Validé par l'humain le 08/11/2026, révision du 11/11/2026 validée le 11/11/2026, révision du 12/11/2026 validée le 12/11/2026.
> Révisions : 11/11/2026 — `explorer-l-historique` CA-7 modifié (évolution de S-5) et nouvelle spec `organiser-l-espace` (révisions du 11/11/2026 de `ux.md` et `stack.md`) : stories S-57 à S-61 ajoutées en tranche « valeur 1 bis » ; `organiser-l-espace` CA-17 ajouté à S-26 ; CA-10 scindé entre S-59 et S-25 (fermeture au checkout) ; jobs J-1 et J-16 servis aussi par `organiser-l-espace`.
> Révisions : 12/11/2026 — amendement de `stack.md` (méthode 0.25.0, isolement d'un worktree par `.env.local`) : story d'outillage S-62 ajoutée, à faire avant S-59.

## Jobs du brief
| Job | Résumé | Specs |
|---|---|---|
| J-1 | Voir l'historique en graphe à lanes, branches distantes comprises | `explorer-l-historique`, `organiser-l-espace` |
| J-2 | Stager, committer, amender, stasher depuis l'interface | `preparer-un-commit` |
| J-3 | Fetch, pull (ff ou rebase), push et tags en un clic, sans fusion surprise | `synchroniser` |
| J-4 | Consulter le détail d'un commit et le diff d'un fichier | `explorer-l-historique` |
| J-5 | Rechercher dans l'historique par message, auteur ou SHA | `explorer-l-historique` |
| J-6 | Merge ou rebase par sélection puis clic droit, sans erreur de sens | `integrer-une-branche` |
| J-7 | Rebase interactif sans fichier todo | `nettoyer-une-branche` |
| J-8 | Cherry-pick ou revert | `revenir-en-arriere` |
| J-9 | Résoudre les conflits et terminer l'opération dans l'interface | `resoudre-les-conflits` |
| J-10 | Cloner par URL dans le bon profil | `demarrer-un-depot` |
| J-11 | Définir des profils (identité, clé SSH, signature) | `configurer-les-profils` |
| J-12 | Rattacher chaque dépôt au bon profil et l'écrire dans `.git/config` local | `proteger-l-identite` |
| J-13 | Être empêché de committer ou pousser avec la mauvaise identité | `proteger-l-identite` |
| J-14 | Réinitialiser une branche (soft, mixed, hard) en voyant ce qui sera perdu | `revenir-en-arriere` |
| J-15 | Choisir thème, palette et halo | `choisir-l-apparence` |
| J-16 | Changer, créer, renommer, supprimer des branches | `gerer-les-branches`, `organiser-l-espace` |
| J-17 | Installer Git en un clic sur un Mac neuf | `demarrer-un-depot` |

## Backlog
La table « Réorganisation proposée » de `ux.md` n'est pas découpée : aucun code n'existait au premier plan, et ses écarts retenus sont intégrés dans les specs ; les deux écarts du 11/11/2026 (`BranchSidebar`, `CommitGraph`) sont couverts par `organiser-l-espace` (S-57 à S-61, S-26).

| Story | Objectif | Critères | Jobs | Tranche | Dépend de |
|---|---|---|---|---|---|
| S-1 | Poser le socle : workspace Cargo (`git`, `identity`, `store`, `platform`, `app`), application Tauri 2 et Svelte 5, `tokens.css` écrit depuis `ux/tokens.md` (thème par défaut seulement), contrat `tauri-specta` (`pnpm gen:bindings`), pont de test Playwright, fixtures de dépôts, commandes de qualité et `.github/dependabot.yml` ; au lancement, le dernier dépôt s'ouvre dans `History` (liste de commits simple), sinon `Welcome` | `explorer-l-historique` CA-1 | J-1 | socle | — |
| S-2 | Ouvrir un dépôt depuis `Welcome` (Open folder…, Recent) et en changer par `RepoPicker` | `demarrer-un-depot` CA-3, CA-4 ; `explorer-l-historique` CA-2 | J-1 | socle | S-1 |
| S-3 | Livrer : `.dmg` produit par `pnpm tauri build`, signature ad hoc, release GitHub manuelle sur `jeanalexandre/octogit` | `stack.md` Livraison | J-1 | socle | S-2 |
| S-4 | Afficher le graphe en lanes colorées, virtualisé (10 000 commits), avec initiales, colonnes masquables mémorisées, dates relatives et barre d'aide | `explorer-l-historique` CA-9, CA-12, CA-13, CA-14, CA-15, CA-16, CA-23 | J-1 | valeur 1 | S-1 |
| S-5 | Afficher les refs (branches, `origin/…`, tags, stashes) reliées aux nœuds, l'avance / retard de la branche courante, et `CommitDetail` au clic sur un commit | `explorer-l-historique` CA-7, CA-8, CA-10, CA-24, CA-25 | J-1, J-4 | valeur 1 | S-4 |
| S-6 | Fetch automatique à l'ouverture puis chaque minute, `FetchStatus`, sans pull implicite | `explorer-l-historique` CA-3, CA-4, CA-6 | J-1 | valeur 1 | S-5 |
| S-57 | `BranchSidebar` : sections dans l'ordre fixe et triées, noms groupés par chemin en dossiers dépliables, état des dossiers mémorisé par dépôt | `organiser-l-espace` CA-1, CA-2, CA-3 | J-1, J-16 | valeur 1 bis | S-5 |
| S-58 | Sections de `BranchSidebar` à hauteur ajustée (8 lignes au plus, défilement interne), redimensionnables et repliables, mémorisées globalement ; refs toujours dans le graphe | `organiser-l-espace` CA-4, CA-5, CA-6, CA-7, CA-8 | J-1, J-16 | valeur 1 bis | S-57 |
| S-62 | Outillage : créneau d'un worktree lu dans `.env.local` (Node natif, `--env-file-if-exists` ou `process.loadEnvFile`) par les scripts pnpm qui lancent l'interface ou les tests (`dev:web`, `e2e`) ; `webServer` de `playwright.config.ts` sans préfixe de commande ; `pnpm tauri dev` reste sur 1420, non isolé (`devUrl` inchangé, décision de l'humain du 12/11/2026) ; valeurs par défaut sans `.env.local` (1420, `.dev-data/`) ; `.env.local` ignoré par Git ; README (lancement en worktree, `.env.local`) et `.env.example` à jour. Aucun changement de comportement de l'application | `stack.md` Environnement local (révision du 12/11/2026) | J-1 | valeur 1 bis | S-58 |
| S-59 | Replier `BranchSidebar` en bande d'icônes, volet flottant d'une section par-dessus le graphe, fermé par Échap ou un clic ailleurs. Scinde `organiser-l-espace` CA-10 : la fermeture au checkout est en S-25 | `organiser-l-espace` CA-9, CA-10 (sauf checkout) | J-1, J-16 | valeur 1 bis | S-58 |
| S-60 | Largeur du graphe : toutes les lanes au plus 40 %, fondu des lanes coupées, séparateur à glisser mémorisé par dépôt, figée jusqu'à la réouverture | `organiser-l-espace` CA-11, CA-12, CA-13 | J-1 | valeur 1 bis | S-4 |
| S-61 | Évolution de S-5 : colonne des refs à 180 px, une `RefLabel` par commit tronquée en fin avec « +n », étiquettes entières flottantes au survol ou au focus ; infobulle nom et adresse de l'auteur | `explorer-l-historique` CA-7 (évolution) ; `organiser-l-espace` CA-14, CA-15, CA-16, CA-18 | J-1 | valeur 1 bis | S-5 |
| S-7 | Créer, enregistrer et réordonner des profils dans `ProfileSettings`, sans jamais toucher `~/.gitconfig` | `configurer-les-profils` CA-2, CA-3, CA-13, CA-14, CA-17, CA-19 | J-11 | valeur 2 | S-1 |
| S-8 | Associer une clé SSH à un profil : choisir dans `~/.ssh`, générer une ed25519, copier la clé publique, passphrase gardée dans le trousseau | `configurer-les-profils` CA-5, CA-6, CA-7, CA-15, CA-16 | J-11 | valeur 2 | S-7 |
| S-9 | Tester la connexion d'un profil à github.com avec sa seule clé (hypothèse risquée n°1) | `configurer-les-profils` CA-8, CA-9, CA-10 | J-11, J-12 | valeur 2 | S-8 |
| S-10 | Rattacher un dépôt par règles (Path, Remote owner) et écrire identité, `core.sshCommand` et signature dans son `.git/config` local | `configurer-les-profils` CA-11 ; `proteger-l-identite` CA-1, CA-2, CA-3, CA-4, CA-28 | J-11, J-12 | valeur 2 | S-9, S-2 |
| S-11 | Détecter un réglage local différent et proposer Overwrite ou Import dans `IdentityMismatch`, rien d'écrit avant le choix | `proteger-l-identite` CA-5, CA-6, CA-8 | J-12 | valeur 2 | S-10 |
| S-12 | Afficher `ProfileBadge` (conforme, non conforme) dans `History` et dans Recent, et la couleur du profil dans la liste | `configurer-les-profils` CA-4 ; `proteger-l-identite` CA-14 ; `demarrer-un-depot` CA-2 | J-11, J-12 | valeur 2 | S-11 |
| S-13 | Propager la modification d'un profil aux dépôts rattachés, sauf ceux réglés à la main, et supprimer un profil sans toucher leur `.git/config` | `configurer-les-profils` CA-12, CA-18, CA-20 | J-11, J-12 | valeur 2 | S-12 |
| S-14 | Ligne WIP et `WorkingChanges` : fichiers non indexés / indexés, mise à jour en moins de 1 s (`notify`), Stage all / Unstage all ; la ligne WIP remplace le texte « No commits yet. » de l'état vide de `History` (depuis S-1, revue 1) | `preparer-un-commit` CA-1, CA-2, CA-3, CA-4, CA-5, CA-11 | J-2 | valeur 3 | S-5 |
| S-15 | Committer (bouton et Cmd+Entrée) avec l'identité du `.git/config` local, et amender le dernier commit | `preparer-un-commit` CA-12, CA-13, CA-14, CA-15, CA-16, CA-22, CA-23 | J-2, J-13 | valeur 3 | S-14, S-10 |
| S-16 | Bloquer la création de commit quand l'identité locale diffère du profil, y compris modifiée au terminal, et réparer par « Fix repository identity » | `proteger-l-identite` CA-15, CA-17, CA-18 | J-13 | valeur 3 | S-15, S-12 |
| S-17 | Menu de `ProfileBadge` : choisir un profil à la main, Reset to rules, Edit profiles…, Fix repository identity ; accès à `ProfileSettings` par Cmd+, et depuis `Welcome` | `proteger-l-identite` CA-9, CA-10, CA-11 ; `configurer-les-profils` CA-1 | J-11, J-12, J-13 | valeur 3 | S-16 |
| S-18 | `SyncButton` : Fetch All (avec prune) par défaut, choix de l'action par défaut mémorisé, clé du `.git/config` local utilisée | `synchroniser` CA-1, CA-2, CA-3, CA-22 | J-3 | valeur 4 | S-6, S-10 |
| S-19 | Pull en avance rapide seulement ou en rebase, refus en cas de divergence, désactivé sur une branche non publiée | `synchroniser` CA-4, CA-5, CA-6, CA-7, CA-10 | J-3 | valeur 4 | S-18 |
| S-20 | `PushButton` : Push n, Nothing to push, publication d'une branche « Not published » sur `origin`, refus si le distant a avancé | `synchroniser` CA-11, CA-12, CA-13, CA-15 ; `explorer-l-historique` CA-11 | J-3 | valeur 4 | S-18 |
| S-21 | Bloquer le Push (et la création de commit) d'un dépôt non conforme ou « No profile », sans aucun contournement. Scinde `proteger-l-identite` CA-19 : ici le Push ; la partie « Delete from origin » est en S-45 | `proteger-l-identite` CA-7, CA-13, CA-19 (Push), CA-27 | J-13 | valeur 4 | S-20, S-16 |
| S-22 | Vérifier auteur et committer des commits à pousser et marquer les fautifs dans le graphe, commits faits au terminal compris | `proteger-l-identite` CA-20, CA-22, CA-23, CA-26 | J-13 | valeur 4 | S-21 |
| S-23 | « Fix commit identity » : réécrire en un geste les commits fautifs en gardant les auteurs collègues | `proteger-l-identite` CA-21, CA-24, CA-25 | J-13 | valeur 4 | S-22 |
| S-24 | Force push après réécriture locale, par `ForcePushDialog` (`--force-with-lease`) | `synchroniser` CA-16, CA-17, CA-18 | J-3 | valeur 4 | S-20, S-15 |
| S-25 | Changer de branche (double-clic, sélecteur de la `Toolbar`, clic droit), y compris une `origin/…` jamais récupérée, sans jamais détacher HEAD ; un checkout depuis le volet flottant de `BranchSidebar` le ferme (partie de `organiser-l-espace` CA-10 scindée de S-59) | `gerer-les-branches` CA-1, CA-2, CA-3, CA-4, CA-5, CA-21, CA-23 ; `organiser-l-espace` CA-10 (fermeture au checkout) | J-16 | valeur 5 | S-5, S-59 |
| S-26 | Créer une branche (Branch, Create branch here) par saisie en ligne, qui s'élargit au-dessus du graphe (reprise ensuite par Rename et Create tag), et Checkout depuis `CommitDetail` | `gerer-les-branches` CA-7, CA-8, CA-9, CA-10, CA-11 ; `organiser-l-espace` CA-17 | J-16 | valeur 5 | S-25, S-61 |
| S-27 | Cloner par `CloneDialog` avec un profil choisi, dossier pré-rempli, `.git/config` écrit avant l'ouverture dans `History` | `demarrer-un-depot` CA-1, CA-8, CA-9, CA-10, CA-15, CA-16 ; `proteger-l-identite` CA-12 | J-10, J-12 | valeur 6 | S-10, S-2 |
| S-28 | Clone sans profil (création à la volée), URL HTTPS convertie en SSH, seule la clé du profil présentée, progression et Cancel | `demarrer-un-depot` CA-5, CA-11, CA-12, CA-17, CA-18 | J-10, J-11 | valeur 6 | S-27 |
| S-29 | `DiffView` d'un fichier d'un commit : côte à côte ou unifié, fichier suivant / précédent, retour au même endroit du graphe | `explorer-l-historique` CA-26, CA-27, CA-28, CA-29 | J-4 | valeur 7 | S-5 |
| S-30 | Rechercher par message, auteur ou SHA dans `SearchBox` (Cmd+F), naviguer entre les résultats, « Show matches only » | `explorer-l-historique` CA-17, CA-18, CA-19, CA-20, CA-21, CA-22 | J-5 | valeur 7 | S-4 |
| S-31 | Indexer ou désindexer un fichier, un bloc ou des lignes dans `DiffView`, et abandonner les modifications d'un fichier | `preparer-un-commit` CA-6, CA-7, CA-8, CA-9, CA-24, CA-25, CA-26 | J-2 | valeur 8 | S-29, S-14 |
| S-32 | Stash, Pop, Apply et Drop d'un stash choisi | `preparer-un-commit` CA-17, CA-18, CA-19, CA-20, CA-21 | J-2 | valeur 8 | S-14 |
| S-33 | Reset Soft et Mixed sur n'importe quel commit, dont `origin/…` | `revenir-en-arriere` CA-10, CA-11, CA-12, CA-15, CA-18 | J-14 | valeur 9 | S-6 |
| S-34 | Reset Hard confirmé par `ResetHardDialog` qui liste ce qui sera perdu | `revenir-en-arriere` CA-13, CA-14, CA-16 | J-14 | valeur 9 | S-33, S-24 |
| S-35 | Cherry-pick et revert depuis le clic droit ou `CommitDetail`, avec l'identité du profil | `revenir-en-arriere` CA-1, CA-2, CA-3, CA-4, CA-17 | J-8 | valeur 9 | S-34, S-15 |
| S-36 | Menu merge / rebase d'une branche source, libellés nommant les deux branches, checkout de la branche qui reçoit | `integrer-une-branche` CA-1, CA-2, CA-3, CA-4, CA-5 | J-6 | valeur 10 | S-25 |
| S-37 | Exécuter merge (toujours avec commit de merge) et rebase sans conflit, « Already up to date. », rien de poussé | `integrer-une-branche` CA-6, CA-7, CA-8, CA-9, CA-10, CA-11, CA-16 | J-6 | valeur 10 | S-36, S-24 |
| S-38 | `ConflictResolver` : fichiers par statut, Ours / Theirs / Result, Take this block, Mark as resolved | `resoudre-les-conflits` CA-1, CA-2, CA-3, CA-4, CA-5 ; `integrer-une-branche` CA-13 | J-9, J-6 | valeur 11 | S-37 |
| S-39 | Terminer ou abandonner un merge en conflit : Continue, Abort confirmé, `OperationBanner` sur tous les écrans, retour au graphe | `resoudre-les-conflits` CA-7, CA-8, CA-11, CA-13, CA-14, CA-19, CA-21 | J-9 | valeur 11 | S-38 |
| S-40 | Conflits de rebase, Pull (rebase), cherry-pick et revert, et opérations lancées au terminal | `resoudre-les-conflits` CA-9, CA-10, CA-15 ; `revenir-en-arriere` CA-5 ; `synchroniser` CA-8 | J-9, J-3, J-8 | valeur 11 | S-39, S-35, S-19 |
| S-41 | Conflits de Pop / Apply (Done), fichiers non fusionnables (Keep ours / theirs / Delete), ouverture dans l'éditeur par défaut | `resoudre-les-conflits` CA-6, CA-17, CA-20 | J-9, J-2 | valeur 11 | S-39, S-32 |
| S-42 | Ouvrir `InteractiveRebase` depuis un commit et composer : actions par ligne, messages, déplacement au clavier, aperçu, Reset et Cancel | `nettoyer-une-branche` CA-1, CA-4, CA-5, CA-6, CA-8, CA-10 | J-7 | valeur 12 | S-5 |
| S-43 | Lancer le rebase interactif : validation de la composition, alerte « déjà poussé », progression, résultat conforme à l'aperçu, conflit vers `ConflictResolver` | `nettoyer-une-branche` CA-7, CA-9, CA-12, CA-13, CA-14, CA-15 | J-7, J-9 | valeur 12 | S-42, S-40, S-24 |
| S-44 | Renommer une branche locale et supprimer une branche locale (confirmation si non fusionnée) | `gerer-les-branches` CA-12, CA-13, CA-14, CA-15, CA-16 | J-16 | valeur 13 | S-26 |
| S-45 | Supprimer une branche sur `origin`, confirmé, refusé par une identité non conforme. Scinde `proteger-l-identite` CA-19 : ici « Delete from origin » ; le Push est en S-21 | `gerer-les-branches` CA-17, CA-18, CA-19 ; `proteger-l-identite` CA-19 (Delete from origin) | J-16, J-13 | valeur 13 | S-44, S-21 |
| S-46 | Créer un tag (simple ou annoté), le pousser, le supprimer en local et sur `origin` | `synchroniser` CA-23, CA-24, CA-25 | J-3 | valeur 13 | S-20 |
| S-47 | `ThemeSwitch` : Dark / Light / System, suivi de macOS, valeurs par défaut, réglage global mémorisé sur tous les écrans | `choisir-l-apparence` CA-1, CA-2, CA-3, CA-5, CA-10, CA-11, CA-12 | J-15 | valeur 14 | S-4 |
| S-48 | Palettes Neon / Kraken et Halo dans le menu de `ThemeSwitch`, sans perdre sélection ni défilement ; icônes Lucide devant chaque libellé de bouton | `choisir-l-apparence` CA-4, CA-6, CA-7, CA-8, CA-9, CA-15, CA-16 | J-15 | valeur 14 | S-47 |
| S-49 | Git absent au lancement : état « Git not found », installation d'Apple en un clic, attente, reprise seule en 5 s au plus | `demarrer-un-depot` CA-20, CA-21, CA-22, CA-23, CA-25 | J-17 | valeur 15 | S-28 |
| S-50 | Désactiver les gestes concernés pendant une opération en cours, et refuser merge, cherry-pick, revert, rebase et Continue à une identité non conforme | `resoudre-les-conflits` CA-16 ; `gerer-les-branches` CA-20 ; `integrer-une-branche` CA-14 ; `revenir-en-arriere` CA-21 ; `synchroniser` CA-21 ; `proteger-l-identite` CA-16 | J-9, J-13, J-16 | durcissement | S-43, S-45 |
| S-51 | Refuser checkout, merge, rebase, rebase interactif, cherry-pick, revert et pull face à des modifications non commitées | `gerer-les-branches` CA-6 ; `integrer-une-branche` CA-12 ; `revenir-en-arriere` CA-7 ; `synchroniser` CA-9 ; `nettoyer-une-branche` CA-11 | J-3, J-6, J-7, J-8, J-16 | durcissement | S-50 |
| S-52 | Désactiver ou refuser les actions inapplicables : HEAD détachée, commit racine, plage avec merge, commit de merge, cherry-pick vide | `nettoyer-une-branche` CA-2, CA-3 ; `revenir-en-arriere` CA-6, CA-9, CA-20 | J-7, J-8, J-14 | durcissement | S-50 |
| S-53 | Erreurs de Git : message d'une ligne et « Details » avec la sortie brute, Continue refusé, rien ne reste en cours | `gerer-les-branches` CA-22 ; `integrer-une-branche` CA-15 ; `revenir-en-arriere` CA-8 ; `synchroniser` CA-20 ; `resoudre-les-conflits` CA-12 | J-3, J-6, J-8, J-9, J-16 | durcissement | S-50 |
| S-54 | Dépôt introuvable (Locate…, Remove from recent, rattachement manuel conservé) et clone refusé ou vers un dossier non vide | `demarrer-un-depot` CA-6, CA-7, CA-13, CA-14, CA-19 | J-1, J-10 | durcissement | S-28 |
| S-55 | Robustesse : réseau coupé, branche publiée sans `origin`, boutons de synchronisation occupés, gros diffs et binaires, installation d'Apple refusée | `explorer-l-historique` CA-5 ; `synchroniser` CA-14, CA-19 ; `preparer-un-commit` CA-10 ; `demarrer-un-depot` CA-24 | J-1, J-2, J-3, J-17 | durcissement | S-49 |
| S-56 | Clavier et contraste : menus, saisies, dialogues et écrans complexes au clavier avec focus visible, contraste AA des quatre combinaisons ; date absolue d'un commit affichée aussi au focus de sa ligne (depuis S-4, revue 1) | `gerer-les-branches` CA-24 ; `integrer-une-branche` CA-17 ; `nettoyer-une-branche` CA-16 ; `revenir-en-arriere` CA-19 ; `resoudre-les-conflits` CA-18 ; `choisir-l-apparence` CA-13, CA-14 | J-6, J-7, J-8, J-9, J-15, J-16 | durcissement | S-48, S-50 |

### Pourquoi cet ordre
- **socle** : ouvrir un vrai dépôt dans une application installée depuis un `.dmg`, avec les outils de test qui serviront à toutes les stories. Question pour l'humain : `tokens.css` est posé dès S-1 avec le thème par défaut, plutôt qu'une story d'habillage séparée ; le choix de thème, de palette et de Halo reste la tranche valeur 14.
- **valeur 1** : lire mes dépôts réels en graphe, branches distantes à jour sans geste, et vérifier tout de suite la fluidité sur 10 000 commits (hypothèse risquée n°5).
- **valeur 1 bis** : tant que `History` vient d'être construit, le rendre lisible sur un dépôt chargé (panneau rangé, graphe à la bonne largeur, noms longs qui ne poussent rien) avant d'y empiler les tranches suivantes ; S-61 reprend la colonne des refs de S-5. S-62 (outillage) passe avant S-59 pour que les stories suivantes se lancent en worktree avec `.env.local`.
- **valeur 2** : définir mes profils pro et perso et voir chaque dépôt écrire la bonne identité et la bonne clé dans son `.git/config`, vérifiable au terminal (hypothèses risquées n°1 et n°4).
- **valeur 3** : committer depuis Octogit avec la certitude d'être bloqué sur la mauvaise identité.
- **valeur 4** : échanger avec github.com (fetch, pull, push, force push) sans jamais pousser un commit fait avec le mauvais compte, même depuis le terminal.
- **valeur 5** : passer d'une tâche à l'autre (checkout, nouvelle branche) sans terminal.
- **valeur 6** : cloner un projet directement dans le bon profil. Fin du premier jalon : l'utiliser deux semaines au quotidien en notant chaque retour forcé à GitKraken, avant les tranches suivantes (hypothèse risquée n°2).
- **valeur 7** : relire le diff d'un commit et retrouver un changement passé.
- **valeur 8** : préparer des commits propres bloc par bloc et mettre du travail de côté.
- **valeur 9** : ramener une branche sur `origin` ou un état antérieur, reporter ou annuler un commit.
- **valeur 10** : intégrer une branche par merge ou rebase sans erreur de sens.
- **valeur 11** : finir un merge, un rebase, un cherry-pick ou un pop en conflit sans quitter Octogit, ni laisser le dépôt cassé (hypothèse risquée n°3).
- **valeur 12** : réécrire une branche par rebase interactif, avec les conflits déjà gérés.
- **valeur 13** : faire le ménage dans les branches, sur `origin` compris, et poser des tags.
- **valeur 14** : travailler toute la journée dans l'apparence de mon choix.
- **valeur 15** : démarrer sur un Mac neuf sans terminal.
- **durcissement** : rendre chaque refus, erreur et cas limite sûr et lisible, et tout utilisable au clavier, pour désinstaller GitKraken.

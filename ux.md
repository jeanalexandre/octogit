# UX : Octogit

> Produit par `/ux` à partir de `brief.md`. Deux pages maximum. Validé par l'humain le 23/10/2026, révisions du 05/11 et du 06/11/2026 validées le 06/11/2026, révisions du 07/11/2026 validées le 07/11/2026, révisions du 08/11/2026 validées le 08/11/2026.
> Révisions : 23/10/2026 — J-2 : comportement de Stash et Pop précisé, composant `StashButtons` ajouté (oubli relevé à la relecture).
>   23/10/2026 — suite à la révision du brief : J-3 et J-6 à J-8 sans Undo (non-objectif), J-14 ajouté (reset Soft / Mixed / Hard sur n'importe quel commit, Hard confirmé), `ResetHardDialog` ajouté.
>   05/11/2026 — direction visuelle « Neon » ajoutée (palettes Neon et Kraken, option Halo, icônes d'action) ; contraste AA précisé ; `History` réorganisé d'après la référence du 05/11 : colonne des refs reliée aux nœuds, colonnes auteur / date / SHA masquables, `ThemeSwitch` et barre d'aide ajoutés. Maquettes refaites dans cette disposition (`conflict-resolver`, `interactive-rebase`, `profile-settings`) et ajoutées (`diff-view`, `welcome`). Détail des écrans et composants sorti dans `ux/ecrans/`, tokens dans `ux/tokens.md` ; 1 837 mots gardés au-delà de 1 200 : 14 parcours, laissés dans `ux.md` pour `/spec`.
>   06/11/2026 — suite à la révision du brief : J-13 bloque sans contournement et vérifie les auteurs des commits à pousser (correction guidée), J-15 ajouté (apparence globale) ; état « Push bloqué (auteur) » ajouté à la maquette `history`. 1 999 mots gardés : 15 parcours laissés dans `ux.md` pour `/spec`.
>   06/11/2026 — suite à J-16 (brief) et aux specs validées le 06/11 : J-16 ajouté (checkout, création en ligne, Rename, Delete local, Delete from origin ; jamais de HEAD détachée) ; J-3, J-6, J-7, J-9 à J-13 alignés sur les specs (« Fix commit identity », menu de `ProfileBadge`, dossier de clone, menu de `SyncButton`…) ; détail dans `ux/ecrans/`, couleurs de profil dans `ux/tokens.md`, 6 maquettes corrigées. 2 532 mots gardés : 16 parcours laissés dans `ux.md` (choix de l'humain).
>   07/11/2026 — report des « À reporter vers ux.md » des specs (explorer-l-historique, preparer-un-commit, proteger-l-identite, gerer-les-branches, revenir-en-arriere ; rien de choisir-l-apparence) : J-9, J-13, J-16 alignés sur `specs/gerer-les-branches.md` (Reset and checkout, menu de Checkout de `CommitDetail`, Delete local fusionnée ailleurs, Not published après Delete from origin, Delete from origin bloqué par J-13, gestes de branche désactivés pendant une opération) ; textes fixés dans `ux/ecrans/` (confirmation de Delete from origin, raison de Delete local désactivé, saisie en ligne, cherry-pick vide, refus pour modifications non commitées, `ProfileBadge` non conforme, `ResetHardDialog` sans perte) ; maquettes `history` (sections 4 et 5) et `conflict-resolver` (Continue bloqué) complétées. 2 766 mots gardés : 16 parcours laissés dans `ux.md` (choix de l'humain).
>   07/11/2026 — report des « À reporter vers ux.md » restants (configurer-les-profils, demarrer-un-depot, resoudre-les-conflits, nettoyer-une-branche : déjà intégrés le 06/11 ; integrer-une-branche, synchroniser : maquettes manquantes) : section 6 de `ux/maquettes/history.html` (menu merge / rebase d'une branche source, Create tag, menu et confirmation d'un tag, `ForcePushDialog` ouvert et refusé) ; textes de Create tag, Delete tag et `ForcePushDialog` fixés dans `ux/ecrans/`. Aucun parcours modifié.
>   07/11/2026 — report de `specs/resoudre-les-conflits.md` (CA-16, décision de l'humain) : pendant une opération en cours, rebase interactif, cherry-pick et revert désactivés sans raison affichée, sortis de « Désactivées, avec raison » dans `ux/ecrans/history.md`. Aucun parcours ni maquette modifié.
>   08/11/2026 — suite à la révision du brief (J-17) : parcours J-17 ajouté (Git absent au lancement → `Welcome` à l'état « Git not found », installation d'Apple en un clic, attente, reprise seule) ; états ajoutés dans `ux/ecrans/welcome.md` (Profiles masqué tant que Git manque), sans maquette (choix de l'humain).
>   08/11/2026 — report de `specs/demarrer-un-depot.md` (CA-23, CA-24, décisions de l'humain) : `ux/ecrans/welcome.md` précise la reprise au plus tard 5 s après que Git est disponible, et la revérification avec « Check again » active aussi dans l'état « installation impossible ». Aucun parcours ni maquette modifié.

## Contexte d'usage
- **Développeur multi-comptes, à la maison** : macOS, seul, second écran dédié ; Octogit ouvert en permanence, en plein écran, à côté de l'éditeur.
- **Développeur multi-comptes, au bureau** : macOS, seul, portable ; Octogit ouvert ponctuellement en plein écran (~1 500 px), en alternance avec l'éditeur par Cmd+Tab. Les trois colonnes de `History` tiennent à cette largeur.

## Principes d'interaction
1. Rien ne modifie le dépôt sans geste explicite : seul le fetch est automatique ; pas de pull implicite, pas d'écriture de `.git/config` sans choix.
2. Toute opération qui réécrit l'historique ou écrase nomme ce qu'elle touche (branches, commits perdus, commits distants écrasés) dans son libellé ou sa confirmation.
3. L'identité active est toujours visible (`ProfileBadge`) ; une identité non conforme bloque toute création de commit et le Push, sans échappatoire.
4. Une opération en cours reste visible sur tous les écrans (`OperationBanner`) jusqu'à sa fin ou son abandon, y compris lancée depuis le terminal.
5. Toute action fréquente a un raccourci clavier (Cmd+F, Cmd+Entrée, Échap, Alt+↑ / Alt+↓).

## Parcours
**J-1 · Voir l'historique.** Lancement → dernier dépôt dans `History` (sinon `Welcome`) ; `RepoPicker` pour changer. Fetch auto à l'ouverture puis périodique (`FetchStatus`). Graphe : lanes, branches locales et `origin/…` (même jamais récupérées), tags, stashes.
*Moment de vérité* : sans rien faire, le graphe montre les branches distantes à jour et l'avance / le retard de la branche courante.

**J-2 · Préparer un commit (modifié le 23/10/2026).** Ligne WIP (sélectionnée par défaut) → `WorkingChanges`. Clic sur un fichier → `DiffView` : indexer fichier, bloc ou lignes. Résumé, description, Amend, Commit (Cmd+Entrée). Stash (message optionnel) et Pop : Pop applique et retire le stash sélectionné, sinon le dernier ; conflit → J-9. Clic droit sur un stash : Apply, Pop, Drop (confirmé).
*Moment de vérité* : « Identity matches profile Work » sous le bouton, le commit part avec le bon compte.

**J-3 · Synchroniser (modifié le 06/11/2026).** `SyncButton` : clic = action par défaut ; flèche = choix du défaut, sans lancer, pour tous les dépôts : Fetch All (défaut, avec prune), Pull (ff only), Pull (rebase). Pull ff refusé si divergé (« Branch has diverged: 2 local, 3 on origin. »). `PushButton` devient Force push après réécriture → `ForcePushDialog` (commits distants écrasés, `--force-with-lease`). Tags : clic droit sur un commit (Create tag) ou sur le tag (Push tag, Delete tag).
*Moment de vérité* : après un fetch, la divergence se lit dans le graphe et rien n'a bougé sans décision.

**J-4 · Consulter un commit.** Clic sur un commit → `CommitDetail` à droite ; clic sur un fichier → `DiffView` (côte à côte ou unifié) ; Échap ramène au même endroit du graphe.
*Moment de vérité* : du graphe au diff d'un fichier en deux clics, et retour.

**J-5 · Rechercher.** `SearchBox` (Cmd+F) : message, auteur ou SHA ; résultats surlignés, Entrée / Maj+Entrée (« 3 / 12 ») ; « Show matches only ».
*Moment de vérité* : un SHA collé amène directement au commit.

**J-6 · Merge ou rebase (modifié le 06/11/2026).** Clic sur la branche qui reçoit (sinon la courante), clic droit sur la source (branche, `origin/…` ou commit) → `RefContextMenu`, libellés nommant les deux branches (« Merge develop into feature/profiles »), rien dans l'autre sens ; commit sans branche : rebase seulement. Merge toujours avec commit de merge. Checkout de la branche qui reçoit si besoin ; exécution immédiate, sans Undo ; conflit → J-9.
*Moment de vérité* : le libellé dit exactement ce qui va bouger.

**J-7 · Rebase interactif (modifié le 06/11/2026).** Clic droit sur un commit › « Interactive rebase from here » (commit inclus, base = son parent) → `InteractiveRebase` : action par ligne, message éditable, Alt+↑ ↓ déplace, ↑ ↓ sélectionne, aperçu avant / après, alerte « déjà poussé » ; Start rebase ; conflit → J-9.
*Moment de vérité* : le graphe obtenu est celui de l'aperçu.

**J-8 · Cherry-pick ou revert (modifié le 23/10/2026).** Clic droit sur un commit (même `origin/…`) ou depuis `CommitDetail` ; exécution immédiate, conflit → J-9.
*Moment de vérité* : le commit apparaît sur la branche courante sans quitter le graphe.

**J-9 · Résoudre les conflits (modifié le 06/11/2026).** `ConflictResolver` : fichiers par statut, nous · eux · résultat éditable, Mark as resolved, Continue (quand tout est résolu), Abort ; Pop ou Apply en conflit : Done et Abort. Retour au graphe possible, `OperationBanner` (Resolve · Continue · Abort) ; checkout, Branch, Create branch here, Rename, Delete local, Delete from origin, Stash, Pop, merge, rebase, cherry-pick, revert, reset et Pull désactivés, Commit aussi pendant un merge.
*Moment de vérité* : Continue termine l'opération et `git status` est propre.

**J-10 · Cloner (modifié le 06/11/2026).** `CloneDialog` (`Welcome` ou `RepoPicker`) : profil d'abord (aucun par défaut, pas de clone sans profil), URL (SSH proposée pour une `https://`), dossier pré-rempli par le dernier dossier parent de clone ; ouverture dans `History`, `.git/config` écrit.
*Moment de vérité* : le dépôt cloné committe et pousse avec le bon compte sans autre réglage.

**J-11 · Configurer les profils (modifié le 06/11/2026).** `ProfileSettings` (Cmd+, ou « Edit profiles… » du menu de `ProfileBadge`) : liste ordonnée (Alt+↑ ↓), nom, couleur, identité, clé SSH (`~/.ssh` ou ed25519 générée), Copy public key, signature, Test connection, règles par chemin ou propriétaire du remote.
*Moment de vérité* : Test connection répond « authenticated as @jag-work ».

**J-12 · Rattachement automatique (modifié le 06/11/2026).** À l'ouverture ou au clone, le profil vient du choix mémorisé (menu de `ProfileBadge`, clone), sinon du premier profil dont une règle correspond (Remote owner lu sur `origin` seulement) ; « Reset to rules » efface le choix. Profil écrit dans `.git/config` local (identité, `core.sshCommand`, signature). Réglage local différent → `IdentityMismatch`, rien d'écrit avant un choix : Overwrite, Import local config, Cancel (non conforme). Aucune règle → « No profile », blocage J-13.
*Moment de vérité* : `git config user.email` dans le terminal renvoie l'adresse du profil.

**J-13 · Blocage d'identité (modifié le 06/11/2026).** Avant toute création de commit (Commit, merge, cherry-pick, revert, rebase, Continue), push ou « Delete from origin », les quatre valeurs (identité, clé, signature) comparées au profil ; écart → actions refusées, sans contournement, attendu / trouvé par valeur, « Fix repository identity ». Push : commits à pousser vérifiés aussi, committer toujours, auteur seulement s'il est un autre de mes profils (« 1 of 2 commits authored as jag@perso.fr. ») ; commits fautifs marqués dans le graphe ; « Fix commit identity » les réécrit tous en un geste, en gardant un auteur collègue.
*Moment de vérité* : un `user.email` modifié à la main est bloqué, puis réparé en un clic ; un commit fait au terminal avec le mauvais compte ne part jamais.

**J-14 · Reset (ajouté le 23/10/2026).** Clic droit sur un commit (dont `origin/…`) → « Reset feature/profiles to here › Soft / Mixed / Hard », chaque mode décrit en une ligne. Soft et Mixed immédiats ; Hard ouvre `ResetHardDialog` (« 2 commits and 3 modified files will be lost. »).
*Moment de vérité* : après un fetch, la branche locale rejoint `origin/…` en deux clics, en sachant ce qui disparaît.

**J-15 · Choisir l'apparence (ajouté le 06/11/2026).** `ThemeSwitch` dans la barre d'outils : Dark / Light / System en un clic ; sa flèche ouvre Palette (Neon, Kraken) et Halo (sombre seulement). Réglage global, mémorisé, appliqué tout de suite sans redémarrage.
*Moment de vérité* : passer de Neon à Kraken ne change ni la sélection ni le défilement du graphe.

**J-16 · Gérer les branches (ajouté le 06/11/2026).** Checkout par double-clic sur une branche (`BranchSidebar` ou `RefLabel`), par le sélecteur de branche de la `Toolbar` (liste filtrable) ou par clic droit › Checkout ; sur une `origin/…` non récupérée, le même geste crée la branche locale qui la suit ; si la locale de même nom est sur un autre commit, confirmation « feature/graph already exists locally. Reset it to origin/feature/graph? » (commits locaux perdus listés ; Reset and checkout, Checkout local as is, Cancel). Modifications non commitées : elles suivent si compatibles, sinon refus « Commit or stash your changes before switching branches. », rien ne change. Création : Branch (`Toolbar`, depuis la courante) ou clic droit sur un commit / `CommitDetail` › « Create branch here » ; nom saisi en ligne à la place de la `RefLabel`, refusé dès la saisie s'il est pris ou invalide ; Entrée crée et fait le checkout, Échap annule. Clic droit sur une branche locale : Rename (même saisie en ligne ; lien de suivi gardé, `origin/…` non renommée) et « Delete local » (désactivé sur la courante ; immédiat seulement si fusionnée dans la courante ; sinon confirmation : « feature/graph is not merged into feature/profiles (merged into origin/develop). Delete anyway? » ou « feature/graph has 3 commits not merged anywhere. Delete anyway? »). Clic droit sur une `origin/…` : « Delete from origin », toujours confirmé, nommant la branche distante et la branche locale qui la suit encore ; aucune branche locale supprimée, la locale passe « Not published » ; refusé comme Push par une identité non conforme. Checkout de `CommitDetail` : la branche du commit, menu de choix s'il en porte plusieurs, checkout de l'`origin/…` s'il ne porte qu'une distante ; aucune branche : « Create branch here » (jamais de HEAD détachée). Opération en cours : tous ces gestes désactivés (« Operation in progress. »).
*Moment de vérité* : double-clic sur `origin/feature/graph` jamais récupérée : la branche locale est créée, suit la distante, et le graphe la montre courante.

**J-17 · Installer Git (ajouté le 08/11/2026).** Au lancement, Git absent → `Welcome` à l'état « Git not found », même si un dernier dépôt existe (récents, Open, Clone remplacés). « Install Command Line Tools » ouvre l'installation d'Apple ; Octogit attend et revérifie ; Git trouvé → reprise seule du lancement normal (dernier dépôt dans `History`, sinon `Welcome`).
*Moment de vérité* : l'installation d'Apple terminée, Octogit ouvre le dépôt ou `Welcome` sans relance ni autre clic.

## Écrans
| Écran | Rôle | Détail et états |
|---|---|---|
| `Welcome` | dépôts récents, ouvrir, cloner | `ux/ecrans/welcome.md` |
| `History` | écran principal : graphe, commit, synchronisation | `ux/ecrans/history.md` |
| `DiffView` | diff de travail ou de commit, indexation fine | `ux/ecrans/diff-view.md` |
| `InteractiveRebase` | composer et lancer un rebase interactif | `ux/ecrans/interactive-rebase.md` |
| `ConflictResolver` | résoudre les conflits et terminer l'opération | `ux/ecrans/conflict-resolver.md` |
| `ProfileSettings` | profils, clés SSH, règles de rattachement | `ux/ecrans/profile-settings.md` |
| Dialogues | clone, force push, reset hard, écart d'identité | `ux/ecrans/dialogues.md` |

## Composants
Composants par écran dans `ux/ecrans/` ; composants partagés (`Toolbar`, `ThemeSwitch`, `RepoPicker`, `ProfileBadge`, `OperationBanner`) dans `ux/ecrans/communs.md`.

## Ton et accessibilité
- **Références** : GitKraken pour le graphe (liens à angles droits et coudes arrondis, lignes teintées par branche, icônes local / origin) et pour les icônes d'action ; référence « Neon » du 05/11/2026 pour la disposition de `History` ; thèmes sombre, clair et système.
- **Ton** : interface en anglais ; messages courts, factuels, impersonnels, sans « you » (« Identity does not match profile Work. ») ; message brut de Git accessible en cas d'erreur.
- **Accessibilité** : tout au clavier, focus visible, texte ≥ 12 px, jamais d'information portée par la couleur seule (étiquettes sur les lanes, statut M / A / D en lettre).
- **Contraste** : WCAG AA dans les deux thèmes, 4,5:1 pour le texte, 3:1 pour les lanes, nœuds, focus et bordures de contrôle.

## Direction visuelle
- **Ambiance et références** : « Neon », d'après la référence fournie le 05/11/2026 : lanes vives, ligne de chaque commit teintée de la couleur de sa branche et ouverte par un trait de cette couleur, colonne des refs reliée au nœud par un fil ; étiquette pleine pour une branche locale (anneau si en avance), pointillés pour une branche seulement distante. Deux palettes au choix (Neon par défaut, Kraken), chacune en sombre et en clair ; option Halo (sombre seulement) : lueur sur lanes, étiquettes pleines et boutons d'action (`brand`, `danger`, focus).
- **Maquettes retenues** : `ux/direction/neon.html`, `ux/direction/neon-kraken.html`. Écartées : `kraken.html`, `graphite.html`, `atelier.html`.

- **Tokens** : `surface`, `surface-raised`, `border`, `border-strong`, `ink`, `muted`, `brand`, `on-brand`, `link`, `selection`, `focus`, `success`, `warning`, `danger`, `lane-1`…`lane-6`, `on-label`, `node-ink` ; valeurs des deux palettes et des deux thèmes, règles dérivées et contrastes dans `ux/tokens.md`.
- **Police** : SF Pro 13 px (messages de commit 14 px), SF Mono 12 px pour chemins et SHA.
- **Icônes** : trait de 1,8 px, 16 px, sans remplissage, devant chaque libellé de bouton (Fetch, Push, Branch, Stash, Pop, Commit, Resolve, Abort, Hard reset…).
- **Rayons, ombres** : 7 px (contrôles), 5 px (étiquettes), 10 px (fenêtre, cartes), pilule (badge de profil) ; ombre sur fenêtre et dialogues seulement.
- **Densité** : lignes du graphe 34 px (bande teintée 30 px), 8 px entre les blocs du panneau, 14 px de marge intérieure.

## Réorganisation proposée
| Écart | Proposition | Décision | Repris par |
|---|---|---|---|
| Carte « Intégration GitHub », « Voir sur GitHub », dépôts GitHub | Retirer (non-objectif) | retenu | `explorer-l-historique` (Exclu), `demarrer-un-depot` (Exclu) |
| Onglets Blame et Historique du fichier | Retirer (non-objectif) | retenu | `explorer-l-historique` (Exclu) |
| Avatars d'auteur | Initiales | retenu | S-4 |
| Écriture `.git/config` optionnelle | Toujours, après choix en cas d'écart | retenu | S-10, S-11 |
| Glisser dans le rebase | ↑ ↓ et raccourcis, sans glisser (non-objectif) | retenu | S-42 |
| Fetch et Pull séparés | `SyncButton` | retenu | S-18 |
| Pas de Welcome, clone, recherche, bandeau d'opération | Ajouter | retenu | S-2, S-27, S-30, S-39 |
| Référence du 05/11 : refs en colonne à gauche reliées aux nœuds, lignes teintées | Adopter dans `CommitGraph` | retenu | S-4, S-5 |
| Référence du 05/11 : sélecteur de thème dans la barre d'outils | `ThemeSwitch`, avec palette et halo dans son menu | retenu | S-47, S-48 |
| Référence du 05/11 : barre d'aide en pied du graphe | Adopter | retenu | S-4 |
| Référence du 05/11 : ni auteur ni SHA, date absolue | Garder auteur, date relative, SHA, masquables par colonne | retenu | S-4 |
| Référence du 05/11 : icône devant chaque libellé de bouton | Adopter | retenu | S-48 |
| Référence du 05/11 : interface en français, Fetch et Pull séparés, filtre « Whole repo / Local », bouton Undo | Garder l'anglais et `SyncButton` ; ni filtre ni Undo (non-objectif) | écarté |  |

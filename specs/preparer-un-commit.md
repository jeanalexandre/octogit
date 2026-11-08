# Spec : Préparer un commit

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/preparer-un-commit.md`. Validé par l'humain le 06/11/2026.
> Révisions : 06/11/2026 : renvois « → spec à écrire » remplacés par `specs/proteger-l-identite.md`, `specs/synchroniser.md` et `specs/configurer-les-profils.md` ; « Amend author » remplacé par « Fix commit identity » (mise à jour de référence, aucun critère changé).
> Révisions : 06/11/2026 : renvoi « résoudre les conflits » mis à jour vers `specs/resoudre-les-conflits.md` (mise à jour de référence, aucun critère changé).
> Révisions : 07/11/2026 : « À reporter » vers `ux.md` retiré, traité par les révisions du 06/11 et du 07/11/2026 de `ux.md` (`ux/ecrans/history.md`, `ux/ecrans/diff-view.md`, `ux/maquettes/diff-view.html`) ; section Interface alignée, composants à ajouter devenus composants utilisés (mise à jour de référence, aucun critère changé). Validé par l'humain le 07/11/2026.

## Objectif
J'ouvre un dépôt : la ligne WIP est sélectionnée et `WorkingChanges` liste mes modifications. J'indexe ou je désindexe des fichiers entiers, ou un bloc ou quelques lignes depuis `DiffView`. J'écris le résumé et la description, j'amende si besoin, puis je committe au clavier. Je mets aussi de côté mon travail en cours dans un stash, puis je le réapplique, sans taper de commande.
- Jobs servis : J-2

## Périmètre
- **Inclus :** ligne WIP sélectionnée par défaut (repris de `specs/explorer-l-historique.md`) ; `WorkingChanges` : fichiers non indexés et indexés avec statut en lettre, Stage all, Unstage all, état propre, Discard changes sur un fichier non indexé ou non suivi (repris de `specs/explorer-l-historique.md`) ; `DiffView` en mode travail : indexer et désindexer un fichier, un bloc ou des lignes, états binaire et trop gros (repris de `specs/explorer-l-historique.md`) ; résumé, description, Amend, Commit et Cmd+Entrée ; ligne « Identity matches profile … » sous le bouton (affichage seul) ; `StashButtons` (Stash avec message optionnel, fichiers non suivis compris, Pop) ; clic droit sur un stash : Apply, Pop, Drop confirmé.
- **Exclu :**
  - Génération du message de commit par IA (non-objectif).
  - Annulation (Undo) d'un commit, d'un discard ou d'un stash (non-objectif).
  - Blocage d'identité avant commit et push (J-13 : état bloqué de `WorkingChanges`, attendu / trouvé, « Fix repository identity », « Fix commit identity ») → `specs/proteger-l-identite.md`
  - Résoudre les conflits (`ConflictResolver`, J-9), y compris ceux d'un Pop ou d'un Apply → `specs/resoudre-les-conflits.md`
  - Synchroniser (`SyncButton`, `PushButton`, Force push après un Amend d'un commit déjà poussé) → `specs/synchroniser.md`
  - Signature et identité du profil : définition du profil → `specs/configurer-les-profils.md` ; rattachement et écriture dans `.git/config` → `specs/proteger-l-identite.md` (J-11, J-12)

## Critères d'acceptation
- **CA-1** : Étant donné un dépôt avec 3 fichiers modifiés, quand il s'ouvre dans `History`, alors la ligne WIP est en tête du graphe, sélectionnée, porte « 3 changed files », et `WorkingChanges` s'affiche à droite.
- **CA-2** : Étant donné un autre commit sélectionné, quand je clique sur la ligne WIP, alors `WorkingChanges` remplace `CommitDetail`.
- **CA-3** : Étant donné `WorkingChanges`, alors les fichiers sont répartis en « Unstaged · n » et « Staged · n », chacun avec son statut en lettre (M / A / D) et son chemin.
- **CA-4** : Étant donné un fichier modifié hors d'Octogit (éditeur, terminal) alors que le dépôt est ouvert, alors `WorkingChanges` et le compteur de la ligne WIP le reflètent en moins de 1 s, sans geste de ma part.
- **CA-5** : Étant donné des fichiers non indexés, quand je clique sur Stage all, alors tous passent dans Staged et `git diff --cached --name-only` les liste ; Unstage all fait l'inverse.
- **CA-6** : Étant donné un fichier non indexé de `WorkingChanges`, quand je clique dessus, alors `DiffView` s'ouvre en mode travail sur ce fichier, avec Stage file, un Stage hunk par bloc, et « File i / n ».
- **CA-7** : Étant donné `DiffView` en mode travail, quand je clique sur Stage hunk, alors seul ce bloc est indexé : `git diff --cached` contient ce bloc et `git diff` contient les autres.
- **CA-8** : Étant donné 2 lignes sélectionnées par Maj+clic ou glissé dans la marge, quand je clique sur Stage selected lines, alors seules ces 2 lignes sont indexées.
- **CA-9** : Étant donné `DiffView` en mode travail, quand je passe au fichier suivant ou précédent, alors le diff du fichier voisin dans `WorkingChanges` s'affiche ; quand je fais Échap, alors `History` revient avec la ligne WIP sélectionnée.
- **CA-10** : Étant donné un fichier binaire, alors `DiffView` affiche « Binary file » avec les tailles avant et après, et Stage file reste disponible ; étant donné un diff de plus de 5 000 lignes, alors il est replié, s'affiche à la demande par Show diff, et Stage file reste disponible ; à 5 000 lignes ou moins, il s'affiche directement.
- **CA-11** : Étant donné un arbre de travail propre, alors `WorkingChanges` affiche « Working tree clean. », Commit est désactivé et Stash est désactivé.
- **CA-12** : Étant donné des fichiers indexés et un résumé saisi, quand je clique sur « Commit to <branche> », alors un commit est créé sur la branche courante avec le résumé en première ligne et la description en corps, il apparaît en tête du graphe, Staged se vide, les fichiers non indexés restent, résumé et description se vident.
- **CA-13** : Étant donné le focus dans le résumé ou la description, quand je fais Cmd+Entrée, alors le résultat est celui de CA-12.
- **CA-14** : Étant donné un commit créé par Octogit, alors son auteur et sa signature sont ceux du `.git/config` local du dépôt, sans écriture dans `~/.gitconfig`.
- **CA-15** : Étant donné une identité effective conforme au profil Work, alors « Identity matches profile Work » et l'adresse s'affichent sous le bouton Commit.
- **CA-16** : Étant donné Amend last commit coché, quand je committe, alors le dernier commit est remplacé (nouveau SHA, même parent) avec les fichiers indexés et le message saisi, et l'ancien n'apparaît plus dans le graphe.
- **CA-17** : Étant donné des modifications, dont un fichier non suivi, quand je clique sur Stash avec ou sans message, alors l'arbre de travail devient propre (fichier non suivi compris) et un stash apparaît dans `BranchSidebar` et dans le graphe, nommé par le message s'il est saisi.
- **CA-18** : Étant donné un stash sélectionné, quand je clique sur Pop, alors ce stash est appliqué, fichiers non suivis compris, puis retiré ; sans stash sélectionné, c'est le dernier ; sans aucun stash, Pop est désactivé.
- **CA-19** : Étant donné un clic droit sur un stash, alors le menu propose Apply, Pop et Drop ; Apply applique le stash et le garde dans la liste.
- **CA-20** : Étant donné Drop choisi, alors une confirmation nomme le stash ; après confirmation il disparaît de `git stash list`, après annulation rien ne change.
- **CA-21** : Étant donné un Pop ou un Apply qui produit un conflit, alors le stash reste dans `git stash list` et les fichiers en conflit sont signalés dans `WorkingChanges`.
- **CA-22** : Étant donné des fichiers indexés et un résumé vide, alors Commit est désactivé et « Summary required » s'affiche en une ligne ; étant donné un résumé saisi et aucun fichier indexé, alors Commit est désactivé et « No staged changes » s'affiche ; dans les deux cas, rien n'est indexé automatiquement.
- **CA-23** : Étant donné un brouillon de résumé et de description saisi, quand je coche Amend last commit, alors les champs affichent le message du dernier commit, modifiables ; quand je décoche, alors le brouillon saisi avant revient à l'identique.
- **CA-24** : Étant donné un fichier indexé de `WorkingChanges`, quand je clique dessus, alors `DiffView` s'ouvre en mode indexé avec Unstage file, un Unstage hunk par bloc et Unstage selected lines ; chacun retire de l'index exactement le fichier, le bloc ou les lignes visés, le reste de l'index ne change pas.
- **CA-25** : Étant donné un clic droit sur un fichier suivi non indexé, quand je choisis Discard changes, alors une confirmation nomme le fichier ; après confirmation, ses modifications non indexées disparaissent de l'arbre de travail et de `git diff` ; après annulation, rien ne change.
- **CA-26** : Étant donné un clic droit sur un fichier non suivi (ex. `lib/ProfileBadge.svelte`), quand je choisis Discard changes, alors la confirmation dit que le fichier sera supprimé (« ProfileBadge.svelte will be deleted. ») ; après confirmation, le fichier n'existe plus sur le disque ni dans `WorkingChanges` ; après annulation, rien ne change.

## Interface
- Écrans concernés (`ux.md`) : `History` (`ux/ecrans/history.md`, maquette `ux/maquettes/history.html`, état 1 et variante « No changes ») ; `DiffView` en mode travail et indexé (`ux/ecrans/diff-view.md`, maquette `ux/maquettes/diff-view.html`, états 1 et 3, dont « trop gros » avec Show diff).
- Composants utilisés (`ux.md`) : `Toolbar`, `StashButtons`, `BranchSidebar`, `CommitGraph` / `CommitNode` (variante WIP), `WorkingChanges` (fichiers, propre, Commit désactivé avec « Summary required » / « No staged changes », amend avec brouillon restauré, conflit de Pop ou d'Apply, clic droit Discard changes), `RefContextMenu` (entrées Stash : Apply, Pop, Drop confirmé ; entrées Fichier non indexé ou non suivi : Discard changes confirmé, variante « will be deleted. »), `DiffView` (travail, indexé, binaire, trop gros), `ProfileBadge` (affiché).

## À reporter
- Vers `stack.md` : détection en moins de 1 s des changements de l'arbre de travail faits hors d'Octogit ; indexation et désindexation partielles par bloc et par ligne ; création de commit et d'amend qui respecte l'identité et la signature du `.git/config` local ; stash fichiers non suivis compris, apply, pop, drop ; abandon des modifications non indexées d'un fichier suivi et suppression d'un fichier non suivi.

## Questions ouvertes
- aucune

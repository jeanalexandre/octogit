# Spec : Explorer l'historique

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/explorer-l-historique.md`. Validé par l'humain le 06/11/2026.
> Révisions : 06/11/2026, le tag (création, push, suppression) passe à `specs/synchroniser.md` : « tag » retiré du renvoi des actions du `RefContextMenu` et de `CommitDetail`, exclusion « Tags » ajoutée ; renvois « préparer un commit » et « synchroniser » mis à jour vers leurs specs ; aucun critère modifié.
> Révisions : 06/11/2026, renvoi « marquage des commits d'auteur non conforme (J-13) » mis à jour vers `specs/proteger-l-identite.md` (CA-23 : marque auteur ou committer) ; aucun critère modifié.
> Révisions : 06/11/2026, renvoi « démarrer un dépôt » mis à jour vers `specs/demarrer-un-depot.md` ; aucun critère modifié.
> Révisions : 06/11/2026, renvoi « apparence (`ThemeSwitch`) » mis à jour vers `specs/choisir-l-apparence.md` ; aucun critère modifié.
> Révisions : 06/11/2026, renvoi des actions du `RefContextMenu` et de `CommitDetail` scindé : merge et rebase mis à jour vers `specs/integrer-une-branche.md` ; cherry-pick, revert et reset restent à écrire ; aucun critère modifié.
> Révisions : 06/11/2026, renvoi « `OperationBanner` » mis à jour vers `specs/resoudre-les-conflits.md` ; aucun critère modifié.
> Révisions : 06/11/2026, renvoi des actions du `RefContextMenu` et de `CommitDetail` (cherry-pick, revert, reset) mis à jour vers `specs/revenir-en-arriere.md` ; aucun critère modifié.

## Objectif
J'ouvre Octogit : le dernier dépôt s'affiche dans `History`. Le graphe en lanes montre les branches locales et distantes à jour, sans geste de ma part. Je lis l'état du projet d'un coup d'œil. Je retrouve un commit passé par son message, son auteur ou son SHA, puis j'en consulte le détail et le diff de ses fichiers, et je reviens au même endroit du graphe.
- Jobs servis : J-1, J-4, J-5

## Périmètre
- **Inclus :** ouverture du dernier dépôt au lancement ; changement de dépôt par `RepoPicker` ; fetch automatique à l'ouverture puis toutes les minutes, et son état (`FetchStatus`) ; graphe en lanes avec branches locales, `origin/…` (même jamais récupérées), tags et stashes ; avance / retard de la branche courante ; refs en colonne à gauche reliées aux nœuds, lignes teintées par branche (de `ux.md`) ; colonnes auteur, date relative, SHA, masquables par colonne (de `ux.md`) ; initiales d'auteur au lieu d'avatars (de `ux.md`) ; barre d'aide en pied du graphe (de `ux.md`) ; recherche par message, auteur ou SHA (de `ux.md`, ligne « Pas de Welcome, clone, recherche, bandeau d'opération » : seule la recherche est reprise ici) ; détail d'un commit (`CommitDetail`) et diff d'un fichier de ce commit (`DiffView`, mode commit).
- **Exclu :**
  - Historique d'un fichier et blame, onglets Blame et Historique du fichier (non-objectif, de `ux.md`).
  - Avatars GitHub (non-objectif).
  - Onglets multi-dépôts (non-objectif).
  - Filtre « Whole repo / Local » (écarté dans `ux.md`).
  - Tags : création, push, suppression → `specs/synchroniser.md`
  - Démarrer un dépôt (`Welcome`, état « dépôt introuvable », clone par URL) → `specs/demarrer-un-depot.md`
  - `OperationBanner` (bandeau d'opération) → `specs/resoudre-les-conflits.md`
  - Merge et rebase depuis le `RefContextMenu` → `specs/integrer-une-branche.md`
  - Actions du `RefContextMenu` et de `CommitDetail` (cherry-pick, revert, reset) → `specs/revenir-en-arriere.md`
  - Préparer un commit (ligne WIP, `WorkingChanges`, `DiffView` en mode travail et indexation) → `specs/preparer-un-commit.md`
  - Synchroniser (`SyncButton`, `PushButton`, publication d'une branche non suivie) → `specs/synchroniser.md`
  - Marquage des commits d'auteur non conforme (J-13) → `specs/proteger-l-identite.md` (CA-23 : marque auteur ou committer)
  - Apparence (`ThemeSwitch` dans la barre d'outils de `History`) → `specs/choisir-l-apparence.md` (CA-1)

## Critères d'acceptation
- **CA-1** : Étant donné un dépôt ouvert lors de la session précédente et toujours présent, quand je lance Octogit, alors ce dépôt s'affiche dans `History` sans autre geste ; si ce dépôt est introuvable, `Welcome` s'ouvre à la place.
- **CA-2** : Étant donné `History` affiché, quand je choisis un autre dépôt dans `RepoPicker`, alors `History` affiche le graphe de ce dépôt dans la même fenêtre.
- **CA-3** : Étant donné une branche poussée sur `origin` par un autre clone après le dernier fetch, quand j'ouvre le dépôt, alors un fetch part sans geste de ma part et la branche apparaît dans le graphe avec une `RefLabel` en pointillés.
- **CA-4** : Étant donné un dépôt ouvert, quand 1 min s'est écoulée depuis le dernier fetch, alors un fetch part sans geste et `FetchStatus` affiche l'âge relatif du dernier fetch réussi.
- **CA-5** : Étant donné le réseau coupé, quand un fetch automatique échoue, alors `FetchStatus` passe à l'état hors ligne, aucune branche locale ni l'arbre de travail ne change, et le graphe reste consultable.
- **CA-6** : Étant donné un fetch automatique terminé, alors aucune branche locale n'a bougé (aucun pull implicite) et `.git/config` n'a pas été écrit.
- **CA-7** : Étant donné un dépôt avec des branches locales, des `origin/…`, des tags et des stashes, quand `History` s'affiche, alors chacun apparaît dans `BranchSidebar` et sous forme de `RefLabel` dans la colonne des refs, reliée par un fil au nœud du commit qu'il désigne.
- **CA-8** : Étant donné une `RefLabel`, alors sa variante suit son état : pleine si synchronisée, pleine avec anneau si en avance, pointillés si distante seule, tag pour un tag ; chaque étiquette porte le nom de la ref en texte.
- **CA-9** : Étant donné un graphe affiché, alors chaque ligne de commit est teintée de la couleur de sa lane et ouverte par un trait de cette couleur ; deux branches voisines n'ont pas la même couleur de lane.
- **CA-10** : Étant donné la branche courante en avance de 2 et en retard de 3 sur sa branche distante suivie, quand `History` s'affiche, alors les deux nombres 2 et 3 sont lisibles sans survol ni clic.
- **CA-11** : Étant donné une branche courante sans branche distante suivie, alors l'indicateur affiche « Not published » à la place du compteur et `PushButton` reste actif.
- **CA-12** : Étant donné un commit d'auteur « Jean-Alexandre Gautreau », alors son nœud affiche des initiales cerclées de la couleur de sa branche et aucune image d'avatar n'est chargée.
- **CA-13** : Étant donné un graphe affiché, alors les colonnes auteur, date et SHA abrégé sont visibles ; un clic droit sur l'en-tête de colonnes masque ou réaffiche chacune séparément.
- **CA-14** : Étant donné une colonne masquée, quand je ferme puis rouvre Octogit, alors elle est toujours masquée.
- **CA-15** : Étant donné un commit, alors sa date est toujours relative (« 12 min ago », « yesterday », « 3 weeks ago ») ; au survol, la date et l'heure absolues s'affichent au format « 2026-11-04 14:32 ».
- **CA-16** : Étant donné un graphe affiché, alors une barre d'aide en pied du graphe indique en une ligne comment sélectionner une branche puis lancer une action par clic droit.
- **CA-17** : Étant donné `History`, quand je fais Cmd+F, alors `SearchBox` reçoit le focus.
- **CA-18** : Étant donné une saisie dans `SearchBox`, alors les commits dont le résumé, la description, l'auteur ou le SHA contient le texte, sans tenir compte de la casse, sont surlignés dans le graphe ; le compteur affiche « position / total » (ex. « 3 / 12 »).
- **CA-19** : Étant donné des résultats, quand je fais Entrée, alors la sélection passe au résultat suivant et le graphe défile pour l'afficher ; Maj+Entrée passe au précédent ; le compteur suit.
- **CA-20** : Étant donné un SHA complet ou abrégé d'un commit du dépôt collé dans `SearchBox`, alors ce commit est sélectionné et affiché dans le graphe sans autre geste.
- **CA-21** : Étant donné une saisie sans résultat, alors `SearchBox` affiche l'état « aucun » et la sélection ne change pas.
- **CA-22** : Étant donné des résultats, quand j'active « Show matches only », alors seules les lignes des résultats restent dans le graphe ; le désactiver rétablit toutes les lignes.
- **CA-23** : Étant donné un dépôt de 10 000 commits, quand je l'ouvre, alors le graphe s'affiche en moins de 3 s ; quand je le fais défiler du premier au dernier commit, alors le défilement tient 60 images/s sans saut visible.
- **CA-24** : Étant donné un graphe affiché, quand je clique sur un commit, alors `CommitDetail` s'affiche à droite avec son message, son auteur, sa date, son SHA, l'état signé ou non signé, et la liste de ses fichiers modifiés avec leur statut en lettre (M / A / D).
- **CA-25** : Étant donné un commit de merge sélectionné, alors `CommitDetail` affiche sa variante merge.
- **CA-26** : Étant donné `CommitDetail` affiché, quand je clique sur un fichier, alors `DiffView` affiche le diff de ce fichier dans ce commit ; une commande bascule entre côte à côte et unifié.
- **CA-27** : Étant donné `DiffView` en mode commit, quand je passe au fichier suivant ou précédent, alors le diff du fichier voisin dans la liste du commit s'affiche.
- **CA-28** : Étant donné un fichier ajouté ou supprimé, alors `DiffView` n'affiche qu'un seul côté ; étant donné un fichier binaire, alors `DiffView` affiche l'état binaire au lieu du contenu.
- **CA-29** : Étant donné `DiffView` ouvert depuis un commit, quand je fais Échap, alors `History` revient avec le même commit sélectionné et la même position de défilement du graphe.

## Interface
- Écrans concernés (`ux.md`) : `History` (`ux/ecrans/history.md`, maquette `ux/maquettes/history.html`), états vide, attente, erreur, hors ligne ; `DiffView` en mode commit (`ux/ecrans/diff-view.md`, maquette `ux/maquettes/diff-view.html`).
- Composants utilisés (`ux.md`) : `Toolbar`, `RepoPicker`, `ProfileBadge` (affiché, non modifié), `FetchStatus`, `BranchSidebar`, `CommitGraph`, `CommitNode`, `RefLabel`, `SearchBox`, `CommitDetail`, `DiffView`, `PushButton` (état actif seulement).
- Composants à ajouter : aucun.

## À reporter
- Vers `stack.md` : lecture du graphe de commits, des refs et des diffs ; fetch en tâche de fond sans bloquer l'interface ; 10 000 lignes de graphe affichées en moins de 3 s et défilées à 60 images/s ; mémorisation locale des préférences (dernier dépôt, colonnes masquées).
- Vers `ux.md` : variante « Not published » de l'indicateur d'avance / retard (CA-11), absente des états listés ; format de la date relative et date absolue au survol (CA-15).

## Questions ouvertes
- aucune

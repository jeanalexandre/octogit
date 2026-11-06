# Spec : Synchroniser

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/synchroniser.md`. Validé par l'humain le 06/11/2026.
> Révisions : 06/11/2026, renvoi du blocage d'identité (J-13) mis à jour vers `specs/proteger-l-identite.md` ; « Amend author » et « Reset (soft) before <sha> » remplacés par « Fix commit identity ». Aucun critère modifié.
> Révisions : 06/11/2026, renvoi des actions du `RefContextMenu` et de `CommitDetail` scindé : merge et rebase mis à jour vers `specs/integrer-une-branche.md` ; cherry-pick, revert et reset restent à écrire. Aucun critère modifié.
> Révisions : 06/11/2026, renvois « résoudre les conflits » et « `OperationBanner` » mis à jour vers `specs/resoudre-les-conflits.md`, y compris la référence dans le texte de CA-8. Aucun critère modifié.
> Révisions : 06/11/2026, renvoi des actions du `RefContextMenu` et de `CommitDetail` (cherry-pick, revert, reset) mis à jour vers `specs/revenir-en-arriere.md`. Aucun critère modifié.

## Objectif
Depuis `History`, j'échange avec le remote en un clic. `SyncButton` lance l'action par défaut que j'ai choisie : Fetch All, Pull en avance rapide seulement ou Pull en rebase. `PushButton` pousse ma branche, la publie si elle n'est pas suivie, ou propose un Force push confirmé après réécriture. Je pose, pousse et supprime des tags. Rien ne bouge sans décision de ma part, et aucun pull ne crée de commit de fusion.
- Jobs servis : J-3

## Périmètre
- **Inclus :** `SyncButton` réunissant Fetch et Pull : un clic lance l'action par défaut, la flèche choisit l'action par défaut (de `ux.md`, ligne « Fetch et Pull séparés → `SyncButton` ») ; Fetch All manuel de tous les remotes, avec prune ; Pull (fast-forward only), refusé si la branche a divergé ; Pull (rebase) ; Pull refusé si des modifications ne sont pas commitées ; `PushButton` et son compteur d'avance (repris de `specs/explorer-l-historique.md` et de `specs/preparer-un-commit.md`) ; publication d'une branche non suivie (repris de `specs/explorer-l-historique.md`) ; Force push après réécriture de commits déjà poussés, dont un Amend, par `ForcePushDialog` (repris de `specs/preparer-un-commit.md`) ; états en cours, désactivé et erreur des deux boutons ; tags : Create tag, Push tag, Delete tag.
- **Exclu :**
  - Pull par merge : J-3 exclut toute fusion surprise.
  - Annulation (Undo) d'un pull, d'un push, d'un force push ou d'une suppression de tag (non-objectif).
  - Pull requests et intégration GitHub (non-objectif).
  - Fetch automatique, `FetchStatus` hors ligne : `specs/explorer-l-historique.md`.
  - Indicateur d'avance / retard et état « Not published » : `specs/explorer-l-historique.md`.
  - Amend : `specs/preparer-un-commit.md`.
  - Blocage d'identité avant commit et push (J-13 : état bloqué de `PushButton`, auteurs des commits à pousser, « Fix commit identity », qui corrige en un geste tous les commits fautifs, sans Force push) : `specs/proteger-l-identite.md` (CA-24, CA-25).
  - Résoudre les conflits (`ConflictResolver`, J-9), y compris ceux d'un Pull (rebase) : `specs/resoudre-les-conflits.md`.
  - `OperationBanner` (bandeau d'opération) : `specs/resoudre-les-conflits.md`.
  - Merge et rebase depuis le `RefContextMenu` : `specs/integrer-une-branche.md`.
  - Actions du `RefContextMenu` et de `CommitDetail` (cherry-pick, revert, reset) : `specs/revenir-en-arriere.md`.

## Critères d'acceptation
- **CA-1** : Étant donné `History`, alors `SyncButton` affiche le libellé de son action par défaut (« Fetch All » au premier lancement), suivi d'une flèche ; un clic sur le bouton lance cette action.
- **CA-2** : Étant donné la flèche de `SyncButton` ouverte, quand je coche Fetch All, Pull (fast-forward only) ou Pull (rebase), alors cette entrée devient l'action par défaut et le libellé du bouton change, sans lancer d'action. Ce choix vaut pour tous les dépôts et reste en place après la fermeture et la réouverture d'Octogit.
- **CA-3** : Étant donné une branche poussée sur un remote depuis un autre clone, et une branche supprimée de `origin` dont `origin/…` existe encore en local, quand je lance Fetch All, alors tous les remotes sont récupérés. La nouvelle branche apparaît dans le graphe et l'`origin/…` supprimée disparaît. `FetchStatus` repart de zéro. Aucune branche locale ni l'arbre de travail n'a changé.
- **CA-4** : Étant donné la branche courante en retard de 3 et en avance de 0 sur sa branche suivie, quand je lance Pull (fast-forward only), alors elle pointe sur le même commit que sa branche suivie, et l'indicateur affiche 0 / 0.
- **CA-5** : Étant donné la branche courante en avance de 2 et en retard de 3, quand je lance Pull (fast-forward only), alors « Branch has diverged: 2 local, 3 on origin. » s'affiche. La branche et l'arbre de travail ne changent pas.
- **CA-6** : Étant donné la branche courante en avance de 2 et en retard de 3, sans conflit, quand je lance Pull (rebase), alors les 2 commits locaux sont rejoués au-dessus de la branche suivie. L'historique de la branche est linéaire, et l'indicateur affiche 2 / 0.
- **CA-7** : Étant donné n'importe quelle action de `SyncButton` terminée, alors aucun commit de fusion n'a été créé.
- **CA-8** : Étant donné un Pull (rebase) qui produit un conflit, alors l'opération s'arrête en rebase en cours, sans commit de fusion, et `ConflictResolver` prend le relais (`specs/resoudre-les-conflits.md`).
- **CA-9** : Étant donné des modifications non commitées, indexées ou non, quand je lance un Pull (fast-forward only ou rebase), alors il est refusé avec « Commit or stash your changes before pulling. ». La branche, l'index et l'arbre de travail ne changent pas.
- **CA-10** : Étant donné une branche courante « Not published », alors Pull (fast-forward only) et Pull (rebase) sont désactivés, avec la raison « Branch not published. », et Fetch All reste actif.
- **CA-11** : Étant donné la branche courante en avance de 2 sur sa branche suivie, alors `PushButton` affiche « Push 2 ». Quand je clique dessus, alors la branche distante pointe sur le commit local, et l'indicateur affiche 0 / 0.
- **CA-12** : Étant donné une branche publiée sans commit en avance, alors `PushButton` est désactivé, sans compteur, avec la raison « Nothing to push. ».
- **CA-13** : Étant donné une branche « Not published » dans un dépôt qui a un remote `origin`, quand je clique sur `PushButton`, alors la branche est créée sur `origin` sous le même nom et devient sa branche suivie. Sa `RefLabel` passe de l'état en avance à l'état synchronisé, et « Not published » disparaît.
- **CA-14** : Étant donné une branche « Not published » dans un dépôt sans `origin` et avec au moins un remote, quand je clique sur `PushButton`, alors la liste des remotes s'affiche. Quand j'en choisis un, alors la branche y est créée sous le même nom et devient sa branche suivie. Quand j'annule, rien n'est poussé.
- **CA-15** : Étant donné une branche distante qui a reçu des commits d'un autre clone, sans réécriture locale, alors `PushButton` n'affiche jamais « Force push ». Quand je pousse, alors le push est refusé et la branche distante ne change pas. Un message dit que la branche distante a des commits absents en local.
- **CA-16** : Étant donné des commits déjà poussés, puis réécrits en local par un Amend, un rebase ou un reset, alors `PushButton` affiche « Force push ». Quand je clique dessus, alors `ForcePushDialog` s'ouvre et liste, par SHA abrégé et résumé, les commits distants qui seront écrasés.
- **CA-17** : Étant donné `ForcePushDialog` ouvert, quand je confirme, alors la branche distante pointe sur le commit local. Quand j'annule, alors la branche distante ne change pas.
- **CA-18** : Étant donné une branche distante qui a reçu un commit depuis le dernier fetch, quand je confirme `ForcePushDialog`, alors le force push est refusé, et la branche distante garde ce commit (protection `--force-with-lease`).
- **CA-19** : Étant donné une action de `SyncButton` ou de `PushButton` en cours, alors le bouton affiche l'état en cours avec sa progression. Aucun des deux boutons ne peut lancer une autre action avant la fin de celle-ci.
- **CA-20** : Étant donné un fetch, un pull ou un push en échec (ex. « Permission denied (publickey). »), alors un message d'une ligne s'affiche, et « Details » montre la sortie brute de Git. Les branches locales et l'arbre de travail n'ont pas changé.
- **CA-21** : Étant donné un merge, un rebase, un cherry-pick ou un revert en cours, alors `SyncButton` et `PushButton` sont désactivés.
- **CA-22** : Étant donné un dépôt dont le `.git/config` local définit `core.sshCommand`, quand je lance un fetch, un pull ou un push, alors Git utilise cette commande et sa clé. Octogit ne lit pas `~/.gitconfig` pour choisir la clé et n'y écrit rien.
- **CA-23** : Étant donné un clic droit sur un commit, quand je choisis Create tag et saisis le nom `v1.2.0` sans message, alors `git tag` liste un tag simple `v1.2.0` qui désigne ce commit. Avec un message, le tag est annoté et porte ce message. Dans les deux cas, le tag apparaît dans le graphe en `RefLabel` tag et dans `BranchSidebar`. Un nom déjà pris ou invalide est refusé avec un message, et rien n'est créé.
- **CA-24** : Étant donné un tag local non poussé, quand je pousse la branche courante, alors le tag n'est pas poussé. Quand je choisis Push tag par clic droit sur ce tag, alors le tag existe sur `origin` et désigne le même commit.
- **CA-25** : Étant donné un clic droit sur un tag, quand je choisis Delete tag, alors une confirmation nomme le tag, et dit s'il sera aussi supprimé de `origin`. Après confirmation, le tag disparaît de `git tag`, et de `origin` s'il y avait été poussé. Après annulation, rien ne change.

## Interface
- Écrans concernés (`ux.md`) : `History` (`ux/ecrans/history.md`, maquette `ux/maquettes/history.html`, section 3 : « Fetch / Pull split menu », « Pull refused (diverged) », « Push after rewrite → Force push », « Offline / error », « Operation in progress ») ; Dialogues (`ux/ecrans/dialogues.md`) : `ForcePushDialog`.
- Composants utilisés (`ux.md`) : `Toolbar`, `SyncButton` (Fetch All · Pull ff-only · Pull rebase · en cours · refusé), `PushButton` (normal · Force push · en cours), `ForcePushDialog`, `FetchStatus`, `CommitGraph`, `RefLabel`, `BranchSidebar`, `RefContextMenu` (entrée Create tag), `OperationBanner` (affiché, non modifié).
- Composants à ajouter : saisie de Create tag (nom, message optionnel) ; menu contextuel d'un tag (Push tag, Delete tag) et confirmation de Delete tag ; liste de choix du remote au premier push (CA-14) ; raisons des états désactivés (« Branch not published. », « Nothing to push. ») ; messages de Pull refusé pour modifications non commitées (CA-9) et de push refusé (CA-15) ; état erreur de `PushButton` avec Details (CA-20).

## À reporter
- Vers `stack.md` : fetch de tous les remotes avec prune ; pull en avance rapide seulement et pull en rebase ; push avec création de la branche suivie ; force push protégé par `--force-with-lease` ; détection des commits déjà poussés puis réécrits en local ; création de tags simples et annotés, push et suppression d'un tag en local et sur le remote ; opérations réseau en tâche de fond, avec progression, sans bloquer l'interface ; utilisation du `core.sshCommand` local du dépôt pour toute opération réseau ; mémorisation locale et globale de l'action par défaut de `SyncButton`.
- Vers `ux.md` :
  - `ForcePushDialog` n'a pas de maquette (libellés, liste des commits écrasés).
  - Create tag (nom, message optionnel) et le menu contextuel d'un tag (Push tag, Delete tag, confirmation) manquent dans les composants et les maquettes. `RefContextMenu` ne couvre pas les tags.
  - La liste de choix du remote au premier push sans `origin` manque (CA-14).
  - Fetch All fait toujours un prune (CA-3).
  - Les états désactivés manquent : Pull pour une branche non publiée (« Branch not published. »), `PushButton` sans commit en avance (« Nothing to push. »).
  - Le Pull refusé pour modifications non commitées manque (« Commit or stash your changes before pulling. »).
  - Le message de push refusé, quand la branche distante est en avance, manque (CA-15).
  - L'état erreur de `PushButton` manque dans ses variantes (CA-20).
  - Le menu de `SyncButton` choisit seulement l'action par défaut, sans la lancer. Ce choix vaut pour tous les dépôts (CA-2).

## Questions ouvertes
- aucune

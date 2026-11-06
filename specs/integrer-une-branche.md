# Spec : Intégrer une branche

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/integrer-une-branche.md`. Validé par l'humain le 06/11/2026.
> Révisions : 06/11/2026, renvois « résoudre les conflits » et « `OperationBanner` » mis à jour vers `specs/resoudre-les-conflits.md`, y compris la référence dans le texte de CA-13 ; aucun critère modifié.
> Révisions : 06/11/2026, renvoi « rebase interactif (`InteractiveRebase`, J-7) » mis à jour vers `specs/nettoyer-une-branche.md` ; aucun critère modifié.
> Révisions : 06/11/2026, renvoi des actions du `RefContextMenu` et de `CommitDetail` (cherry-pick, revert, reset) mis à jour vers `specs/revenir-en-arriere.md` ; aucun critère modifié.

## Objectif
Dans `History`, je clique sur la branche qui reçoit, puis je fais un clic droit sur la branche source. Sans sélection, la branche courante reçoit. Le `RefContextMenu` propose un merge ou un rebase, avec des libellés qui nomment les deux branches. Octogit fait le checkout de la branche qui reçoit si besoin, puis exécute l'opération tout de suite, sans Undo. En cas de conflit, la résolution prend le relais. Je ne me trompe plus de sens.
- Jobs servis : J-6

## Périmètre
- **Inclus :** sélection de la branche qui reçoit (clic), ou branche courante sans sélection ; clic droit sur la source : branche locale, `origin/…` ou commit sans branche (rebase seulement) ; entrées merge et rebase du `RefContextMenu`, libellés nommant les deux branches (repris de `specs/explorer-l-historique.md` et de `specs/proteger-l-identite.md`, renvoi « actions du `RefContextMenu` et de `CommitDetail` » : merge et rebase seulement) ; checkout de la branche qui reçoit si besoin ; merge avec commit de merge toujours créé et message par défaut de Git ; exécution immédiate ; arrêt en opération en cours sur conflit ; refus avec modifications non commitées, refus « déjà à jour », erreurs de Git ; entrées désactivées pendant une opération en cours.
- **Exclu :**
  - Glisser-déposer pour le merge et le rebase (non-objectif).
  - Annulation (Undo) d'un merge ou d'un rebase (non-objectif) : une erreur se rattrape au terminal.
  - Merge et rebase dans l'autre sens (la branche du clic droit qui reçoit) et merge d'un commit sans branche.
  - Édition du message du commit de merge.
  - Pull (rebase) et Force push après rebase → `specs/synchroniser.md` (CA-6, CA-16)
  - Tags → `specs/synchroniser.md`
  - Refus du merge et du rebase pour identité non conforme ou « No profile » → `specs/proteger-l-identite.md` (CA-16)
  - Résoudre les conflits (`ConflictResolver`, J-9), y compris ceux d'un merge ou d'un rebase → `specs/resoudre-les-conflits.md`
  - `OperationBanner` (bandeau d'opération) → `specs/resoudre-les-conflits.md`
  - Rebase interactif (`InteractiveRebase`, J-7) → `specs/nettoyer-une-branche.md`
  - Actions du `RefContextMenu` et de `CommitDetail` (cherry-pick, revert, reset) → `specs/revenir-en-arriere.md`

## Critères d'acceptation
- **CA-1** : Étant donné `History`, quand je clique sur la branche locale `feature/profiles` puis fais un clic droit sur `develop`, alors `RefContextMenu` propose « Merge develop into feature/profiles » et « Rebase feature/profiles onto develop », et aucune entrée dans l'autre sens ; aucune entrée merge ou rebase n'est libellée sans les deux noms.
- **CA-2** : Étant donné aucune branche sélectionnée et `feature/profiles` courante, quand je fais un clic droit sur `develop`, alors `RefContextMenu` propose « Merge develop into feature/profiles » et « Rebase feature/profiles onto develop ». Étant donné un clic droit sur la branche qui reçoit elle-même (sélectionnée, ou courante sans sélection), alors ni merge ni rebase n'est proposé.
- **CA-3** : Étant donné `feature/profiles` sélectionnée puis un clic droit sur `origin/develop`, alors « Merge origin/develop into feature/profiles » et « Rebase feature/profiles onto origin/develop » sont proposés. Étant donné une `origin/…` sélectionnée, alors aucun merge ni rebase n'est proposé. Aucune entrée ne déplace une branche distante.
- **CA-4** : Étant donné `feature/profiles` sélectionnée (ou courante) puis un clic droit sur un commit `c41d8e0` qui ne porte aucune branche, alors seul « Rebase feature/profiles onto c41d8e0 » (SHA abrégé) est proposé ; aucun merge n'est proposé. Quand je le choisis, alors les commits de `feature/profiles` absents de `c41d8e0` sont rejoués au-dessus de ce commit.
- **CA-5** : Étant donné `main` courante et `feature/profiles` sélectionnée, quand je choisis « Merge develop into feature/profiles » ou « Rebase feature/profiles onto develop », alors `feature/profiles` devient la branche courante avant l'opération, et le reste après. Étant donné la branche qui reçoit déjà courante, aucun checkout n'a lieu.
- **CA-6** : Étant donné `develop` et `feature/profiles` divergées, sans conflit, quand je choisis « Merge develop into feature/profiles », alors, sans dialogue ni confirmation, `feature/profiles` pointe sur un nouveau commit de merge dont les parents sont l'ancien sommet de `feature/profiles` puis celui de `develop`, et dont le message est « Merge branch 'develop' into feature/profiles » ; `develop` ne bouge pas ; le graphe l'affiche aussitôt.
- **CA-7** : Étant donné `feature/profiles` ancêtre de `develop`, quand je choisis « Merge develop into feature/profiles », alors un commit de merge est créé comme en CA-6 ; `feature/profiles` n'est jamais avancée sans commit de merge.
- **CA-8** : Étant donné le commit de merge de CA-6 ou CA-7, alors son auteur et son committer sont l'identité du profil du dépôt et il est signé si ce profil signe ; `git log -1` le confirme dans le terminal.
- **CA-9** : Étant donné `feature/profiles` en avance de 2 commits sur leur ancêtre commun avec `develop`, sans conflit, quand je choisis « Rebase feature/profiles onto develop », alors, sans dialogue ni confirmation, les 2 commits sont rejoués au-dessus de `develop`, gardent leur message et leur auteur, et `feature/profiles` a un historique linéaire depuis `develop` ; `develop` ne bouge pas.
- **CA-10** : Étant donné des commits de `feature/profiles` déjà poussés, quand le rebase de CA-9 se termine, alors `PushButton` affiche « Force push » (`specs/synchroniser.md`, CA-16) ; rien n'est poussé.
- **CA-11** : Étant donné une branche qui reçoit déjà à jour (`develop` déjà contenue dans `feature/profiles` pour un merge, ou `feature/profiles` déjà au-dessus de `develop` pour un rebase), quand je lance l'opération, alors « Already up to date. » s'affiche ; aucun commit n'est créé ; branches, index et arbre de travail ne changent pas.
- **CA-12** : Étant donné des modifications non commitées, indexées ou non, quand je lance un merge ou un rebase, alors il est refusé avec un message qui demande de committer ou de stasher ; aucun checkout n'a eu lieu ; branches, index et arbre de travail ne changent pas.
- **CA-13** : Étant donné un merge ou un rebase qui produit un conflit, alors l'opération s'arrête en merge ou en rebase en cours, aucun commit de merge n'est créé, et `ConflictResolver` prend le relais (`specs/resoudre-les-conflits.md`) ; `git status` dans le terminal indique la même opération en cours.
- **CA-14** : Étant donné un merge, un rebase, un cherry-pick ou un revert en cours, y compris lancé depuis le terminal, alors les entrées merge et rebase de `RefContextMenu` sont désactivées.
- **CA-15** : Étant donné un merge ou un rebase refusé par Git pour une autre raison (ex. fichier non suivi qui serait écrasé), alors un message d'une ligne s'affiche et « Details » montre la sortie brute de Git ; aucune opération ne reste en cours.
- **CA-16** : Étant donné un merge ou un rebase terminé, alors aucune branche distante n'a changé et rien n'a été poussé.
- **CA-17** : Étant donné le focus sur une branche ou un commit source, alors `RefContextMenu` s'ouvre au clavier et ses entrées merge et rebase se choisissent et se lancent au clavier.

## Interface
- Écrans concernés (`ux.md`) : `History` (`ux/ecrans/history.md`, maquette `ux/maquettes/history.html` : barre d'aide, état « opération en cours ») ; `ConflictResolver` (prise de relais seulement).
- Composants utilisés (`ux.md`) : `BranchSidebar` et `RefLabel` (sélection, clic droit), `CommitGraph` / `CommitNode` (clic droit sur un commit), `RefContextMenu` (libellés nommant les deux branches), `PushButton` (Force push, affiché seulement), `OperationBanner` (affiché, non modifié).
- Composants à ajouter : entrée « Rebase <branche> onto <SHA abrégé> » de `RefContextMenu` sur un commit sans branche ; entrées désactivées pendant une opération en cours ; messages « Already up to date. », refus pour modifications non commitées, erreur avec Details.

## À reporter
- Vers `stack.md` : merge qui crée toujours un commit de merge, avec le message par défaut de Git ; rebase d'une branche sur une branche locale, distante ou sur un commit ; checkout préalable de la branche qui reçoit ; détection d'un merge ou d'un rebase en cours, y compris lancé au terminal ; commit de merge créé avec l'identité et la signature du `.git/config` local ; sortie brute de Git conservée pour Details.
- Vers `ux.md` :
  - Sens du geste : la branche sélectionnée (ou courante sans sélection) reçoit, la branche du clic droit est la source ; aucune entrée dans l'autre sens.
  - Merge toujours avec commit de merge, message par défaut de Git, sans édition.
  - Clic droit sur un commit sans branche : rebase seulement, pas de merge. La barre d'aide de `history.html` (« right-click another branch or a commit to merge, rebase, reset, cherry-pick… ») est à ajuster.
  - Pas de maquette du `RefContextMenu` avec ses entrées merge et rebase ni de leurs états désactivés.
  - Messages « Already up to date. », refus pour modifications non commitées, erreur avec Details : absents.
  - Ouverture de `RefContextMenu` au clavier non décrite (principe « tout au clavier »).

## Questions ouvertes
- aucune

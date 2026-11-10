# Story S-5 : Afficher les refs, l'avance / retard et `CommitDetail`

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-05-refs-et-detail-commit.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-5 (tranche valeur 1)
- Critères couverts : `explorer-l-historique` CA-7, CA-8, CA-10, CA-24, CA-25
- Jobs servis : J-1, J-4
- Revue renforcée : non

## Objectif
`History` affiche les branches, `origin/…`, tags et stashes dans `BranchSidebar` et en `RefLabel` reliées aux nœuds, l'avance / retard de la branche courante, et `CommitDetail` au clic sur un commit.

## Critères d'acceptation
- **explorer-l-historique CA-7** : Étant donné un dépôt avec des branches locales, des `origin/…`, des tags et des stashes, quand `History` s'affiche, alors chacun apparaît dans `BranchSidebar` et sous forme de `RefLabel` dans la colonne des refs, reliée par un fil au nœud du commit qu'il désigne.
- **explorer-l-historique CA-8** : Étant donné une `RefLabel`, alors sa variante suit son état : pleine si synchronisée, pleine avec anneau si en avance, pointillés si distante seule, tag pour un tag ; chaque étiquette porte le nom de la ref en texte.
- **explorer-l-historique CA-10** : Étant donné la branche courante en avance de 2 et en retard de 3 sur sa branche distante suivie, quand `History` s'affiche, alors les deux nombres 2 et 3 sont lisibles sans survol ni clic.
- **explorer-l-historique CA-24** : Étant donné un graphe affiché, quand je clique sur un commit, alors `CommitDetail` s'affiche à droite avec son message, son auteur, sa date, son SHA, l'état signé ou non signé, et la liste de ses fichiers modifiés avec leur statut en lettre (M / A / D).
- **explorer-l-historique CA-25** : Étant donné un commit de merge sélectionné, alors `CommitDetail` affiche sa variante merge.

## Décisions de l'humain
### Fiche (10/11/2026)
1. « Signé » = une signature est présente dans le commit (en-tête `gpgsig`, GPG ou SSH), sans vérification de sa validité ; le libellé dit « Signed » / « Not signed » et ne promet pas qu'elle est valide (option a).

## Contexte technique
- Dépend de S-4 : `CommitGraph` en lanes virtualisé, colonnes, `CommitNode` ; `crates/git/src/lib.rs` (lecture `gix`), `src-tauri/src/commands.rs`, contrat `pnpm gen:bindings`.
- Refs : branches locales, `origin/…` (même jamais récupérées localement), tags, stashes (`refs/stash` et son reflog) ; le crate `git` les lit, `app` les expose. Une ref désigne un commit ; plusieurs refs sur un commit se groupent dans la colonne des refs.
- Variantes `RefLabel` (`ux/ecrans/history.md`) : pleine (synchronisée), pleine avec anneau (en avance), pointillés (distante seule), tag ; le nom est toujours en texte (jamais la couleur seule). « Not published » (CA-11) et `PushButton` sont en S-20, pas ici.
- Avance / retard : la branche courante comparée à sa branche distante suivie (configuration de suivi du dépôt) ; deux nombres visibles sans survol. Branche courante sans suivi : rien n'est affiché ici (S-20).
- `BranchSidebar` : sections branches locales, `origin`, tags, stashes ; branche courante marquée. Le clic de sélection de la branche qui reçoit, le double-clic de checkout et les menus sont hors périmètre (S-25, S-36).
- `CommitDetail` à droite (`ux/ecrans/history.md`, maquette `ux/maquettes/history.html`) : message complet, auteur, date (relative et absolue comme en S-4), SHA complet, état signé / non signé, fichiers modifiés avec M / A / D en lettre ; variante merge pour un commit à plusieurs parents ; les boutons Checkout, Cherry-pick, Revert, Create branch here viennent avec leurs stories (S-26, S-35). Clic sur un fichier : `DiffView` (S-29), ici inerte.
- Fichiers modifiés d'un merge : liste par rapport au premier parent (choix d'implémentation, à noter dans le code).
- Fixtures : étendre `fixtures/branches.sh` ou ajouter un script (tags, stash, branche en avance / en retard d'un `origin` bare, branche seulement distante, commit de merge, commit signé) ; faux `ssh` non nécessaire.
- Styles : tokens de `src/lib/styles/tokens.css` seulement ; `ux.md` « Direction visuelle » (étiquette 5 px de rayon, nœud, fil des refs).

## Interface à vérifier
- **Écrans et états** : `History` avec `BranchSidebar` et colonne des refs (local synchronisée, en avance, distante seule, tag, stash), indicateur avance / retard 2 et 3, `CommitDetail` d'un commit ordinaire, signé, non signé et de merge
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] explorer-l-historique CA-7 → test Rust du crate `git` (branches, `origin/…`, tags, stashes lus avec le commit désigné) et e2e : chaque ref dans `BranchSidebar` et en `RefLabel` reliée au nœud
- [ ] explorer-l-historique CA-8 → test de composant : les quatre variantes de `RefLabel` (pleine, anneau, pointillés, tag), nom toujours en texte
- [ ] explorer-l-historique CA-10 → test Rust (avance 2, retard 3 sur un `origin` bare) et e2e : « 2 » et « 3 » visibles sans survol
- [ ] explorer-l-historique CA-24 → e2e : clic sur un commit, `CommitDetail` montre message, auteur, date, SHA, signé / non signé, fichiers avec M / A / D
- [ ] explorer-l-historique CA-25 → test de composant et e2e : commit de merge, variante merge

## Hors périmètre
- « Not published » et `PushButton` (S-20) ; fetch (S-6) ; ligne WIP (S-14).
- Checkout, création de branche, menus `RefContextMenu`, actions de `CommitDetail` (S-25, S-26, S-35, S-36).
- `DiffView` et clic sur un fichier (S-29).

## Documentation à mettre à jour
- aucune attendue ; vérifier que le README et `.env.example` reflètent l'état du projet (rattrapage éventuel).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : <à noter au début de la boucle>

| # | Agent | Résultat | Verdict |
|---|---|---|---|

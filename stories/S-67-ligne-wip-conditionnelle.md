# Story S-67 : Ligne WIP seulement s'il y a des changements

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-67-ligne-wip-conditionnelle.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-67 (tranche valeur 7 bis)
- Critères couverts : `specs/explorer-l-historique.md` CA-31, CA-32, CA-33, CA-34, CA-35 ; `specs/preparer-un-commit.md` CA-1, CA-2, CA-11 (évolutions)
- Jobs servis : J-1, J-2
- Revue renforcée : non

## Objectif
Évolution de S-14 : la ligne WIP n'existe que s'il y a des changements ; sur arbre propre, le dernier commit de la branche courante est sélectionné avec son `CommitDetail`, la ligne WIP revient en moins de 1 s sans changer la sélection, et disparaît (dernier commit sélectionné, après un Commit : le commit créé) quand l'arbre redevient propre ; pas d'Échap pour quitter WIP ; « Working tree clean. » seulement sur un dépôt sans commit.

## Critères d'acceptation
- **explorer-l-historique CA-31** : Étant donné un dépôt avec au moins un commit et un arbre de travail propre (aucun fichier modifié, indexé ou non suivi), quand il s'ouvre dans `History`, alors le graphe n'a pas de ligne WIP, le dernier commit de la branche courante est sélectionné et son `CommitDetail` occupe le panneau de droite (contenu propre au dernier commit : `specs/preparer-un-commit.md`).
- **explorer-l-historique CA-32** : Étant donné `History` sur un arbre propre avec un commit sélectionné, quand un fichier est modifié, y compris hors d'Octogit (éditeur, terminal), alors en moins de 1 s et sans geste de ma part la ligne WIP apparaît en tête du graphe avec son compte (« 1 changed file »), et la sélection et le contenu du panneau ne changent pas ; quand je clique ensuite sur la ligne WIP, alors `WorkingChanges` remplace `CommitDetail`.
- **explorer-l-historique CA-33** : Étant donné la ligne WIP sélectionnée, quand je fais Échap, alors la sélection reste sur la ligne WIP et `WorkingChanges` reste affiché ; quand je clique sur un commit, alors son `CommitDetail` s'affiche.
- **explorer-l-historique CA-34** : Étant donné un dépôt sans aucun commit, quand il s'ouvre dans `History`, alors le graphe ne contient que la ligne WIP.
- **explorer-l-historique CA-35** : Étant donné la ligne WIP sélectionnée, quand l'arbre de travail devient propre (Commit, Stash, Discard du dernier changement, ou changement fait hors d'Octogit), alors en moins de 1 s la ligne WIP disparaît du graphe, le dernier commit de la branche courante est sélectionné et son `CommitDetail` occupe le panneau ; après un Commit, ce commit sélectionné est celui qui vient d'être créé.
- **preparer-un-commit CA-1** (modifié le 18/11/2026) : Étant donné un dépôt avec 3 fichiers modifiés, quand il s'ouvre dans `History`, alors la ligne WIP est en tête du graphe, sélectionnée, porte « 3 changed files », et `WorkingChanges` s'affiche à droite. Sur un arbre propre, il n'y a pas de ligne WIP et le dernier commit est sélectionné (`specs/explorer-l-historique.md`, CA-31).
- **preparer-un-commit CA-2** (modifié le 18/11/2026) : Étant donné au moins un changement dans l'arbre de travail et un autre commit sélectionné, quand je clique sur la ligne WIP, alors `WorkingChanges` remplace `CommitDetail` (retour de la ligne WIP quand un changement apparaît : `specs/explorer-l-historique.md`, CA-32).
- **preparer-un-commit CA-11** (modifié le 18/11/2026) : Étant donné un arbre de travail propre, alors Stash est désactivé. Étant donné un dépôt sans aucun commit et un arbre propre, alors la ligne WIP, seule ligne du graphe (`specs/explorer-l-historique.md`, CA-34), est sélectionnée et `WorkingChanges` affiche « Working tree clean. » avec Commit désactivé. Étant donné un dépôt avec au moins un commit, quand l'arbre devient propre avec la ligne WIP sélectionnée, alors en moins de 1 s `WorkingChanges` laisse la place au `CommitDetail` du dernier commit (`specs/explorer-l-historique.md`, CA-35).

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, dépôts d'exemple)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css` (écrit à partir de `ux/tokens.md`)
- Conventions : composants Svelte en `PascalCase` au nom de `ux.md` dans `src/lib/components/`, écrans dans `src/lib/screens/` ; CSS natif, couleurs par tokens seulement ; `snake_case` en Rust, `camelCase` en TypeScript ; commandes et événements Tauri sans logique dans `src-tauri` ; événements typés tauri-specta ; détection des changements par `notify` dans le crate `git` ; interface en anglais ; lint, texte ≥ 12 px, focus visible, jamais la couleur seule.

## Contexte technique
- `stack.md` : Architecture (détection `notify` citée pour la ligne WIP, CA-32 et CA-35, sans changement technique ; lecture par `gix`), Contrat (`pnpm gen:bindings`), Tests ciblés.
- Interface, existant livré par S-14 et S-15 :
  - `src/lib/screens/History.svelte` : `wipSelected` (vrai par défaut), `selected`, `detail`, `selectWip()`, `select(id)`, `changedFiles` (nombre de fichiers distincts de `workingTree`, `null` tant que non lu), `$effect.pre` sur `openId` qui appelle `selectWip()` à chaque ouverture ; panneau de droite : `WorkingChanges` si `wipSelected`, sinon `CommitDetail`. À faire évoluer : sélection initiale selon l'arbre (propre et au moins un commit : dernier commit de la branche courante, `repository.refs` entrée `kind === "branch" && current`, son `target`) ; attention : `workingTree` est `null` avant la première lecture, ne pas faire clignoter la ligne WIP ni le panneau pendant ce temps (le panneau réserve sa place, voir le commentaire existant) ; ligne WIP et panneau suivent `changedFiles` ; arbre propre avec WIP sélectionné : bascule sur le dernier commit (après un Commit : le commit créé, qui est le nouveau dernier de la branche courante dans `repository` rendu par `commit` de `App.svelte`) ; changement apparu avec un commit sélectionné : la sélection et le panneau ne bougent pas.
  - `src/lib/components/CommitGraph.svelte` : prop `wip` (`{ count } | null`), `wipSelected`, `onselectwip`, ligne `.row.wip` (rendue si `wip`), `wipLabel` (« No changes » quand `count === 0` : à retirer, la ligne n'existe plus alors), nœud WIP sur la lane de HEAD ; dépôt sans commit : la ligne WIP reste seule (CA-34).
  - `src/lib/components/WorkingChanges.svelte` : état propre « Working tree clean. » (lignes 46, 141-143), à réserver au dépôt sans commit ; Commit désactivé.
  - `src/lib/components/CommitDetail.svelte` : panneau du dernier commit (le formulaire d'Amend est S-68, hors de cette story).
  - `src/App.svelte` : `workingTree` lu à l'ouverture et mis à jour par l'événement typé `events.workingTreeChanged` (lignes 114-146) ; `commit()` (ligne 157) remplace `workingTree` et `screen.repository` par ce que rend le cœur ; `moveAll`. Les autres chemins qui relisent l'arbre (lignes ~567, ~660, ~725) passent par `workingTree`.
  - Échap : aucun raccourci Échap ne quitte WIP aujourd'hui dans `History.svelte` (aucune occurrence) ; le garantir par un test (CA-33). L'Échap de `DiffView` (retour avec la ligne WIP sélectionnée, `preparer-un-commit` CA-9) n'est pas touché.
- Cœur : la surveillance et l'événement `working-tree-changed` existent (`crates/git/src/lib.rs`, `src-tauri/src/working_tree.rs`, `crates/git/tests/working_tree.rs`) et émettent déjà quand la liste des fichiers change ; ne les modifier que si un test montre qu'un cas de CA-32 ou CA-35 (arbre redevenu propre, fichier non suivi seul) n'est pas signalé en moins de 1 s.
- Pont de test : `src/web-bridge.ts` (flux SSE `working-tree-changed`) et `e2e/helpers.ts` ; fixtures : `fixtures/wip.sh` (3 fichiers modifiés), `fixtures/simple.sh` (dépôt propre, vérifier), `fixtures/empty.sh` (sans commit).
- Tests existants à mettre à jour : `src/lib/screens/History.test.ts` (25 occurrences WIP), `src/lib/components/WorkingChanges.test.ts`, `src/lib/components/CommitNode.test.ts`, `e2e/working-changes.spec.ts` (ouverture sur dépôts `wip`, `simple`, `empty` ; l'e2e CA-11 « arbre propre » actuel devient « dépôt sans commit »), `e2e/commit.spec.ts` (après Commit, arbre propre : plus de ligne WIP, nouveau commit sélectionné), et tout e2e qui compte sur la ligne WIP à l'ouverture d'un dépôt propre (Grep `data-wip` dans `e2e/`).
- Écrans : `ux/ecrans/history.md` (ligne « Arbre propre », composants `CommitGraph` WIP, `WorkingChanges` propre, `CommitDetail`), maquette `ux/maquettes/history.html` (section 2 « No changes »), « Direction visuelle » de `ux.md`, tokens dans `src/lib/styles/tokens.css`.
- Reports : aucun point « reporter vers S-67 » dans les fiches existantes.

## Interface à vérifier
- **Écrans et états** : `History` : arbre propre (pas de ligne WIP, dernier commit sélectionné, `CommitDetail` à droite) · ligne WIP apparue avec un commit sélectionné (sélection et panneau inchangés) · ligne WIP sélectionnée avec `WorkingChanges` (3 fichiers) · arbre redevenu propre depuis WIP (dernier commit sélectionné) · dépôt sans commit (ligne WIP seule, « Working tree clean. »)
- **Tailles d'écran** : 1 500×900 (portable, plein écran), 1 280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] explorer-l-historique CA-31 → test composant `History` (arbre propre et commits : pas de ligne WIP, dernier commit de la branche courante sélectionné, `CommitDetail` affiché) ; e2e sur un dépôt propre
- [ ] explorer-l-historique CA-32 → test composant (changement apparu : ligne WIP avec « 1 changed file », sélection et panneau inchangés, clic WIP : `WorkingChanges`) ; e2e : fichier modifié hors d'Octogit, ligne WIP en moins de 1 s sans changer la sélection
- [ ] explorer-l-historique CA-33 → test composant et e2e : Échap avec WIP sélectionné, sélection et `WorkingChanges` inchangés ; clic sur un commit : son `CommitDetail`
- [ ] explorer-l-historique CA-34 → test composant et e2e : dépôt sans commit, graphe réduit à la ligne WIP
- [ ] explorer-l-historique CA-35 → test composant (arbre qui devient propre avec WIP sélectionné : ligne WIP retirée, dernier commit sélectionné) ; e2e : Commit des fichiers indexés (commit créé sélectionné) et changement externe qui annule les modifications (moins de 1 s) ; Stash et Discard : cas testés par S-32 et S-31 quand ils existeront, la logique repose sur le seul état de l'arbre
- [ ] preparer-un-commit CA-1 → e2e : 3 fichiers modifiés : ligne WIP en tête, sélectionnée, « 3 changed files », `WorkingChanges` ; arbre propre : pas de ligne WIP
- [ ] preparer-un-commit CA-2 → e2e : dernier commit sélectionné avec changements, clic sur WIP : `WorkingChanges` remplace `CommitDetail`
- [ ] preparer-un-commit CA-11 → test composant `WorkingChanges` et e2e : « Working tree clean. » et Commit désactivé seulement sur un dépôt sans commit ; sur un dépôt avec commit, arbre redevenu propre : `CommitDetail` du dernier commit en moins de 1 s ; Stash désactivé sur arbre propre : sans objet tant que `StashButtons` n'existe pas (S-32)

## Hors périmètre
- Formulaire d'amend (Summary, Description, « Amend <sha> », ligne d'identité) dans `CommitDetail` : S-68.
- `StashButtons`, Pop, Apply, Drop (S-32) ; Discard changes et indexation par fichier, bloc ou ligne (S-31).
- Colonne du graphe, en-tête « Graph », infobulle de l'auteur (S-69).
- Tout changement du cœur de surveillance qui ne soit pas rendu nécessaire par un test rouge.

## Documentation à mettre à jour
- README, ligne « La ligne WIP … » de la section `History` (ligne 41) : la ligne WIP n'existe que s'il y a des changements ; arbre propre : dernier commit sélectionné avec son `CommitDetail`, « No changes » retiré ; elle revient en moins de 1 s sans changer la sélection ; elle disparaît quand l'arbre redevient propre (dernier commit ou commit créé sélectionné) ; pas d'Échap pour quitter WIP ; « Working tree clean. » seulement sur un dépôt sans commit.
- README, fixtures : indiquer le dépôt propre utilisé pour l'arbre propre si une fixture est ajoutée (sinon aucune).
- `.env.example` : aucune variable ajoutée ; rattrapage : rien constaté, il reflète l'état actuel.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `43bbecd`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : 8 fichiers, tests et e2e verts, rouge non constaté | — |
| 2 | reviewer | revue 1 : 1 bloquant (aucun test ne distingue la branche courante de `commits[0]`) ; e2e instables hors story (badge-menu CA-11, refs-column CA-18) | à corriger |
| 3 | dev | passage 2 : 2 tests discriminants (branche courante vs `commits[0]`), rouge constaté ; tests, lint, build, e2e 272/272 verts | — |
| 4 | reviewer | revue 2 : aucun problème, interface conforme aux deux tailles | validé |

## Décisions de l'humain

### Après la revue 2
- Libellé de la ligne WIP tronqué au 1 280×720 (« 3 change… ») : pris en compte (pour information), non introduit par la story, peut-être résolu par S-69.
- e2e instables `badge-menu` CA-11 et `refs-column` CA-18 dans un `pnpm e2e` complet : pris en compte (pour information), à surveiller.

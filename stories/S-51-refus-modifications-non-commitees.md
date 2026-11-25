# Story S-51 : Refuser checkout, merge, rebase, rebase interactif, cherry-pick, revert et pull face à des modifications non commitées

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-51-refus-modifications-non-commitees.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-51 (tranche durcissement) ; dépend de S-50 (sa fiche existe, non livrée au moment de cette fiche : ne pas démarrer avant)
- Critères couverts : `gerer-les-branches` CA-6 ; `integrer-une-branche` CA-12 ; `revenir-en-arriere` CA-7 ; `synchroniser` CA-9 ; `nettoyer-une-branche` CA-11 (specs validées par l'humain)
- Jobs servis : J-3, J-6, J-7, J-8, J-16
- Revue renforcée : non

## Objectif
Avec des modifications non commitées (indexées ou non), le checkout (tous gestes), le merge, le rebase, le rebase interactif, le cherry-pick, le revert et le pull sont refusés par le cœur avec le message exact de la spec, sans rien changer (branches, index, arbre de travail).

## Critères d'acceptation
- **gerer-les-branches CA-6** : Étant donné des modifications non commitées qu'un checkout écraserait, quand je le lance par n'importe quel geste, y compris via « Create branch here », alors il est refusé avec « Commit or stash your changes before switching branches. » ; aucune branche n'est créée ni déplacée, la branche courante, l'index et l'arbre de travail ne changent pas.
- **integrer-une-branche CA-12** (modifié le 07/11/2026) : Étant donné des modifications non commitées, indexées ou non, quand je lance un merge ou un rebase, alors il est refusé avec « Commit or stash your changes before merging. » (merge) ou « Commit or stash your changes before rebasing. » (rebase) ; aucun checkout n'a eu lieu ; branches, index et arbre de travail ne changent pas.
- **revenir-en-arriere CA-7** (modifié le 07/11/2026) : Étant donné des modifications non commitées, indexées ou non, quand je lance un cherry-pick, alors il est refusé avec « Commit or stash your changes before cherry-picking. » ; quand je lance un revert, alors il est refusé avec « Commit or stash your changes before reverting. » ; branches, index et arbre de travail ne changent pas.
- **synchroniser CA-9** : Étant donné des modifications non commitées, indexées ou non, quand je lance un Pull (fast-forward only ou rebase), alors il est refusé avec « Commit or stash your changes before pulling. ». La branche, l'index et l'arbre de travail ne changent pas.
- **nettoyer-une-branche CA-11** : Étant donné des modifications non commitées, quand je clique sur Start rebase, alors le rebase est refusé avec un message qui le dit ; `git log`, les branches, l'index et l'arbre de travail sont inchangés.

## Décisions de l'humain
### Fiche (à remplir)
1. Fichiers non suivis (untracked) : a) seuls les fichiers suivis comptent, indexés ou non (recommandation retenue par l'humain, 25/11/2026)

### Après la revue 1
- Mineur 1 (`fetch.rs` : message « switching branches » posé sur tout échec avec modifications) : traiter (d'office). Le refus ne doit couvrir que le cas « écraserait » ; la détection ne doit pas dépendre de la langue de Git.
- Mineur 2 (règle `dirty` dupliquée côté interface) : pris en compte (pour information) ; aucun changement exigé.
- Mineur 3 (README : pas de checkout avant merge/rebase avec arbre modifié) : traiter (d'office), une phrase.

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple versionnés ; port et données par `.env.local` en worktree)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings`, jamais édité à la main (seulement si une signature de commande change : aucune attendue)
- Tokens de style : `src/lib/styles/tokens.css` (aucune couleur en dur)
- Conventions : écritures de Git par le binaire `git` en sous-processus, jamais `~/.gitconfig` ; crate `app` sans logique hors garde ; contrat par `tauri-specta` ; `snake_case` en Rust, `camelCase` en TypeScript, composants en `PascalCase` au nom exact de `ux.md` ; interface en anglais ; aucun appel réseau réel en test (`origin` = dépôts `--bare` par chemin, faux `ssh`) ; travail direct sur `main`, aucun push sans validation humaine ; Conventional Commits en anglais

## Contexte technique
- Le refus vit dans le cœur, jamais seulement dans l'interface, et se joue avant tout sous-processus qui écrit. Aujourd'hui aucune commande ne porte les textes « Commit or stash… » (hors « fixing commit identity », `crates/git/src/rewrite.rs` l. 25-41 et 212) : Git refuse parfois de lui-même (message brut) ou laisse passer un merge, un pull ou un cherry-pick qui ne touche pas les fichiers modifiés. Il faut un refus systématique pour merge, rebase, interactive rebase, cherry-pick, revert, pull ; et pour le checkout seulement quand Git écraserait des modifications (CA-6 : « qu'un checkout écraserait »), sans jamais bloquer un checkout que Git accepte en emportant les modifications.
- Modèle de détection : `git status --porcelain --untracked-files=no` (`crates/git/src/rewrite.rs` l. 212). Ajouter une lecture partagée dans le crate `git` (fonction unique « modifications non commitées », réutilisée par toutes les commandes ; sa portée sur les fichiers non suivis dépend de la décision 1) plutôt que la copier.
- Points d'entrée Rust, à garder dans l'ordre déjà posé par S-50 (« Operation in progress. », puis identité `crate::attach::ensure_conform`, puis ce refus) :
  - `src-tauri/src/working_tree.rs` : `merge_checked` (l. 356), `rebase_checked` (l. 391), `cherry_pick_checked` (l. 259), `revert_checked` (l. 271), « Already up to date. » reste prioritaire seulement quand l'arbre est propre.
  - `src-tauri/src/fetch.rs` : `pull_repository` (l. 33, refus avant `octogit_git::pull`), `checkout_repository` (l. 94, mapper l'échec « écraserait » de Git, y compris via `plan_checkout` / `octogit_git::checkout`, `crates/git/src/checkout.rs` l. 154 et 174, sur « … before switching branches. » via `checkout_message` l. 133), `create_branch_repository` (l. 167, « Create branch here » : même message, `crates/git/src/branch.rs` l. 363).
  - `src-tauri/src/rebase_plan.rs` (`start_rebase` l. 55) : refus avec « Commit or stash your changes before rebasing. » avant de lancer Git ; le test existant `crates/git/tests/interactive_rebase.rs` l. 429-447 attend aujourd'hui « unstaged changes » (sortie brute de Git) : l'adapter.
  - `src-tauri/src/commands.rs` : `start_interactive_rebase` l. 436, `cherry_pick` l. 600, `revert` l. 617, `merge_branch` l. 636, `rebase_branch` l. 833, `pull_repository` l. 983, `checkout_repository` l. 994, `create_branch_repository` l. 1023 ; les commandes passent déjà `Store` et `home` pour l'identité.
- Message d'une ligne, texte exact de la spec ; rien n'a changé après un refus. Ne pas reprendre les textes génériques de S-25, S-26, S-36, S-37, S-43 : S-51 les remplace pour ces cas ; les autres erreurs de Git restent génériques (« Details » : S-53). Rebase interactif : le texte n'est pas fixé par la spec, reprendre « Commit or stash your changes before rebasing. ».
- Interface : le refus s'affiche déjà en une ligne là où l'opération est lancée : merge / rebase par `integrate` (`src/App.svelte` l. 1079, notice d'erreur de `src/lib/screens/History.svelte` l. 846), checkout par `Toolbar` / `BranchSidebar` / `CommitGraph` (état « checkout refusé », `ux/ecrans/communs.md`), pull par `SyncButton` (état « refusé », `ux/ecrans/history.md`), cherry-pick et revert par `RefContextMenu` / `CommitDetail`, Start rebase par `InteractiveRebase`. Vérifier que le texte du cœur y est rendu tel quel, sans le remplacer par un message générique ; aucune entrée n'est désactivée pour cette cause. Pas de nouvelle commande, pas de changement de contrat.
- Report de revue pris en compte (S-35, revues 1 et 2) : `git cherry-pick --abort` après un conflit sur un dépôt avec modifications non commitées ne peut plus arriver, puisque le cherry-pick est refusé en amont.
- Modèles de tests : `src-tauri/tests/integrate_guard.rs`, `cherry_pick_guard.rs`, `commit_guard.rs`, `fix_commit_identity.rs` (cas « dirty », l. 179) ; `e2e/checkout.spec.ts` (cas modifié, l. 304), `e2e/fix-commit-identity.spec.ts` ; fixtures `fixtures/refs.sh`, `push.sh` (dépôt à `origin` bare).
- Textes de référence : `ux/ecrans/history.md` (« Messages », `SyncButton` refusé), `ux/ecrans/communs.md` (`Toolbar` : checkout refusé), maquette `ux/maquettes/history.html` (sections avec « Commit or stash… » l. 463 et 518).

## Interface à vérifier
- **Écrans et états** : `History` avec une modification non commitée : checkout par double-clic, par sélecteur de la `Toolbar` et par « Create branch here » (modification écrasée) ; merge et rebase depuis `RefContextMenu` ; cherry-pick et revert (menu et `CommitDetail`) ; Pull ff-only et rebase de `SyncButton` ; Start rebase de `InteractiveRebase` : chaque refus montre le texte exact en une ligne et rien ne change dans le graphe ni dans `WorkingChanges`
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`, port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] gerer-les-branches CA-6 → Rust (`src-tauri/tests/`, voisin de `integrate_guard.rs`) : une modification que le checkout écraserait, par `checkout_repository` et par `create_branch_repository` : « Commit or stash your changes before switching branches. », branche courante, index, arbre et branches inchangés ; une modification que le checkout n'écrase pas reste permise ; e2e (`e2e/checkout.spec.ts`) : double-clic sur une branche
- [ ] integrer-une-branche CA-12 → Rust : modification indexée, puis non indexée, `merge_checked` et `rebase_checked` répondent « …merging. » / « …rebasing. », `git rev-parse HEAD`, branches, index et arbre inchangés, aucun checkout ; Vitest ou e2e : le texte s'affiche près de l'en-tête
- [ ] revenir-en-arriere CA-7 → Rust : modification indexée, puis non indexée, `cherry_pick_checked` et `revert_checked` refusés avec leur texte, aucune opération en cours (`read_operation` vide), HEAD et arbre inchangés ; e2e
- [ ] synchroniser CA-9 → Rust (dépôt à `origin` bare en avance) : Pull ff-only et rebase refusés avec « …pulling. », branche, index, arbre et `origin` inchangés ; Vitest `SyncButton` : le refus s'affiche tel quel ; e2e
- [ ] nettoyer-une-branche CA-11 → Rust : `start_rebase` refusé sans lancer Git (message « …rebasing. »), `git log`, branches, index, arbre inchangés, aucune opération laissée ; adapter `crates/git/tests/interactive_rebase.rs` l. 429-447 ; e2e : Start rebase avec une modification
- [ ] Décision 1 → test selon la réponse (fichier non suivi seul : refus ou passage)

## Hors périmètre
- Désactivation des gestes pendant une opération en cours et refus d'identité (S-50) ; HEAD détachée, commit racine, plage avec merge, commit de merge, cherry-pick sans changement (S-52) ; « Details » et textes d'erreur de Git autres que ceux-ci (S-53) ; réseau coupé et boutons occupés (S-55) ; accès clavier complet (S-56).
- Stash, Pop, Apply, Reset (Soft, Mixed, Hard), push, Fetch All : aucun refus ajouté (Reset Hard a sa propre confirmation).
- Aucune désactivation d'entrée ou de bouton pour cette cause : le refus est un message après le geste.
- Aucun changement de signature ou de contrat de commande.

## Documentation à mettre à jour
- README, section « Graphe de `History` » (lignes 62 à 75 et la zone de `SyncButton`, l. 92-94) : retirer les mentions qui renvoient à S-51 (textes génériques d'un refus de Git, avant cette story) et décrire l'état livré : refus avec les textes exacts, sans rien changer, pour checkout, merge, rebase, rebase interactif, cherry-pick, revert et pull.
- `.env.example` : aucun changement. Rattrapage : aucun retard constaté connu ; vérifier README et `.env.example` contre l'état du projet à la livraison de S-49 et de S-50.

## Terminé quand
- [ ] À chaque passage de `dev` : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm tauri build`, plus les e2e liés au diff par « Tests ciblés » (`pnpm e2e <fichier>`)
- [ ] Avant le commit, une fois, par l'agent story-runner : `pnpm e2e` ; `pnpm audit:deps` seulement si `pnpm-lock.yaml` ou `Cargo.lock` a changé depuis la Référence
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `ed875c7`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (tests, lint, build, e2e liés ✅) ; écarts : saut du checkout avant merge/rebase (option `dirty` de `runIntegrate`), refus checkout posé sur `Failed` + modifications | — |
| 1 | reviewer | revue 1 : 3 mineurs, 0 bloquant (`stories/S-51-revue-1.md`) | validé |
| 2 | dev | terminé (tests, lint, build, e2e liés ✅) ; mineurs 1 et 3 traités ; `LC_ALL=C` dans `run` de `crates/git/src/fetch.rs` | — |
| 2 | reviewer | revue 2 : mineurs 1 et 3 levés, 2 inchangé (pour information) (`stories/S-51-revue-2.md`) | validé |
| fin | story-runner | run de fin : `pnpm e2e` (491 tests) vert ; `pnpm audit:deps` non lancé (aucun verrou changé depuis la référence) | — |

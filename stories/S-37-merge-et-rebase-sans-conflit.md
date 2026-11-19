# Story S-37 : Exécuter merge (toujours avec commit de merge) et rebase sans conflit, « Already up to date. », rien de poussé

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-37-merge-et-rebase-sans-conflit.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-37 (tranche valeur 10) ; dépend de S-36 (menu, checkout de la branche qui reçoit, point d'accroche `integrate`) et de S-24 (`PushButton` « Force push »)
- Critères couverts : `integrer-une-branche` CA-6, CA-7, CA-8, CA-9, CA-10, CA-11, CA-16 ; dernière phrase de CA-4 (rejeu des commits au-dessus d'un commit sans branche, laissée à cette story par S-36) (`specs/integrer-une-branche.md`, validée le 07/11/2026)
- Jobs servis : J-6
- Revue renforcée : non

## Objectif
Choisir « Merge <source> into <reçoit> » ou « Rebase <reçoit> onto <source> » dans `RefContextMenu` exécute l'opération tout de suite, sans dialogue : merge toujours avec commit de merge, rebase qui rejoue les commits, « Already up to date. » quand il n'y a rien à faire, rien de poussé.

## Critères d'acceptation
- **integrer-une-branche CA-4 (dernière phrase)** : Quand je choisis « Rebase feature/profiles onto c41d8e0 » (commit sans branche), alors les commits de `feature/profiles` absents de `c41d8e0` sont rejoués au-dessus de ce commit.
- **integrer-une-branche CA-6** : Étant donné `develop` et `feature/profiles` divergées, sans conflit, quand je choisis « Merge develop into feature/profiles », alors, sans dialogue ni confirmation, `feature/profiles` pointe sur un nouveau commit de merge dont les parents sont l'ancien sommet de `feature/profiles` puis celui de `develop`, et dont le message est « Merge branch 'develop' into feature/profiles » ; `develop` ne bouge pas ; le graphe l'affiche aussitôt.
- **integrer-une-branche CA-7** : Étant donné `feature/profiles` ancêtre de `develop`, quand je choisis « Merge develop into feature/profiles », alors un commit de merge est créé comme en CA-6 ; `feature/profiles` n'est jamais avancée sans commit de merge.
- **integrer-une-branche CA-8** : Étant donné le commit de merge de CA-6 ou CA-7, alors son auteur et son committer sont l'identité du profil du dépôt et il est signé si ce profil signe ; `git log -1` le confirme dans le terminal.
- **integrer-une-branche CA-9** : Étant donné `feature/profiles` en avance de 2 commits sur leur ancêtre commun avec `develop`, sans conflit, quand je choisis « Rebase feature/profiles onto develop », alors, sans dialogue ni confirmation, les 2 commits sont rejoués au-dessus de `develop`, gardent leur message et leur auteur, et `feature/profiles` a un historique linéaire depuis `develop` ; `develop` ne bouge pas.
- **integrer-une-branche CA-10** : Étant donné des commits de `feature/profiles` déjà poussés, quand le rebase de CA-9 se termine, alors `PushButton` affiche « Force push » (`specs/synchroniser.md`, CA-16) ; rien n'est poussé.
- **integrer-une-branche CA-11** : Étant donné une branche qui reçoit déjà à jour (`develop` déjà contenue dans `feature/profiles` pour un merge, ou `feature/profiles` déjà au-dessus de `develop` pour un rebase), quand je lance l'opération, alors « Already up to date. » s'affiche ; aucun commit n'est créé ; branches, index et arbre de travail ne changent pas.
- **integrer-une-branche CA-16** : Étant donné un merge ou un rebase terminé, alors aucune branche distante n'a changé et rien n'a été poussé.

## Décisions de l'humain
### Fiche (19/11/2026)
1. Conflit pendant un merge ou un rebase avant S-39 et S-40 : 1a (annulé par `git merge --abort` ou `git rebase --abort`, dépôt inchangé, refus en une ligne avec « Details »)
2. Contrôle d'identité dès cette story : 2a (oui, `ensure_conform` comme Cherry-pick de S-35, refus en une ligne)

### Après la revue 1
- Bloquant 1 (e2e CA-11 et décision 1, alerte périmée) : traiter (passage 2).
- Mineur 2 / à décider « Already up to date. » en rouge : traiter (d'office) : style neutre de la maquette `history.html:519`, `ux/ecrans/history.md` « Messages » fait foi.
### Après la revue 2
- Pour information : README relu, texte correct : pris en compte (pour information).
- E2E instables refs-column CA-18 et graph-width CA-13 : hors périmètre, passent en ciblé (d'office : non traité).

### Après la revue 1 (suite)
- Pour information : `src/web-bridge.ts` et `e2e/helpers.ts` sans changement nécessaire : pris en compte (pour information).

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css`
- Conventions : binaire `git` en sous-processus pour toute écriture (merge et rebase dans le crate `git`, sortie brute gardée pour « Details ») ; identité et signature lues par `git` dans le `.git/config` local, rien dans `~/.gitconfig` ; commandes et événements Tauri dans `src-tauri/src` sans logique ; `snake_case` en Rust, `camelCase` en TypeScript, composants Svelte en `PascalCase` au nom exact de `ux.md` ; CSS natif, couleurs par tokens seulement ; interface en anglais ; Conventional Commits en anglais

## Contexte technique
- Dépend de S-36 (`stories/S-36-menu-merge-et-rebase.md`, pas encore livrée à la rédaction) : relire le code livré avant de coder. S-36 ajoute à `RefContextMenu` les entrées et les rappels `onmerge(source, receiving)` / `onrebase(onto, receiving)`, la sélection dans `App.svelte`, le checkout de la branche qui reçoit (si elle n'est pas courante) puis l'appel d'un point d'accroche vide `integrate(kind, source, receiving)` : S-37 le remplit. Aucune commande merge ou rebase n'existe avant cette story. Un checkout refusé ou à confirmer arrête S-36 avant `integrate` : rien à refaire ici.
- Dépend de S-24 : `crates/git/src/force_push.rs` (`read_rewrite`) détecte déjà une réécriture par le reflog de `refs/heads/<branche>` (le rebase l'alimente) et `PushButton.svelte` affiche « Force push » : CA-10 doit passer sans changer ce code ; l'écrire seulement s'il manque un cas (reflog d'un rebase).
- Rust, crate `git` : nouveau module `crates/git/src/integrate.rs` (déclaré dans `crates/git/src/lib.rs`, `mod` et `pub use`), sur le modèle de `crates/git/src/cherry_pick.rs` (fonction `run` : `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, stdin nul, `HOME` optionnel pour les tests ; `check_commit` : rien qui ressemble à une option ; rend `WorkingTree` par `read_working_tree` puis `remember`). Les gestes agissent sur la branche courante :
  - `merge(path, source)` : `git merge --no-ff --no-edit <source>` (message par défaut de Git, jamais de fast-forward, CA-7). `source` = branche locale ou `origin/…`.
  - `rebase(path, onto)` : `git rebase <onto>` ; `onto` = branche locale, `origin/…` ou SHA de commit (CA-4). Éditeur jamais ouvert (`GIT_EDITOR=true`, `GIT_SEQUENCE_EDITOR=true`), jamais de `-i`.
  - « Already up to date. » (CA-11) : détecté avant d'écrire par `git merge-base --is-ancestor <source> HEAD` (merge) et `git merge-base --is-ancestor <onto> HEAD` (rebase) ; rend un refus en une ligne « Already up to date. », rien n'est écrit (aucun commit, branches, index et arbre inchangés). Le rendre par une valeur typée distincte d'une erreur Git si c'est plus lisible, au choix de dev.
  - Vérifier que la branche courante est bien la branche qui reçoit (nom passé par l'appelant) ; sinon refuser sans rien écrire.
  - Conflit : voir décision 1 (rien n'est laissé en cours dans l'option proposée ; `git merge --abort` / `git rebase --abort`).
  - Aucune ref distante n'est écrite et aucun `push` n'est lancé (CA-16) ; `develop` (la source) ne bouge pas.
  - Tests : `crates/git/tests/integrate.rs` (modèles : `crates/git/tests/cherry_pick.rs`, `commit.rs`), dépôts temporaires, `user.name` / `user.email` du profil différents des auteurs des commits rejoués (CA-8, CA-9 : auteur d'origine gardé par le rebase), signature si le profil signe.
- Rust, crate `app` : `src-tauri/src/working_tree.rs` (modèle : `cherry_pick_checked` avec `crate::attach::ensure_conform(store, path, home)` selon la décision 2, puis `committed(path, tree)` qui rend `CommittedView`), `src-tauri/src/commands.rs` (modèle : `cherry_pick`), `src-tauri/src/lib.rs` (enregistrement) ; deux commandes `merge_branch` et `rebase_branch` (noms au choix de dev), puis `pnpm gen:bindings`. `src-tauri/examples/octogit-bridge.rs` : les enregistrer dans le pont de test (modèle : `"cherry_pick" | "revert"`, ligne ~619). Pas de logique dans `app` hors garde d'identité et appel au crate `git`. Tests : `src-tauri/tests/` (modèle : `cherry_pick_guard.rs`).
- Interface, `src/App.svelte` : remplir `integrate(kind, source, receiving)` (point d'accroche de S-36) sur le modèle de `pickFromMenu` / `runStash` (~lignes 734 à 810 : garde « un seul geste à la fois » par `checkoutPath` et `runFetchNow`, `applyCommitted` pour remplacer `screen` par le dépôt relu sans changer d'écran, `checkoutNotice` pour une ligne de refus ou « Already up to date. »). Après le merge ou le rebase, le graphe se met à jour tout de suite. Si la sélection de la branche qui reçoit est effacée ou gardée après l'opération, suivre la réponse de l'humain à la question 1 de S-36 (en attente à la rédaction) : tester l'état de la sélection selon cette réponse.
- Pont de test et e2e : `src/web-bridge.ts`, `e2e/helpers.ts` (ajouter les commandes) ; nouveau `e2e/integrate.spec.ts` (modèles : `e2e/cherry-pick.spec.ts`, `e2e/push.spec.ts` pour `PushButton` après réécriture). Fixtures : `fixtures/branches.sh` (branches `develop`, `feature/…`), `fixtures/refs.sh` (`origin` bare, `origin/…`), `fixtures/force-push.sh` (commits poussés, `origin` bare) et `fixtures/lib.sh` ; les cas « divergées », « ancêtre de `develop` », « déjà à jour », « 2 commits en avance » se fabriquent dans le test, sinon nouveau script `fixtures/integrate.sh` documenté au README (celui de S-36, s'il existe, est à réutiliser). Aucun appel réseau réel.
- Interface : `ux/ecrans/history.md` (« Entrées de `RefContextMenu` » › Branche ou `origin/…` source : merge toujours avec commit de merge, message par défaut de Git, sans édition ; « Messages » : « Already up to date. » ; composant `PushButton` : « Force push ») ; maquette `ux/maquettes/history.html`, sections 3 (« Push after rewrite → Force push ») et 6 ; « Direction visuelle » de `ux.md` (« Neon »), couleurs par tokens seulement. Aucun nouvel écran ni composant : seul l'effet visible change (graphe mis à jour, ligne de notice).
- Reports : aucun point « reporter vers S-37 » dans les fiches existantes (à relire par Grep dans `stories/` avant de coder).

## Interface à vérifier
- **Écrans et états** : `History` : après « Merge develop into feature/profiles » (commit de merge à deux parents en tête du graphe, sans changer d'écran) · après le merge d'une branche ancêtre (commit de merge quand même) · après « Rebase feature/profiles onto develop » (historique linéaire) · après « Rebase … onto <sha7> » · « Already up to date. » (une ligne, rien ne bouge) · `PushButton` « Force push » après un rebase de commits poussés · branche qui reçoit non courante : courante après l'opération
- **Tailles d'écran** : 1500×900 (portable, plein écran), 1280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] integrer-une-branche CA-6 → test Rust du crate `git` : branches divergées sans conflit, `merge` : parents (ancien sommet puis sommet de la source), message « Merge branch 'develop' into feature/profiles », source inchangée ; e2e : choix de l'entrée, `git log --format=%P -1` à deux parents, graphe mis à jour, aucun dialogue
- [ ] integrer-une-branche CA-7 → test Rust : branche ancêtre de la source : commit de merge créé (jamais de fast-forward) ; e2e idem
- [ ] integrer-une-branche CA-8 → test Rust : auteur et committer = identité locale du dépôt, signature présente si la config locale signe ; e2e : `git log -1 --format=fuller`
- [ ] integrer-une-branche CA-9 → test Rust : 2 commits en avance, `rebase` sur une branche locale : commits rejoués au-dessus de la source, messages et auteurs gardés, historique linéaire, source inchangée ; sur une `origin/…` ; e2e idem
- [ ] integrer-une-branche CA-4 (dernière phrase) → test Rust : `rebase` sur un SHA de commit sans branche : les commits absents de ce commit sont rejoués dessus ; e2e : clic droit sur un commit sans branche, « Rebase … onto <sha7> », `git log` linéaire au-dessus du commit
- [ ] integrer-une-branche CA-10 → e2e : commits de `feature/profiles` poussés sur l'`origin` bare, rebase, `PushButton` affiche « Force push », branche du bare inchangée
- [ ] integrer-une-branche CA-11 → test Rust : merge de la source déjà contenue, rebase sur une branche déjà en dessous : refus « Already up to date. », mêmes SHA de branches, index et arbre inchangés, aucun commit ; test de composant ou App : la ligne s'affiche ; e2e
- [ ] integrer-une-branche CA-16 → test Rust : après merge puis rebase, refs `origin/…` et branches du bare identiques à avant, aucun `push` lancé ; e2e : `git rev-parse` des branches du bare inchangé
- [ ] Décision 1 → test Rust et e2e selon la réponse (conflit : dépôt inchangé et refus en une ligne, ou opération laissée en cours) ; décision 2 → test `src-tauri/tests/` : identité non conforme, rien n'est créé

## Hors périmètre
- Menu, sélection de la branche qui reçoit, checkout préalable : S-36.
- Refus pour modifications non commitées (« Commit or stash your changes before merging. » et `… rebasing.`, CA-12) : S-51. Entrées désactivées pendant une opération en cours, « Operation in progress. » (CA-14) et refus d'identité non conforme dans le menu : S-50 ; refus d'une autre raison par Git avec « Details » (CA-15) : S-53, ici une erreur de Git rend un message d'une ligne seulement ; accès clavier complet (CA-17) : S-56 ; HEAD détachée et commit racine : S-52.
- Conflits, `OperationBanner`, `ConflictResolver`, Continue / Abort : S-38, S-39 et S-40.
- Pull en rebase et push : S-20 et suivantes ; ici rien n'est poussé et `PushButton` n'est que lu.
- Édition du message du commit de merge, merge d'un commit sans branche, merge et rebase dans l'autre sens, glisser-déposer, Undo, rebase interactif.

## Documentation à mettre à jour
- README, section « Graphe de `History` » : choisir « Merge … into … » ou « Rebase … onto … » exécute l'opération sans dialogue ; merge avec commit de merge toujours créé (message par défaut de Git), rebase qui rejoue les commits ; « Already up to date. » ; `PushButton` « Force push » après un rebase de commits poussés, rien n'est poussé ; comportement en cas de conflit (selon la décision 1) ; fixture `fixtures/integrate.sh` si créée.
- `.env.example` : aucune variable ajoutée. Rattrapage : README et `.env.example` à relire à la livraison ; aucun retard constaté, sections « Push » et « Graphe de `History` » à relire pour les mentions de Force push et de rebase.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `3e2489b`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : crate `git` `integrate.rs`, commandes `merge_branch` / `rebase_branch`, `integrate` dans `App.svelte`, tests Rust et e2e, README ; tests, lint, build ✅ ; rouge e2e non constaté | — |
| 2 | reviewer | revue 1 : 1 bloquant (e2e CA-11 et décision 1 : alerte périmée du merge satisfait l'assertion du rebase), 1 mineur (« Already up to date. » en rouge, maquette neutre) | à corriger |
| 3 | dev | terminé : e2e CA-11 et décision 1 séparés merge / rebase, « Already up to date. » en classe `.notice` neutre ; `pnpm e2e` complet : 2 échecs instables hors périmètre (refs-column CA-18, graph-width CA-13), passent en ciblé (relancés par story-runner) | — |
| 4 | reviewer | revue 2 : bloquant 1 et mineur 2 levés, aucun problème | validé |

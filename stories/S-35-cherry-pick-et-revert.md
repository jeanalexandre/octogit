# Story S-35 : Cherry-pick et Revert depuis le clic droit ou `CommitDetail`, avec l'identité du profil

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-35-cherry-pick-et-revert.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-35 (tranche valeur 9) ; dépend de S-34 (menu Reset du commit) et S-15 (commit avec l'identité du `.git/config` local)
- Critères couverts : `specs/revenir-en-arriere.md` CA-1, CA-2, CA-3, CA-4, CA-17
- Jobs servis : J-8
- Revue renforcée : non

## Objectif
Ajouter Cherry-pick et Revert au menu clic droit d'un commit (y compris désigné par `origin/…`) et aux boutons de `CommitDetail`, qui créent sans dialogue un commit signé et identifié par le profil du dépôt, sans toucher à une autre ref.

## Critères d'acceptation
- **revenir-en-arriere CA-1** : Étant donné `History` et `feature/profiles` courante, quand je fais un clic droit sur un commit, y compris un commit désigné seulement par `origin/…`, alors le menu propose Cherry-pick, Revert et « Reset feature/profiles to here › » ; étant donné ce commit sélectionné, alors `CommitDetail` propose les boutons Cherry-pick et Revert.
- **revenir-en-arriere CA-2** : Étant donné le commit `a3f9c21` absent de `feature/profiles`, sans conflit, quand je choisis Cherry-pick, alors, sans dialogue ni confirmation, `feature/profiles` pointe sur un nouveau commit enfant de son ancien sommet, de même message et mêmes changements que `a3f9c21` ; le graphe l'affiche aussitôt, sans changer d'écran.
- **revenir-en-arriere CA-3** : Étant donné le commit `a3f9c21` sur `feature/profiles`, sans conflit, quand je choisis Revert, alors, sans dialogue ni confirmation, `feature/profiles` pointe sur un nouveau commit qui inverse exactement les changements de `a3f9c21`, avec le message par défaut de Git (« Revert "<résumé>" », puis « This reverts commit <SHA complet>. ») ; le graphe l'affiche aussitôt.
- **revenir-en-arriere CA-4** : Étant donné le commit créé en CA-2, alors il garde l'auteur d'origine (nom, adresse, date) ; étant donné celui créé en CA-3, alors son auteur est l'identité du profil ; dans les deux cas, le committer est l'identité du profil du dépôt et le commit est signé si ce profil signe ; `git log -1 --format=fuller` le confirme dans le terminal.
- **revenir-en-arriere CA-17** : Étant donné un cherry-pick, un revert ou un reset terminé, alors aucune branche distante n'a changé, aucune autre branche locale n'a bougé, et rien n'a été poussé.

## Décisions de l'humain
### Fiche (19/11/2026)
1. Contrôle d'identité dès cette story : a) oui, avec `ensure_conform`, refus en une ligne (décision de l'humain, 19/11/2026)
2. Conflit ou cherry-pick vide avant S-40 et S-52 : a) annuler par `--abort`, dépôt inchangé, refus en une ligne ; S-40 remplace ce comportement (décision de l'humain, 19/11/2026)

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css`
- Conventions : binaire `git` en sous-processus pour toute écriture (cherry-pick et revert dans le crate `git`, sortie brute gardée pour « Details ») ; identité et signature lues par `git` dans le `.git/config` local, rien dans `~/.gitconfig` ; commandes et événements Tauri dans `src-tauri/src` sans logique ; `snake_case` en Rust, `camelCase` en TypeScript, composants Svelte en `PascalCase` au nom exact de `ux.md` ; icônes Lucide (16 px, trait 1,8 px, sans remplissage) devant chaque libellé de bouton ; CSS natif, couleurs par tokens seulement ; interface en anglais ; Conventional Commits en anglais

## Contexte technique
- Dépend de S-33 et S-34 (même lot, pas encore livrées à la rédaction : `stories/S-33-reset-soft-et-mixed.md`, `stories/S-34-reset-hard-confirme.md`) : relire le code livré avant de coder. S-33 crée `crates/git/src/reset.rs`, l'entrée à sous-menu « Reset <courante> to here › » de `src/lib/components/RefContextMenu.svelte` (prop `onresetbranch(target, mode)` suggérée) et son branchement dans `src/App.svelte` ; S-34 ajoute `ResetHardDialog`. S-35 ajoute Cherry-pick et Revert à côté, sans dupliquer ces fichiers. Le menu d'un commit ne contient aujourd'hui que « Create branch here » (S-26) ; les autres entrées (rebase, tag, rebase interactif) viennent avec S-36 et suivantes.
- Rust, crate `git` : nouveau module `crates/git/src/cherry_pick.rs` (ou `revert.rs`, un module par geste si plus lisible) sur le modèle de `crates/git/src/stash.rs` et de `commit_in` dans `crates/git/src/working_tree.rs` (binaire `git`, `WorkingTree` rendu, erreur `GitError` gardant la sortie brute) ; `crates/git/src/lib.rs` : `mod …;` et `pub use …`. Cherry-pick : `git cherry-pick <commit>` (auteur d'origine gardé par Git, committer et signature = config locale). Revert : `git revert --no-edit <commit>` (message par défaut de Git ; auteur et committer = config locale). Le commit est celui désigné : pour une `origin/…`, le commit vers lequel pointe la ref (`target` dans `screen.repository.refs`). Aucune autre ref ne bouge, rien n'est poussé (CA-17). Tests : `crates/git/tests/` (modèle `commit.rs`), dépôt temporaire avec un `user.name` / `user.email` du profil différents de l'auteur du commit repris.
- Rust, crate `app` : `src-tauri/src/working_tree.rs` (modèles : `commit_checked` avec la garde `crate::attach::ensure_conform(store, path, home)`, `stash_changes` / `committed` qui rend `CommittedView` : arbre et dépôt relus), `src-tauri/src/commands.rs` (modèle : commande `commit`, `apply_stash`), `src-tauri/src/lib.rs` (enregistrement) ; deux commandes, puis `pnpm gen:bindings`. `src-tauri/examples/octogit-bridge.rs` : les enregistrer dans le pont de test si les commandes y sont listées. Contrôle d'identité selon la décision 1. Tests : `src-tauri/tests/commit_guard.rs` (modèle).
- Interface : `src/lib/components/RefContextMenu.svelte` (type `RefMenuTarget`, liste `entries`, flèches et Échap existantes à garder, focus visible) : entrées Cherry-pick et Revert pour un commit, y compris celui d'une `origin/…`, à l'emplacement de `ux/ecrans/history.md` (« Commit » : Cherry-pick, Revert avant « Reset … to here › ») ; `src/lib/components/CommitDetail.svelte` (props actuelles `detail`, `refs`, `oncheckout`, `oncreatebranch`, `onopenfile`, `onamend`) : boutons Cherry-pick et Revert avec icône Lucide, à côté de Checkout et « Create branch here » ; `src/lib/screens/History.svelte` (rend `CommitDetail`, relaie `oncreatebranch` : suivre ce patron) ; `src/App.svelte` (`openCommitMenu`, `refMenu`, garde « un seul geste à la fois » par `checkoutPath` et `runFetchNow`, `applyCommitted`, `checkoutNotice` pour un refus en une ligne : modèle `runStash` et `stashFromMenu`). Sans dialogue ni confirmation : le graphe se met à jour par le dépôt relu, sans changer d'écran.
- Pont de test : `src/web-bridge.ts`, `e2e/helpers.ts` (ajouter les commandes). Fixtures : `fixtures/branches.sh` (branche portant des commits absents de la courante : à vérifier), `fixtures/pull.sh` (commit désigné par `origin/…` après fetch), `fixtures/identity.sh` (modèle d'identité du profil) ; un dépôt « commit absent de la courante, auteur différent du profil » se fabrique dans le test si aucune fixture ne convient. Aucun appel réseau réel.
- Écrans : `ux/ecrans/history.md` (« Entrées de `RefContextMenu` » › Commit ; ligne `CommitDetail` : Cherry-pick et Revert), maquette `ux/maquettes/history.html`, « Direction visuelle » de `ux.md`, couleurs uniquement par les tokens ; un état n'est jamais porté par la couleur seule.
- Reports : aucun point « reporter vers S-35 » dans les fiches existantes ; les mentions de S-35 dans les fiches S-05, S-26 et S-29 sont des renvois vers cette story (boutons de `CommitDetail`, entrées du menu d'un commit).

## Interface à vérifier
- **Écrans et états** : `History` : menu clic droit d'un commit avec Cherry-pick, Revert et Reset · menu d'un commit désigné par `origin/…` · `CommitDetail` avec boutons Cherry-pick et Revert · après Cherry-pick (nouveau commit en tête du graphe, sans changer d'écran) · après Revert (message « Revert "<résumé>" ») · refus en une ligne (selon la décision 2)
- **Tailles d'écran** : 1 500×900 (portable, plein écran), 1 280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] revenir-en-arriere CA-1 → test composant `RefContextMenu` (entrées Cherry-pick et Revert d'un commit et d'une `origin/…`) ; test composant `CommitDetail` (deux boutons, rappels appelés) ; e2e (clic droit sur un commit et sur `origin/…`, boutons de `CommitDetail`)
- [ ] revenir-en-arriere CA-2 → test Rust (dépôt temporaire : commit absent de la branche courante ; après cherry-pick : nouveau commit enfant de l'ancien sommet, même message, mêmes changements) ; e2e (sans dialogue, graphe à jour)
- [ ] revenir-en-arriere CA-3 → test Rust (le commit créé inverse exactement les changements, message par défaut de Git avec SHA complet) ; e2e
- [ ] revenir-en-arriere CA-4 → test Rust (`git log -1 --format=fuller` : cherry-pick garde auteur d'origine nom, adresse et date, committer = profil ; revert auteur et committer = profil ; signature si le profil signe)
- [ ] revenir-en-arriere CA-17 → test Rust (références distantes, autres branches locales et `origin` bare inchangés, rien poussé)
- [ ] Décisions 1 et 2 → test selon la réponse (refus d'identité ; aucune opération laissée en cours après conflit)

## Hors périmètre
- Conflits de cherry-pick et de revert, opération en cours, `ConflictResolver`, `OperationBanner` (S-40) ; commandes lancées au terminal (S-40).
- Refus pour modifications non commitées (S-51), désactivation en HEAD détachée, sur un commit de merge et cherry-pick sans changement (S-52), pendant une opération en cours (S-50), refus d'identité non conforme avec sa raison affichée (S-50, voir décision 1), messages d'erreur « Details » (S-53), accès clavier complet (S-56).
- Rebase, rebase interactif, Create tag, merge du menu d'un commit (S-36 et suivantes) ; Reset (S-33, S-34).

## Documentation à mettre à jour
- README : section de `History` (menu clic droit d'un commit : Cherry-pick et Revert ; boutons de `CommitDetail` ; auteur et committer des commits créés ; rien n'est poussé). Rattrapage : README et `.env.example` à relire à la livraison ; `.env.example` : aucune variable ajoutée.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|

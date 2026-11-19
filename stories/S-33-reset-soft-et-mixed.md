# Story S-33 : Reset Soft et Mixed sur n'importe quel commit, dont `origin/…`

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-33-reset-soft-et-mixed.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-33 (tranche valeur 9)
- Critères couverts : `specs/revenir-en-arriere.md` CA-10, CA-11, CA-12, CA-15, CA-18
- Jobs servis : J-14
- Revue renforcée : non

## Objectif
Ajouter au `RefContextMenu` le sous-menu « Reset <branche courante> to here › » (Soft, Mixed, Hard décrits en une ligne), avec Soft et Mixed immédiats sur n'importe quel commit, `origin/…` comprise, et sans blocage d'identité.

## Critères d'acceptation
- **revenir-en-arriere CA-10** : Étant donné le sous-menu « Reset feature/profiles to here › », alors il propose Soft, Mixed et Hard, chacun suivi d'une ligne qui dit ce qui est gardé (« Soft — keep changes staged », « Mixed — keep changes unstaged », « Hard — discard everything… »).
- **revenir-en-arriere CA-11** : Étant donné `feature/profiles` 2 commits au-dessus de `c41d8e0`, quand je choisis Soft sur `c41d8e0`, alors, sans dialogue, `feature/profiles` pointe sur `c41d8e0`, l'arbre de travail est inchangé, et `git diff --cached` montre les changements des 2 commits retirés en plus de ce qui était déjà indexé.
- **revenir-en-arriere CA-12** : Étant donné la même situation, quand je choisis Mixed, alors, sans dialogue, `feature/profiles` pointe sur `c41d8e0`, l'arbre de travail est inchangé, rien n'est indexé, et `git diff` montre les changements des 2 commits retirés et les modifications d'avant.
- **revenir-en-arriere CA-15** : Étant donné `feature/profiles` en retard sur `origin/feature/profiles` après un fetch, quand je fais un clic droit sur `origin/feature/profiles` puis choisis un mode de reset, alors `feature/profiles` pointe sur le même commit que `origin/feature/profiles` et l'indicateur d'avance / retard affiche 0 / 0, en deux clics pour Soft ou Mixed, plus la confirmation pour Hard.
- **revenir-en-arriere CA-18** : Étant donné un dépôt non conforme ou « No profile », alors Soft, Mixed et Hard restent disponibles, car ils ne créent aucun commit.

## Décisions de l'humain
### Fiche (19/11/2026)
1. Entrée Hard avant `ResetHardDialog` (S-34) : a) listée mais désactivée jusqu'à S-34 (décision de l'humain, 19/11/2026)

### Après la revue 1
- Mineur 1 (README : « to » manquant) : traiter (d'office)
- Mineur 2 (README : « à » manquant) : traiter (d'office)

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css`
- Conventions : binaire `git` en sous-processus pour toute écriture (reset soft et mixed du crate `git`, sortie brute gardée pour « Details ») ; commandes et événements Tauri dans `src-tauri/src` sans logique ; `snake_case` en Rust, `camelCase` en TypeScript, composants Svelte en `PascalCase` au nom exact de `ux.md` ; icônes Lucide (16 px, trait 1,8 px, sans remplissage) devant chaque libellé de bouton ; CSS natif, couleurs par tokens seulement ; interface en anglais ; Conventional Commits en anglais

## Contexte technique
- Rust, crate `git` : `crates/git/src/lib.rs` (déclare les modules et réexporte : ajouter `mod reset;` et `pub use reset::…`, `GitError`) ; nouveau module `crates/git/src/reset.rs` sur le modèle de `crates/git/src/stash.rs` (appel du binaire `git`, `WorkingTree` rendu) : `git reset --soft <commit>` et `git reset --mixed <commit>` de la branche courante, sur n'importe quel commit, `origin/…` comprise ; l'arbre de travail reste inchangé, aucune autre ref ne bouge, rien n'est poussé. Pas de contrôle d'identité (CA-18) : ne pas appeler `ensure_conform`.
- Rust, crate `app` : `src-tauri/src/working_tree.rs` (modèle : `stash_changes`, `committed`, qui rend `CommittedView` : arbre et dépôt relus), `src-tauri/src/commands.rs` (commande `#[tauri::command]` `#[specta::specta]`, modèle `apply_stash`), `src-tauri/src/lib.rs` (enregistrement près de `commands::drop_stash`) ; régénérer `src/lib/bindings.ts` par `pnpm gen:bindings`.
- Interface : `src/lib/components/RefContextMenu.svelte` (type `RefMenuTarget` ; liste `entries` extensible ; ajouter l'entrée à sous-menu « Reset <courante> to here › » aux menus d'un commit et d'une branche ou `origin/…` ; un `onreset`-like existe déjà pour « Reset and checkout » du checkout : nommer la nouvelle prop autrement, p. ex. `onresetbranch(target, mode)` ; navigation flèches et Échap existantes à garder, focus visible) ; `src/App.svelte` (`openRefMenu`, `openCommitMenu`, `refMenu`, garde « un seul geste à la fois » par `checkoutPath` et `runFetchNow`, `applyCommitted`, `checkoutNotice` pour un refus en une ligne : modèle `runStash` et `stashFromMenu`) ; `src/lib/screens/History.svelte` (nom de la branche courante, indicateur d'avance / retard relu avec le dépôt) ; sources du clic droit : `src/lib/components/CommitGraph.svelte`, `RefLabel.svelte`, `BranchSidebar.svelte` (déjà branchés sur `openRefMenu` et `openCommitMenu`, à vérifier pour une `origin/…`).
- La cible du reset est le commit désigné : pour un commit, `menu.commit` ; pour une branche ou une `origin/…`, le commit vers lequel pointe la ref dans `screen.repository.refs` (`target`).
- Pont de test : `src/web-bridge.ts`, `e2e/helpers.ts` ; fixtures : `fixtures/pull.sh` (branche locale en retard sur `origin` après fetch, CA-15), `fixtures/wip.sh <dossier>` (fichiers modifiés, indexé et non suivi), `fixtures/identity.sh` (dépôt non conforme, CA-18) ; un dépôt de 2 commits au-dessus d'une base se fabrique dans le test si aucune fixture ne convient.
- Écrans : `ux/ecrans/history.md` (« Entrées de `RefContextMenu` » › Commit : « Reset feature/profiles to here › » Soft / Mixed / Hard, chaque mode décrit en une ligne ; « Blocage d'identité (J-13) » : Reset reste disponible), `ux/maquettes/history.html` (section 3 « Right-click on origin/feature/profiles → Reset »), Direction visuelle de `ux.md`. Un état n'est jamais porté par la couleur seule.
- Reports : aucun point « reporter vers S-33 » dans les fiches existantes.

## Interface à vérifier
- **Écrans et états** : `History` : menu clic droit d'un commit avec sous-menu Reset ouvert (Soft, Mixed, Hard et leurs lignes) · menu de `origin/feature/profiles` avec Reset · après Soft (changes indexés dans `WorkingChanges`) · après Mixed (changes non indexés) · après reset sur `origin/…` (avance / retard 0 / 0) · dépôt non conforme ou « No profile » : entrées toujours actives
- **Tailles d'écran** : 1 500×900 (portable, plein écran), 1 280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] revenir-en-arriere CA-10 → test composant `RefContextMenu` (sous-menu : Soft, Mixed, Hard avec leurs lignes « Soft — keep changes staged », « Mixed — keep changes unstaged », « Hard — discard everything… », nom de la branche courante dans le titre) ; e2e (sous-menu visible depuis un commit)
- [ ] revenir-en-arriere CA-11 → test Rust (dépôt temporaire : branche 2 commits au-dessus de la base, modification indexée au départ ; après Soft : HEAD sur la base, arbre inchangé, `git diff --cached` montre les 2 commits en plus de l'indexé) ; e2e (Soft sans dialogue)
- [ ] revenir-en-arriere CA-12 → test Rust (après Mixed : HEAD sur la base, arbre inchangé, index vide, `git diff` montre les 2 commits et les modifications d'avant) ; e2e (Mixed sans dialogue)
- [ ] revenir-en-arriere CA-15 → test Rust (reset sur la ref `origin/…` : la locale pointe sur le même commit) ; e2e (`fixtures/pull.sh` : clic droit sur `origin/…` puis Soft ou Mixed, indicateur 0 / 0, deux clics)
- [ ] revenir-en-arriere CA-18 → test Rust ou e2e (dépôt non conforme ou « No profile » : Soft et Mixed s'exécutent) ; test composant (entrées actives)
- [ ] Hard selon la décision 1 → test composant (état de l'entrée Hard)

## Hors périmètre
- `ResetHardDialog` et l'exécution de Hard (S-34) ; Force push après reset (S-24 et S-34).
- Cherry-pick, Revert et leurs entrées (S-35) ; désactivation en HEAD détachée (S-52), pendant une opération en cours (S-50), refus pour modifications non commitées (S-51) ; messages d'erreur « Details » (S-53) ; accès clavier complet des entrées (S-56).
- Undo d'un reset (non-objectif de la spec).

## Documentation à mettre à jour
- README : section de `History` (menu clic droit : « Reset <branche> to here › » Soft / Mixed, effet sur l'index et l'arbre, reset sur `origin/…` ; Hard selon la décision 1). Rattrapage : README et `.env.example` à relire ; `.env.example` : aucune variable ajoutée.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `e9ee443`

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé ; tests, lint, build verts ; 2 e2e instables hors périmètre (`graph-width`, `refs-column`) | — |
| 1 | reviewer | `stories/S-33-revue-1.md` : 2 mineurs README | validé |
| 2 | dev | aucun fichier modifié : les 2 corrections README déjà en place (vérifié ligne 62) ; `pnpm format:check` vert. Pas de nouvelle revue : aucun changement | — |

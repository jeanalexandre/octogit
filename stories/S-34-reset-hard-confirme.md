# Story S-34 : Reset Hard confirmé par `ResetHardDialog` qui liste ce qui sera perdu

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-34-reset-hard-confirme.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-34 (tranche valeur 9) ; dépend de S-33 (sous-menu Reset, Soft et Mixed) et S-24 (Force push)
- Critères couverts : `specs/revenir-en-arriere.md` CA-13, CA-14, CA-16
- Jobs servis : J-14
- Revue renforcée : non

## Objectif
Brancher l'entrée Hard du sous-menu Reset sur `ResetHardDialog`, qui liste les commits et fichiers suivis perdus avant toute modification, puis exécuter `git reset --hard` à la confirmation.

## Critères d'acceptation
- **revenir-en-arriere CA-13** (modifié le 07/11/2026) : Étant donné la même situation [`feature/profiles` 2 commits au-dessus de `c41d8e0`] et 3 fichiers suivis modifiés, quand je choisis Hard, alors `ResetHardDialog` s'ouvre sans rien modifier : titre « Hard reset feature/profiles to c41d8e0? », « 2 commits and 3 modified files will be lost. », la liste des 2 commits (SHA abrégé, résumé) et des 3 fichiers (statut en lettre, chemin), Cancel et Hard reset. Étant donné rien à perdre, alors le dialogue s'ouvre avec le même titre, « Nothing will be lost: no commits or modified files. », et les mêmes boutons Cancel et Hard reset.
- **revenir-en-arriere CA-14** : Étant donné `ResetHardDialog`, quand je confirme Hard reset, alors `feature/profiles` pointe sur `c41d8e0`, l'index et les fichiers suivis sont identiques à `c41d8e0` (`git status` ne liste aucun fichier suivi modifié), et les fichiers non suivis sont inchangés. Quand je clique sur Cancel ou fais Échap, alors branches, index et arbre de travail ne changent pas.
- **revenir-en-arriere CA-16** : Étant donné un reset qui retire des commits déjà poussés, alors `PushButton` affiche « Force push » (`specs/synchroniser.md`, CA-16) ; rien n'est poussé.

## Décisions de l'humain
### Fiche (19/11/2026)
1. Commits listés dans `ResetHardDialog` : a) tous les commits retirés de la branche courante (décision de l'humain, 19/11/2026)

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css`
- Conventions : binaire `git` en sous-processus pour toute écriture (reset hard du crate `git`, sortie brute gardée pour « Details ») ; commandes et événements Tauri dans `src-tauri/src` sans logique ; `snake_case` en Rust, `camelCase` en TypeScript, composants Svelte en `PascalCase` au nom exact de `ux.md` ; icônes Lucide (16 px, trait 1,8 px, sans remplissage) devant chaque libellé de bouton ; CSS natif, couleurs par tokens seulement ; interface en anglais ; Conventional Commits en anglais

## Contexte technique
- Dépend de S-33 (`stories/S-33-reset-soft-et-mixed.md`, même lot, pas encore livrée à la rédaction) : relire le code livré avant de coder. S-33 crée `crates/git/src/reset.rs` (reset soft et mixed), la commande `app` de reset, l'entrée à sous-menu « Reset <courante> to here › » de `src/lib/components/RefContextMenu.svelte` (prop `onresetbranch(target, mode)` suggérée) et son branchement dans `src/App.svelte`. S-34 prolonge ces fichiers sans les dupliquer : l'entrée Hard doit ouvrir le dialogue au lieu d'exécuter (selon la décision 1 de S-33). S-24 (`stories/S-24-force-push-apres-reecriture.md`) détecte déjà la réécriture par le reflog de la branche, que `reset` alimente : CA-16 est surtout à prouver par un test, sans nouveau code de détection sauf défaut constaté.
- Rust, crate `git` : `crates/git/src/reset.rs` (S-33) : ajouter (a) une lecture sans effet de ce qui sera perdu pour un reset de la branche courante vers un commit : commits retirés de la branche (SHA abrégé, résumé) et fichiers suivis modifiés (statut en lettre, chemin ; indexés ou non, fichiers non suivis exclus), (b) `git reset --hard <commit>` (modèle `crates/git/src/stash.rs` : binaire `git`, `WorkingTree` rendu, erreur gardant la sortie brute). Les fichiers non suivis ne bougent pas. Aucune autre ref ne change, rien n'est poussé. Pas de contrôle d'identité (CA-18 : Hard reste disponible) : ne pas appeler `ensure_conform`. `crates/git/src/lib.rs` : réexporter.
- Rust, crate `app` : `src-tauri/src/working_tree.rs`, `src-tauri/src/commands.rs` (modèle `apply_stash` / commande de reset de S-33), `src-tauri/src/lib.rs` (enregistrement) : deux commandes, l'aperçu en lecture seule et l'exécution qui rend le dépôt relu (modèle `committed` / `CommittedView`) ; puis `pnpm gen:bindings`. Pas de logique dans `app` hors appel au crate `git`.
- Interface : nouveau `src/lib/components/ResetHardDialog.svelte` (+ `ResetHardDialog.test.ts`), nom exact de `ux.md`, modèle `src/lib/components/DiscardDialog.svelte` (props par `$props`, `role="dialog"`, Échap par `<svelte:window {onkeydown}>`, état occupé, erreur d'une ligne) et `IdentityMismatch.svelte` ; états « pertes listées » et « rien à perdre » ; singulier à gérer (« 1 commit », « 1 modified file ») ; Cancel (Échap) et Hard reset atteignables au clavier, focus visible ; bouton Hard reset non relançable pendant l'exécution. `src/App.svelte` : ouvrir le dialogue depuis l'entrée Hard avec l'aperçu, exécuter à la confirmation, remplacer `screen` par le dépôt relu (`applyCommitted`), garde « un seul geste à la fois » (`checkoutPath`, `runFetchNow`, `inFlight` de `src/lib/fetchScheduler.ts`), refus en une ligne par `checkoutNotice` ; modèle `discardDialog` / `discardFile`. `src/lib/screens/History.svelte` : nom de la branche courante, `PushButton` (S-20, S-24) qui doit passer à « Force push » après un reset de commits poussés (CA-16), indicateur d'avance / retard relu.
- Pont de test : `src/web-bridge.ts`, `e2e/helpers.ts` (ajouter les commandes). Fixtures : `fixtures/wip.sh <dossier>` (fichiers modifiés, indexé et non suivi), `fixtures/refs.sh` (`origin` bare, second clone) et `fixtures/lib.sh`, `fixtures/pull.sh` ; un dépôt « 2 commits au-dessus d'une base, 3 fichiers suivis modifiés, un fichier non suivi » et « 2 commits poussés puis reset » se fabriquent dans le test si aucune fixture ne convient. Aucun appel réseau réel : `origin` en `--bare` par chemin.
- Écrans : `ux/ecrans/dialogues.md` (`ResetHardDialog` : « Hard reset feature/profiles to c41d8e0? », « 2 commits and 3 modified files will be lost. », commits et fichiers suivis perdus, non suivis gardés et non listés ; Cancel (Échap), Hard reset ; rien à perdre : « Nothing will be lost: no commits or modified files. ») ; `ux/ecrans/history.md` (« Entrées de `RefContextMenu` », `PushButton`) ; maquette `ux/maquettes/history.html` (« ResetHardDialog » et « ResetHardDialog — nothing to lose » : titre, ligne d'avertissement, commits et fichiers en monospace, Cancel / Hard reset en bouton principal ; « Push after rewrite → Force push ») ; Direction visuelle de `ux.md` (« Neon »), couleurs uniquement par les tokens ; un état n'est jamais porté par la couleur seule.
- Reports : aucun point « reporter vers S-34 » dans les fiches existantes.

## Interface à vérifier
- **Écrans et états** : `History` : `ResetHardDialog` avec pertes listées (2 commits, 3 fichiers, un fichier non suivi absent de la liste) · `ResetHardDialog` « Nothing will be lost » · après Hard reset (graphe, `WorkingChanges` sans fichier suivi modifié, fichier non suivi présent) · Cancel et Échap (rien ne change) · `PushButton` « Force push » après Hard reset de commits poussés · dépôt non conforme ou « No profile » : Hard disponible
- **Tailles d'écran** : 1 500×900 (portable, plein écran), 1 280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] revenir-en-arriere CA-13 → test Rust (aperçu : 2 commits retirés et 3 fichiers suivis modifiés avec leur lettre, fichier non suivi exclu, aucune modification du dépôt ; rien à perdre : listes vides) ; test composant `ResetHardDialog` (titre, « 2 commits and 3 modified files will be lost. », lignes de la liste, Cancel et Hard reset ; « Nothing will be lost: no commits or modified files. » ; singulier) ; e2e (clic droit › Reset › Hard : dialogue conforme, dépôt inchangé)
- [ ] revenir-en-arriere CA-14 → test Rust (après `reset --hard` : HEAD sur la base, index et fichiers suivis identiques à la base, `git status` sans fichier suivi modifié, fichier non suivi inchangé) ; test composant (Cancel et Échap ferment sans appeler la commande) ; e2e (confirmation puis état du dépôt ; Cancel et Échap : HEAD, index et arbre inchangés ; Hard sur `origin/…` en retard : branche sur le même commit, 0 / 0)
- [ ] revenir-en-arriere CA-16 → test Rust ou e2e (2 commits poussés sur un `origin` bare, Hard reset en dessous : la détection de S-24 les trouve, `PushButton` « Force push », rien poussé, branche du bare inchangée)
- [ ] CA-18 (déjà couvert par S-33 pour Soft et Mixed) → un test pour Hard sur dépôt non conforme ou « No profile » : le dialogue s'ouvre et Hard s'exécute

## Hors périmètre
- Soft et Mixed, sous-menu, entrées Reset et leurs lignes descriptives (S-33) ; Force push et `ForcePushDialog` (S-24, déjà livrés) : ici, `PushButton` n'est qu'observé.
- Cherry-pick, Revert (S-35) ; désactivation en HEAD détachée (S-52), pendant une opération en cours (S-50), refus pour modifications non commitées (S-51) ; messages d'erreur « Details » (S-53) ; accès clavier complet du menu (S-56).
- Undo d'un reset Hard (non-objectif de la spec) ; sauvegarde automatique avant Hard.

## Documentation à mettre à jour
- README : section de `History` (Reset Hard : `ResetHardDialog`, ce qui est listé, fichiers non suivis gardés, Cancel et Échap, Force push proposé ensuite si des commits poussés ont été retirés). Rattrapage : le README de S-33 (sous-menu Reset) est écrit par S-33 ; relire README et `.env.example` à la livraison. `.env.example` : aucune variable ajoutée.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|

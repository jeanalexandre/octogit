# Story S-38 : `ConflictResolver` : fichiers par statut, Ours / Theirs / Result, Take this block, Mark as resolved

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-38-conflict-resolver-merge.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-38 (tranche valeur 11) ; dépend de S-37 (merge et rebase exécutés, décision 1 : conflit annulé par `--abort`, à inverser pour le merge)
- Critères couverts : `resoudre-les-conflits` CA-1, CA-2, CA-3, CA-4, CA-5 ; `integrer-une-branche` CA-13 (`specs/resoudre-les-conflits.md`, validée le 07/11/2026 ; `specs/integrer-une-branche.md`, validée le 07/11/2026)
- Jobs servis : J-9, J-6
- Revue renforcée : oui (architecture : changement du contrat de la commande `merge_branch`, un conflit n'est plus un refus mais une opération laissée en cours)

## Objectif
Un merge lancé dans Octogit qui s'arrête sur un conflit reste en cours et ouvre `ConflictResolver` : fichiers en trois groupes par statut, Ours / Theirs / Result éditable, Take this block, Mark as resolved qui écrit et indexe le fichier.

## Critères d'acceptation
Périmètre de la story : le conflit d'un **merge** lancé dans Octogit. Les conflits de rebase, de cherry-pick et de revert (S-40) gardent le comportement de S-35 et S-37 (annulés, rien n'est laissé en cours).
- **resoudre-les-conflits CA-1** : Étant donné un merge, un rebase, un cherry-pick ou un revert lancé dans Octogit qui s'arrête sur un conflit, alors `ConflictResolver` s'ouvre. Ses fichiers sont groupés en « Conflicted · n », « Resolved · n » et « Auto-merged · n ». Chaque fichier porte un statut lisible sans la couleur (`!`, `✓`, `·`). Les fichiers listés sont ceux que `git status` donne en conflit ou fusionnés.
- **resoudre-les-conflits CA-2** : Étant donné un fichier texte en conflit sélectionné, alors `ConflictPane` affiche Ours et Theirs, puis Result. Ours et Theirs portent chacun leur branche et leur SHA abrégé (ex. « feature/profiles · a3f9c21 », « develop · e92a6b3 ») et sont teintés de leur lane. « Conflict i / n » et ses flèches passent d'un bloc en conflit au bloc suivant ou précédent.
- **resoudre-les-conflits CA-3** : Étant donné un bloc en conflit, quand je coche Take this block côté Ours, côté Theirs ou des deux côtés, alors Result contient ce ou ces blocs à la place du marqueur, dans l'ordre Ours puis Theirs. Take all ours et Take all theirs font de même pour tous les blocs du fichier. Result reste éditable au clavier.
- **resoudre-les-conflits CA-4** : Étant donné un Result qui contient encore une ligne de marqueur de conflit (`<<<<<<<`, `=======` ou `>>>>>>>`), alors Mark as resolved est désactivé, et le décompte le dit (« Block 1 resolved · Block 2 to do »). Sans marqueur, Mark as resolved est actif.
- **resoudre-les-conflits CA-5** : Étant donné un clic sur Mark as resolved, alors le contenu de Result est écrit dans le fichier, octet pour octet, puis indexé : `git diff --cached` le montre et `git status` ne le liste plus en conflit. Le fichier passe dans Resolved et le fichier en conflit suivant s'affiche.
- **integrer-une-branche CA-13** : Étant donné un merge ou un rebase qui produit un conflit, alors l'opération s'arrête en merge ou en rebase en cours, aucun commit de merge n'est créé, et `ConflictResolver` prend le relais (`specs/resoudre-les-conflits.md`) ; `git status` dans le terminal indique la même opération en cours.

## Décisions de l'humain
### Fiche (20/11/2026)
1. Sortie de `ConflictResolver` avant S-39 : 1a, aucune sortie dans l'application, le merge se termine ou s'abandonne au terminal jusqu'à S-39
2. Fichier non fusionnable avant S-41 : 2a, listé dans Conflicted avec « Not mergeable yet. », sans Result, Mark as resolved indisponible

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple dont un merge en conflit, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css`
- Conventions : binaire `git` en sous-processus pour toute écriture, sortie brute gardée ; lecture rapide par `gix` seulement pour le statut ; identité et signature lues par `git` dans le `.git/config` local, rien dans `~/.gitconfig` ; commandes et événements Tauri dans `src-tauri/src` sans logique ; `snake_case` en Rust, `camelCase` en TypeScript, écrans dans `src/lib/screens/` et composants dans `src/lib/components/` en `PascalCase` au nom exact de `ux.md` ; CSS natif, couleurs par tokens seulement, icônes Lucide (16 px, trait 1,8 px) devant chaque libellé de bouton ; interface en anglais, messages courts, sans « you » ; texte ≥ 12 px, jamais d'information portée par la couleur seule ; Conventional Commits en anglais

## Contexte technique
- Rien n'existe pour les conflits : ni `ConflictResolver`, ni `ConflictPane`, ni `OperationBanner`, ni détection d'opération en cours (Grep fait : seuls `crates/git/src/working_tree.rs` (statut `ChangeStatus::Conflicted`, lignes ~68 à 116) et `WorkingChanges.svelte` (ligne ~230, étiquette « Conflict ») connaissent un fichier en conflit). `OperationBanner`, Continue, Abort, Back to graph, Resolve et la détection au terminal sont à S-39 : ne rien en poser ici.
- Rust, crate `git` : `crates/git/src/integrate.rs` (livré par S-37). `apply` annule aujourd'hui tout conflit par `merge --abort` / `rebase --abort` (lignes ~131 à 142). Pour `Kind::Merge` seulement : ne plus annuler, laisser le merge en cours (CA-13 : `MERGE_HEAD` présent, aucun commit de merge, `git status` indique le merge en cours) et rendre une issue typée distincte d'un refus (conflit : branche source, branche qui reçoit, arbre relu avec les fichiers en conflit) ; `Kind::Rebase` garde l'annulation (S-40). Le cas « opération déjà en cours du même genre » (`busy`) reste un refus sans rien annuler. Modèle de tests : `crates/git/tests/integrate.rs` (les tests de conflit de merge s'y inversent).
- Rust, crate `git` : nouveau module `crates/git/src/conflict.rs` (déclaré dans `crates/git/src/lib.rs`, `mod` et `pub use`), modèle : `crates/git/src/integrate.rs` (`run` : `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, stdin nul, `HOME` optionnel pour les tests). Il faut :
  - lister les fichiers du merge en cours par groupe : Conflicted (entrées non fusionnées de l'index), Resolved (ex-conflit passé au stage 0), Auto-merged (modifiés par le merge sans conflit) ; un ex-conflit résolu se reconnaît à `git ls-files -u` / `git rerere`-free : conserver côté interface la liste des fichiers vus en conflit à l'ouverture, ou la relire par `git diff --name-only --diff-filter=U` avant écriture ; choix au dev, testé ;
  - lire les versions Ours (`:2:<fichier>`), Theirs (`:3:<fichier>`) et le fichier avec marqueurs de l'arbre de travail (base `:1:` si utile) ; Ours = branche courante (nom et SHA abrégé de `HEAD`), Theirs = branche fusionnée (nom et SHA abrégé de `MERGE_HEAD`, nom lu dans `MERGE_MSG` ou passé par l'appelant) ;
  - écrire le contenu de Result dans le fichier **octet pour octet** (pas de normalisation de fin de ligne) puis `git add -- <fichier>` (CA-5) ; chemin refusé s'il sort du dépôt ou commence par `-`.
  - Tests : `crates/git/tests/conflict.rs` (dépôts temporaires, fixture à plusieurs blocs, fichier auto-fusionné, fichier avec fin de ligne CRLF ou sans retour final pour l'octet pour octet).
- Rust, crate `app` : `src-tauri/src/working_tree.rs` (le merge garde le contrôle d'identité `ensure_conform` de S-37, inchangé), `src-tauri/src/commands.rs` (`merge_branch` change de contrat : issue « fusionné » ou « conflit » ; nouvelles commandes de lecture de la liste, de lecture d'un fichier et de Mark as resolved, noms au choix de dev), `src-tauri/src/lib.rs` (enregistrement), `src-tauri/examples/octogit-bridge.rs` (pont de test : `"merge_branch" | "rebase_branch"`, ligne ~645, et les nouvelles commandes), puis `pnpm gen:bindings`. Pas de logique dans `app`.
- Interface, `src/App.svelte` : `integrate` (ligne ~736) lit l'issue de `commands.mergeBranch` ; sur conflit, ouvre `ConflictResolver` par-dessus `History`, qui reste monté dessous (même patron que l'état `diff` : état dédié, `History` `inert` dessous, voir ligne ~58 à 73 et ~1400) ; l'arbre relu remplace l'affichage (`applyCommitted`). Le rebase garde `checkoutNotice` (ligne unique « … conflicts with …. Nothing was changed. »). Garde « un seul geste à la fois » (`checkoutPath`) inchangée.
- Interface : nouveaux `src/lib/screens/ConflictResolver.svelte` (liste des fichiers en trois groupes, statuts `!` `✓` `·` avec libellé, décompte « ✓ n resolved · m auto-merged » quand plus rien en conflit, sélection d'un fichier, clavier, focus visible) et `src/lib/components/ConflictPane.svelte` (Ours, Theirs teintés de leur lane et portant « branche · sha7 » ; Result `<textarea>` éditable ; Take this block Ours / Theirs / les deux, Take all ours / theirs, « Conflict i / n » avec flèches, décompte « Block 1 resolved · Block 2 to do », Mark as resolved désactivé tant qu'une ligne de marqueur `<<<<<<<`, `=======` ou `>>>>>>>` reste). Logique de blocs et de marqueurs dans un module testable `src/lib/conflictBlocks.ts` (+ test Vitest), sur le modèle de `src/lib/search.ts` ou `src/lib/graphWidth.ts`. Modèles de tests de composants : `src/lib/screens/DiffView.test.ts`, `src/lib/components/ResetHardDialog.test.ts`.
- Pont de test et e2e : `src/web-bridge.ts` et `e2e/helpers.ts` (ajouter les commandes) ; nouveau `e2e/conflict-resolver.spec.ts` (modèles : `e2e/integrate.spec.ts`, `e2e/cherry-pick.spec.ts`). `e2e/integrate.spec.ts` lignes ~205 et ~229 (« conflicts with … Nothing was changed. ») : le cas merge change de comportement (le test s'inverse), le cas rebase reste. Fixtures : `fixtures/conflict.sh` (un seul fichier, un bloc, merge déjà en cours, existant) est insuffisant ; ajouter `fixtures/conflict-merge.sh` (branches `develop` et `feature/profiles` divergées, un fichier à 2 blocs en conflit, un second fichier en conflit, un fichier modifié des deux côtés sans conflit pour Auto-merged) sur le modèle de `fixtures/branches.sh` et `fixtures/lib.sh`, documentée au README. Aucun appel réseau.
- Interface : `ux/ecrans/conflict-resolver.md` (ouverture automatique, contenu et actions, états « à résoudre » et « tout résolu » ; composant `ConflictPane` : à résoudre · résolu), maquette `ux/maquettes/conflict-resolver.html` (« Conflicts remaining », « All resolved »), « Direction visuelle » de `ux.md` (« Neon », police SF Mono 12 px pour chemins et SHA, rayons 7 / 10 px), tokens dans `src/lib/styles/tokens.css` (`lane-1`…`lane-6` pour teinter Ours et Theirs, `success`, `warning`, `focus`). Texte de l'identité et Continue : S-39.
- Spécifications de `stack.md` utiles : « Accès à Git » (écritures par le binaire `git`, sortie brute) ; « Détection des changements » (`notify`, non utilisé ici : la liste se relit après chaque geste, pas de surveillance au terminal avant S-39).
- Reports : aucun point « reporter vers S-38 » dans les fiches existantes (Grep fait dans `stories/`).

## Interface à vérifier
- **Écrans et états** : `ConflictResolver` : ouverture automatique après « Merge develop into feature/profiles » en conflit (trois groupes avec décomptes, statuts `!` `✓` `·`) · fichier texte sélectionné (Ours et Theirs teintés avec « branche · sha7 », Result éditable, « Conflict i / n ») · à résoudre (Mark as resolved désactivé, « Block 1 resolved · Block 2 to do ») · bloc pris côté Ours, Theirs ou les deux · Take all ours / theirs · Mark as resolved (fichier dans Resolved, fichier suivant affiché) · tout résolu (« ✓ n resolved · m auto-merged »). `History` : rebase en conflit inchangé (ligne de refus, rien en cours).
- **Tailles d'écran** : 1500×900 (portable, plein écran), 1280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] resoudre-les-conflits CA-1 → test Rust (`crates/git/tests/conflict.rs`) : liste Conflicted / Resolved / Auto-merged égale à celle de `git status` ; test de composant : trois groupes, décomptes et statuts avec libellé ; e2e : « Merge develop into feature/profiles » en conflit ouvre `ConflictResolver`
- [ ] resoudre-les-conflits CA-2 → test Rust : versions Ours et Theirs lues, branche et SHA abrégé de chaque côté ; test de composant et e2e : étiquettes « branche · sha7 », « Conflict i / n » et flèches parcourent les blocs
- [ ] resoudre-les-conflits CA-3 → test Vitest `src/lib/conflictBlocks.test.ts` : Ours seul, Theirs seul, les deux (ordre Ours puis Theirs), Take all ours / theirs ; Result reste éditable ; e2e
- [ ] resoudre-les-conflits CA-4 → test Vitest : détection d'une ligne de marqueur ; test de composant : Mark as resolved désactivé et décompte « Block 1 resolved · Block 2 to do » ; actif sans marqueur
- [ ] resoudre-les-conflits CA-5 → test Rust : fichier écrit octet pour octet (CRLF, sans retour final), `git diff --cached` le montre, plus de conflit dans `git status` ; e2e : le fichier passe dans Resolved, le suivant s'affiche, `git status` au terminal
- [ ] integrer-une-branche CA-13 → test Rust (`crates/git/tests/integrate.rs`) : merge en conflit : `MERGE_HEAD` présent, aucun commit de merge, issue « conflit » ; rebase en conflit : toujours annulé ; test `src-tauri/tests/` : identité non conforme, rien n'est lancé ; e2e : `git status` indique le merge en cours
- [ ] Décisions 1 et 2 → test selon la réponse

## Hors périmètre
- `OperationBanner`, détection d'une opération lancée au terminal, Continue, Abort et sa confirmation, Back to graph et Resolve, Commit et Amend désactivés pendant un merge, gestes désactivés pendant l'opération : S-39 (CA-7, CA-8, CA-11, CA-13 de `resoudre-les-conflits`, CA-14, CA-19, CA-21) et S-50.
- Conflits de rebase, de Pull (rebase), de cherry-pick et de revert : S-40. Conflits de Pop et d'Apply (Done), fichiers non fusionnables (Keep ours / theirs / Delete), Open in external editor, fichier résolu au terminal : S-41.
- Le décompte « ✓ n resolved · m auto-merged » est affiché ici ; l'activation de Continue qui l'accompagne (CA-7) est à S-39.
- Accès clavier complet de l'écran (CA-18) : S-56 ; ici les contrôles sont des éléments natifs focalisables.
- Texte d'erreur brut de Git (CA-12) : S-39 et S-53.

## Documentation à mettre à jour
- README, section « Graphe de `History` » : un merge en conflit reste en cours et ouvre `ConflictResolver` (fichiers par statut, Take this block, Mark as resolved) ; le rebase en conflit reste annulé jusqu'à S-40 ; fixture `fixtures/conflict-merge.sh` (usage : `conflict-merge.sh <dossier>`).
- Corriger la mention de S-37 qui dit qu'un conflit de merge est annulé (README, même section).
- `ux/ecrans/history.md` et `ux.md` : aucun changement.
- `.env.example` : aucune variable ajoutée. Rattrapage : README et `.env.example` relus à la rédaction, aucun retard constaté.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|

# Story S-41 : Conflits de Pop / Apply (Done), fichiers non fusionnables (Keep ours / theirs / Delete), ouverture dans l'éditeur par défaut

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-41-conflits-de-stash-et-fichiers-non-fusionnables.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-41 (tranche valeur 11) ; dépend de S-39 (`stories/S-39-continuer-ou-abandonner-un-merge.md` : `OperationBanner`, Continue, Abort, Back to graph) et de S-32 (`stories/S-32-stash-pop-apply-drop.md` : Pop, Apply, Drop, conflit signalé dans `WorkingChanges`)
- Critères couverts : `resoudre-les-conflits` CA-6, CA-17, CA-20 (`specs/resoudre-les-conflits.md`, validée le 07/11/2026)
- Jobs servis : J-9, J-2
- Revue renforcée : non

## Objectif
Un Pop ou un Apply en conflit ouvre `ConflictResolver` avec `OperationBanner` en variante Abort / Done ; un fichier non fusionnable (binaire, supprimé d'un côté, renommé) se résout par Keep ours, Keep theirs ou Delete ; Open in external editor ouvre le fichier dans l'application par défaut de macOS.

## Critères d'acceptation
- **resoudre-les-conflits CA-6** : Étant donné un clic sur Open in external editor, alors le fichier s'ouvre dans l'application par défaut de macOS pour son type ; Octogit n'a aucun réglage d'éditeur. Quand j'enregistre le fichier puis reviens dans Octogit, alors Result affiche son nouveau contenu. Étant donné un fichier résolu au terminal (`git add`), alors il passe dans Resolved sans autre geste.
- **resoudre-les-conflits CA-17** : Étant donné un Pop ou un Apply en conflit, alors `ConflictResolver` s'ouvre sur les fichiers en conflit, et `OperationBanner` affiche sa variante conflit avec Abort et Done à la place de Continue. Le stash reste dans `git stash list` (`specs/preparer-un-commit.md`, CA-21). Done est désactivé tant qu'un fichier est dans Conflicted. Quand je clique sur Done, alors les fichiers résolus sont désindexés, comme après un Pop sans conflit. `OperationBanner` disparaît et le stash reste dans la liste. Quand je confirme Abort, alors les fichiers touchés reviennent à leur état d'avant le Pop ou l'Apply, et le stash reste dans la liste.
- **resoudre-les-conflits CA-20** : Étant donné un fichier en conflit non fusionnable, alors `ConflictPane` ne propose pas de Result éditable. Sont non fusionnables : un fichier binaire, un fichier supprimé d'un côté et modifié de l'autre, un fichier renommé. Les choix proposés portent sur le fichier entier : Keep ours, Keep theirs, et Delete seulement si un côté l'a supprimé. Quand je choisis l'un d'eux, alors le fichier est écrit ou supprimé selon ce choix. Ce résultat est indexé, et le fichier passe dans Resolved.

Rappel, repris de CA-19 (S-39) : l'Abort d'un Pop ou d'un Apply avec au moins un fichier résolu passe par la même confirmation (« Abort pop? n resolved files will be lost. », libellé adapté à l'opération).

## Décisions de l'humain
### Fiche (à remplir)
1. Pop / Apply en conflit après fermeture d'Octogit ou changement de dépôt : 1a, état tenu en mémoire seulement, bandeau disparu au redémarrage, fichiers toujours « Conflict » dans `WorkingChanges`
2. Open in external editor et Result non enregistré : 2a, fichier ouvert tel que sur disque, Result remplacé au retour seulement si le fichier a changé, saisies non enregistrées perdues

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css`
- Conventions : binaire `git` en sous-processus pour toute écriture, sortie brute gardée ; commandes et événements Tauri dans `src-tauri/src` sans logique ; plugins Tauri (dont `opener`) appelés depuis le crate `platform` ; `snake_case` en Rust, `camelCase` en TypeScript, écrans dans `src/lib/screens/` et composants dans `src/lib/components/` en `PascalCase` au nom exact de `ux.md` ; CSS natif, couleurs par tokens seulement, icônes Lucide (16 px, trait 1,8 px) devant chaque libellé de bouton ; interface en anglais, messages courts, sans « you » ; texte ≥ 12 px, jamais d'information portée par la couleur seule ; Conventional Commits en anglais

## Contexte technique
- Dépend de S-38 et S-39, pas livrées à la rédaction : relire leurs fiches et le code livré avant de coder. Elles créent `crates/git/src/conflict.rs` (liste Conflicted / Resolved / Auto-merged, lecture Ours / Theirs, écriture et indexation d'un fichier), `src/lib/screens/ConflictResolver.svelte`, `src/lib/components/ConflictPane.svelte` (variantes à résoudre · résolu), `src/lib/components/OperationBanner.svelte` (variante merge), `src/lib/conflictBlocks.ts`, l'état dédié de `ConflictResolver` dans `src/App.svelte`, Back to graph / Échap / Resolve, la confirmation d'Abort (patron de `ResetHardDialog.svelte`), `fixtures/conflict-merge.sh`, `e2e/conflict-resolver.spec.ts`. Réutiliser, ne pas dupliquer.
- Rust, crate `git` : `crates/git/src/stash.rs` (livré par S-32 : `stash_pop`, `stash_apply` rendent un `WorkingTree` dont les fichiers en conflit portent `ChangeStatus::Conflicted`, `restore` ; le stash reste dans la liste). Git ne laisse aucun marqueur d'opération pour un Pop ou un Apply en conflit (ni `MERGE_HEAD` ni autre) : l'opération en cours est un état tenu par Octogit (voir « À confirmer » 1). À ajouter, dans `conflict.rs` ou `stash.rs` au choix de dev :
  - Done : désindexer les fichiers résolus (`git reset -q -- <fichiers>`, comme après un Pop sans conflit : tout revient non indexé), stash conservé ;
  - Abort : remettre les fichiers touchés par le Pop ou l'Apply à leur état d'avant (fichiers suivis à `HEAD` dans l'index et l'arbre, fichiers non suivis créés par le stash supprimés), stash conservé ; Git refuse un Pop sur des fichiers déjà modifiés qu'il écraserait, donc les fichiers touchés étaient propres avant ;
  - fichier non fusionnable : le reconnaître (binaire, supprimé d'un côté, renommé : par `git ls-files -u` : stages présents, et `git diff --numstat` / attributs pour le binaire) et rendre ce type avec le fichier ; Keep ours (`git checkout --ours -- <f>` puis `git add`), Keep theirs (`--theirs`), Delete (`git rm -- <f>`, seulement si un côté l'a supprimé) ; chemin refusé s'il sort du dépôt ou commence par `-`. Pour un Pop ou un Apply, « ours » = l'arbre courant, « theirs » = le stash ; pour le merge de S-38 / S-39, Ours = branche courante, Theirs = branche fusionnée ;
  - lecture d'un fichier au retour dans Octogit (CA-6) et fichier résolu au terminal (`git add`) : la liste et le fichier se relisent du dépôt, un fichier sans entrée non fusionnée passe dans Resolved.
  - Tests : `crates/git/tests/conflict.rs` et `crates/git/tests/stash.rs` (modèle : conflit de Pop aux lignes ~209 et ~225) : Done désindexe et garde le stash, Abort restaure les fichiers touchés (suivis et non suivis) et garde le stash, Keep ours / Keep theirs / Delete sur un binaire, un fichier supprimé d'un côté, un fichier renommé, fichier résolu par `git add` relu dans Resolved.
- Rust, crate `platform` : `crates/platform/src/lib.rs` (modèle : `clipboard_plugin`, `write_clipboard`) : ajouter le plugin `opener` de Tauri (déjà prévu par `stack.md`, « Intégrations macOS » : pas une dépendance nouvelle) : `tauri-plugin-opener` dans `crates/platform/Cargo.toml`, plugin enregistré dans `src-tauri/src/lib.rs` (à côté de `clipboard_plugin()`, ligne ~161), permission dans `src-tauri/capabilities/default.json` (aujourd'hui `core:default` seul). Une fonction `open_in_default_app` n'ouvre que un fichier existant dont le chemin résolu reste dans le dépôt ouvert. Sortie en erreur d'une ligne si l'ouverture échoue. Lancer `pnpm audit:deps` : la dépendance entre dans l'audit.
- Rust, crate `app` : `src-tauri/src/working_tree.rs` (modèle : `pop_stash`, `apply_stash`, lignes ~147 à 160 ; `CommittedView`), `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` (enregistrement), `src-tauri/examples/octogit-bridge.rs` (pont de test : les nouvelles commandes à côté de `"pop_stash"`), puis `pnpm gen:bindings`. Nouvelles commandes, noms au choix de dev : Done, Abort d'un Pop / Apply, Keep ours / theirs / Delete, ouverture dans l'application par défaut. Pas de logique dans `app`. Le contrôle d'identité (`ensure_conform`) ne s'applique pas : Pop, Apply, Done et Abort n'écrivent aucun commit.
- Interface, `src/App.svelte` (gros fichier : repérer par `git grep -n`, lire en offset et limit) : après un Pop ou un Apply dont l'arbre rendu contient des fichiers `Conflicted` (aujourd'hui seulement signalés dans `WorkingChanges`, S-32), ouvrir `ConflictResolver` par-dessus `History` (même patron que le merge de S-38) et poser l'état « conflit de Pop ou d'Apply » (nom du stash, Pop ou Apply) qui alimente `OperationBanner` ; Done et Abort appliquent `applyCommitted`. Garde « un seul geste à la fois » (`checkoutPath`) inchangée.
- Interface : `OperationBanner.svelte` (S-39) : ajouter la variante conflit de Pop ou d'Apply (« Done » à la place de « Continue », Abort conservé, Resolve hors `ConflictResolver`, fichiers restants) ; `ConflictResolver.svelte` : Done désactivé tant qu'un fichier est dans Conflicted, bouton Open in external editor (icône Lucide), rafraîchissement de la liste et de Result au retour de la fenêtre dans Octogit (événement de focus de la fenêtre ; ne pas dépendre de `notify`) ; `ConflictPane.svelte` : nouvelle variante « non fusionnable » (pas de `<textarea>` de Result ; Keep ours, Keep theirs, Delete seulement si un côté a supprimé ; libellés « binary file », « deleted on one side », « renamed » lisibles sans la couleur). Modèles de tests : `src/lib/screens/DiffView.test.ts`, `src/lib/components/ResetHardDialog.test.ts`.
- Pont de test et e2e : `src/web-bridge.ts` et `e2e/helpers.ts` (ajouter les commandes ; Chromium n'ouvre aucune application : le pont enregistre le chemin demandé à l'ouverture, l'e2e vérifie cet appel) ; compléter `e2e/conflict-resolver.spec.ts`. Fixtures : `fixtures/conflict-merge.sh` (S-38) pour le merge ; ajouter `fixtures/conflict-stash.sh <dossier>` (un stash qui entre en conflit au Pop, un second fichier en conflit, un fichier non fusionnable : binaire ; un fichier supprimé côté stash et modifié côté courant), sur le modèle de `fixtures/wip.sh` et `fixtures/lib.sh`, documentée au README. Aucun appel réseau.
- Interface : `ux/ecrans/conflict-resolver.md` (Ouverture, Contenu et actions : Open in external editor, Done, états « conflit de Pop ou d'Apply » ; composant `ConflictPane` : non fusionnable), `ux/ecrans/communs.md` (`OperationBanner` : conflit de Pop ou d'Apply), `ux/ecrans/history.md` (`WorkingChanges` en conflit), maquette `ux/maquettes/conflict-resolver.html` (la section « external editor » ; pas de maquette de l'état non fusionnable à la rédaction : suivre la description de `ux/ecrans/conflict-resolver.md` et les composants de `ux.md`) ; « Direction visuelle » de `ux.md` (« Neon », police SF Mono 12 px pour chemins et SHA, rayons 7 / 10 px) ; tokens dans `src/lib/styles/tokens.css` (`lane-1`…`lane-6`, `success`, `warning`, `focus`).
- Spécifications de `stack.md` utiles : « Accès à Git » (écritures par le binaire `git`, sortie brute) ; « Intégrations macOS » (`opener`, appelé depuis `platform`) ; « Détection des changements » (`notify` : la détection d'opérations lancées au terminal est à S-40).
- Reports : aucun point « reporter vers S-41 » dans les fiches existantes autre que les renvois de périmètre de S-32, S-38 et S-39 (Grep fait dans `stories/`) : Pop / Apply en conflit, fichiers non fusionnables, Open in external editor, fichier résolu au terminal.

## Interface à vérifier
- **Écrans et états** : `ConflictResolver` : ouverture automatique après un Pop et après un Apply en conflit (trois groupes) · `OperationBanner` variante Pop / Apply (Abort, Done, Resolve sur `History`) · Done désactivé tant qu'un fichier est en conflit, actif ensuite · Abort avec confirmation (fichier résolu) et sans · fichier non fusionnable : binaire, supprimé d'un côté (Delete proposé), renommé (pas de Result éditable, Keep ours / Keep theirs) · Open in external editor (appel du pont) puis retour dans Octogit : Result mis à jour · fichier résolu au terminal passé dans Resolved. `History` après Done (fichiers non indexés, stash conservé) et après Abort. `WorkingChanges` : fichiers en conflit signalés.
- **Tailles d'écran** : 1500×900 (portable, plein écran), 1280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] resoudre-les-conflits CA-6 → test Rust (`crates/platform`) : chemin hors dépôt ou inexistant refusé ; test Rust (`crates/git/tests/conflict.rs`) : fichier résolu par `git add` relu dans Resolved ; test de composant : Open in external editor appelle la commande, retour de focus relit Result ; e2e : appel d'ouverture enregistré par le pont, fichier modifié au terminal, Result à jour, fichier `git add` au terminal passé dans Resolved
- [ ] resoudre-les-conflits CA-17 → test Rust (`crates/git/tests/stash.rs`) : Pop et Apply en conflit, Done désindexe et garde le stash, Abort restaure les fichiers touchés (suivis et non suivis) et garde le stash ; test de composant `OperationBanner` : variante Pop / Apply, Done à la place de Continue ; test de composant `ConflictResolver` : Done désactivé avec un fichier en conflit ; e2e : Pop en conflit ouvre `ConflictResolver`, résoudre puis Done, `git stash list` et `git status` au terminal ; Abort avec et sans confirmation
- [ ] resoudre-les-conflits CA-20 → test Rust : Keep ours, Keep theirs, Delete sur binaire, supprimé d'un côté, renommé ; Delete absent si aucun côté n'a supprimé ; fichier indexé ensuite ; test de composant `ConflictPane` : pas de `<textarea>`, choix proposés selon le type ; e2e : choix puis fichier dans Resolved
- [ ] Décisions 1 et 2 → test selon la réponse

## Hors périmètre
- Conflits de rebase, de Pull (rebase), de cherry-pick et de revert, opération trouvée ou lancée au terminal (`OperationBanner` à l'ouverture ou au retour dans Octogit) : S-40 (CA-9, CA-10, CA-15).
- Désactivation des gestes (Stash, Pop, checkout, merge…) pendant l'opération : S-50 (CA-16).
- Message d'échec de Continue en trois éléments : S-53 (CA-12). Accès clavier complet de l'écran : S-56 (CA-18) ; ici les contrôles sont des éléments natifs focalisables.
- Pop et Apply eux-mêmes, Drop, Stash : S-32 (livrés).
- Réglage d'un éditeur : Octogit n'en a aucun.
- Undo après Done, Abort ou Keep / Delete : non-objectif.

## Documentation à mettre à jour
- README, section « Graphe de `History` » : un Pop ou un Apply en conflit ouvre `ConflictResolver` avec Abort et Done (stash conservé) ; fichiers non fusionnables (Keep ours / Keep theirs / Delete) ; Open in external editor (application par défaut de macOS) ; fixture `fixtures/conflict-stash.sh` (usage : `conflict-stash.sh <dossier>`). Mettre à jour la phrase de S-32 qui dit que les conflits de Pop / Apply sont seulement signalés dans `WorkingChanges`.
- `ux/ecrans/conflict-resolver.md`, `ux/ecrans/communs.md`, `ux.md` : aucun changement ; si dev constate un écart, le signaler au reviewer sans modifier ces fichiers.
- `.env.example` : aucune variable ajoutée. Rattrapage : README relu seulement sur les extraits de cette story ; S-38 et S-39 n'étaient pas livrées à la rédaction, vérifier que leurs mentions README (conflit de merge laissé en cours, `OperationBanner`) sont bien en place.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`

| # | Agent | Résultat | Verdict |
|---|---|---|---|

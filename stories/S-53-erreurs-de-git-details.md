# Story S-53 : Erreurs de Git : message d'une ligne et « Details » avec la sortie brute, Continue refusé, rien ne reste en cours

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-53-erreurs-de-git-details.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-53 (tranche durcissement) ; dépend de S-50
- Critères couverts : `specs/gerer-les-branches.md` CA-22 ; `specs/integrer-une-branche.md` CA-15 ; `specs/revenir-en-arriere.md` CA-8 ; `specs/synchroniser.md` CA-20 ; `specs/resoudre-les-conflits.md` CA-12 (toutes validées le 07/11/2026)
- Jobs servis : J-3, J-6, J-8, J-9, J-16
- Revue renforcée : oui (architecture : le contrat d'erreur de nombreuses commandes Tauri passe d'une chaîne seule à message + sortie brute)

## Objectif
Quand Git refuse ou échoue (checkout, création, Rename, suppression, merge, rebase, cherry-pick, revert, fetch, pull, push, Continue), l'interface affiche un message d'une ligne et un lien « Details » qui montre la sortie brute de Git ; Continue refusé affiche trois éléments ; aucune opération ne reste en cours et rien n'a changé.

## Critères d'acceptation
- **gerer-les-branches CA-22** : Étant donné un checkout, une création, un Rename ou une suppression refusé par Git pour une autre raison (dont `origin` injoignable), alors un message d'une ligne s'affiche et « Details » montre la sortie brute de Git ; rien n'a changé.
- **integrer-une-branche CA-15** : Étant donné un merge ou un rebase refusé par Git pour une autre raison (ex. fichier non suivi qui serait écrasé), alors un message d'une ligne s'affiche et « Details » montre la sortie brute de Git ; aucune opération ne reste en cours.
- **revenir-en-arriere CA-8** : Étant donné un cherry-pick ou un revert refusé par Git pour une autre raison, alors un message d'une ligne s'affiche et « Details » montre la sortie brute de Git ; aucune opération ne reste en cours.
- **synchroniser CA-20** : Étant donné un fetch, un pull ou un push en échec (ex. « Permission denied (publickey). »), alors un message d'une ligne s'affiche, et « Details » montre la sortie brute de Git. Les branches locales et l'arbre de travail n'ont pas changé.
- **resoudre-les-conflits CA-12** : Étant donné Continue refusé par Git (ex. « error: Committing is not possible because you have unmerged files. »), alors trois éléments s'affichent : « Continue failed. », la sortie brute de Git, et « Repository left as is. Resolve, then Continue again. ». L'opération reste en cours. Les branches, l'index et l'arbre de travail ne changent pas.

## Décisions de l'humain
### Fiche (à remplir)
1. Périmètre des actions qui reçoivent « Details » : a) seulement les actions listées par les specs (recommandation retenue par l'humain, 25/11/2026)
2. Une opération laissée par Git après un refus (autre qu'un conflit) : a) Octogit annule lui-même cet état si aucun fichier n'est en conflit (recommandation retenue par l'humain, 25/11/2026)

### Après la revue 1
- Mineur README renvoyant à S-53 : traité au passage 2 (d'office)
- Pour information : `rerere` et Décision 2 (merge ou rebase annulé sans fichier en conflit) : pris en compte (pour information), reporté dans `notes-production.md`

### Après la revue 2
- Pour information : même point `rerere` : pris en compte (pour information)

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` (le crate `app` s'appelle `octogit-app`, ses tests sont dans `src-tauri/`) ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, faux `ssh`, `origin` = dépôt `--bare` par chemin ; port et données par `.env.local` en worktree)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais à la main ; aussi régénéré par `pnpm tauri dev`)
- Tokens de style : `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`) ; couleur du lien « Details » : token `link` ; aucun nouveau token
- Conventions : `snake_case` en Rust, `camelCase` en TypeScript, composants Svelte en `PascalCase` ; interface en anglais ; crate `app` (`src-tauri`) sans logique (la logique va dans `git`, `store`, `identity`, `platform`) ; sortie de `git` gardée brute ; icônes Lucide 16 px, trait 1,8 px, devant chaque libellé de bouton ; CSS natif, couleurs par les tokens seulement ; texte ≥ 12 px, sens jamais porté par la couleur seule ; jamais d'appel réel à GitHub dans les tests (faux `ssh` en tête du `PATH`, `origin` = dépôt `--bare` par chemin) ; aucune nouvelle dépendance

## Contexte technique
- Dépend de S-50 (garde « Operation in progress. », refus d'identité) : ne pas les refaire ; leurs messages d'une ligne restent sans « Details » (ce ne sont pas des erreurs de Git). Les refus de Git déjà nommés par S-51 (modifications non commitées) et S-52 (HEAD détachée, commit racine…) gardent leur texte exact, sans « Details » : S-53 ne couvre que « une autre raison ».
- Aujourd'hui : les commandes Tauri rendent `Result<_, String>` ; les messages sont construits par `checkout_message`, `branch_message`, `remote_delete_message`, `tag_message` (`src-tauri/src/fetch.rs`, ~l. 133-360) et les `map_err` de `push`, `fetch`, `pull`. L'interface ne garde que la première ligne (`(typeof e === "string" ? e : "The action failed.").split("\n")[0]` dans `src/App.svelte` ~l. 1097, 1200, 1242, 1267, 1305, 1330 ; `operationError` pour Continue via `endOperation` l. 145-174 ; `syncNotice`, `pushNotice`, `checkoutNotice` dans `src/lib/screens/History.svelte`, affichés par `SyncButton`, `PushButton` et un `<p class="error" role="alert">` ~l. 846). La sortie brute de Git est donc perdue. Erreurs typées du crate `git` à compléter pour qu'elles gardent la sortie brute : `CheckoutError`, `BranchError`, `TagError`, `PushError`, `FetchError`, `PullError`, `RewriteError` (`crates/git/src/*.rs`), et l'erreur de merge, rebase, cherry-pick, revert, Continue (`crates/git/src/operation.rs` et `src-tauri/src/working_tree.rs`, `merge_checked`, `rebase_checked`, `cherry_pick_checked`, `revert_checked`, `continue_operation_checked`).
- Contrat : une erreur portant le message d'une ligne et la sortie brute (forme au choix de `dev`, par exemple une structure d'erreur partagée par les commandes concernées, avec `tauri-specta` puis `pnpm gen:bindings` ; ou, en restant sur `String`, une convention « première ligne = message, suite = sortie brute » appliquée partout et testée). Un seul patron pour toutes les actions, pas une variante par bouton. `src/lib/bindings.test.ts` à ajuster si besoin. `ForcePushDialog` a déjà son « Details » (`src/lib/components/ForcePushDialog.svelte`, S-24) : reprendre son patron visuel (lien `Details` en bouton texte qui déplie la sortie brute) et son composant si possible, sans modifier ses textes ni CA-18.
- Message d'une ligne : la raison lisible de Git (ex. « Permission denied (publickey). », première ligne utile de la sortie), jamais une ligne vide ni le chemin d'un sous-processus ; sortie brute de Git conservée telle quelle (pas de réécriture) dans « Details ». Les timeouts et les erreurs de lancement de `git` (« Git could not run. ») restent des messages d'une ligne ; « Details » seulement quand Git a produit une sortie.
- Aucune opération ne reste en cours après un refus (CA-15 de `integrer-une-branche`, CA-8 de `revenir-en-arriere`) : après l'échec d'un merge, rebase, cherry-pick ou revert qui n'est pas un conflit, `octogit_git::read_operation(path)` ne doit rien trouver ; voir Décisions 2 pour le cas où Git laisserait un état. Un conflit reste en cours (S-38 à S-41, inchangé).
- Continue refusé (CA-12) : `continue_operation` (`src-tauri/src/commands.rs` ~l. 660) et `continue_operation_checked`. Trois éléments dans `OperationBanner` (`src/lib/components/OperationBanner.svelte`, prop `error`, aujourd'hui une ligne dans `<span class="error" role="alert">`) et dans `ConflictResolver` quand il est ouvert : « Continue failed. », la sortie brute de Git (affichée directement, sans « Details »), « Repository left as is. Resolve, then Continue again. ». `operationError` de `src/App.svelte` (l. 157-170) à passer d'une chaîne à une forme portant la sortie brute. Cette forme ne vaut que pour Continue ; Done et Abort gardent « Done failed. » / « Abort failed. » avec la première ligne. L'opération reste en cours, rien n'est relu comme terminé. Fixture de refus : `fixtures/conflict-merge.sh` avec un fichier encore en conflit (index non résolu) ; Continue d'identité (désactivé d'emblée, S-50) hors sujet.
- Fetch / Pull / Push : `src-tauri/src/fetch.rs` (`fetch_all_repository`, `pull_repository`, `push_repository`), `SyncButton.svelte`, `PushButton.svelte` : leurs états « erreur » (ux : « message d'une ligne, Details »). Le fetch automatique (`fetch_repository`, `FetchStatus`) n'est pas concerné. Un échec ne change ni les branches locales, ni l'arbre de travail, ni `FetchStatus` (S-18 : dernier âge gardé). Les refus déjà nommés (« Branch has diverged… », « Branch not published. », refus de push CA-15 de `synchroniser`) gardent leurs textes.
- Checkout, création, Rename, suppression : `checkout_repository`, `create_branch_repository`, `rename_branch_repository`, `delete_branch_repository`, `delete_remote_branch_repository` (`src-tauri/src/commands.rs` ~l. 994-1110), dont `origin` injoignable. Notice partagée dans `History.svelte` (`checkoutNotice`) : elle doit pouvoir afficher « Details ». Écrans et composants : `ux/ecrans/history.md` (états « erreur (message d'une ligne, "Details" : sortie brute de Git) », « Messages »), `ux/ecrans/communs.md` ; maquette `ux/maquettes/history.html` (état d'erreur) ; `ux/direction/neon.html` ligne `.err` (« Fetch failed: … Details »). Direction visuelle de `ux.md` (CSS natif, tokens, SF Pro 13 px, jeton `--danger` pour l'erreur, lien en `link`).
- Merge, rebase (`merge_branch`, `rebase_branch`), cherry-pick, revert (`cherry_pick`, `revert`) : menus `RefContextMenu.svelte` et `CommitDetail.svelte`, erreurs déjà réduites à une ligne dans `App.svelte` (`integrate` ~l. 1094, ~l. 1267).
- Accessibilité de « Details » : bouton focalisable, `aria-expanded`, sortie brute en texte monospace à défilement, texte ≥ 12 px. Pas d'audit clavier complet (S-56).
- Pont de test et e2e : `src-tauri/examples/octogit-bridge.rs` (renvoyer la forme d'erreur choisie), `src/web-bridge.ts`, `e2e/helpers.ts` (faux `ssh` qui refuse : `Permission denied (publickey).`, voir `e2e/connection.spec.ts`, `e2e/clone.spec.ts`), `fixtures/lib.sh`, `fixtures/refs.sh`, `fixtures/push.sh` (`origin` bare ; `origin` rendu injoignable en changeant son URL). Modèles : `e2e/force-push.spec.ts` (Details, l. 154-158), `e2e/conflict-resolver.spec.ts`, `e2e/branch-remote-delete.spec.ts`. Fichier Rust de test voisin : `src-tauri/tests/integrate_guard.rs`, `cherry_pick_guard.rs`. Tests existants à faire évoluer : `src/lib/components/ForcePushDialog.test.ts`, `SyncButton` / `PushButton` / `OperationBanner` (`*.test.ts`), `src/lib/screens/History.test.ts`, `src/App.test.ts`.
- Reports vers S-53 lus dans les fiches : S-19 (erreurs réseau avec « Details »), S-23 (« Gestion fine des erreurs de Git avec Details »), S-26 / S-44 / S-45 (textes génériques d'une ligne à remplacer par message + « Details »), S-35 / S-37 / S-39 / S-40 / S-41 / S-43 (message d'échec de Continue en trois éléments), S-13 revue 1 (échec d'écriture présenté comme « changed by hand » : « reporter vers S-53 ou S-54 », voir `specs/configurer-les-profils.md` CA-18 : non repris par la ligne du plan, ne pas traiter ici sauf demande de l'humain).
- Fichiers gros : `src/App.svelte`, `crates/store/src/lib.rs` : `git grep -n` puis Read en offset et limit.
- `stack.md` : Architecture (binaire `git` en sous-processus, sortie brute gardée ; `app` sans logique), Intégrations (faux `ssh`, `origin` `--bare`), Tests ciblés. Aucune nouvelle dépendance.

## Interface à vérifier
- **Écrans et états** : `History` : erreur d'un checkout / Branch / Rename / suppression refusé par Git (message d'une ligne, « Details » ouvre la sortie brute, rien n'a changé) · erreur de Fetch All, Pull et Push sur `SyncButton` et `PushButton` (clé refusée par le faux `ssh`) · merge et rebase refusés (fichier non suivi écrasé), cherry-pick et revert refusés : message + « Details », aucun `OperationBanner` · `OperationBanner` et `ConflictResolver` après Continue refusé : « Continue failed. », sortie brute, « Repository left as is. Resolve, then Continue again. », opération toujours en cours · `ForcePushDialog` refusé inchangé
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] gerer-les-branches CA-22 → test Rust (`app`) : checkout, création, Rename, suppression locale et sur `origin` refusés par Git (dont `origin` injoignable) rendent le message d'une ligne et la sortie brute, branches et arbre inchangés ; Vitest : la notice affiche une ligne, « Details » révèle la sortie brute ; e2e : refus affiché avec « Details », `git branch` et `git status` inchangés
- [ ] integrer-une-branche CA-15 → test Rust (`app`, voisin de `integrate_guard.rs`) : merge et rebase refusés par un fichier non suivi qui serait écrasé : message + sortie brute, `read_operation` ne trouve aucune opération, branches, index et arbre inchangés ; e2e : message, « Details », pas de `OperationBanner`
- [ ] revenir-en-arriere CA-8 → test Rust (`app`) : cherry-pick et revert refusés pour une autre raison : message + sortie brute, aucune opération en cours ; e2e idem
- [ ] synchroniser CA-20 → test Rust (`app`, faux `ssh` qui refuse) : fetch, pull et push en échec rendent « Permission denied (publickey). » et la sortie brute, branches locales, arbre et `FetchStatus` inchangés ; Vitest `SyncButton` et `PushButton` : message d'une ligne et « Details » ; e2e : clé refusée, « Details » montre la sortie brute de Git
- [ ] resoudre-les-conflits CA-12 → test Rust (`app`) : Continue refusé (fichier non résolu) rend la sortie brute, l'opération reste en cours, branches, index et arbre inchangés ; Vitest `OperationBanner` : trois éléments dans l'ordre ; e2e (`fixtures/conflict-merge.sh`) : « Continue failed. », sortie brute, « Repository left as is. Resolve, then Continue again. », `git status` indique toujours le merge
- [ ] Décisions 1 et 2 → test selon la réponse

## Hors périmètre
- Raisons déjà nommées par d'autres stories : « Operation in progress. » et refus d'identité (S-50), modifications non commitées (S-51), HEAD détachée, commit racine, commit de merge, cherry-pick vide (S-52), réseau coupé, branche sans `origin`, boutons occupés, gros diffs (S-55).
- Fetch automatique et `FetchStatus` ; clone et dépôt introuvable (S-54) ; `ForcePushDialog` (S-24, inchangé).
- Messages d'erreur de Done, Abort, de l'identité (propagation des profils, S-13) : inchangés.
- Accès clavier complet et contraste (S-56) ; `ux.md`, `stack.md`, les specs.

## Documentation à mettre à jour
- README : section « Graphe de `History` » et sections de synchronisation, branches, merge / rebase, cherry-pick / revert, `ConflictResolver` : mention des erreurs de Git (message d'une ligne, « Details » avec la sortie brute, Continue refusé en trois éléments) ; retirer toute mention « pas encore livré » ou renvoi à S-53 que cette story livre.
- Rattrapage : vérifier que le README reflète les stories livrées jusqu'à S-49 (et S-50 à S-52 si livrées) ; `.env.example` : aucun changement, aucune variable ajoutée par S-53.

## Terminé quand
- [ ] À chaque passage de `dev` : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm tauri build`, plus les e2e liés au diff (`pnpm e2e <fichier>`)
- [ ] Avant le commit, une fois, par l'agent story-runner : `pnpm e2e` ; `pnpm audit:deps` seulement si `pnpm-lock.yaml` ou `Cargo.lock` a changé depuis la Référence
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `cda6f0d`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 2 | reviewer | tous les problèmes de la revue 1 levés, aucun nouveau | validé |
| 2 | run de fin | `pnpm e2e` : 507 verts, 1 rouge reproductible seul : `e2e/dirty-refusal.spec.ts:94` (Merge refusé avec modification indexée attend « Commit or stash your changes before merging. », reçoit « …before switching branches. ») ; audit non lancé (lockfiles inchangés) | rouge : passage 3 |
| 3 | reviewer | correctif de test légitime, aucun problème | validé |
| 3 | run de fin | `pnpm e2e` complet vert ; audit non lancé (lockfiles inchangés) | vert |
| 3 | dev | terminé : course préexistante dans `e2e/dirty-refusal.spec.ts` (attente de « WIP 1 changed file » avant le Merge), code inchangé ; tests, lint, build, e2e liés (110) verts | — |
| 2 | dev | terminé : bandeau + bloc d'échec dans le flux (`--banner-h` mesuré), « <Geste> failed: <ligne> », e2e cherry-pick / revert, `isOnTop`, README ; tests, lint, build, e2e liés (124) verts | — |
| 1 | reviewer | 3 bloquants (bloc Continue en position fixe qui recouvre l'interface ; messages sans « <Geste> failed: » comme la maquette ; pas d'e2e cherry-pick / revert), 1 mineur (README renvoie encore à S-53) | à corriger |
| 1 | dev | terminé : contrat `String` conservée (première ligne = message, suite = sortie brute, `failure_text` / `splitGitError`), `ErrorDetails`, Fetch All alimente `syncNotice`, Décision 2 appliquée ; tests, lint, build, e2e liés (198) verts | — |

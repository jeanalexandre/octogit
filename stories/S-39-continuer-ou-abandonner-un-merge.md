# Story S-39 : Terminer ou abandonner un merge en conflit : Continue, Abort confirmé, `OperationBanner` sur tous les écrans, retour au graphe

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-39-continuer-ou-abandonner-un-merge.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-39 (tranche valeur 11) ; dépend de S-38 (`stories/S-38-conflict-resolver-merge.md` : `ConflictResolver`, merge laissé en cours, liste des fichiers par groupe, Mark as resolved)
- Critères couverts : `resoudre-les-conflits` CA-7, CA-8, CA-11, CA-13, CA-14, CA-19, CA-21 (`specs/resoudre-les-conflits.md`, validée le 07/11/2026)
- Jobs servis : J-9
- Revue renforcée : non

## Objectif
Un merge en conflit se termine par Continue (commit de merge au message par défaut de Git, identité du profil) ou se défait par Abort (confirmé si une résolution est faite) ; `OperationBanner` rappelle l'opération sur `History`, `DiffView`, `ConflictResolver` et `ProfileSettings`, Back to graph (Échap) et Resolve passent du graphe à `ConflictResolver` sans perdre les résolutions.

## Critères d'acceptation
Périmètre de la story : l'opération en cours est un **merge lancé dans Octogit** (livré par S-38). Les autres opérations (rebase, Pull (rebase), cherry-pick, revert, Pop, Apply), la détection d'une opération lancée au terminal (CA-15) et le désactivation des gestes pendant l'opération (CA-16) ne sont pas ici.
- **resoudre-les-conflits CA-7** : Étant donné au moins un fichier dans Conflicted, alors Continue est désactivé. Quand le dernier fichier passe dans Resolved, alors Continue devient actif et l'écran affiche « ✓ n resolved · m auto-merged ».
- **resoudre-les-conflits CA-8** : Étant donné un merge en conflit où tout est résolu, quand je clique sur « Continue merge », alors le commit de merge est créé avec le message par défaut de Git (`specs/integrer-une-branche.md`, CA-6) et l'identité du profil (CA-8 de la même spec). `OperationBanner` disparaît et `History` s'affiche. Dans le terminal, `git status` n'indique aucune opération en cours.
- **resoudre-les-conflits CA-11** : Étant donné une opération en conflit, quand je confirme Abort, alors l'opération est abandonnée. La branche courante, l'index et l'arbre de travail reviennent à leur état d'avant l'opération. Pour un Pull (rebase), la branche pointe sur son commit d'avant le pull. `OperationBanner` disparaît, et `git status` n'indique aucune opération en cours. (Ici : le merge ; le Pull (rebase) est à S-40.)
- **resoudre-les-conflits CA-13** (modifié le 07/11/2026) : Étant donné une opération en cours, alors `OperationBanner` est visible sur `History`, `DiffView`, `ConflictResolver` et `ProfileSettings`. Il nomme l'opération et ses branches (« Merge in progress · develop into feature/profiles ») et le nombre de fichiers restants (« 1 file left »). Pour un rebase, il nomme aussi l'étape (« 2 / 5 »). Il propose Abort et Continue, actif selon CA-7. Hors de `ConflictResolver`, il propose aussi Resolve. Étant donné un dépôt non conforme ou « No profile », alors Continue est désactivé d'emblée, même si tout est résolu. La raison d'identité s'affiche (ex. « Identity does not match profile Work. » ; texte : `specs/proteger-l-identite.md`, CA-13 et CA-15). Abort reste actif. Aucun clic ni raccourci ne lance Continue, et `git status` indique la même opération en cours. (Voir « À confirmer » 1 pour la partie identité.)
- **resoudre-les-conflits CA-14** : Étant donné `ConflictResolver`, quand je fais Échap ou clique sur Back to graph, alors `History` s'affiche, `OperationBanner` reste, et l'opération reste en cours. Quand je clique sur Resolve dans `OperationBanner`, alors `ConflictResolver` revient avec les résolutions déjà marquées.
- **resoudre-les-conflits CA-19** : Étant donné au moins un fichier marqué résolu, quand je clique sur Abort, alors une confirmation nomme ce qui sera perdu (ex. « Abort rebase? 2 resolved files will be lost. »). Après annulation, rien ne change. Étant donné aucun fichier encore résolu, alors Abort agit sans confirmation.
- **resoudre-les-conflits CA-21** : Étant donné un merge en cours, alors Commit et Amend de `WorkingChanges` sont désactivés avec la raison « Merge in progress ». Cmd+Entrée ne crée aucun commit. Seul Continue termine le merge (CA-8).

## Décisions de l'humain
### Fiche (à remplir)
1. Continue sur dépôt non conforme ou « No profile » (CA-13) dans S-39 ou à S-50 : 1a, dans S-39 : Continue désactivé avec « Identity does not match profile Work. » et refusé aussi par `ensure_conform`

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple dont un merge en conflit, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css`
- Conventions : binaire `git` en sous-processus pour toute écriture, sortie brute gardée ; identité et signature lues par `git` dans le `.git/config` local, rien dans `~/.gitconfig` ; commandes et événements Tauri dans `src-tauri/src` sans logique ; `snake_case` en Rust, `camelCase` en TypeScript, écrans dans `src/lib/screens/` et composants dans `src/lib/components/` en `PascalCase` au nom exact de `ux.md` ; CSS natif, couleurs par tokens seulement, icônes Lucide (16 px, trait 1,8 px) devant chaque libellé de bouton ; interface en anglais, messages courts, sans « you » ; texte ≥ 12 px, jamais d'information portée par la couleur seule ; Conventional Commits en anglais

## Contexte technique
- Dépend de S-38 (pas livrée à la rédaction) : relire sa fiche et le code livré avant de coder. S-38 crée `crates/git/src/conflict.rs` (liste Conflicted / Resolved / Auto-merged, lecture Ours / Theirs, écriture et indexation d'un fichier), l'issue « conflit » de `merge_branch` (merge laissé en cours : `MERGE_HEAD`), `src/lib/screens/ConflictResolver.svelte`, `src/lib/components/ConflictPane.svelte`, `src/lib/conflictBlocks.ts`, l'état dédié de `ConflictResolver` dans `src/App.svelte` (par-dessus `History` `inert`, même patron que `diff`), `fixtures/conflict-merge.sh` (2 fichiers en conflit dont un à 2 blocs, un auto-fusionné) et `e2e/conflict-resolver.spec.ts`. Les décisions 1 (sortie de `ConflictResolver` avant S-39) et 2 de la fiche S-38 peuvent avoir laissé une sortie provisoire : la remplacer par Back to graph / Échap ici.
- Rien n'existe pour `OperationBanner` (Grep fait : aucune occurrence dans `src/`, `src-tauri/`, `crates/`). Pas de détection d'opération lancée au terminal (CA-15 : S-40) : l'opération en cours est connue de l'interface depuis l'issue « conflit » de `merge_branch` (branche source, branche qui reçoit) ; le nombre de fichiers restants se relit par la liste de `conflict.rs` après chaque Mark as resolved. Au choix de dev : relire aussi `MERGE_HEAD` à l'ouverture du dépôt pour CA-21 (Commit désactivé), si la lecture de l'arbre le permet sans élargir le périmètre.
- Rust, crate `git` : `crates/git/src/conflict.rs` (ou `integrate.rs`, au choix de dev) ; modèle de `run` : `crates/git/src/integrate.rs` (`GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, stdin nul, `HOME` optionnel pour les tests). À ajouter pour le merge :
  - Continue : `git commit --no-edit` pendant le merge (message de `MERGE_MSG`, « Merge branch 'develop' into feature/profiles »), auteur, committer et signature du `.git/config` local ; si Git refuse (fichiers non fusionnés), rendre sa sortie brute sans rien changer et l'opération reste en cours ; rend l'arbre relu (`read_working_tree`, `remember`).
  - Abort : `git merge --abort` ; branche, index et arbre de travail reviennent à l'état d'avant ; rend l'arbre relu.
  - Garde cœur : `commit` et l'amend refusent pendant un merge en cours (`MERGE_HEAD` présent), raison « Merge in progress » (CA-21), sans se fier à l'affichage. Modèles : `crates/git/src/integrate.rs` (`in_progress`), `commit` existant et `src-tauri/tests/commit_guard.rs`.
  - Tests : `crates/git/tests/conflict.rs` (ou `integrate.rs`) : Continue crée le commit de merge à deux parents, message par défaut, auteur et committer = identité du profil, signé si le profil signe, `git status` sans opération ; Abort remet HEAD, index et arbre dans l'état d'avant ; Continue avec un fichier encore en conflit : refus, `MERGE_HEAD` toujours présent ; commit refusé pendant un merge.
- Rust, crate `app` : `src-tauri/src/working_tree.rs` (`merge_checked`, `commit_checked`, `cherry_pick_checked` comme modèles : `crate::attach::ensure_conform(store, path, home)` avant Continue, selon « À confirmer » 1), `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` (enregistrement), `src-tauri/examples/octogit-bridge.rs` (pont de test : nouvelles commandes à côté de `"merge_branch"`), puis `pnpm gen:bindings`. Pas de logique dans `app` hors garde d'identité. Tests : `src-tauri/tests/` (modèles : `integrate_guard.rs`, `commit_guard.rs`) : identité non conforme ou « No profile », Continue refusé et `MERGE_HEAD` inchangé.
- Interface : nouveau composant `src/lib/components/OperationBanner.svelte` (`ux/ecrans/communs.md`, ligne `OperationBanner` : « Merge in progress · develop into feature/profiles · 1 file left », Resolve hors `ConflictResolver`, Continue actif quand tout est résolu, Abort ; libellé « Continue merge » comme dans la maquette `ux/maquettes/conflict-resolver.html`) monté sur `History`, `DiffView`, `ConflictResolver` et `ProfileSettings` (`src/lib/screens/`) ; test de composant sur le modèle de `src/lib/components/ResetHardDialog.test.ts`. `src/lib/screens/ConflictResolver.svelte` : Continue, Abort, Back to graph, Échap. Confirmation d'Abort : un dialogue du même patron que `src/lib/components/ResetHardDialog.svelte` / `DiscardDialog.svelte` (Cancel focalisé, Échap annule), texte « Abort merge? 2 resolved files will be lost. » (compte des fichiers du groupe Resolved, singulier géré ; les Auto-merged ne comptent pas) ; sans fichier résolu, Abort agit sans confirmation.
- Interface, `src/App.svelte` (gros fichier : repérer par `git grep -n`, lire en offset et limit) : état de l'opération en cours, Back to graph et Resolve (retour à `ConflictResolver` avec les résolutions déjà marquées : la liste se relit du dépôt, rien n'est perdu), `applyCommitted` après Continue ou Abort (graphe et arbre relus, `ConflictResolver` fermé, bandeau retiré). Garde « un seul geste à la fois » (`checkoutPath`) inchangée. `WorkingChanges` (`src/lib/components/WorkingChanges.svelte`) : Commit et Amend désactivés avec la raison « Merge in progress », Cmd+Entrée sans effet ; modèle de l'état désactivé par identité (`blocked`, ligne ~74 : « Identity does not match profile … »). Raison d'identité de Continue : même texte, repris de cet état (le texte relève de `specs/proteger-l-identite.md`).
- Pont de test et e2e : `src/web-bridge.ts` et `e2e/helpers.ts` (ajouter les commandes) ; compléter `e2e/conflict-resolver.spec.ts` (modèles : `e2e/integrate.spec.ts`, `e2e/cherry-pick.spec.ts`) sur `fixtures/conflict-merge.sh` ; identité non conforme : `fixtures/identity.sh` (modèle : `e2e/identity-block.spec.ts`). Aucun appel réseau.
- Interface : `ux/ecrans/conflict-resolver.md` (ouverture, contenu et actions, états « tout résolu », « confirmation d'Abort », « non conforme ou "No profile" ») et `ux/ecrans/communs.md` (`OperationBanner`) ; maquettes `ux/maquettes/conflict-resolver.html` (« All resolved », « Back on the graph during the operation », « Identity mismatch → Continue refused ») et `ux/maquettes/history.html` section 3 (variantes de bandeau) ; « Direction visuelle » de `ux.md` (« Neon », SF Mono 12 px pour chemins et SHA, rayons 7 / 10 px) ; tokens dans `src/lib/styles/tokens.css` (`warning`, `success`, `focus`).
- Spécifications de `stack.md` utiles : « Accès à Git » (écritures par le binaire `git`, sortie brute) ; « Détection des changements » (`notify` : l'opération lancée au terminal est à S-40, non utilisée ici).
- Reports : aucun point « reporter vers S-39 » dans les fiches existantes (Grep fait dans `stories/`).

## Interface à vérifier
- **Écrans et états** : `ConflictResolver` : tout résolu (« ✓ n resolved · m auto-merged », « Continue merge » actif) · Continue désactivé tant qu'un fichier est en conflit · Abort avec confirmation (« Abort merge? 2 resolved files will be lost. ») et sans confirmation · Back to graph / Échap. `OperationBanner` : sur `History` (avec Resolve), `DiffView`, `ConflictResolver` (sans Resolve) et `ProfileSettings` ; « Merge in progress · develop into feature/profiles · 1 file left » ; identité non conforme (Continue désactivé, raison affichée, Abort actif). `History` : après Continue (commit de merge en tête, bandeau disparu) et après Abort. `WorkingChanges` : Commit et Amend désactivés, « Merge in progress ».
- **Tailles d'écran** : 1500×900 (portable, plein écran), 1280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] resoudre-les-conflits CA-7 → test de composant : Continue désactivé avec un fichier dans Conflicted, actif sans, « ✓ n resolved · m auto-merged » ; e2e
- [ ] resoudre-les-conflits CA-8 → test Rust : commit de merge à deux parents, message par défaut, identité du profil, signé si le profil signe, `git status` sans opération ; e2e : `git log -1` et `git status` au terminal
- [ ] resoudre-les-conflits CA-11 → test Rust : Abort remet HEAD, index et arbre dans l'état d'avant, plus de `MERGE_HEAD` ; e2e : bandeau disparu, `git status` propre
- [ ] resoudre-les-conflits CA-13 → test de composant `OperationBanner` : texte, « n file(s) left », Resolve absent dans `ConflictResolver`, Continue désactivé avec la raison d'identité, Abort actif ; test `src-tauri/tests/` : identité non conforme ou « No profile », Continue refusé, `MERGE_HEAD` toujours présent ; e2e : bandeau sur `History`, `DiffView`, `ConflictResolver`, `ProfileSettings`
- [ ] resoudre-les-conflits CA-14 → e2e : Échap et Back to graph ramènent à `History` avec le bandeau, l'opération reste en cours ; Resolve rouvre `ConflictResolver` avec les fichiers déjà résolus dans Resolved
- [ ] resoudre-les-conflits CA-19 → test de composant : confirmation nommant les fichiers résolus, annuler ne change rien ; e2e : sans fichier résolu, Abort sans confirmation
- [ ] resoudre-les-conflits CA-21 → test Rust : commit refusé pendant un merge ; test de composant `WorkingChanges` : Commit et Amend désactivés, « Merge in progress », Cmd+Entrée sans effet ; e2e
- [ ] Décision 1 → test selon la réponse

## Hors périmètre
- Continue et Abort des conflits de rebase, de Pull (rebase), de cherry-pick et de revert, étape « 2 / 5 » du bandeau, détection d'une opération lancée au terminal ou trouvée à l'ouverture et disparition au retour dans Octogit (CA-9, CA-10, CA-15) : S-40.
- Conflits de Pop et d'Apply (Done), fichiers non fusionnables, Open in external editor, fichier résolu au terminal : S-41.
- Désactivation des gestes pendant l'opération (checkout, Branch, Rename, Delete, Stash, Pop, merge, rebase, cherry-pick, revert, reset, Fetch All, Pull, Push ; CA-16) et refus de l'identité non conforme pour les autres opérations : S-50.
- Message d'échec de Continue en trois éléments (« Continue failed. », sortie brute, « Repository left as is. Resolve, then Continue again. », CA-12) : S-53 ; ici, un refus de Git laisse l'opération en cours et affiche au moins la première ligne de sa sortie.
- Accès clavier complet de l'écran (CA-18) : S-56 ; ici les contrôles sont des éléments natifs focalisables, Échap ramène au graphe.
- Undo après Continue ou Abort : non-objectif.

## Documentation à mettre à jour
- README, section « Graphe de `History` » : un merge en conflit se termine par Continue (commit de merge, message par défaut de Git, identité du profil) ou Abort (confirmé si un fichier est résolu) ; `OperationBanner` (Resolve, Continue, Abort) sur `History`, `DiffView`, `ConflictResolver` et `ProfileSettings` ; Back to graph / Échap ; Commit et Amend désactivés pendant un merge (« Merge in progress »). Mentionner que le rebase en conflit reste annulé jusqu'à S-40 et que les gestes ne sont pas encore désactivés pendant l'opération (S-50).
- `ux/ecrans/conflict-resolver.md`, `ux/ecrans/communs.md`, `ux.md` : aucun changement.
- `.env.example` : aucune variable ajoutée. Rattrapage : README et `.env.example` relus à la rédaction ; la mention S-37 « en cas de conflit (avant S-38 à S-40), l'opération est annulée par `git merge --abort` » (README, même section) est corrigée par S-38 : vérifier qu'elle l'est.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|

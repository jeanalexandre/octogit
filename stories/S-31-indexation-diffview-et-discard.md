# Story S-31 : Indexation fine dans `DiffView` et Discard changes

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-31-indexation-diffview-et-discard.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-31 (tranche valeur 8)
- Critères couverts : `preparer-un-commit` CA-6, CA-7, CA-8, CA-9, CA-24, CA-25, CA-26 (`specs/preparer-un-commit.md`)
- Jobs servis : J-2
- Revue renforcée : non

## Objectif
Un clic sur un fichier de `WorkingChanges` ouvre `DiffView` en mode travail (non indexé) ou indexé, où j'indexe ou désindexe le fichier, un bloc ou des lignes choisies, et un clic droit sur un fichier non indexé ou non suivi propose Discard changes, confirmé.

## Critères d'acceptation
- **preparer-un-commit CA-6** : Étant donné un fichier non indexé de `WorkingChanges`, quand je clique dessus, alors `DiffView` s'ouvre en mode travail sur ce fichier, avec Stage file, un Stage hunk par bloc, et « File i / n ».
- **preparer-un-commit CA-7** : Étant donné `DiffView` en mode travail, quand je clique sur Stage hunk, alors seul ce bloc est indexé : `git diff --cached` contient ce bloc et `git diff` contient les autres.
- **preparer-un-commit CA-8** : Étant donné 2 lignes sélectionnées par Maj+clic ou glissé dans la marge, quand je clique sur Stage selected lines, alors seules ces 2 lignes sont indexées.
- **preparer-un-commit CA-9** : Étant donné `DiffView` en mode travail, quand je passe au fichier suivant ou précédent, alors le diff du fichier voisin dans `WorkingChanges` s'affiche ; quand je fais Échap, alors `History` revient avec la ligne WIP sélectionnée.
- **preparer-un-commit CA-24** : Étant donné un fichier indexé de `WorkingChanges`, quand je clique dessus, alors `DiffView` s'ouvre en mode indexé avec Unstage file, un Unstage hunk par bloc et Unstage selected lines ; chacun retire de l'index exactement le fichier, le bloc ou les lignes visés, le reste de l'index ne change pas.
- **preparer-un-commit CA-25** : Étant donné un clic droit sur un fichier suivi non indexé, quand je choisis Discard changes, alors une confirmation nomme le fichier ; après confirmation, ses modifications non indexées disparaissent de l'arbre de travail et de `git diff` ; après annulation, rien ne change.
- **preparer-un-commit CA-26** : Étant donné un clic droit sur un fichier non suivi (ex. `lib/ProfileBadge.svelte`), quand je choisis Discard changes, alors la confirmation dit que le fichier sera supprimé (« ProfileBadge.svelte will be deleted. ») ; après confirmation, le fichier n'existe plus sur le disque ni dans `WorkingChanges` ; après annulation, rien ne change.

## Décisions de l'humain
### Fiche (19/11/2026)
1. Dernier bloc d'un fichier indexé ou désindexé : a) `DiffView` reste ouvert sur un état vide « No more changes in this file », avec Previous / Next file et Échap ; rien ne bouge sans geste de l'humain.

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test avec les vraies commandes du crate `app`, dépôts d'exemple dans un dossier temporaire) ; `pnpm tauri dev` n'est pas isolé (port 1420), aucune preuve de revue ne l'utilise
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css` (écrit à partir de `ux/tokens.md`, seule source des couleurs)
- Conventions : `git` (binaire, sous-processus) pour toute écriture (index, arbre de travail), `gix` pour la lecture, dans le crate `git` ; `src-tauri` sans logique (commandes et événements typés `tauri-specta`) ; `snake_case` en Rust, `camelCase` en TypeScript, composants en `PascalCase` au nom de `ux.md` ; interface en anglais ; CSS natif, styles propres au composant ; icônes Lucide (trait 1,8 px, 16 px, sans remplissage) ; tout au clavier, focus visible, texte 12 px au moins, jamais la couleur seule ; aucune nouvelle dépendance sans demande

## Contexte technique
- Dépend de S-29 (`DiffView` en mode commit, lecture seule) et S-14 (`WorkingChanges`). `stack.md` : Rust `git` binaire pour les écritures, détection `notify` dans le crate `git` ; l'indexation partielle (bloc, lignes) et l'abandon des modifications d'un fichier (restauration d'un fichier suivi, suppression d'un fichier non suivi) sont des écritures : binaire `git` (ex. `git apply --cached` avec un patch construit pour le bloc ou les lignes, `git apply --cached --reverse` ou `git reset` pour désindexer, `git restore` pour Discard), sans écrire dans `~/.gitconfig`.
- Rust, crate `git` : `crates/git/src/diff.rs` (`read_file_diff(path, id, file)`, `FileDiff`, `FileDiffContent::{Text, Binary}`, `DiffLine`/`DiffLineKind` : lecture d'un fichier d'un commit seulement, à étendre aux diffs de l'arbre de travail contre l'index et de l'index contre HEAD, mêmes types), `crates/git/src/working_tree.rs` (`read_working_tree`, `stage_all`, `unstage_all` : modèle des écritures qui rendent l'état relu, `WorkingTree`, `WorkingTreeWatcher`), `crates/git/src/lib.rs` (`FileChange`, `ChangeStatus`). Nouvelles fonctions à prévoir (noms libres) : diff de travail / indexé, stage / unstage d'un fichier, d'un bloc, de lignes, discard. Un diff de fichier non suivi est un ajout complet ; un binaire : Stage file seul.
- Tauri : `src-tauri/src/working_tree.rs` (vues sérialisées `WorkingTreeView`, `FileChangeView`, commandes `stage_all`, `unstage_all` : modèle), `src-tauri/src/commands.rs` et `src-tauri/src/lib.rs` (enregistrement des commandes) ; `src/lib/bindings.ts` généré.
- Interface : `src/lib/screens/DiffView.svelte` (mode commit existant ; ajouter les modes travail et indexé : Stage file / Unstage file, Stage hunk / Unstage hunk par bloc, Stage selected lines / Unstage selected lines, « File i / n » parmi les fichiers du groupe, Échap), `src/lib/screens/DiffView.test.ts` (modèle), `src/lib/screens/History.svelte` (reste monté sous `DiffView` ; prop `onopendiff` existante pour le mode commit : même schéma, mode travail ; au retour par Échap, la ligne WIP reste sélectionnée), `src/App.svelte` (navigation : `DiffView` par-dessus `History`), `src/lib/components/WorkingChanges.svelte` (le clic sur un fichier est inerte : ajouter un rappel d'ouverture ; clic droit, touche menu ou Maj+F10 sur un fichier non indexé ou non suivi), `src/lib/components/RefContextMenu.svelte` (menu à entrées extensibles : entrée « Fichier non indexé ou non suivi » = Discard changes) et le patron des confirmations modales de `ForcePushDialog.svelte` / `ResetHardDialog` (`ux/ecrans/dialogues.md`) pour la confirmation de Discard (Cancel avec Échap, bouton Discard ; texte « <fichier> will be deleted. » pour un non suivi ; confirmation qui nomme le fichier pour un suivi).
- Rafraîchissement : les écritures d'Octogit ne sont pas signalées par le watcher (`stack.md`, README) : après chaque Stage / Unstage / Discard, la commande rend l'état relu et `DiffView` ainsi que `WorkingChanges` / la ligne WIP se mettent à jour d'eux-mêmes.
- `ux/ecrans/diff-view.md` (contenu, états, composant `DiffView` : travail · indexé · commit · binaire · trop gros) et maquette `ux/maquettes/diff-view.html` : section 1 « Working diff (unified): stage file, hunk or lines » (mode travail, unifié, boutons Stage, « File i / n »), section 3 « Other states » (binaire avec Stage file disponible). `ux/ecrans/history.md` : « Entrées de `RefContextMenu` », ligne « Fichier non indexé ou non suivi » (Discard changes). Sélection de lignes : Maj+clic ou glissé dans la marge (CA-8), aussi au clavier.
- Direction visuelle (`ux.md`, « Direction visuelle ») : SF Mono 12 px pour code et chemins, icônes Lucide, rayons 7 px (contrôles), couleurs par les seuls tokens (`success`, `danger`, `surface`, `border`, `muted`, `focus`…), lignes ajoutées / supprimées marquées par « + » / « − » ; AA dans les deux thèmes.
- Fixtures : `fixtures/wip.sh` (arbre avec fichiers modifiés, indexés, non suivis, voir `e2e/working-changes.spec.ts`) et `fixtures/diff.sh` ; il faut un fichier texte à plusieurs blocs modifiés et un fichier non suivi : étendre une fixture (en vérifiant les tests qui la comptent) ou en ajouter une dans `fixtures/` avec `fixtures/lib.sh`. e2e : `e2e/diff-view.spec.ts` et `e2e/working-changes.spec.ts` (modèles), `e2e/helpers.ts`.
- Reports visant S-31 : S-67 (arbre qui devient propre) laisse à S-31 le test e2e de Discard (la logique de la ligne WIP repose sur l'état de l'arbre seul) : après un Discard qui vide l'arbre avec la ligne WIP sélectionnée, la ligne WIP disparaît et le dernier commit est sélectionné en moins de 1 s (`explorer-l-historique` CA-35).

## Interface à vérifier
- **Écrans et états** : `History` avec `WorkingChanges` puis `DiffView` en mode travail (unifié, Stage file, Stage hunk par bloc, Stage selected lines avec 2 lignes sélectionnées, « File i / n », premier et dernier fichier) · `DiffView` en mode indexé (Unstage file, Unstage hunk, Unstage selected lines) · fichier binaire avec Stage file disponible · clic droit sur un fichier suivi non indexé puis sur un fichier non suivi : confirmation de Discard changes (« … will be deleted. » pour le non suivi), confirmée et annulée · retour par Échap sur la ligne WIP sélectionnée
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web` ; port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] preparer-un-commit CA-6 → e2e : clic sur un fichier non indexé de `WorkingChanges`, `DiffView` en mode travail avec Stage file, un Stage hunk par bloc et « File i / n » ; test Rust du diff de travail (arbre contre index, fichier non suivi = ajout)
- [ ] preparer-un-commit CA-7 → test Rust : Stage hunk sur un fichier à plusieurs blocs, `git diff --cached` contient ce bloc et `git diff` les autres ; e2e sur le bouton
- [ ] preparer-un-commit CA-8 → test Rust : 2 lignes choisies, seules elles sont dans l'index ; test composant `DiffView` : Maj+clic et glissé dans la marge sélectionnent des lignes ; e2e
- [ ] preparer-un-commit CA-9 → test composant ou e2e : fichier suivant / précédent parmi les fichiers non indexés ; Échap : `History` avec la ligne WIP sélectionnée
- [ ] preparer-un-commit CA-24 → test Rust : Unstage file, Unstage hunk, Unstage selected lines retirent exactement le visé, le reste de l'index (`git diff --cached`) est inchangé ; e2e : clic sur un fichier indexé, mode indexé
- [ ] preparer-un-commit CA-25 → test Rust (fichier suivi : modifications non indexées disparues de l'arbre et de `git diff`, partie indexée gardée) et e2e : clic droit, confirmation nomme le fichier, confirmer puis annuler
- [ ] preparer-un-commit CA-26 → test Rust (fichier non suivi supprimé du disque) et e2e : « ProfileBadge.svelte will be deleted. », confirmer (fichier absent du disque et de `WorkingChanges`) puis annuler (rien ne change) ; cas reporté de S-67 : arbre vidé par Discard avec la ligne WIP sélectionnée, ligne WIP retirée et dernier commit sélectionné en moins de 1 s

## Hors périmètre
- Diff replié de plus de 5 000 lignes et Show diff, robustesse des gros diffs et binaires (S-55 ; `preparer-un-commit` CA-10 y est couvert) ; ici, un binaire n'a que Stage file / Unstage file.
- Stash, Pop, Apply, Drop (S-32) ; blocage d'identité (S-16, S-21).
- Détection des renommages, Undo d'un discard (non-objectifs), mémorisation du mode côte à côte / unifié, indexation depuis le mode commit (lecture seule).
- Commit et Amend (S-15, faits).

## Documentation à mettre à jour
- README : section « Graphe de `History` » : ajouter une puce (après celle de `DiffView` en mode commit) sur le clic d'un fichier de `WorkingChanges` : `DiffView` en mode travail / indexé, Stage / Unstage file, hunk, lignes sélectionnées (Maj+clic, glissé), « File i / n », Échap vers la ligne WIP, binaire ; et sur Discard changes (clic droit, confirmation, non suivi supprimé) ; corriger la puce de `DiffView` en mode commit qui dit « pas d'indexation ni de diff de travail (S-31) » ; la fixture ajoutée ou étendue ; la puce « Hors périmètre » de `WorkingChanges` si elle dit que le clic sur un fichier ne fait rien.
- `.env.example` : aucune (à jour : `OCTOGIT_DATA_DIR`, `OCTOGIT_SSH_DIR`, `OCTOGIT_PORT`, intervalle de fetch).
- Rattrapage : aucun constaté.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Décisions de l'humain (suite)
### Après la revue 1
- Bloquant clippy : traité au passage 2 (d'office). Mineur README : traité au passage 2 (d'office).
- Échec Vitest illisible de la 1re passe : pris en compte (pour information).
### Après la revue 2
- Instabilité e2e de `graph-width` / `refs-column` (S-69) : pris en compte (pour information), consigné dans `notes-production.md` ; reste dans « À décider » pour `/story`.
- Décidé par l'humain (19/11/2026) : option a, à rejuger dans la revue de S-69 ; pas de story de correction.

## Journal
- Référence : `ccefbe4`

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé ; tests, lint, build ✅ (28 fichiers) | — |
| 1 | reviewer | `pnpm lint` ❌ clippy type_complexity (1 bloquant), 1 mineur README | à corriger |
| 2 | dev | alias `Sides` ; lint, tests, audit, build ✅ ; `pnpm e2e` 2 échecs instables sous charge (`graph-width` CA-13, `refs-column` CA-18/212, tests de S-69, passent seuls, e2e S-31 verts) : relayé au reviewer, pas un écart de S-31 | — |
| 2 | reviewer | 0 problème ; e2e 286/288 (2 instables de S-69) | validé |

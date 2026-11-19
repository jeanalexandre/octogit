# Story S-32 : Stash, Pop, Apply et Drop d'un stash choisi

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-32-stash-pop-apply-drop.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-32 (tranche valeur 8)
- Critères couverts : `specs/preparer-un-commit.md` CA-17, CA-18, CA-19, CA-20, CA-21
- Jobs servis : J-2
- Revue renforcée : non

## Objectif
Ajouter `StashButtons` (Stash avec message optionnel, Pop du stash sélectionné sinon du dernier) et les entrées Apply, Pop, Drop du clic droit sur un stash, avec confirmation du Drop et signalement des conflits de Pop / Apply dans `WorkingChanges`.

## Critères d'acceptation
- **preparer-un-commit CA-17** : Étant donné des modifications, dont un fichier non suivi, quand je clique sur Stash avec ou sans message, alors l'arbre de travail devient propre (fichier non suivi compris) et un stash apparaît dans `BranchSidebar` et dans le graphe, nommé par le message s'il est saisi.
- **preparer-un-commit CA-18** : Étant donné un stash sélectionné, quand je clique sur Pop, alors ce stash est appliqué, fichiers non suivis compris, puis retiré ; sans stash sélectionné, c'est le dernier ; sans aucun stash, Pop est désactivé.
- **preparer-un-commit CA-19** : Étant donné un clic droit sur un stash, alors le menu propose Apply, Pop et Drop ; Apply applique le stash et le garde dans la liste.
- **preparer-un-commit CA-20** : Étant donné Drop choisi, alors une confirmation nomme le stash ; après confirmation il disparaît de `git stash list`, après annulation rien ne change.
- **preparer-un-commit CA-21** : Étant donné un Pop ou un Apply qui produit un conflit, alors le stash reste dans `git stash list` et les fichiers en conflit sont signalés dans `WorkingChanges`.

## Décisions de l'humain
### Fiche (19/11/2026)
1. Stash « sélectionné » : a) le stash dont la ligne ou le nœud est sélectionné dans le graphe ; sans sélection de stash, le dernier.
2. Pop / Apply et l'index : a) comportement par défaut de Git, tout revient non indexé (pas de `--index`).

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css`
- Conventions : binaire `git` en sous-processus pour toute écriture, sortie brute gardée (« Details ») ; commandes et événements Tauri dans `src-tauri/src` sans logique ; `snake_case` en Rust, `camelCase` en TypeScript, composants Svelte en `PascalCase` au nom exact de `ux.md` ; icônes Lucide (16 px, trait 1,8 px, sans remplissage) devant chaque libellé de bouton ; CSS natif, couleurs par tokens seulement ; interface en anglais ; Conventional Commits en anglais

## Contexte technique
- Rust, crate `git` : `crates/git/src/lib.rs` (déclare les modules ; `read_refs` lit déjà les stashes `stash@{n}` par `refs/stash` et son reflog, `RefKind::Stash`, `GitError`, `ChangeStatus` / `FileChange` à étendre pour signaler un fichier en conflit) ; `crates/git/src/working_tree.rs` (`read_working_tree`, `stage_all`, `commit` : modèle d'appel du binaire `git` et d'erreur ; l'entrée `EntryStatus::Conflict` de `gix` y est aujourd'hui rangée avec les changements). Nouveau module `crates/git/src/stash.rs` : `git stash push -u [-m <message>]` (fichiers non suivis compris), `git stash pop [<stash>]`, `git stash apply <stash>`, `git stash drop <stash>`. Pop ou Apply en conflit : `git` laisse le stash dans la liste et les fichiers en conflit dans l'arbre ; rendre cet état (pas une erreur fatale) avec les fichiers en conflit. Stash impossible sans commit (Git le refuse) : bouton désactivé.
- Rust, crate `app` : `src-tauri/src/commands.rs` et `src-tauri/src/working_tree.rs` (modèle : `stage_all`, `commit`, `amend_message`), `src-tauri/src/lib.rs` (enregistrement) ; relire l'arbre et rendre `WorkingTreeView` comme `stage_all`.
- Interface : `src/lib/screens/History.svelte` (ligne ~524 : bouton `Stash` désactivé en dur dans le slot de `Toolbar`, à remplacer par le composant ; `stashTitles`, `workingTree`, mise à jour après écriture comme `commit`) ; nouveau `src/lib/components/StashButtons.svelte` ; `src/lib/components/RefContextMenu.svelte` (type `RefMenuTarget` à étendre d'une variante `stash`, entrées extensibles : Apply, Pop, Drop) ; `src/App.svelte` (état `refMenu`, ouverture du menu, actions, garde « un seul à la fois » comme `checkoutPath`) ; `src/lib/components/BranchSidebar.svelte` (ligne de la section Stashes : clic droit, touche menu, Maj+F10 via `menuKey`), `src/lib/components/CommitGraph.svelte` et `RefLabel.svelte` (clic droit sur l'étiquette ou le nœud d'un stash, `oncommitcontextmenu`) ; `src/lib/components/WorkingChanges.svelte` (signaler les fichiers en conflit ; Stash n'y figure pas).
- Confirmation du Drop : modèle de la confirmation du checkout dans `RefContextMenu.svelte` et de `ForcePushDialog.svelte` ; Annuler par Échap, nom du stash dans la question.
- Pont de test : `src/web-bridge.ts`, `e2e/helpers.ts` ; fixtures : `fixtures/wip.sh <dossier>` (fichiers modifiés, indexé et non suivi) ; un dépôt avec stash et un conflit de Pop se fabrique dans le test.
- Écrans : `ux/ecrans/history.md` (composants `StashButtons` : actif · désactivé arbre propre / aucun stash / opération en cours ; `RefContextMenu` entrée « Stash » ; `WorkingChanges` : conflit de Pop ou d'Apply, fichiers signalés ; Direction visuelle de `ux.md`), `ux/maquettes/history.html`. Un indicateur de conflit ne repose pas sur la couleur seule.
- Reports : S-14 (Stash désactivé seulement, `StashButtons` complet ici) ; S-67 (sur arbre propre la ligne WIP disparaît ; après un Stash, le dernier commit de la branche courante est sélectionné avec son `CommitDetail` : logique déjà en place, vérifier avec un vrai Stash).

## Interface à vérifier
- **Écrans et états** : `History` : `StashButtons` actif (arbre modifié) · désactivé (arbre propre, aucun stash) · saisie du message du stash · après Stash (ligne WIP retirée, stash dans `BranchSidebar` et le graphe) · menu clic droit d'un stash (Apply, Pop, Drop) · confirmation de Drop nommant le stash · `WorkingChanges` avec fichiers en conflit après Pop ou Apply
- **Tailles d'écran** : 1 500×900 (portable, plein écran), 1 280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] preparer-un-commit CA-17 → test Rust (dépôt temporaire : modifié, indexé et non suivi ; arbre propre ensuite, non suivi compris ; `git stash list` nomme le message saisi) ; e2e (Stash avec et sans message, stash visible dans `BranchSidebar` et le graphe, ligne WIP retirée)
- [ ] preparer-un-commit CA-18 → test Rust (Pop d'un stash nommé : fichiers, non suivis compris, retour puis stash retiré ; sans nom, le dernier) ; test composant `StashButtons` (Pop désactivé sans stash) ; e2e (Pop du stash sélectionné, puis du dernier)
- [ ] preparer-un-commit CA-19 → test composant `RefContextMenu` (variante stash : Apply, Pop, Drop) ; test Rust (Apply garde le stash dans `git stash list`) ; e2e (clic droit sur un stash)
- [ ] preparer-un-commit CA-20 → test composant (confirmation nommant le stash, Échap et Cancel ne changent rien) ; test Rust (Drop retire de `git stash list`) ; e2e
- [ ] preparer-un-commit CA-21 → test Rust (Pop et Apply en conflit : stash conservé, fichiers en conflit rendus) ; test composant `WorkingChanges` (fichiers signalés) ; e2e
- [ ] Stash désactivé sur arbre propre et sur dépôt sans commit → test composant `StashButtons` (reprend le renvoi de S-67 et S-14)

## Hors périmètre
- Résoudre le conflit, Done, Abort, `ConflictResolver` (S-41) ; `OperationBanner` (S-39).
- Désactivation pendant une opération en cours (S-50), refus face à des modifications non commitées (S-51).
- Discard changes et indexation fine (S-31) ; nœud de stash du graphe et `RefLabel` du stash (déjà livrés par S-5 et S-63).
- Blocage d'identité : le stash n'écrit aucun commit de l'historique, aucun contrôle de profil.

## Documentation à mettre à jour
- README : section de `History` (Stash, Pop, Apply, Drop, signalement des conflits, `StashButtons`) ; rattrapage : README et `.env.example` relus, aucun retard constaté sur le périmètre de cette story (`.env.example` : aucune variable ajoutée).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `04aad4c`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (tests, lint, build, e2e, audit:deps, tauri build verts) ; écarts : variante `Conflicted` de `ChangeStatus`, 4 commandes Tauri, `DropStashDialog`, ligne de stash de `BranchSidebar` en `role="button"` | — |
| 1 | reviewer | CA-17 à CA-21 couverts, interface conforme à 1500×900 et 1280×720 | validé (`stories/S-32-revue-1.md`) |

## Traitement des retours
### Après la revue 1
- Hauteur figée de la section Stashes de `BranchSidebar` après un premier Stash : pris en compte (pour information), reporté dans `notes-production.md`.
- `audit:deps` et `tauri build` : pris en compte (pour information), passés par `dev`.

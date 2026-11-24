# Story S-42 : Ouvrir `InteractiveRebase` depuis un commit et composer (actions, messages, déplacement au clavier, aperçu, Reset, Cancel)

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-42-composer-un-rebase-interactif.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-42 (tranche valeur 12) ; dépend de S-5 (livrée : refs, `CommitDetail`) ; S-43 en dépend (lancement du rebase)
- Critères couverts : `nettoyer-une-branche` CA-1, CA-4, CA-5, CA-6, CA-8, CA-10 (`specs/nettoyer-une-branche.md`, validée le 07/11/2026)
- Jobs servis : J-7
- Revue renforcée : non

## Objectif
Un clic droit sur un commit de la branche courante propose « Interactive rebase from here » et ouvre `InteractiveRebase` : `RebaseTodoList` avec une action par ligne, messages éditables, déplacement au clavier, aperçu avant / après mis à jour à chaque modification, Reset et Cancel (Échap, Back to graph). Rien n'est lancé ni écrit dans le dépôt.

## Critères d'acceptation
- **nettoyer-une-branche CA-1** : Étant donné `History` et un commit C ancêtre de la branche courante ou sommet de celle-ci, quand je fais un clic droit sur C, alors le menu propose « Interactive rebase from here » ; quand je la choisis, alors `InteractiveRebase` s'ouvre, son titre nomme la branche courante et la base, parent de C (SHA abrégé), et `RebaseTodoList` liste C et tous les commits suivants jusqu'au sommet de la branche, du plus ancien (C) en haut au plus récent, chacun en pick, avec son résumé, ses initiales d'auteur et son SHA abrégé.
- **nettoyer-une-branche CA-4** : Étant donné une ligne sélectionnée, quand je choisis une action dans son menu ou tape p, r, s, f ou d, alors l'action de la ligne devient pick, reword, squash, fixup ou drop, lisible sans la couleur ; une ligne drop a son résumé barré ; une ligne squash ou fixup est indentée sous le commit qu'elle rejoint.
- **nettoyer-une-branche CA-5** : Étant donné une ligne en reword, alors un champ « New message » pré-rempli du message d'origine s'affiche sous la ligne et reste éditable. Étant donné au moins une ligne en squash, alors un champ affiche les messages combinés des commits réunis, dans l'ordre de la liste, et reste éditable.
- **nettoyer-une-branche CA-6** : Étant donné une ligne sélectionnée, quand je fais Alt+↑ ou Alt+↓, ou clique sur son bouton ↑ ou ↓, alors elle échange sa place avec la ligne voisine et reste sélectionnée ; ↑ et ↓ seuls changent la ligne sélectionnée. Quand je fais glisser une ligne à la souris, alors l'ordre ne change pas.
- **nettoyer-une-branche CA-8** : Étant donné toute modification de la liste, alors l'aperçu se met à jour sans autre geste : « Before · n commits » liste les commits d'origine, « After · m commits » liste, dans l'ordre, les résumés des commits qui seront produits, puis la base.
- **nettoyer-une-branche CA-10** : Étant donné une liste modifiée, quand je clique sur Reset, alors la liste, les actions et les messages reviennent à leur état d'ouverture. Quand je clique sur Cancel, fais Échap ou clique sur Back to graph, alors `History` s'affiche ; `git log`, les branches, l'index et l'arbre de travail sont inchangés, et aucun rebase n'est en cours.

## Décisions de l'humain
### Fiche (à remplir)
1. Start rebase dans S-42 : a) visible mais inactif, avec la raison « Available in a later story » (réponse de l'humain, 24/11/2026)

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` (= `vitest run --reporter=dot`) ; Rust `pnpm test:rs -p <crate> [<filtre>]` (= `cargo test -q`) ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css` (écrit à partir de `ux/tokens.md`)
- Conventions : binaire `git` en sous-processus pour toute écriture, `gix` pour la lecture ; commandes et événements Tauri dans `src-tauri/src` sans logique ; `snake_case` en Rust, `camelCase` en TypeScript ; écrans dans `src/lib/screens/` et composants dans `src/lib/components/` en `PascalCase` au nom exact de `ux.md` ; CSS natif, couleurs par tokens seulement, icônes Lucide (16 px, trait 1,8 px) devant chaque libellé de bouton ; interface en anglais, messages courts, sans « you » ; texte ≥ 12 px, jamais d'information portée par la couleur seule ; Conventional Commits en anglais

## Contexte technique
- Écran à créer : `src/lib/screens/InteractiveRebase.svelte` (nom exact de `ux.md`). Composant à créer : `src/lib/components/RebaseTodoList.svelte`. Modèles de patron d'écran plein et de retour au graphe (Back to graph, Échap) : `src/lib/screens/ConflictResolver.svelte` et `src/lib/screens/DiffView.svelte` ; modèle de test : `src/lib/screens/ConflictResolver.test.ts`.
- Logique de composition pure et testée à part, dans `src/lib/rebasePlan.ts` (nom au choix de dev) : liste de lignes (sha, résumé, message complet, initiales, action), changement d'action, échange de deux lignes, aperçu « After » (commits produits, dans l'ordre : pick et reword = un commit, squash et fixup rejoignent le commit précédent non drop, drop = aucun ; message combiné d'un squash = messages des commits réunis dans l'ordre de la liste ; fixup n'ajoute pas son message), retour à l'état d'ouverture (Reset). Pas de logique dans le composant.
- Lecture de la plage, crate `git` (lecture : `gix`, comme `crates/git/src/graph.rs`) : nouvelle fonction (fichier au choix de dev, déclaré dans `crates/git/src/lib.rs`) qui, pour un commit C ancêtre ou sommet de la branche courante, rend la base (parent de C, SHA abrégé et complet) et les commits de C au sommet du plus ancien au plus récent (sha, résumé, message complet, nom et initiales de l'auteur). Aucune écriture, aucun rebase lancé. Tests : `crates/git/tests/` (modèle : `crates/git/tests/branch.rs`, `crates/git/tests/reset.rs`).
- Crate `app` : `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` (enregistrement), un fichier de commandes au choix de dev (modèle : `src-tauri/src/detail.rs`, `src-tauri/src/working_tree.rs`) ; pont de test : `src-tauri/examples/octogit-bridge.rs`, `src/web-bridge.ts`, `e2e/helpers.ts` ; puis `pnpm gen:bindings`. Pas de logique dans `app`.
- Menu : `src/lib/components/RefContextMenu.svelte` (cible `kind === "commit"`, lignes ~93 à 112 ; titre du sous-menu Reset : prop `currentBranch`) : ajouter « Interactive rebase from here » (icône Lucide) dans les entrées « Commit » à la place indiquée par `ux/ecrans/history.md` (après « Reset … to here › », avant Create tag), avec une prop de rappel comme `oncherrypick` ; tests : `src/lib/components/RefContextMenu.test.ts`. L'entrée n'apparaît que si une branche est courante et que C est ancêtre ou sommet d'elle ; les variantes désactivées (HEAD détachée, commit racine, commit hors branche) sont à S-52.
- `src/App.svelte` (gros fichier : repérer par `git grep -n`, lire en offset et limit) : ouverture de `InteractiveRebase` par-dessus `History` selon le patron de `ConflictResolver` et de `DiffView` ; `RefContextMenu` ouvert ligne ~1954, rappels à passer depuis `src/lib/screens/History.svelte` si le menu y est relayé. Cancel, Échap, Back to graph reviennent à `History` sans écrire.
- Clavier de l'écran (de `ux/ecrans/interactive-rebase.md`) : ↑ ↓ sélectionnent ; Alt+↑ ↓ ou les boutons ↑ ↓ de la ligne déplacent (la ligne reste sélectionnée) ; p r s f d choisissent l'action (sans effet quand le focus est dans un champ de message) ; pas de glisser-déposer : aucun attribut `draggable`, aucun gestionnaire `drag*`. Focus visible sur tout (`focus`). Éléments natifs focalisables ; l'accès clavier complet de l'écran est audité par S-56.
- Interface : `ux/ecrans/interactive-rebase.md` (contenu, clavier, états ; composant `RebaseTodoList` : pick · reword (« New message ») · squash (messages combinés éditables, indenté) · fixup (indenté) · drop (résumé barré)), maquette `ux/maquettes/interactive-rebase.html` (section 1 « Composing the rebase » seulement ; ⌥↑ ⌥↓ = Alt+↑ ↓), `ux/ecrans/history.md` (entrées « Commit » de `RefContextMenu`) ; « Direction visuelle » de `ux.md` (« Neon », SF Pro 13 px, SF Mono 12 px pour SHA, rayons 7 / 10 px, icônes Lucide) ; tokens dans `src/lib/styles/tokens.css` (`surface`, `surface-raised`, `border`, `ink`, `muted`, `brand`, `selection`, `focus`, `warning`, `danger`). Action lisible sans la couleur : libellé texte (pick, reword…) sur chaque ligne.
- Fixture : `fixtures/rebase-interactive.sh <dossier>` (nouveau ; branche courante de 5 à 6 commits, auteurs variés, messages à plusieurs lignes ; modèle : `fixtures/branches.sh` et `fixtures/lib.sh`), à brancher dans le pont de test. E2e : `e2e/interactive-rebase.spec.ts` (modèle : `e2e/conflict-resolver.spec.ts` si présent, sinon `e2e/force-push.spec.ts`). Aucun appel réseau.
- Reports : aucun point « reporter vers S-42 » dans les fiches existantes (Grep fait dans `stories/`). `stack.md` « Accès à Git » : le rebase interactif réel se fera par fichier todo généré, en S-43 ; ici aucune écriture.

## Interface à vérifier
- **Écrans et états** : `History` : menu contextuel d'un commit avec « Interactive rebase from here » · `InteractiveRebase` composition : ouverture (titre branche et base, toutes les lignes en pick, aperçu Before = After), une ligne en reword avec « New message », squash (indenté, message combiné), fixup (indenté), drop (barré), déplacement par Alt+↑ ↓ et par boutons, glisser sans effet, Reset, Cancel / Échap / Back to graph vers `History`.
- **Tailles d'écran** : 1500×900 (portable, plein écran), 1280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] nettoyer-une-branche CA-1 → test Rust (`crates/git/tests/`) : plage d'un commit ancêtre et du sommet (ordre, base = parent, initiales, SHA abrégés) ; test de composant `RefContextMenu` : entrée présente sur un commit de la branche courante ; e2e : clic droit › « Interactive rebase from here », titre et lignes en pick
- [ ] nettoyer-une-branche CA-4 → test unitaire `rebasePlan` et test de composant `RebaseTodoList` : p r s f d et menu changent l'action, libellé texte présent, drop barré, squash et fixup indentés
- [ ] nettoyer-une-branche CA-5 → test de composant : « New message » pré-rempli et éditable en reword ; message combiné en squash, dans l'ordre de la liste, éditable
- [ ] nettoyer-une-branche CA-6 → test unitaire (échange, sélection conservée) ; test de composant : Alt+↑ ↓, boutons ↑ ↓, ↑ ↓ seuls déplacent la sélection ; glisser (événements `dragstart` / `drop` / souris) ne change pas l'ordre
- [ ] nettoyer-une-branche CA-8 → test unitaire de l'aperçu (pick, reword, squash, fixup, drop, réordonné ; « Before · n commits », « After · m commits », base en dernier) ; e2e : l'aperçu suit chaque modification
- [ ] nettoyer-une-branche CA-10 → test de composant : Reset rend actions, ordre et messages d'origine ; Cancel, Échap, Back to graph reviennent à `History` ; e2e : `git log`, `git status` et `git branch` identiques avant et après, aucune opération en cours
- [ ] Décision 1 → test selon la réponse

## Hors périmètre
- Lancer le rebase (Start rebase), validation de la composition (squash ou fixup en première ligne, message vide), alerte « déjà poussé », progression, résultat, conflit : S-43 (CA-7, CA-9, CA-12 à CA-15).
- Entrée désactivée (HEAD détachée, commit racine, commit hors branche), plage avec merge : S-52 (CA-2, CA-3). Refus pour modifications non commitées : S-51 (CA-11). Identité non conforme : `proteger-l-identite` CA-16 (S-50). Désactivation pendant une opération en cours : S-50.
- Accès clavier complet et focus audité : S-56 (CA-16).
- Glisser-déposer pour réordonner, Undo après rebase, commandes `edit`, `exec`, `break`, `label` : exclus.
- Aucune écriture dans le dépôt, aucun fichier todo, aucun `OperationBanner`.

## Documentation à mettre à jour
- README, section « Graphe de `History` » : « Interactive rebase from here » (clic droit sur un commit de la branche courante), `InteractiveRebase` (actions p r s f d, Alt+↑ ↓, aperçu, Reset, Cancel / Échap ; rien n'est lancé tant que S-43 n'est pas livrée) ; fixture `fixtures/rebase-interactive.sh` (usage : `rebase-interactive.sh <dossier>`).
- `.env.example` : aucune variable ajoutée. Rattrapage : README et `.env.example` à relire sur les extraits touchés ; tout retard constaté s'ajoute ici sous « rattrapage ».
- `ux.md`, `ux/ecrans/interactive-rebase.md`, `stack.md` : aucun changement ; tout écart est signalé au reviewer, sans modifier ces fichiers.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`

| # | Agent | Résultat | Verdict |
|---|---|---|---|

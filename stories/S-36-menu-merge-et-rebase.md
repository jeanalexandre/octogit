# Story S-36 : Menu merge / rebase d'une branche source, libellés nommant les deux branches, checkout de la branche qui reçoit

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-36-menu-merge-et-rebase.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-36 (tranche valeur 10) ; dépend de S-25 (checkout, `RefContextMenu`, `Toolbar`)
- Critères couverts : `integrer-une-branche` CA-1, CA-2, CA-3, CA-4, CA-5 (`specs/integrer-une-branche.md`, validée le 07/11/2026)
- Jobs servis : J-6
- Revue renforcée : non

## Objectif
Dans `History`, un clic sélectionne la branche qui reçoit (sinon la courante reçoit) ; le clic droit sur une branche, une `origin/…` ou un commit sans branche propose « Merge <source> into <reçoit> » et « Rebase <reçoit> onto <source> » (rebase seul pour un commit), et choisir une entrée fait d'abord le checkout de la branche qui reçoit si elle n'est pas courante.

## Critères d'acceptation
- **integrer-une-branche CA-1** : Étant donné `History`, quand je clique sur la branche locale `feature/profiles` puis fais un clic droit sur `develop`, alors `RefContextMenu` propose « Merge develop into feature/profiles » et « Rebase feature/profiles onto develop », et aucune entrée dans l'autre sens ; aucune entrée merge ou rebase n'est libellée sans les deux noms.
- **integrer-une-branche CA-2** : Étant donné aucune branche sélectionnée et `feature/profiles` courante, quand je fais un clic droit sur `develop`, alors `RefContextMenu` propose « Merge develop into feature/profiles » et « Rebase feature/profiles onto develop ». Étant donné un clic droit sur la branche qui reçoit elle-même (sélectionnée, ou courante sans sélection), alors ni merge ni rebase n'est proposé.
- **integrer-une-branche CA-3** : Étant donné `feature/profiles` sélectionnée puis un clic droit sur `origin/develop`, alors « Merge origin/develop into feature/profiles » et « Rebase feature/profiles onto origin/develop » sont proposés. Étant donné une `origin/…` sélectionnée, alors aucun merge ni rebase n'est proposé. Aucune entrée ne déplace une branche distante.
- **integrer-une-branche CA-4** : Étant donné `feature/profiles` sélectionnée (ou courante) puis un clic droit sur un commit `c41d8e0` qui ne porte aucune branche, alors seul « Rebase feature/profiles onto c41d8e0 » (SHA abrégé) est proposé ; aucun merge n'est proposé. Quand je le choisis, alors les commits de `feature/profiles` absents de `c41d8e0` sont rejoués au-dessus de ce commit.
- **integrer-une-branche CA-5** : Étant donné `main` courante et `feature/profiles` sélectionnée, quand je choisis « Merge develop into feature/profiles » ou « Rebase feature/profiles onto develop », alors `feature/profiles` devient la branche courante avant l'opération, et le reste après. Étant donné la branche qui reçoit déjà courante, aucun checkout n'a lieu.

## Décisions de l'humain
### Fiche (19/11/2026)
1. Durée de vie de la sélection de la branche qui reçoit : 1a (jusqu'à un autre clic ou un changement de dépôt ; nouveau clic sur la même branche la désélectionne ; si elle disparaît, la courante reçoit)
2. Effet d'une entrée merge ou rebase choisie avant S-37 (la dernière phrase de CA-4 et l'opération de CA-5 sont exécutées par S-37) : 2a (checkout de la branche qui reçoit, puis point d'accroche vide que S-37 remplit)

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test aux vraies commandes du crate `app`, dépôts d'exemple, données dans un dossier temporaire) ; jamais `npx playwright` ni `cargo run`
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main), seulement si une commande est ajoutée
- Tokens de style : `src/lib/styles/tokens.css`
- Conventions : binaire `git` en sous-processus pour toute écriture ; commandes et événements Tauri dans `src-tauri/src` sans logique ; `snake_case` en Rust, `camelCase` en TypeScript, composants Svelte en `PascalCase` au nom exact de `ux.md` ; icônes Lucide (16 px, trait 1,8 px, sans remplissage) ; CSS natif, couleurs par tokens seulement, un état jamais porté par la couleur seule ; interface en anglais ; tout au clavier, focus visible ; Conventional Commits en anglais

## Contexte technique
- Dépend de S-25 (livrée : `RefContextMenu.svelte`, `Toolbar.svelte`, `checkout()` de `src/App.svelte`), fiche `stories/S-25-changer-de-branche.md`. S-35 (livrée) a ajouté Cherry-pick et Revert dans `RefContextMenu`. Aucun code de sélection d'une branche n'existe : `BranchSidebar.svelte` n'a que `ondblclick` (checkout, ligne ~288) et `oncontextmenu` sur les lignes de branche ; `RefLabel.svelte` n'a que `ondblclick` et `oncontextmenu`. À ajouter : un clic (rappel `onrefclick(name)`) sur une ligne de branche de `BranchSidebar` et sur une `RefLabel` de `CommitGraph` (colonne et étiquette flottante), relayé par `History.svelte` (modèle : `onrefdblclick`, `onrefcontextmenu`) jusqu'à `App.svelte`. Le clic sur une `RefLabel` ne doit pas casser la sélection du commit de sa ligne ni son double-clic.
- État de la sélection dans `src/App.svelte` (à côté de `refMenu`, ligne ~685), jamais dans le crate : nom de la branche locale qui reçoit, ou `null`. Branche qui reçoit = sélection si elle existe encore parmi `screen.repository.refs`, sinon la branche courante (`refs` : `current`). Sélectionner une `origin/…` est possible (CA-3) et ne propose alors aucun merge ni rebase. Sans branche courante (HEAD détachée) et sans sélection : aucune entrée (désactivation motivée : S-52).
- Marque visuelle « sélectionnée » dans `BranchSidebar` (état listé dans `ux/ecrans/history.md`) : pas seulement la couleur (token `selection`, plus un indice non coloré, ex. `aria-selected` et un marqueur).
- `src/lib/components/RefContextMenu.svelte` : type `RefMenuTarget`, liste `entries` (`$derived`), flèches et Échap à garder, nouvelles props `receiving` (nom de la branche qui reçoit, ou `null`, sa nature locale / `origin/…`), et rappels `onmerge(source, receiving)` et `onrebase(onto, receiving)` à la façon de `oncherrypick`. Entrées : pour une branche locale ou une `origin/…` source différente de la branche qui reçoit, « Merge <source> into <reçoit> » puis « Rebase <reçoit> onto <source> », après Checkout (et avant Cherry-pick pour une `origin/…`) ; pour un commit sans aucune ref de branche (locale ou `origin/…`, à lire dans `screen.repository.refs` par `target`), seule « Rebase <reçoit> onto <sha7> », après « Create branch here » ; jamais de merge pour un commit ; aucune entrée si la source est la branche qui reçoit ou si la branche qui reçoit est une `origin/…`. Libellés exacts de `ux/ecrans/history.md` (« Entrées de `RefContextMenu` »). Le menu n'a pas d'entrée désactivée à cette story (« Operation in progress. » : S-50).
- `src/App.svelte` : à la sélection d'une entrée, si la branche qui reçoit n'est pas la courante, appeler `checkout(name)` (même garde `checkoutPath` / `runFetchNow`, `checkoutNotice` pour un refus ; un checkout qui demande confirmation ou échoue arrête là, sans opération) ; si elle est déjà courante, aucun checkout. Puis appeler un point d'accroche `integrate(kind, source, receiving)` à vide que S-37 remplit (exécution du merge ou du rebase). Passer à `RefContextMenu` la branche qui reçoit.
- Backend : aucune nouvelle commande attendue ; `checkoutRepository` (S-25) suffit. Ne pas créer de commande merge ou rebase ici (S-37).
- Barre d'aide de `CommitGraph.svelte` (« Click the branch that receives, then right-click the source branch to merge or rebase. », ligne ~618) : déjà en place, inchangée.
- Fixtures : `fixtures/branches.sh` (branches `develop`, `feature/…`), `fixtures/refs.sh` (`origin` bare, `origin/…`), `fixtures/lib.sh` ; un commit sans branche et une branche `feature/profiles` divergente de `develop` se fabriquent dans le test, sinon nouveau script `fixtures/integrate.sh` documenté au README. Aucun appel réseau réel. Pont de test : `src/web-bridge.ts`, `e2e/helpers.ts` (rien à ajouter sans nouvelle commande).
- Interface : `ux/ecrans/history.md` (composants `BranchSidebar` : « clic : sélection de la branche qui reçoit » ; `CommitGraph` / `RefLabel` ; `RefContextMenu` et « Entrées de `RefContextMenu` » › Branche ou `origin/…` source, Commit) ; maquette `ux/maquettes/history.html`, section 6 (« Merge / rebase », première rangée : menu d'une branche source, clic droit sur la branche qui reçoit, `origin/…` sélectionnée) ; « Direction visuelle » de `ux.md` (« Neon »), couleurs par `src/lib/styles/tokens.css` seulement.
- Tests existants à étendre : `src/lib/components/RefContextMenu.test.ts`, `BranchSidebar.test.ts`, `RefLabel.test.ts`, `src/lib/screens/History.test.ts` ; e2e : nouveau `e2e/integrate-menu.spec.ts` (modèle `e2e/checkout.spec.ts`, `e2e/cherry-pick.spec.ts`).
- Reports : aucun point « reporter vers S-36 » dans les fiches existantes ; les mentions de S-36 dans les fiches S-04, S-05, S-25, S-26, S-35 et S-61 sont des renvois vers cette story (sélection, entrées merge et rebase, clic sur les étiquettes).

## Interface à vérifier
- **Écrans et états** : `History` : `BranchSidebar` avec une branche sélectionnée (marque non colorée) · menu clic droit d'une branche locale source avec Merge et Rebase nommant les deux branches · idem sur une `origin/…` · clic droit sur la branche qui reçoit (sans merge ni rebase) · `origin/…` sélectionnée (aucune entrée) · menu d'un commit sans branche (« Rebase … onto <sha7> » seule) · branche qui reçoit non courante : après le choix, elle devient courante
- **Tailles d'écran** : 1500×900 (portable, plein écran), 1280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] integrer-une-branche CA-1 → Vitest `RefContextMenu` : branche reçoit `feature/profiles`, source `develop` : exactement « Merge develop into feature/profiles » et « Rebase feature/profiles onto develop », aucune entrée dans l'autre sens ; Vitest `BranchSidebar` et `RefLabel` : un clic appelle `onrefclick(name)` ; e2e : clic sur `feature/profiles` dans le panneau, clic droit sur `develop`
- [ ] integrer-une-branche CA-2 → Vitest : sans sélection, la courante reçoit ; clic droit sur la branche qui reçoit (sélectionnée ou courante) : ni merge ni rebase ; e2e idem
- [ ] integrer-une-branche CA-3 → Vitest : source `origin/develop` : libellés avec `origin/develop`, aucune entrée qui déplace une distante ; `origin/…` sélectionnée : aucune entrée merge ni rebase ; e2e
- [ ] integrer-une-branche CA-4 → Vitest : commit sans branche : seule « Rebase … onto c41d8e0 » ; commit portant une branche : pas de merge ; e2e sur un commit sans branche (le rejeu des commits est vérifié en S-37)
- [ ] integrer-une-branche CA-5 → Vitest `App` / `History` : branche qui reçoit non courante : `checkout` appelé avant le rappel d'intégration ; déjà courante : aucun checkout ; e2e : `main` courante, `feature/profiles` sélectionnée, choix d'une entrée : `feature/profiles` courante (`git branch --show-current`), HEAD sur une branche, aucun commit créé ; clavier (Maj+F10, flèches, Entrée) sur une branche source
- [ ] Décisions 1 et 2 → test selon la réponse

## Hors périmètre
- Exécution du merge et du rebase, « Already up to date. », commit de merge, identité et signature, `PushButton` « Force push » après rebase, rien de poussé : S-37.
- Entrées désactivées pendant une opération en cours (« Operation in progress. ») : S-50 ; refus d'identité non conforme : S-50 ; refus pour modifications non commitées (« Commit or stash your changes before merging. ») : S-51 ; HEAD détachée et commit racine : S-52 ; « Details » : S-53 ; accès clavier complet (CA-17) : S-56.
- Conflits, `OperationBanner`, `ConflictResolver` : S-39 et S-40.
- Merge d'un commit sans branche, merge et rebase dans l'autre sens, glisser-déposer, Undo.
- Rebase interactif, Create tag, Rename, « Delete local » : stories dédiées.

## Documentation à mettre à jour
- README, section « Graphe de `History` » : un clic sur une branche (panneau ou `RefLabel`) la sélectionne comme branche qui reçoit, sinon la courante ; clic droit sur la source : entrées « Merge … into … » et « Rebase … onto … » nommant les deux branches (commit sans branche : rebase seul) ; checkout de la branche qui reçoit avant l'opération ; fixture ajoutée si créée.
- `.env.example` : aucune variable ajoutée. Rattrapage : README et `.env.example` à relire à la livraison ; aucun retard constaté sur les sections « Push » et « Graphe de `History` ».

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `f3af5d0`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (14 fichiers ; e2e 336/338 avant correction des 2 attentes obsolètes ; pas de test Vitest `App`) | — |
| 1 | reviewer | 2 bloquants : CA-5 « déjà courante : aucun checkout » non prouvé ; décision 1 (disparition, changement de dépôt) sans test | à corriger (`stories/S-36-revue-1.md`) |
| 2 | dev | terminé (logique extraite dans `src/lib/integrate.ts` + tests ; Vitest 500/500) | — |
| 2 | reviewer | 2 bloquants levés, aucun problème | validé (`stories/S-36-revue-2.md`) |

# Story S-56 : Clavier et contraste

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-56-clavier-et-contraste.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-56 (tranche durcissement) ; dépend de S-48 (livrée) et S-50 (fiche écrite : `operationBlocked`, gestes désactivés pendant une opération)
- Critères couverts : `specs/gerer-les-branches.md` CA-24 ; `specs/integrer-une-branche.md` CA-17 ; `specs/nettoyer-une-branche.md` CA-16 ; `specs/revenir-en-arriere.md` CA-19 ; `specs/resoudre-les-conflits.md` CA-18 ; `specs/choisir-l-apparence.md` CA-13, CA-14 ; et la part « au focus » de `specs/explorer-l-historique.md` CA-15 (report de S-4, revue 1) (specs validées le 06/11/2026 ou le 07/11/2026)
- Jobs servis : J-6, J-7, J-8, J-9, J-15, J-16
- Revue renforcée : non

## Objectif
Audit et correction de l'accès au clavier (atteindre, activer, quitter, focus visible) des menus, saisies en ligne, dialogues et écrans complexes, vérification du contraste AA des quatre combinaisons Neon / Kraken × sombre / clair (Halo coché ou non), date absolue d'un commit affichée aussi au focus de sa ligne, lueur de focus cumulée avec la lueur Halo des boutons pleins.

## Critères d'acceptation
- **gerer-les-branches CA-24** : Étant donné une branche ou un commit qui a le focus, alors le `RefContextMenu`, le sélecteur de la `Toolbar`, le menu de choix de branche de `CommitDetail`, la saisie en ligne et les confirmations s'utilisent entièrement au clavier, avec un focus visible.
- **integrer-une-branche CA-17** : Étant donné le focus sur une branche ou un commit source, alors `RefContextMenu` s'ouvre au clavier et ses entrées merge et rebase se choisissent et se lancent au clavier.
- **nettoyer-une-branche CA-16** : Étant donné `InteractiveRebase`, alors ces actions se font au clavier, avec un focus visible : sélection d'une ligne, choix de l'action, édition d'un message, déplacement, Reset, Cancel, Start rebase.
- **revenir-en-arriere CA-19** : Étant donné le focus sur un commit, alors le menu contextuel s'ouvre au clavier, et Cherry-pick, Revert et chaque mode de Reset se choisissent et se lancent au clavier ; dans `ResetHardDialog`, Cancel et Hard reset s'atteignent au clavier, avec un focus visible.
- **resoudre-les-conflits CA-18** : Étant donné `ConflictResolver`, alors ces actions se font au clavier, avec un focus visible : sélection d'un fichier, Take this block, navigation entre blocs, Keep ours / Keep theirs / Delete, Mark as resolved, Continue ou Done, Abort, Back to graph.
- **choisir-l-apparence CA-13** : Étant donné chacune des quatre combinaisons Neon / Kraken × sombre / clair, Halo coché ou non, alors tout texte atteint un contraste de 4,5:1 sur son fond, et les lanes, nœuds, focus et bordures de contrôle 3:1 sur le fond adjacent, teintes dérivées comprises.
- **choisir-l-apparence CA-14** : Étant donné `ThemeSwitch` et son menu, alors chaque choix est atteignable et activable au clavier seul, avec un focus visible.
- **explorer-l-historique CA-15** (part au focus, report de S-4 revue 1 ; le survol est livré) : Étant donné un commit, alors sa date est toujours relative (« 12 min ago », « yesterday », « 3 weeks ago ») ; au survol, la date et l'heure absolues s'affichent au format « 2026-11-04 14:32 ». Ici : la même date absolue s'affiche aussi quand la ligne du commit a le focus clavier.

Report de S-48 (revue 1, mineur 1) : sur un bouton plein (`.primary`, `button.danger`) qui a le focus clavier, la lueur de focus (`:focus-visible`) ne doit pas être écrasée par la lueur Halo du bouton : les deux ombres se cumulent, l'anneau de focus reste visible.

## Décisions de l'humain
Aucune question à confirmer.

### Après la revue 1
- S-56.1 (focus et `border-strong` sur `--selection` sous 3:1, Kraken clair) : décidé par l'humain le 26/11/2026, option (a) : ajuster `focus` et `border-strong`, ou `selection`, dans `ux/tokens.md`. `dev` ne touche pas aux valeurs : amendement de `ux.md` par `/ksm:ux` d'abord, puis reprise de S-56. Amendement validé le 26/11/2026 : `ux/tokens.md` porte les nouvelles valeurs (`border-strong` ×4, `focus` Kraken clair `#0b8479`). `dev` les reporte dans le code au passage 2, avec les problèmes 2 et 3.
- Revue 1, pour information : la date absolue affichée au focus recouvre une partie du nom d'auteur (1 920×1 080) ; même infobulle qu'au survol : pris en compte (pour information).

### Après la revue 2
- Revue validée sans mineur ni point « à décider » ; « Pour l'humain » : RAS.

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` (= `vitest run --reporter=dot`) ; Rust `pnpm test:rs -p <crate> [<filtre>]` (= `cargo test -q`) ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420` dans le navigateur, pont de test aux vraies commandes du crate `app`, jeu de dépôts d'exemple : branches, conflit en cours, identité non conforme ; port et données par `.env.local` en worktree) ; `pnpm tauri dev` n'est pas isolé (port 1420, un seul à la fois)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings`, jamais édité à la main (aucun changement de commande attendu)
- Tokens de style : `src/lib/styles/tokens.css`, écrit à partir de `ux/tokens.md`, seule source des couleurs ; aucune couleur brute ailleurs
- Conventions : CSS natif sans framework, tokens en variables CSS sur la racine ; composants Svelte 5 en `PascalCase` au nom exact de `ux.md` ; `snake_case` Rust, `camelCase` TypeScript ; interface en anglais ; accessibilité de `ux.md` (tout au clavier, focus visible, texte ≥ 12 px, jamais d'information portée par la couleur seule, WCAG AA : 4,5:1 texte, 3:1 lanes, nœuds, focus, bordures de contrôle) ; règles `eslint-plugin-svelte` d'accessibilité maintenues ; icônes Lucide 16 px, trait 1,8 px ; aucune nouvelle dépendance sans demander (le calcul de contraste s'écrit dans le test) ; travail direct sur `main`, aucun push sans validation humaine ; Conventional Commits en anglais

## Contexte technique
- Nature : audit. Pour chaque écran et composant listé ci-dessous, `dev` écrit d'abord un test e2e au clavier seul (Tab, Maj+Tab, flèches, Entrée, Espace, Échap, Maj+F10 ou touche menu), constate ce qui échoue, puis corrige. Ne corriger que ce qu'un test fait échouer.
- Ce que S-50 apporte (lire `stories/S-50-gestes-bloques-pendant-une-operation.md`) : `operationBlocked` passé de `src/App.svelte` à `History.svelte` puis aux composants ; un geste désactivé ne se lance ni au clic ni à la touche. Un menu au clavier doit montrer les entrées désactivées, ne pas les activer, et rendre leur raison lisible au focus.
- Clavier existant à réutiliser comme modèle : `src/lib/components/SyncButton.svelte` (flèche + menu à choix unique : flèches, Entrée, Échap, retour du focus) ; `RefContextMenu.svelte` (Maj+F10 / touche menu depuis `CommitGraph.svelte` : `isMenuKey`, `menuEventAt`, `oncommitcontextmenu`, `onmenukeydown`) ; en-tête de colonnes et séparateurs de `CommitGraph.svelte` ; `RebaseTodoList.svelte` (↑ ↓, Alt+↑ ↓, p r s f d, de `ux/ecrans/interactive-rebase.md`, « Clavier »).
- Composants et écrans à auditer, avec leur spec d'interface :
  - `History` (`ux/ecrans/history.md`, maquette `ux/maquettes/history.html`) : `Toolbar.svelte` (sélecteur filtrable de branche, Branch), `RefContextMenu.svelte` (menus branche locale, `origin/…`, commit, tag ; entrées merge, rebase, cherry-pick, revert, rebase interactif, reset), `BranchSidebar.svelte`, `CommitGraph.svelte` / `RefLabel.svelte` (saisie en ligne du nom : création, Rename, Create tag ; Entrée sans effet tant qu'une erreur est affichée, Échap annule), `CommitDetail.svelte` (menu de choix de branche, Checkout, « Create branch here », Cherry-pick, Revert), `StashButtons.svelte`, `SyncButton.svelte`, `PushButton.svelte`, `OperationBanner.svelte`.
  - Dialogues (`ux/ecrans/dialogues.md`) : `ResetHardDialog`, `ForcePushDialog`, `DropStashDialog`, `DiscardDialog`, `AbortMergeDialog`, `CloneDialog`, `IdentityMismatch`, et la confirmation de « Delete from origin » / « Delete local » / Delete tag : focus placé à l'ouverture, Tab piégé dans le dialogue, Échap = Cancel, focus rendu au déclencheur à la fermeture, Cancel et l'action atteignables avec un focus visible.
  - `InteractiveRebase.svelte` (`ux/ecrans/interactive-rebase.md`, maquette `ux/maquettes/interactive-rebase.html`) ; `ConflictResolver.svelte` et `ConflictPane.svelte` (`ux/ecrans/conflict-resolver.md`, maquette `ux/maquettes/conflict-resolver.html`) : liste des fichiers, Take this block, « Conflict i / n » (navigation entre blocs), Keep ours / Keep theirs / Delete, Mark as resolved, Continue ou Done, Abort, Back to graph (Échap) ; `ThemeSwitch.svelte` et son menu (`ux/ecrans/communs.md`).
  - Saisies : `SearchBox.svelte`, `ProfileForm.svelte`, `MatchingRuleList.svelte`, champs de `CloneDialog` et de `Welcome.svelte`, `ProfileSettings.svelte` : atteignables, étiquetées, focus visible.
- Focus visible global : `src/app.css` (`:focus-visible` : contour 2 px `--focus`, décalage 2 px, `box-shadow: var(--halo-focus)`). Défaut à corriger (report S-48) : les règles `.primary:not(:disabled):not([aria-disabled="true"])` et `button.danger:not(...)` posent `box-shadow: var(--halo-brand)` / `--halo-danger` avec une spécificité plus forte que `:focus-visible`, donc écrasent `--halo-focus`. Ajouter des règles `:focus-visible` pour ces boutons qui cumulent les deux ombres (`box-shadow: var(--halo-brand), var(--halo-focus)`, idem `danger`). Vérifier par `git grep -n "outline" -- 'src/*.svelte' 'src/*.css'` qu'aucun composant ne retire le contour sans le remplacer, et que le contour reste visible sur tout fond (3:1).
- Date absolue au focus (report S-4, revue 1) : `CommitGraph.svelte`, lignes ~553-565 : l'infobulle de la date (`hovered === commit.id`, `formatAbsolute(commit.timestamp)` de `src/lib/relativeTime.ts`) ne s'ouvre qu'à `mouseenter`. La ligne se focalise par le bouton `.summary` (`data-commit`). Afficher la même infobulle quand ce bouton ou la ligne a le focus (sur le modèle de `focusedAuthor` pour l'auteur et `aria-describedby`), la retirer au `blur` ; la colonne date masquée n'affiche rien. Même texte « 2026-11-04 14:32 », fuseau local.
- Contraste (CA-13) : valeurs dans `ux/tokens.md` (quatre colonnes) et `src/lib/styles/tokens.css` (sélecteurs `:root[data-theme]`, `:root[data-palette="kraken"][data-theme]`, lueur `:root[data-halo="on"][data-theme="dark"]`) ; `src/lib/styles/tokens.test.ts` (modèle : lit `tokens.css`, vérifie l'absence de couleur brute ailleurs). Écrire un test Vitest (par exemple `src/lib/styles/contrast.test.ts`) qui lit `tokens.css`, calcule le contraste WCAG (luminance relative, sans dépendance) pour les paires du tableau : `ink` / `muted` / `link` / `success` / `warning` / `danger` sur `surface` et `surface-raised`, `on-brand` sur `brand`, `on-label` sur chaque lane et sur les teintes dérivées, `node-ink` sur le remplissage de nœud (lane à 40 % sur blanc), 4,5:1 ; `lane-1…6`, `border-strong`, `focus` sur `surface` et `surface-raised`, 3:1 ; teintes dérivées de `ux/tokens.md` (« Dérivés » : lane à 10 % clair / 14 % sombre sur `surface`, bandeau conforme = `success` à 12 % sur `surface-raised`). Compléter par un e2e dans les quatre combinaisons, Halo coché et décoché, qui lit les couleurs calculées d'éléments réels (texte secondaire, étiquette de branche, lane, bordure de champ, focus) et vérifie les seuils sur le fond adjacent réel. Si une paire échoue, `dev` ne change pas la valeur de `ux/tokens.md` : il le signale dans son rapport (arrêt) ; une correction de `tokens.css` seule, qui reste dans l'esprit du token, n'est pas permise sans décision de l'humain.
- Pont de test et e2e : `src/web-bridge.ts`, `src-tauri/examples/octogit-bridge.rs`, `e2e/helpers.ts`. Fixtures : `fixtures/refs.sh`, `branches`, `conflict-merge.sh`, `conflict-rebase.sh`, `conflict-pick.sh`, `conflict-stash.sh`, `identity.sh`. Modèles e2e : `e2e/appearance.spec.ts` (menu de `ThemeSwitch`, quatre combinaisons), `e2e/sync.spec.ts` (menu de la flèche au clavier), `e2e/conflict-resolver.spec.ts`, `e2e/interactive-rebase.spec.ts`, `e2e/branch-manage.spec.ts`, `e2e/reset.spec.ts`, `e2e/integrate-menu.spec.ts`, `e2e/button-icons.spec.ts`. Ajouter `e2e/keyboard.spec.ts` (parcours au clavier par écran) et `e2e/contrast.spec.ts`.
- Reports lus dans les fiches : S-4 revue 1 mineur 5 (date au focus) ; S-48 revue 1 mineur 1 (focus et Halo) ; S-33 à S-45 : accès clavier complet des entrées de menu et des écrans, avec focus visible ; S-48 : CA-13 et CA-14 de `choisir-l-apparence`. Aucun autre point « reporter vers S-56 ».
- Direction visuelle de `ux.md` (« Neon » ; Halo : lueur sur lanes, étiquettes, boutons `brand` et `danger`, focus) et `ux/tokens.md` : voir ci-dessus.

## Interface à vérifier
- **Écrans et états** : `History` : `RefContextMenu` ouvert au clavier sur une branche locale, une `origin/…`, un commit, un tag (focus visible sur chaque entrée, entrée désactivée avec sa raison) ; sélecteur de branche de `Toolbar` ; menu de choix de branche de `CommitDetail` ; saisie en ligne (création, Rename) avec nom refusé ; date absolue au focus d'une ligne ; `ThemeSwitch` et son menu ; boutons `.primary` et `danger` avec le focus et Halo coché. Dialogues : `ResetHardDialog`, `ForcePushDialog`, une confirmation de suppression de branche. `InteractiveRebase` (ligne sélectionnée, action, message en édition, déplacement, Reset, Cancel, Start rebase). `ConflictResolver` (fichiers, blocs, Keep ours / theirs, Mark as resolved, Continue, Abort, Back to graph). Les quatre combinaisons Neon / Kraken × sombre / clair, Halo coché et décoché, sur `History`, `ConflictResolver` et un dialogue.
- **Tailles d'écran** : 1 500×900 (portable au bureau, plein écran) ; 1 920×1 080 (second écran à la maison)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`, port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] gerer-les-branches CA-24 → e2e (`e2e/keyboard.spec.ts`) : focus sur une branche puis sur un commit, ouverture du `RefContextMenu` (Maj+F10 ou touche menu), parcours des entrées, Échap ; sélecteur de `Toolbar` : ouvrir, filtrer, choisir ; menu de branche de `CommitDetail` ; saisie en ligne (Entrée valide, Échap annule, Entrée sans effet sur nom refusé) ; confirmations (Delete local, Delete from origin, Delete tag) : focus à l'ouverture, Cancel / confirmer atteignables, Échap ; à chaque étape, l'élément focalisé a un contour visible (`outline-style` non `none` et couleur `--focus`) ; Vitest pour les composants dont le rendu est isolé
- [ ] integrer-une-branche CA-17 → e2e : focus sur une branche source, menu, entrée merge ou rebase choisie et lancée au clavier seul (`git log` confirme) ; entrée désactivée (opération en cours) non lancée
- [ ] nettoyer-une-branche CA-16 → e2e (`InteractiveRebase`) : sélection ↑ ↓, p r s f d, édition d'un message, déplacement Alt+↑ ↓ et boutons, Reset, Cancel, Start rebase, tous au clavier, focus visible
- [ ] revenir-en-arriere CA-19 → e2e : commit focalisé, menu, Cherry-pick, Revert, Soft, Mixed, Hard lancés au clavier (`git rev-parse HEAD`) ; `ResetHardDialog` : Tab atteint Cancel et Hard reset, focus visible, Échap annule
- [ ] resoudre-les-conflits CA-18 → e2e (`conflict-merge.sh`, `conflict-rebase.sh`) : sélection d'un fichier, Take this block, blocs suivant / précédent, Keep ours / Keep theirs / Delete, Mark as resolved, Continue (et Done sur `conflict-stash.sh`), Abort, Back to graph (Échap), tous au clavier avec focus visible
- [ ] choisir-l-apparence CA-14 → Vitest `ThemeSwitch` et e2e : flèche, groupes Theme / Palette, case Halo atteints et activés au clavier seul, Échap ferme, focus visible
- [ ] choisir-l-apparence CA-13 → Vitest (`contrast.test.ts`) : toutes les paires de `tokens.css` dans les quatre combinaisons aux seuils 4,5:1 et 3:1, teintes dérivées comprises ; e2e (`e2e/contrast.spec.ts`) : couleurs calculées d'éléments réels dans les quatre combinaisons, Halo coché et décoché
- [ ] explorer-l-historique CA-15 (au focus) → Vitest `CommitGraph` et e2e : le bouton `.summary` d'une ligne reçoit le focus au clavier : l'infobulle « 2026-11-04 14:32 » (fuseau local) s'affiche, disparaît au blur ; au survol : inchangé
- [ ] Report S-48 (focus et Halo) → e2e : sombre, Halo coché, focus clavier sur un bouton `.primary` et sur un `button.danger` : `box-shadow` calculé contient la lueur de focus et celle du bouton ; Halo décoché : aucune lueur, contour visible

## Hors périmètre
- Changer le comportement d'un geste : seul l'accès au clavier, le focus et le contraste changent. Les gestes désactivés pendant une opération restent ceux de S-50.
- Messages d'erreur « Details » (S-53), réseau coupé et boutons occupés (S-55), refus pour modifications non commitées (S-51), HEAD détachée et commit racine (S-52).
- Nouveaux raccourcis clavier globaux, réglage des raccourcis ; aucun raccourci ne replie le panneau (README).
- Modifier `ux.md`, `ux/tokens.md`, `stack.md` ou une spec ; ajouter une bibliothèque d'accessibilité ou de contraste (axe-core, etc.).
- Lecteur d'écran (annonces vocales détaillées) au-delà des rôles et étiquettes nécessaires à l'accès au clavier.

## Documentation à mettre à jour
- `README.md` : décrire l'accès au clavier (menu contextuel par Maj+F10 ou touche menu, saisies en ligne, dialogues, `InteractiveRebase`, `ConflictResolver`, `ThemeSwitch`), le focus visible, la date absolue au focus d'une ligne du graphe (section « Graphe de `History` ») et le test de contraste des quatre combinaisons.
- `.env.example` : aucun changement.
- Rattrapage : vérifier à la lecture du README qu'il reflète S-50 à S-55 une fois livrées ; `.env.example` est à jour (`OCTOGIT_DATA_DIR`, `OCTOGIT_SSH_DIR`, `OCTOGIT_PORT`, paramètres de test) : aucun retard constaté.

## Terminé quand
- [ ] À chaque passage de `dev` : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm tauri build` (vérifie aussi `pnpm check`), plus les e2e liés au diff par `pnpm e2e <fichier>` (au minimum `e2e/keyboard.spec.ts`, `e2e/contrast.spec.ts`, `e2e/appearance.spec.ts`)
- [ ] Avant le commit, une fois, par l'agent story-runner : `pnpm e2e` ; `pnpm audit:deps` seulement si `pnpm-lock.yaml` ou `Cargo.lock` a changé depuis la Référence
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `2f4c284`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : 19 fichiers, keyboard/contrast e2e, contrast.test.ts, CommitGraph.test.ts, restoreFocus.ts ; qualité verte, 336 e2e ; écarts mineurs consignés (Maj+F10 sur WorkingChanges, choix de branche réceptrice au clavier inchangé) | — |
| 2 | reviewer | `stories/S-56-revue-1.md` : paire focus/border-strong sur `--selection` sous 3:1 (tokens, décision humaine) ; test `.primary` n'exerce que `danger` | bloqué |
| 3 | dev | passage 2 : tokens.css aligné sur `ux/tokens.md` amendé, paires `selection` (unitaire + e2e 8 apparences), vrai `.primary` (Force push) ; qualité verte, format:check revérifié | — |
| 4 | reviewer | `stories/S-56-revue-2.md` : problèmes 1, 2, 3 levés, aucun problème | validé |

# Story S-47 : ThemeSwitch Dark / Light / System

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-47-themeswitch-dark-light-system.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-47 (tranche valeur 14) ; dépend de S-4
- Critères couverts : `specs/choisir-l-apparence.md` CA-1, CA-2, CA-3, CA-5, CA-10, CA-11, CA-12
- Jobs servis : J-15
- Revue renforcée : non

## Objectif
`ThemeSwitch` dans la barre d'outils de `History` : Dark / Light / System en un clic, System suit macOS à chaud, réglage global mémorisé et appliqué à tous les écrans et dialogues. Palette Neon seule (Kraken, Halo et le menu de la flèche : S-48).

## Critères d'acceptation
- **choisir-l-apparence CA-1** : Étant donné `History` affiché, alors `ThemeSwitch` est visible dans sa barre d'outils et indique le thème actif (Dark, Light ou System) ; `Welcome`, `ProfileSettings`, `DiffView` et les dialogues n'affichent pas `ThemeSwitch`.
- **choisir-l-apparence CA-2** : Étant donné `ThemeSwitch`, quand je clique sur Dark, Light ou System, alors toute l'interface prend ce thème immédiatement, sans redémarrage ni rechargement du dépôt, et `ThemeSwitch` indique le nouveau thème actif.
- **choisir-l-apparence CA-3** : Étant donné le thème System, quand l'apparence de macOS passe de clair à sombre ou l'inverse, Octogit ouvert, alors Octogit suit cette apparence sans geste ni redémarrage.
- **choisir-l-apparence CA-5** : Étant donné aucun réglage d'apparence encore enregistré, quand je lance Octogit, alors le thème actif est System, la palette active est Neon et la case Halo est cochée.
- **choisir-l-apparence CA-10** : Étant donné un thème, une palette et un état de halo choisis, quand je ferme puis rouvre Octogit, alors les trois sont restaurés.
- **choisir-l-apparence CA-11** : Étant donné une apparence choisie dans `History`, quand j'ouvre `Welcome`, `ProfileSettings`, `DiffView` ou un dialogue, alors il s'affiche avec ce thème, cette palette et cet état de halo.
- **choisir-l-apparence CA-12** : Étant donné une apparence choisie, quand je change de dépôt par `RepoPicker` ou ouvre un dépôt rattaché à un autre profil, alors l'apparence ne change pas.

Part de ces critères qui revient à S-48 : palette et Halo (choix, mémorisation, application). Ici, seul le thème est réglable ; palette Neon et Halo coché sont les valeurs par défaut (voir « Décisions de l'humain »).

## Décisions de l'humain
### Fiche (25/11/2026)
1. Palette et Halo dans S-47 (CA-5, CA-10, CA-11) : a) S-47 mémorise et applique le thème seulement ; S-48 persiste palette et Halo et vérifie leurs défauts (réponse de l'humain, 25/11/2026)

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, jeu de dépôts d'exemple) ; `pnpm tauri dev` pour l'application (port 1420, un seul à la fois)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main ; aussi régénéré par `pnpm tauri dev`)
- Tokens de style : `src/lib/styles/tokens.css`, écrit à partir de `ux/tokens.md`, seule source des couleurs ; aucune couleur brute ailleurs
- Conventions : CSS natif sans framework, tokens en variables CSS sur la racine, changement à chaud par attribut ; composant Svelte 5 `PascalCase` au nom exact de `ux.md` dans `src/lib/components/` ; `snake_case` Rust, `camelCase` TypeScript ; interface en anglais ; préférences dans `preferences.json` (crate `store`, champ `version`, migration à la lecture, écriture atomique) ; icônes Lucide (`@lucide/svelte`, déjà utilisé) ; Conventional Commits en anglais

## Contexte technique
- Tokens : `src/lib/styles/tokens.css` définit aujourd'hui Neon sombre dans `:root` et Neon clair dans `@media (prefers-color-scheme: light)`. À remplacer par des sélecteurs d'attribut sur la racine (par exemple `:root[data-theme="dark"]` et `:root[data-theme="light"]`), valeurs de `ux/tokens.md` colonnes « Neon sombre » et « Neon clair » inchangées, `color-scheme` posé selon le thème. `src/lib/styles/tokens.test.ts` découpe le fichier sur `prefers-color-scheme: light` : l'adapter au nouveau découpage, en gardant ses vérifications (valeurs, pas de couleur brute hors `tokens.css`).
- `src/lib/components/CommitGraph.svelte` (ligne ~746) a un `@media (prefers-color-scheme: light)` pour `--tint` (10 % en clair, 14 % en sombre par défaut) : le faire suivre l'attribut de thème effectif, sans quoi un thème forcé ne change pas la teinte. Chercher d'autres `prefers-color-scheme` ou `color-scheme` avec `git grep -n` avant de conclure.
- Thème effectif : Dark ou Light = valeur choisie ; System = apparence de macOS. Stack : API de thème de la fenêtre Tauri pour lire l'apparence et ses changements (`getCurrentWindow().theme()` / `onThemeChanged` de `@tauri-apps/api`), sans nouvelle dépendance ; dans le navigateur de `pnpm dev:web` et des e2e (Chromium), repli sur `matchMedia("(prefers-color-scheme: dark)")`, que Playwright pilote par `page.emulateMedia({ colorScheme })`. Appliquer aussi le thème choisi à la fenêtre si l'API le permet, pour que les contrôles natifs suivent.
- Mémorisation : préférences globales dans `preferences.json`, sur le modèle de `sync_action` (champ optionnel `theme`, absent = System ; `skip_serializing_if`). Fichiers à suivre : `crates/store/src/lib.rs` (`PreferencesFile`, `PREFERENCES_VERSION` 4 → 5, `sync_action` / `set_sync_action` ligne ~356, tests de version lignes ~576, ~703, ~736), `src-tauri/src/preferences.rs` (`sync_action` / `set_sync_action`, type specta), `src-tauri/src/commands.rs` (`get_sync_action` / `set_sync_action` ligne ~1234) et `src-tauri/src/lib.rs` (enregistrement ligne ~161), `src-tauri/examples/octogit-bridge.rs` (dispatch ligne ~1165, pont des e2e et de `pnpm dev:web`), `src/web-bridge.ts` si le mode navigateur y mappe les commandes. Nouveaux : commandes `get_theme` / `set_theme`, type `Theme` (`dark` | `light` | `system`) ; régénérer `src/lib/bindings.ts` par `pnpm gen:bindings`. Un fichier d'exemple versionné de la version 4 doit se lire sans perte (stack : migrations testées par fichiers d'exemple ; voir comment les versions 1 à 3 sont testées dans `crates/store/src/lib.rs`).
- Application : `src/App.svelte` lit le réglage dans `onMount` (à côté de `commands.getSyncAction()`, ligne ~1697), le garde en état, pose l'attribut sur la racine du document et écoute les changements de macOS quand le réglage est System ; l'attribut est donc posé au-dessus de tous les écrans (`Welcome`, `ProfileSettings`, `DiffView`, `ConflictResolver`, dialogues), sans rechargement du dépôt ni remontage de `History` (CA-2, CA-11, CA-12). `RepoPicker` et le changement de profil ne touchent pas à ce réglage (CA-12).
- Composant : `src/lib/components/ThemeSwitch.svelte`, trois boutons exclusifs Dark / Light / System (segment actif en `brand` ; rôle et `aria-pressed` ou `radiogroup` ; actif au clavier, focus visible). Monté dans la barre d'outils de `History` : `src/lib/screens/History.svelte` ligne ~737 (autour de `RepoPicker`, `Toolbar`, `ProfileBadge`) ; ne l'ajouter à aucun autre écran (CA-1). La flèche et son menu (Palette, Halo) sont à S-48 : ne pas les ajouter ; laisser la place à la flèche (le composant reçoit le thème et un `onchange`, le reste est de S-48).
- Spécification d'interface : `ux/ecrans/communs.md` (`ThemeSwitch` : « thème actif · menu ouvert ») ; maquette `ux/maquettes/history.html`, section 1b « ThemeSwitch ▾ → appearance » (seule la partie Theme, ici) ; direction `ux/direction/neon.html` (segment actif `.seg .on`), `ux/tokens.md`. « Direction visuelle » de `ux.md` : Neon par défaut ; rayons 7 px (contrôles) ; texte ≥ 12 px ; focus visible ; WCAG AA (4,5:1 texte, 3:1 bordures de contrôle, focus) dans Neon sombre et Neon clair.
- E2E : `e2e/helpers.ts` (accès à `preferences.json`, par exemple `storedPreferences()` ligne ~455 et l'écriture ligne ~421) ; sur le modèle de `e2e/sync.spec.ts` (réglage mémorisé et relancé) et `e2e/panel.spec.ts`.
- Reports à cette story depuis d'autres fiches : aucun.

## Interface à vérifier
- **Écrans et états** : `History` : `ThemeSwitch` avec chacun des trois thèmes actifs, en sombre et en clair (System avec macOS en sombre puis en clair) ; `Welcome` et `ProfileSettings` avec un thème choisi dans `History` (ils n'affichent pas `ThemeSwitch`) ; un dialogue ouvert depuis `History`.
- **Tailles d'écran** : 1 500×900 (portable au bureau, plein écran) ; 1 920×1 080 (second écran à la maison)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] choisir-l-apparence CA-1 → Vitest `ThemeSwitch` : les trois choix sont rendus, celui du thème actif est indiqué ; e2e : `ThemeSwitch` présent dans `History`, absent de `Welcome`, `ProfileSettings`, `DiffView` et d'un dialogue
- [ ] choisir-l-apparence CA-2 → e2e : un clic sur Dark puis Light puis System change l'attribut de thème et une couleur calculée (`--surface`) de l'interface sans rechargement (le dépôt n'est pas relu) ; l'indication du thème actif suit
- [ ] choisir-l-apparence CA-3 → e2e : thème System, `page.emulateMedia({ colorScheme })` dark puis light, l'interface suit sans geste ; Vitest sur la résolution du thème effectif (valeur choisie, ou apparence système pour System)
- [ ] choisir-l-apparence CA-5 → Rust (`crates/store`, `src-tauri`) : sans `preferences.json` ou sans champ `theme`, le thème lu est System ; e2e : premier lancement, System actif et palette Neon appliquée (Halo : voir décision 1)
- [ ] choisir-l-apparence CA-10 → Rust : écriture puis relecture du thème, fichier de version 4 lu sans perte et passé en version 5 à la prochaine écriture ; e2e : choisir Light, relancer, Light actif
- [ ] choisir-l-apparence CA-11 → e2e : thème choisi dans `History`, puis `Welcome`, `ProfileSettings`, `DiffView` et un dialogue affichent le même thème
- [ ] choisir-l-apparence CA-12 → e2e : thème choisi, changement de dépôt par `RepoPicker` et ouverture d'un dépôt d'un autre profil, thème inchangé
- [ ] `tokens.test.ts` adapté : valeurs Neon sombre et clair de `ux/tokens.md` présentes sous leur sélecteur d'attribut, aucune couleur brute hors `tokens.css`

## Hors périmètre
- La flèche de `ThemeSwitch`, son menu, la palette Kraken, l'option Halo et la lueur : S-48 (`choisir-l-apparence` CA-4, CA-6 à CA-9, CA-14 à CA-16 hors thème).
- Les icônes Lucide devant les libellés de bouton : S-48.
- Tout réglage de l'apparence hors de `History`, par profil ou par dépôt (spec, Exclu).
- Thèmes personnalisés, police, taille.
- Toute modification de `ux.md`, `ux/tokens.md` ou `stack.md`.

## Documentation à mettre à jour
- `README.md` : ajouter le champ `theme` (`dark`, `light`, `system` ; absent : System) de `preferences.json` à côté de `hidden_columns`, `panel_collapsed` et `sync_action` (lignes ~37, ~53, ~85), et une phrase sur `ThemeSwitch` dans `History` (réglage global, suit macOS en System).
- `.env.example` : aucun changement attendu ; vérifier qu'il reflète l'état actuel (`OCTOGIT_PORT`, `OCTOGIT_DATA_DIR`) et noter tout retard sous « rattrapage ».
- Rattrapage : à constater par `dev` en relisant le README (commandes, ports, champs de `preferences.json`) ; rien n'est connu à ce jour.

## Terminé quand
- [ ] À chaque passage de `dev` : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm tauri build` (vérifie aussi `pnpm check`), plus les e2e liés au diff par `pnpm e2e <fichier>` (au minimum `e2e/appearance.spec.ts` et `e2e/sync.spec.ts`)
- [ ] Avant le commit, une fois, par l'agent story-runner : `pnpm e2e` ; `pnpm audit:deps` seulement si `pnpm-lock.yaml` ou `Cargo.lock` a changé depuis la Référence
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `12cc4af`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé ; tests, lint, build, e2e liés verts ; écarts : ThemeSwitch sur la seconde ligne de l'en-tête, permission `core:window:allow-set-theme`, `read_preferences` jusqu'à `PREFERENCES_VERSION` | |
| 1 | reviewer | validé, sans mineur ; pour information : position de ThemeSwitch | validé |
| fin | run de fin | `pnpm e2e` : 449 passés, 3 échecs. `badge-menu.spec.ts` CA-11 instable (passe seul, test non touché) ; `graph-width.spec.ts` CA-11 échoue seul (largeur 372 au lieu de 508) → passage 2 ; `pnpm audit:deps` non lancé (aucun verrou modifié) | |
| 2 | dev | terminé ; `settled` dans CommitGraph et panneau vide `aria-busy` dans History ; tests, lint, build, e2e liés verts | |
| 2 | reviewer | validé, sans mineur | validé |
| fin | run de fin | `pnpm e2e` complet vert ; audit non lancé (aucun verrou modifié) | |

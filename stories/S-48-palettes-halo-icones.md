# Story S-48 : Palettes Neon / Kraken, Halo et icônes de boutons

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-48-palettes-halo-icones.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-48 (tranche valeur 14) ; dépend de S-47
- Critères couverts : `specs/choisir-l-apparence.md` CA-4, CA-6, CA-7, CA-8, CA-9, CA-15, CA-16 ; et la part palette et Halo de CA-5, CA-10, CA-11 (S-47 ne couvre que le thème de ces trois critères)
- Jobs servis : J-15
- Revue renforcée : non

## Objectif
La flèche de `ThemeSwitch` ouvre un menu Theme / Palette (Neon, Kraken) / Halo ; palette et Halo s'appliquent à chaud sans perdre sélection ni défilement du graphe, sont mémorisés, et chaque bouton d'action à libellé porte une icône Lucide devant son libellé.

## Critères d'acceptation
- **choisir-l-apparence CA-4** : Étant donné `ThemeSwitch`, quand je clique sur sa flèche, alors un menu s'ouvre avec Theme (Dark, Light, System), Palette (Neon, Kraken) et une case « Halo (dark theme only) » ; Échap ou un clic hors du menu le ferme sans rien changer.
- **choisir-l-apparence CA-6** : Étant donné le menu ouvert, quand je choisis Neon ou Kraken, alors toutes les couleurs de l'interface prennent les valeurs de cette palette pour le thème actif, telles que listées dans `ux/tokens.md`, immédiatement et sans redémarrage.
- **choisir-l-apparence CA-7** : Étant donné un commit sélectionné et le graphe défilé loin du haut, quand je change de thème, de palette ou l'état du halo, alors le même commit reste sélectionné et la position de défilement du graphe ne change pas.
- **choisir-l-apparence CA-8** : Étant donné le thème sombre et Halo coché, alors les lanes, les étiquettes de branche pleines et les boutons d'action `brand`, `danger` et le focus portent une lueur ; Halo décoché, aucune lueur n'est affichée.
- **choisir-l-apparence CA-9** : Étant donné le thème effectif clair (Light, ou System avec macOS en clair), alors la case Halo reste active et modifiable, et aucune lueur n'est affichée, qu'elle soit cochée ou non ; quand le thème effectif repasse en sombre, la lueur s'affiche si et seulement si la case est cochée, sans autre geste.
- **choisir-l-apparence CA-15** : Étant donné un bouton d'action à libellé, sur tout écran (Fetch, Push, Branch, Stash, Pop, Commit, Resolve, Abort, Hard reset, etc.), alors une icône au trait de 16 px, sans remplissage, précède le libellé, et le libellé reste affiché en texte.
- **choisir-l-apparence CA-16** : Étant donné un changement de thème ou de palette, alors les icônes des boutons prennent la couleur du texte de leur bouton dans la nouvelle apparence.

Part de CA-5, CA-10 et CA-11 qui revient à S-48 (le thème est à S-47) :
- **choisir-l-apparence CA-5** : Étant donné aucun réglage d'apparence encore enregistré, quand je lance Octogit, alors le thème actif est System, la palette active est Neon et la case Halo est cochée.
- **choisir-l-apparence CA-10** : Étant donné un thème, une palette et un état de halo choisis, quand je ferme puis rouvre Octogit, alors les trois sont restaurés.
- **choisir-l-apparence CA-11** : Étant donné une apparence choisie dans `History`, quand j'ouvre `Welcome`, `ProfileSettings`, `DiffView` ou un dialogue, alors il s'affiche avec ce thème, cette palette et cet état de halo.

CA-14 (clavier du menu) est à S-56 ; le menu doit cependant se servir au clavier comme celui de `SyncButton` (flèches, Entrée, Échap, focus visible).

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, jeu de dépôts d'exemple) ; `pnpm tauri dev` pour l'application (port 1420, un seul à la fois)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main ; aussi régénéré par `pnpm tauri dev`)
- Tokens de style : `src/lib/styles/tokens.css`, écrit à partir de `ux/tokens.md`, seule source des couleurs ; aucune couleur brute ailleurs
- Conventions : CSS natif sans framework, tokens en variables CSS sur la racine, changement à chaud par attribut ; composant Svelte 5 `PascalCase` au nom exact de `ux.md` dans `src/lib/components/` ; `snake_case` Rust, `camelCase` TypeScript ; interface en anglais ; préférences dans `preferences.json` (crate `store`, champ `version`, migration à la lecture, écriture atomique) ; icônes Lucide (`@lucide/svelte`, déjà utilisé) au trait de 1,8 px, 16 px, sans remplissage ; Conventional Commits en anglais

## Contexte technique
- Ce que S-47 crée (lire sa fiche `stories/S-47-themeswitch-dark-light-system.md` et le code livré) : `src/lib/components/ThemeSwitch.svelte` (trois boutons Dark / Light / System, place laissée à la flèche ; reçoit le thème et un `onchange`), commandes `get_theme` / `set_theme` et type `Theme`, champ optionnel `theme` de `preferences.json` (`PREFERENCES_VERSION` 5), tokens en sélecteurs d'attribut sur la racine (`:root[data-theme="dark"]`, `:root[data-theme="light"]`), attribut posé par `src/App.svelte` à partir du thème effectif (System = apparence de macOS), `e2e/appearance.spec.ts`. Vérifier si `data-theme` porte le thème effectif : la lueur en dépend (CA-9). La décision 1 de la fiche de S-47 (palette et Halo, encore en attente à l'écriture) fixe la frontière ; cette fiche suppose que palette et Halo sont ici ; si la réponse de S-47 diffère, `/story` ajuste.
- Mémorisation : sur le modèle de `theme` (donc de `sync_action`) : champs optionnels `palette` (absent = Neon) et `halo` (absent = coché), `skip_serializing_if`. Fichiers : `crates/store/src/lib.rs` (`PreferencesFile`, accesseurs, `PREFERENCES_VERSION` 5 → 6, tests de version), `src-tauri/src/preferences.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` (enregistrement des commandes), `src-tauri/examples/octogit-bridge.rs` (dispatch du pont des e2e et de `pnpm dev:web`), `src/web-bridge.ts` si le mode navigateur y mappe les commandes. Nouveaux : commandes `get_palette` / `set_palette`, `get_halo` / `set_halo`, type `Palette` (`neon` | `kraken`) ; régénérer `src/lib/bindings.ts` par `pnpm gen:bindings`. Un fichier d'exemple versionné de la version 5 doit se lire sans perte (comme les versions précédentes dans `crates/store/src/lib.rs`).
- Tokens : `src/lib/styles/tokens.css` : ajouter les valeurs Kraken sombre et Kraken clair de `ux/tokens.md` (colonnes « Kraken sombre » et « Kraken clair »), sous un sélecteur combinant la palette et le thème (par exemple `:root[data-palette="kraken"][data-theme="dark"]`) ; Neon reste la valeur sans attribut de palette ou `data-palette="neon"`. `src/lib/styles/tokens.test.ts` : étendre aux valeurs Kraken, en gardant la vérification « aucune couleur brute hors `tokens.css` ».
- Dérivés (`ux/tokens.md`) : `--tint` de `src/lib/components/CommitGraph.svelte` (lignes ~715 et ~746, déjà adapté par S-47 au thème effectif) doit suivre la palette via les tokens ; pas de couleur brute.
- Lueur (Halo) : posée par un attribut sur la racine (par exemple `data-halo="on"`) et active seulement avec le thème effectif sombre (`:root[data-halo="on"][data-theme="dark"] …`), donc aucune lueur en clair même coché (CA-9) et retour automatique au passage en sombre. Règles de la maquette `ux/direction/neon.html` lignes 71 à 76 : lanes (`drop-shadow(0 0 3px currentColor)`), étiquettes pleines (`box-shadow` 8 px, `--c` à 55 %), boutons `brand` et segment actif de `ThemeSwitch` (12 px, `brand` à 70 %), boutons `danger` (10 px, 55 %), focus (10 px), étiquette « en avance » (anneau et lueur 10 px). À câbler dans les composants : `src/lib/components/CommitGraph.svelte`, `CommitNode.svelte`, `RefLabel.svelte` (box-shadow ligne ~268 : anneau existant à conserver), boutons `brand` / `danger` (`git grep -n "primary\|danger" -- 'src/*.svelte'`), focus global.
- Application et défilement (CA-7) : `src/App.svelte` garde palette et Halo en état à côté du thème (lecture dans `onMount`, à côté de `commands.getSyncAction()` et `getTheme`), pose `data-palette` et `data-halo` sur la racine. Le changement ne passe que par des attributs : aucun remontage de `History` ni du graphe, aucun rechargement du dépôt, donc sélection et défilement intacts. `RepoPicker` et le changement de profil ne touchent pas à ce réglage.
- Menu : `src/lib/components/ThemeSwitch.svelte` gagne la flèche (Lucide `ChevronDown`) et un menu à trois groupes Theme (Dark, Light, System), Palette (Neon, Kraken), case « Halo (dark theme only) » ; Échap ou clic hors du menu le ferme sans rien changer. Modèle de menu, de fermeture et de clavier : `src/lib/components/SyncButton.svelte` (flèche + menu à choix unique). Maquette `ux/maquettes/history.html`, section 1b « ThemeSwitch ▾ → appearance » (lignes ~169 à 183) : titres Theme / Palette en `muted` petit, radios et case, carte `surface-raised`. La case Halo reste active et modifiable en thème effectif clair (CA-9).
- Icônes (CA-15, CA-16) : Lucide déjà utilisé (`import X from "@lucide/svelte/icons/<nom>"`, `<X size={16} strokeWidth={1.8} aria-hidden="true" />` comme dans `SyncButton.svelte`), couleur héritée du texte (`currentColor`, pas de couleur propre : CA-16). Faire l'inventaire des boutons à libellé de `src/` (`git grep -n "<button" -- 'src/*.svelte'`, 29 fichiers ; boutons de texte seulement, pas ceux d'icône seule ni les lignes de menu) et ajouter l'icône manquante devant chaque libellé, sur tout écran et dialogue : barre d'outils (`Toolbar`, `SyncButton`, `PushButton`, `StashButtons`), `CommitDetail`, `WorkingChanges`, `OperationBanner`, `ConflictPane`, `ConflictResolver`, `InteractiveRebase`, `DiffView`, `Welcome`, `ProfileSettings`, `ProfileForm`, `IdentityMismatch`, `MatchingRuleList`, dialogues (`CloneDialog`, `DiscardDialog`, `DropStashDialog`, `ForcePushDialog`, `ResetHardDialog`, `AbortMergeDialog`). Reports vers S-48 depuis des revues (icônes des boutons de S-8, S-9, S-11, S-17) : inclus ici, par exemple Test connection, Test again, boutons de `IdentityMismatch`. Le libellé reste affiché en texte ; l'espacement entre icône et libellé est homogène (un seul patron de style, pas une valeur par bouton).
- Spécification d'interface : `ux/ecrans/communs.md` (`ThemeSwitch` : « thème actif · menu ouvert ») ; maquette `ux/maquettes/history.html` section 1b ; directions `ux/direction/neon.html` et `ux/direction/neon-kraken.html` (lueur lignes 71 à 76, case Halo ligne ~103) ; `ux/tokens.md`. « Direction visuelle » de `ux.md` : Neon par défaut, deux palettes en sombre et en clair, Halo sombre seulement ; icônes au trait de 1,8 px, 16 px, sans remplissage devant chaque libellé de bouton ; rayons 7 px (contrôles), 10 px (cartes) ; texte ≥ 12 px ; focus visible ; WCAG AA (4,5:1 texte, 3:1 bordures de contrôle, focus) dans les quatre combinaisons, lueur comprise (vérification d'ensemble : S-56).
- E2E : `e2e/helpers.ts` (accès à `preferences.json`, `storedPreferences()`) ; `e2e/appearance.spec.ts` (créé par S-47, à étendre) ; sur le modèle de `e2e/sync.spec.ts` (menu de la flèche, réglage mémorisé et relancé) et `e2e/graph.spec.ts` (sélection et défilement du graphe).
- Reports à cette story depuis d'autres fiches : icônes Lucide devant les libellés de boutons (S-9 décisions 6 et 7, S-11 décision 7, S-17 hors périmètre, journal-auto-valeur-2 ligne 15 ; voir ci-dessus).

## Interface à vérifier
- **Écrans et états** : `History` : `ThemeSwitch` avec menu fermé puis ouvert (Theme, Palette, Halo) ; les quatre combinaisons Neon / Kraken × sombre / clair, Halo coché et décoché en sombre (lueur visible puis absente), Halo coché en clair (aucune lueur) ; graphe défilé avec un commit sélectionné avant et après chaque changement ; icônes devant les boutons de la barre d'outils, de `CommitDetail`, de `WorkingChanges` et de `OperationBanner` ; `Welcome`, `ProfileSettings`, `DiffView`, `ConflictResolver`, `InteractiveRebase` et un dialogue (par exemple `ResetHardDialog`) avec une palette Kraken choisie dans `History` et leurs boutons à icône.
- **Tailles d'écran** : 1 500×900 (portable au bureau, plein écran) ; 1 920×1 080 (second écran à la maison)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] choisir-l-apparence CA-4 → Vitest `ThemeSwitch` : la flèche ouvre le menu avec Theme (3 choix), Palette (2 choix) et la case « Halo (dark theme only) » ; Échap et clic hors du menu le ferment sans changer de réglage ; e2e : même parcours dans `History`
- [ ] choisir-l-apparence CA-6 → e2e : choisir Kraken puis Neon, en sombre et en clair : `data-palette` change et des couleurs calculées (`--brand`, `--surface`, `--lane-1`) égalent les valeurs de `ux/tokens.md` ; `tokens.test.ts` étendu : valeurs Kraken sombre et clair présentes sous leur sélecteur, aucune couleur brute hors `tokens.css`
- [ ] choisir-l-apparence CA-7 → e2e : dépôt à graphe long, commit sélectionné, graphe défilé loin du haut ; changer de thème, de palette puis l'état du halo : même commit sélectionné, `scrollTop` inchangé, dépôt non relu
- [ ] choisir-l-apparence CA-8 → e2e : sombre, Halo coché : une lane, une étiquette pleine, un bouton `brand` ont une lueur (`filter` ou `box-shadow` calculé non vide) ; Halo décoché : aucune
- [ ] choisir-l-apparence CA-9 → e2e : thème clair, Halo coché ou non : la case est active et modifiable, aucune lueur ; retour en sombre (clic Dark, puis System avec `page.emulateMedia({ colorScheme: "dark" })`) : lueur si et seulement si la case est cochée, sans autre geste
- [ ] choisir-l-apparence CA-5 → Rust (`crates/store`, `src-tauri`) : sans fichier ou sans champs, palette lue Neon et halo lu coché ; e2e : premier lancement, menu : System, Neon et Halo cochés
- [ ] choisir-l-apparence CA-10 → Rust : écriture puis relecture de `palette` et `halo` (dont halo décoché), fichier de version 5 lu sans perte et passé en version 6 à la prochaine écriture ; e2e : Kraken, Halo décoché, Light, relance : les trois sont restaurés
- [ ] choisir-l-apparence CA-11 → e2e : Kraken et Halo décoché choisis dans `History`, puis `Welcome`, `ProfileSettings`, `DiffView` et un dialogue affichent `data-palette` et `data-halo` identiques et les couleurs Kraken
- [ ] choisir-l-apparence CA-15 → e2e (`e2e/button-icons.spec.ts`) : sur `History` (barre d'outils, `CommitDetail`, `WorkingChanges`), `Welcome`, `ProfileSettings`, `DiffView`, `ConflictResolver`, `InteractiveRebase` et un dialogue, chaque bouton à libellé contient un `svg` de 16 px au trait de 1,8 px, sans remplissage (`fill="none"`), avant son texte, et son libellé reste affiché ; Vitest sur les composants dont le rendu est isolé
- [ ] choisir-l-apparence CA-16 → e2e : changer de thème puis de palette : la couleur calculée du trait d'une icône de bouton égale la couleur calculée du texte de son bouton, avant et après

## Hors périmètre
- Le choix du thème, ses valeurs par défaut et le suivi de macOS : S-47.
- Contraste AA des quatre combinaisons, atteignabilité et focus visible complets du menu au clavier (`choisir-l-apparence` CA-13, CA-14) : S-56.
- Thèmes personnalisés, couleurs choisies, police, taille ; apparence par profil ou par dépôt ; tout réglage de l'apparence hors de `History` (spec, Exclu).
- Ce que font les boutons : seule leur icône change.
- Icônes sur les boutons d'icône seule, les lignes de menu contextuel et les onglets : sans objet (CA-15 vise les boutons à libellé).
- Toute modification de `ux.md`, `ux/tokens.md` ou `stack.md`.

## Documentation à mettre à jour
- `README.md` : ajouter les champs `palette` (`neon`, `kraken` ; absent : Neon) et `halo` (booléen ; absent : coché) de `preferences.json` à côté de `theme`, `hidden_columns`, `panel_collapsed` et `sync_action` (lignes ~37, ~53, ~85) ; décrire le menu de la flèche de `ThemeSwitch` (Theme, Palette, Halo : sombre seulement, sans effet en clair) et le fait que les boutons à libellé portent une icône.
- `.env.example` : aucun changement attendu ; vérifier qu'il reflète l'état actuel (`OCTOGIT_PORT`, `OCTOGIT_DATA_DIR`) et noter tout retard sous « rattrapage ».
- Rattrapage : à constater par `dev` en relisant le README (commandes, ports, champs de `preferences.json`, y compris `theme` ajouté par S-47) ; rien n'est connu à ce jour.

## Terminé quand
- [ ] À chaque passage de `dev` : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm tauri build` (vérifie aussi `pnpm check`), plus les e2e liés au diff par `pnpm e2e <fichier>` (au minimum `e2e/appearance.spec.ts`, `e2e/button-icons.spec.ts`, `e2e/sync.spec.ts` et `e2e/graph.spec.ts`)
- [ ] Avant le commit, une fois, par l'agent story-runner : `pnpm e2e` ; `pnpm audit:deps` seulement si `pnpm-lock.yaml` ou `Cargo.lock` a changé depuis la Référence
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `29bd98e`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé ; vérifications vertes ; menu ThemeSwitch reste ouvert après un choix (écart non contractuel, non transmis) ; e2e `graph.spec.ts` instable préexistant | n/a |
| 1 | reviewer | `stories/S-48-revue-1.md` : 2 mineurs | validé |
| 2 | dev | terminé ; radios dans le menu ThemeSwitch ; vérifications vertes | n/a |
| 2 | reviewer | `stories/S-48-revue-2.md` : aucun problème | validé |
| fin | run de fin | `pnpm e2e` complet : 465 passés, 4 échecs : `branch.spec.ts` CA-9 (attente périmée, venue de S-43) et `panel.spec.ts` / `sections.spec.ts` (version 5 -> 6) renvoyés à dev ; `graph.spec.ts` CA-14 (7 listitem au lieu de 6) instable préexistant. `pnpm audit:deps` non lancé (aucun lockfile changé) | n/a |
| 3 | dev | terminé ; attentes d'e2e mises à jour (3 fichiers) ; vérifications vertes | n/a |
| 3 | reviewer | `stories/S-48-revue-3.md` : aucun problème | validé |
| fin | run de fin (2e) | `branch.spec.ts`, `panel.spec.ts`, `sections.spec.ts` : 25 passés ; `graph.spec.ts` : 8 passés sur 9, échec seulement sur le premier test lancé (7 listitem au lieu de 6), instable préexistant (déjà constaté à la référence par dev), non bloquant | n/a |

## Décisions de l'humain

### Après la revue 1
- Mineur 1 (lueur de focus écrasée sur boutons pleins) : reporter vers S-56 (d'office), ajouté à sa ligne de `plan.md`.
- Mineur 2 (coche au lieu de radios dans le menu ThemeSwitch) : traiter (d'office), passage 2.

### Fin
- `graph.spec.ts` instable (7 listitem au lieu de 6, premier test d'un run) : pris en compte (pour information), non bloquant (d'office).

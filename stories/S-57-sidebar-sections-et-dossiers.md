# Story S-57 : `BranchSidebar` : sections ordonnées, noms groupés en dossiers

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-57-sidebar-sections-et-dossiers.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-57 (tranche valeur 1 bis)
- Critères couverts : `organiser-l-espace` CA-1, CA-2, CA-3
- Jobs servis : J-1, J-16
- Revue renforcée : non

## Objectif
`BranchSidebar` montre ses sections dans l'ordre fixe et triées, regroupe les noms par chemin en dossiers dépliables avec leur compte, et mémorise l'état des dossiers par dépôt.

## Critères d'acceptation
- **organiser-l-espace CA-1** : Étant donné un dépôt avec les remotes `origin`, `upstream` et `backup`, des tags et des stashes, alors `BranchSidebar` montre ses sections dans l'ordre Local, `origin`, `backup`, `upstream`, Tags, Stashes ; les branches de chaque section sont triées par ordre alphabétique, la courante à sa place ; tags et stashes vont du plus récent au plus ancien.
- **organiser-l-espace CA-2** : Étant donné les branches locales `feat/api`, `feat/graph`, `feat/ui/x` et `main`, alors Local montre le dossier « feat · 3 » puis `main` ; « feat · 3 » contient le dossier « ui · 1 » (qui affiche `x`) puis `api` et `graph` : dossiers avant les noms, chacun par ordre alphabétique, compte de toutes les refs sous le dossier, sous-dossiers compris, dossiers dépliés par défaut ; le même groupement s'applique à chaque remote et à Tags ; les stashes ne sont pas groupés.
- **organiser-l-espace CA-3** : Étant donné un dossier de `BranchSidebar`, quand je clique dessus, alors il se replie ou se déplie ; quand je ferme puis rouvre Octogit sur ce dépôt, alors il garde cet état ; un autre dépôt garde ses propres états.

## Décisions de l'humain
### Pendant le passage 1 (12/11/2026)
1. Ajouter `.vitest` à `.gitignore` et à `.prettierignore` dans cette story (demande de l'humain, hors critères).

### Écarts du passage 1 de dev (12/11/2026)
2. Ordre dans `BranchSidebar` (décision de l'humain, remplace l'ordre alphabétique des branches de CA-1) : à chaque niveau, dossiers avant les éléments ; seuls les dossiers sont triés par ordre alphanumérique croissant sans tenir compte de la casse, dans toutes les sections groupées (Local, remotes, Tags) ; tous les autres éléments (branches locales, branches distantes, tags, stashes) vont du plus récent au plus ancien (date du commit désigné), la courante à sa place dans cet ordre. Un dossier ne prend pas la date de son élément le plus récent. L'ordre des sections (CA-1) ne change pas. `specs/organiser-l-espace.md` CA-1 et CA-2 et `ux/ecrans/history.md` (ligne `BranchSidebar`) sont à amender en conséquence (par `/ksm:spec` et `/ksm:ux`, pas par `dev`).

### Après la revue 2 (12/11/2026)
3. Sidebar coupée en bas à 1280×720, sans défilement : pris en compte (pour information), couvert par S-58 (CA-4, hauteur et défilement des sections).
4. Lecture-modification-écriture de `repositories.json` à chaque clic de dossier, un clic très rapproché peut se perdre : pris en compte (pour information).
5. `pnpm dev:web` des captures coupé : pris en compte (pour information).
## Contexte technique
- Dépend de S-5 (refs, `BranchSidebar` actuel). `src/lib/components/BranchSidebar.svelte` : aujourd'hui liste plate en un seul bloc par section (`Local`, un par remote, `Tags`, `Stashes`), `<h2>{title} · {n}</h2>`, sans tri ni dossiers. Le remote `origin` passe en premier, les autres remotes par ordre alphabétique. Le tri des tags et des stashes « du plus récent au plus ancien » demande la date du commit de la ref : vérifier ce que `RefView` (`src/lib/bindings.ts`, `crates/git/src/graph.rs`) porte déjà, et ne l'ajouter côté Rust (puis `pnpm gen:bindings`) que s'il manque.
- Écran : `ux/ecrans/history.md`, ligne `BranchSidebar` du tableau des composants ; maquette `ux/maquettes/history.html`, sections 1 et « 7 · Sidebar and layout » ; icônes Lucide (`stack.md`) ; couleurs uniquement par `src/lib/styles/tokens.css`.
- Mémorisation (`stack.md` « Données ») : état des dossiers dans le fichier JSON des dépôts (`repositories.json`, clé : chemin du dépôt), écrit à chaque clic sur un dossier (ce n'est pas un glisser). Suivre le modèle de `crates/store/src/lib.rs` : `version` du fichier, migration à la lecture, fichier d'exemple versionné dans `crates/store/tests-data/` (`repositories-v1.json` existe ; si le schéma change, nouvelle version et nouveau fichier d'exemple). Une préférence est une aide : un échec d'écriture est ignoré (voir `src-tauri/src/preferences.rs`). `app` n'expose que des commandes ; régénérer `src/lib/bindings.ts` par `pnpm gen:bindings`.
- Tests : Vitest pour le tri et le groupement (fonction pure testable à part), `crates/store` pour l'aller-retour, e2e dans `e2e/refs.spec.ts` ou un nouveau fichier avec `fixtures/refs.sh` (compléter la fixture : remotes `upstream` et `backup`, branches `feat/api`, `feat/graph`, `feat/ui/x`). Un relancement se simule en rechargeant la page avec le même `OCTOGIT_DATA_DIR`.

## Interface à vérifier
- **Écrans et états** : `History` : `BranchSidebar` déplié avec dossiers dépliés et repliés, courante, plusieurs remotes, Tags, Stashes
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran), 1280×720 (taille minimale de `stack.md`)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] organiser-l-espace CA-1 → test Vitest de l'ordre des sections et du tri (courante à sa place, tags et stashes du plus récent au plus ancien) + e2e sur la fixture à trois remotes
- [ ] organiser-l-espace CA-2 → test Vitest du groupement (comptes, sous-dossiers, dossiers avant les noms, stashes non groupés) + e2e : « feat · 3 », « ui · 1 », `main`
- [ ] organiser-l-espace CA-3 → test Rust du `store` (état d'un dépôt gardé, un autre dépôt indépendant) + e2e : clic, rechargement de la page, même état ; autre dépôt inchangé

## Hors périmètre
- Hauteur, défilement et repli des sections (S-58), bande d'icônes et volet flottant (S-59).
- Clic de sélection de la branche qui reçoit, double-clic de checkout, `RefContextMenu` (autres specs).
- Colonne des refs et `RefLabel` du graphe (S-61).

## Documentation à mettre à jour
- README : section « Graphe de `History` » (ordre des sections, dossiers, état des dossiers mémorisé par dépôt dans `repositories.json`, version du fichier si elle change).
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : 9165773

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (suite pour les décisions 1 et 2), vérifications relancées ✅ | — |
| 1 | reviewer | `stories/S-57-revue-1.md` : 1 bloquant (régression CA-23 10 000 commits, ouverture > 3 s), 1 mineur (captures non prises) | à corriger |
| 2 | dev | terminé (`screen` en `$state.raw` dans `App.svelte`), vérifications relancées ✅ dont `pnpm e2e` 50/50 | — |
| 2 | reviewer | `stories/S-57-revue-2.md` : bloquant et mineur levés, aucun problème | validé |

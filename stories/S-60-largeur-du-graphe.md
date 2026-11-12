# Story S-60 : Largeur du graphe : défaut plafonné à 40 %, séparateur à glisser

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-60-largeur-du-graphe.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-60 (tranche valeur 1 bis)
- Critères couverts : `organiser-l-espace` CA-11, CA-12, CA-13
- Jobs servis : J-1
- Revue renforcée : non

## Objectif
La largeur du graphe affiche par défaut toutes les lanes dans la limite de 40 % de la zone du graphe, avec un fondu sur les lanes coupées ; un séparateur à glisser la fixe par dépôt, et un fetch ne la change jamais.

## Critères d'acceptation
- **organiser-l-espace CA-11** : Étant donné un dépôt dont toutes les lanes tiennent dans 40 % de la zone du graphe, alors la largeur du graphe affiche toutes les lanes ; étant donné un dépôt dont les lanes dépassent 40 %, alors la largeur s'arrête à 40 % et un fondu au bord signale les lanes coupées.
- **organiser-l-espace CA-12** : Étant donné la largeur du graphe par défaut, quand un fetch ajoute des lanes, alors la largeur ne change pas jusqu'à la prochaine ouverture du dépôt et un fondu au bord signale les lanes nouvelles coupées.
- **organiser-l-espace CA-13** : Étant donné le séparateur entre graphe et message, quand je le glisse, alors la largeur du graphe suit et est gardée à la fermeture d'Octogit pour ce dépôt seulement ; quand je double-clique dessus, alors elle revient au défaut, recalculé sur les lanes présentes (CA-11).

## Contexte technique
- Dépend de S-4 (graphe en lanes). `src/lib/components/CommitGraph.svelte`, `CommitNode.svelte`, `src/lib/screens/History.svelte`, `crates/git/src/graph.rs` (nombre de lanes du dépôt).
- Défaut : largeur de toutes les lanes du dépôt, au plus 40 % de la zone du graphe (mesurer la zone du graphe telle que `ux/ecrans/history.md` la définit : la liste des commits, sans `BranchSidebar` ni panneau de droite ; si la définition de « zone » reste ambiguë à l'implémentation, `dev` la pose en écart de fiche). Calculé à l'ouverture du dépôt puis figé : un fetch ne le recalcule pas, et les lanes ajoutées au-delà de la largeur sont coupées avec le fondu. Double-clic sur le séparateur : recalcul sur les lanes présentes.
- Fondu au bord : dégradé par token (`src/lib/styles/tokens.css`), jamais de couleur brute ; il signale les lanes coupées sans porter d'information par la couleur seule (le fondu est visible en clair comme en sombre).
- Séparateur : rôle `separator`, focusable, ajustable aux flèches (tout au clavier, `ux.md`) ; la largeur est écrite à la fin du glisser, pas pendant.
- Mémorisation (`stack.md` « Données ») : largeur du graphe par dépôt dans `repositories.json` (clé : chemin ; S-57 y écrit déjà l'état des dossiers) ; `version` à monter si le schéma change, fichier d'exemple versionné dans `crates/store/tests-data/`. Échec d'écriture ignoré.
- Performance : le graphe virtualisé doit rester à 60 images/s ; `e2e/graph.spec.ts` (10 000 commits, `fixtures/large.sh`) doit rester vert. Les lanes hors largeur ne sont pas tracées en plus.
- Écran : `ux/ecrans/history.md` (ligne `CommitGraph`), maquette `ux/maquettes/history.html` section « 7 · Sidebar and layout ».
- Tests : Vitest du calcul (fonction pure), `crates/store`, e2e avec une fixture à beaucoup de lanes (compléter `fixtures/`) et un fetch simulé qui en ajoute (voir `e2e/fetch.spec.ts`).

## Interface à vérifier
- **Écrans et états** : `History` : graphe avec toutes les lanes visibles, graphe coupé avec fondu, séparateur en cours de glisser, largeur réglée
- **Tailles d'écran** : 1500×900, 1920×1080, 1280×720
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] organiser-l-espace CA-11 → test Vitest de la largeur par défaut + e2e : dépôt à peu de lanes (toutes visibles, pas de fondu), dépôt à beaucoup de lanes (largeur ≤ 40 %, fondu)
- [ ] organiser-l-espace CA-12 → e2e : un fetch ajoute des lanes, largeur inchangée, fondu présent ; après réouverture du dépôt, la largeur est recalculée
- [ ] organiser-l-espace CA-13 → test Rust du `store` (largeur gardée pour ce dépôt seulement) + e2e : glisser, rechargement, même largeur ; un autre dépôt garde son défaut ; double-clic revient au défaut recalculé

## Hors périmètre
- Colonne des refs à 180 px et `RefLabel` (S-61), colonnes auteur, date, SHA (S-4).
- `BranchSidebar` (S-57 à S-59).

## Documentation à mettre à jour
- README : section « Graphe de `History` » (largeur par défaut, séparateur, fondu, largeur par dépôt dans `repositories.json`).
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : (notée au démarrage de la boucle)

| # | Agent | Résultat | Verdict |
|---|---|---|---|

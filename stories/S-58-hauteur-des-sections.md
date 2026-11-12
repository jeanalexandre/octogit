# Story S-58 : Sections de `BranchSidebar` : hauteur ajustée, redimensionnables, repliables

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-58-hauteur-des-sections.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-58 (tranche valeur 1 bis)
- Critères couverts : `organiser-l-espace` CA-4, CA-5, CA-6, CA-7, CA-8
- Jobs servis : J-1, J-16
- Revue renforcée : non

## Objectif
Chaque section de `BranchSidebar` prend la hauteur de ses lignes (8 au plus, défilement interne), se redimensionne par son bord bas et se replie par son en-tête, le tout mémorisé globalement ; replier ne retire jamais une ref du graphe.

## Critères d'acceptation
- **organiser-l-espace CA-4** : Étant donné une section de 23 lignes et une section de 3 lignes dont la hauteur n'a pas été réglée, quand `History` s'affiche, alors la première montre 8 lignes et défile seule, la seconde montre ses 3 lignes ; la branche courante est visible sans défiler ; une section vide n'affiche que son en-tête.
- **organiser-l-espace CA-5** : Étant donné une section de 3 lignes à hauteur par défaut, quand un fetch y ajoute une branche, alors sa hauteur ne change pas jusqu'à la prochaine ouverture du dépôt.
- **organiser-l-espace CA-6** : Étant donné une section de `BranchSidebar`, quand je glisse son bord bas, alors sa hauteur suit le glisser et est gardée à la fermeture d'Octogit et dans tous les dépôts ; quand je double-clique sur ce bord, alors elle revient à sa hauteur par défaut, recalculée (CA-4).
- **organiser-l-espace CA-7** : Étant donné une section de `BranchSidebar`, quand je clique sur son en-tête, alors elle se replie (en-tête seul) ou se déplie ; l'état est gardé à la fermeture d'Octogit et dans tous les dépôts.
- **organiser-l-espace CA-8** : Étant donné une section ou un dossier replié dans `BranchSidebar`, alors toutes les refs qu'il contient restent dans le graphe et la colonne des refs.

## Décisions de l'humain
### Après la revue 1 (12/11/2026)
1. Test de performance `explorer-l-historique CA-23` instable dans un `pnpm e2e` complet (117 ms pour un seuil de 50 ms, puis vert seul) : pris en compte (pour information).

## Contexte technique
- Dépend de S-57 (sections ordonnées, dossiers). `src/lib/components/BranchSidebar.svelte` et `src/lib/screens/History.svelte`.
- Hauteur par défaut : `min(nombre de lignes visibles, 8)` lignes, calculée à l'ouverture du dépôt puis figée (un fetch ne la recalcule pas) ; un double-clic sur le bord bas la recalcule sur les lignes présentes à ce moment. Une ligne de dossier compte comme une ligne. La branche courante est amenée en vue à l'ouverture. Section vide : en-tête seul, sans bord à glisser.
- Mémorisation (`stack.md` « Données ») : hauteurs et repli des sections dans les préférences globales (`preferences.json`, avec `hidden_columns` existant ; `src-tauri/src/preferences.rs`, `crates/store/src/lib.rs`), écrites à la fin du glisser, pas pendant ; clic sur l'en-tête écrit tout de suite. `version` du fichier à monter avec migration à la lecture et fichier d'exemple versionné dans `crates/store/tests-data/` (`preferences-v1.json` existe). Un échec d'écriture est ignoré. Une hauteur est mémorisée par section (nom de la section, remotes compris).
- Séparateur : un bord bas à glisser doit rester utilisable au clavier (rôle `separator`, focusable, flèches) : `ux.md` exige tout au clavier et focus visible.
- Écran : `ux/ecrans/history.md` (ligne `BranchSidebar`), maquette `ux/maquettes/history.html` section « 7 · Sidebar and layout » ; icônes Lucide ; tokens seulement.
- Tests : Vitest du calcul de hauteur par défaut (fonction pure), `crates/store` de l'aller-retour, e2e avec une fixture de 23 branches dans une section et 3 dans une autre (étendre `fixtures/refs.sh` ou une nouvelle fixture), fetch simulé par un `origin` bare qui avance (voir `e2e/fetch.spec.ts`).

## Interface à vérifier
- **Écrans et états** : `History` : `BranchSidebar` avec section défilante (8 lignes), section courte, section vide, section repliée, bord bas en cours de glisser, courante visible sans défiler
- **Tailles d'écran** : 1500×900, 1920×1080, 1280×720
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] organiser-l-espace CA-4 → test Vitest de la hauteur par défaut + e2e : 23 lignes montrent 8 lignes et défilent, 3 lignes montrent 3, courante visible, section vide en-tête seul
- [ ] organiser-l-espace CA-5 → e2e : un fetch ajoute une branche, la hauteur de la section de 3 lignes ne change pas ; après réouverture du dépôt, elle passe à 4
- [ ] organiser-l-espace CA-6 → test Rust du `store` (hauteur gardée) + e2e : glisser le bord bas, rechargement de la page, même hauteur dans un autre dépôt ; double-clic revient au défaut recalculé
- [ ] organiser-l-espace CA-7 → e2e : clic sur l'en-tête, repli, rechargement, état gardé dans un autre dépôt
- [ ] organiser-l-espace CA-8 → e2e : section et dossier repliés, les mêmes refs restent dans le graphe et la colonne des refs

## Hors périmètre
- Repli du panneau entier, bande d'icônes, volet flottant (S-59).
- Largeur du graphe (S-60), colonne des refs (S-61).
- Masquer ou épingler des branches dans le graphe : non-objectif de la spec.

## Documentation à mettre à jour
- README : section « Graphe de `History` » (hauteur par défaut, glisser et double-clic sur le bord bas, repli par l'en-tête, champs de `preferences.json` et sa `version`).
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : 99dacd6

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé, vérifications relancées ✅ (`pnpm e2e` 58/58) | — |
| 1 | reviewer | `stories/S-58-revue-1.md` : aucun problème, 1 point pour information (CA-23 instable) | validé |

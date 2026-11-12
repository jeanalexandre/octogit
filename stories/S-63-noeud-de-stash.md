# Story S-63 : Nœud de stash en carré plein à icône d'archive

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-63-noeud-de-stash.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-63 (tranche valeur 1 bis)
- Critères couverts : `explorer-l-historique` CA-30 (et CA-12, modifié le 12/11/2026, limité aux lignes qui ne sont pas des stashes)
- Jobs servis : J-1
- Revue renforcée : non

## Objectif
Le nœud d'une ligne de stash est un carré plein de 24 px (rayon 5 px, contour couleur de lane) à icône d'archive, sans initiales ; les autres commits gardent le cercle aux initiales.

## Critères d'acceptation
- **explorer-l-historique CA-30** (ajouté le 12/11/2026) : Étant donné un dépôt avec un stash, quand `History` s'affiche, alors le nœud de la ligne du stash est un carré de 24 px aux coins arrondis de 5 px, au contour plein (pas en pointillés) de la couleur de sa lane, avec une icône d'archive au centre et sans initiales ; sur le même graphe, le nœud d'un commit qui n'est pas un stash reste un cercle aux initiales (CA-12).
- **explorer-l-historique CA-12** (modifié le 12/11/2026, rappel : déjà tenu par S-4, ne doit pas régresser) : Étant donné un commit d'auteur « Jean-Alexandre Gautreau » dont la ligne n'est pas un stash, alors son nœud affiche des initiales cerclées de la couleur de sa branche et aucune image d'avatar n'est chargée.

## Contexte technique
- Dépend de S-5 (les stashes sont des refs reliées à leur nœud). Fichiers : `src/lib/components/CommitNode.svelte` (aujourd'hui `author` et `color` seulement, cercle aux initiales), `src/lib/components/CommitGraph.svelte` (le type de ref `stash` y est déjà connu : `KIND_ORDER`, variante `stash` de `RefLabel`), tests à côté (`CommitNode` n'a pas encore de `.test.ts`).
- La ligne d'un stash est le commit que désigne une ref de type stash ; le critère porte sur la ligne du stash, pas sur un commit quelconque qui porterait aussi un autre type de ref.
- Forme : carré de 24 px (même boîte que le cercle : l'alignement du fil de la `RefLabel` et des lanes ne bouge pas), rayon 5 px, contour plein de 2 px de la couleur de lane (`--lane-n`), icône d'archive Lucide (`Archive`, trait 1,8 px, 16 px, sans remplissage, `stack.md` Interface), aucune initiale. Pas de pointillés (déjà « seulement distante »). Tokens seulement, aucune couleur écrite à la main.
- Lisibilité sans la couleur : la forme (carré contre cercle) distingue le stash ; garder le contraste AA de l'icône sur le fond du nœud.
- Référence visuelle : `ux/references/stash-node.png` ; écran `ux/ecrans/history.md` (ligne `CommitGraph` / `CommitNode` / `RefLabel`, variante « stash » du nœud) ; section « Direction visuelle » de `ux.md` (puce « Nœuds du graphe »).
- Le graphe virtualisé reste à 60 images/s : `e2e/graph.spec.ts` (10 000 commits) doit rester vert.
- S-61 (même tranche) touche aussi `CommitGraph.svelte` et `CommitNode.svelte` (colonne des refs, infobulle auteur) : cette story part après sa fusion, ne rien présumer de son code.
- Tests e2e : `fixtures/refs.sh` crée déjà un stash « try notify debounce » ; `e2e/refs.spec.ts` vérifie déjà `[data-variant=stash] [data-icon=stash]` pour l'étiquette.

## Interface à vérifier
- **Écrans et états** : `History` : nœud d'un stash (carré, icône d'archive, sans initiales) à côté de nœuds de commits (cercles aux initiales), sur un dépôt `fixtures/refs.sh`, dans les deux thèmes
- **Tailles d'écran** : 1500×900, 1920×1080, 1280×720
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] explorer-l-historique CA-30 → test Vitest de `CommitNode` (variante stash : carré, icône d'archive, aucun texte d'initiales ; variante commit : cercle et initiales) + e2e `e2e/refs.spec.ts` : sur `fixtures/refs.sh`, le nœud de la ligne du stash mesure 24 px, `border-radius` 5 px, contient une icône d'archive et aucun texte ; le nœud d'un autre commit est un cercle aux initiales
- [ ] explorer-l-historique CA-12 → relancer les tests de `e2e/graph.spec.ts` et `e2e/refs.spec.ts` sur les initiales, adaptés si leur sélecteur attrapait aussi le nœud du stash

## Hors périmètre
- Les gestes sur un stash (Apply, Pop, Drop, clic droit) : S-32 ; `RefLabel` du stash (déjà livrée en S-5).
- L'icône d'application (S-64) ; commit fautif « ✕ author » (S-22), nœuds WIP et merge.
- Tout changement de `crates/` ou de `src/lib/bindings.ts` : le type de ref est déjà lu.

## Documentation à mettre à jour
- README : section « Graphe de `History` » : le nœud d'un stash est un carré à icône d'archive, les autres commits un cercle aux initiales (la première puce parle encore de « nœuds aux initiales »).
- `.env.example` : aucun changement. Rattrapage : README et `.env.example` constatés à jour au 12/11/2026 (hors S-61 en cours).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : (notée au démarrage de la boucle)

| # | Agent | Résultat | Verdict |
|---|---|---|---|

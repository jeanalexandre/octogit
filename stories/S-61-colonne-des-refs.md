# Story S-61 : Colonne des refs à 180 px, « +n », étiquettes flottantes, infobulle auteur

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-61-colonne-des-refs.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-61 (tranche valeur 1 bis)
- Critères couverts : `explorer-l-historique` CA-7 (évolution) ; `organiser-l-espace` CA-14, CA-15, CA-16, CA-18
- Jobs servis : J-1
- Revue renforcée : non

## Objectif
La colonne des refs garde 180 px : une seule `RefLabel` par commit, tronquée en fin, suivie de « +n » ; au survol ou au focus, les étiquettes entières flottent par-dessus le graphe ; le nom d'auteur a une infobulle avec son adresse.

## Critères d'acceptation
- **explorer-l-historique CA-7** (modifié le 11/11/2026) : Étant donné un dépôt avec des branches locales, des `origin/…`, des tags et des stashes, quand `History` s'affiche, alors chacun apparaît dans `BranchSidebar`, et chaque commit qu'ils désignent porte dans la colonne des refs une `RefLabel` reliée par un fil à son nœud. (Évolution de S-5 : « une `RefLabel` » par commit, voir CA-14 et CA-15 ci-dessous.)
- **organiser-l-espace CA-14** : Étant donné une ref `feature/very-long-branch-name-for-sso`, alors la colonne des refs garde 180 px de large et la `RefLabel` affiche le nom tronqué en fin, terminé par « … ».
- **organiser-l-espace CA-15** : Étant donné un commit désigné par plusieurs refs, alors sa ligne montre une seule `RefLabel`, la prioritaire (courante, sinon locale, sinon distante seule, sinon tag), suivie de « +n » pour les n autres ; une branche locale et son `origin/…` sur ce commit forment une seule étiquette à deux icônes.
- **organiser-l-espace CA-16** : Étant donné une `RefLabel` tronquée ou suivie de « +n », quand je la survole ou lui donne le focus clavier, alors toutes les `RefLabel` de la ligne s'affichent entières, empilées par-dessus le graphe, dans leur variante (`specs/explorer-l-historique.md` CA-8) ; un double-clic ou un clic droit sur l'une d'elles agit sur cette ref comme sur sa `RefLabel`.
- **organiser-l-espace CA-18** : Étant donné un commit de « Valérie Olivier » (`v.olivier@pro-company.fr`), quand je survole son nom d'auteur ou lui donne le focus clavier, alors une infobulle affiche « Valérie Olivier <v.olivier@pro-company.fr> ».

## Décisions de l'humain
### Fiche (12/11/2026)
1. `specs/explorer-l-historique.md` révisée le 12/11/2026 (CA-12 modifié, CA-30 ajouté) après la création de cette fiche : continuer selon la fiche, aucun critère de S-61 n'a changé.

## Contexte technique
- Dépend de S-5 (refs reliées aux nœuds). Fichiers : `src/lib/components/RefLabel.svelte` (+ `RefLabel.test.ts`), `CommitGraph.svelte`, `CommitNode.svelte` ; `specs/explorer-l-historique.md` CA-7 et CA-8 (variantes de `RefLabel` : synchronisée, en avance, distante seule, tag).
- Priorité d'affichage : courante, sinon locale, sinon distante seule, sinon tag. Une locale et son `origin/…` sur le même commit restent une étiquette à deux icônes (déjà le cas depuis S-5 : ne pas le casser).
- Étiquettes flottantes : empilées dans leur style, au-dessus du graphe, au survol ou au focus clavier de la ligne ; elles gardent leurs gestes (double-clic, clic droit) : tant que checkout et `RefContextMenu` n'existent pas (S-25, S-36), seul le geste de focus et de sélection est observable ; la fiche ne demande pas de les implémenter, mais ne doit rien bloquer pour eux (événement ou rappel par ref, pas de ligne entière).
- Infobulle de l'auteur : nom et adresse (`CommitView` doit porter l'adresse : voir `crates/git/src/graph.rs` et `src/lib/bindings.ts` ; ne l'ajouter que si elle manque, puis `pnpm gen:bindings`) ; focus clavier obligatoire (nom d'auteur focalisable ou ligne qui le porte), texte ≥ 12 px, contraste AA.
- Le graphe virtualisé reste à 60 images/s : `e2e/graph.spec.ts` (10 000 commits) doit rester vert.
- Écran : `ux/ecrans/history.md` (ligne `CommitGraph` / `CommitNode` / `RefLabel`), maquette `ux/maquettes/history.html` sections 1 et « 7 · Sidebar and layout » ; icônes Lucide ; tokens seulement.
- Tests : Vitest de `RefLabel` et de la sélection de la prioritaire (fonction pure), e2e avec `fixtures/refs.sh` (compléter : nom très long, commit à plusieurs refs, auteur « Valérie Olivier »).

## Interface à vérifier
- **Écrans et états** : `History` : colonne des refs (nom tronqué, « +n », locale + `origin/…` à deux icônes, tag), étiquettes flottantes au survol et au focus, infobulle d'auteur
- **Tailles d'écran** : 1500×900, 1920×1080, 1280×720
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] organiser-l-espace CA-14 → test Vitest de `RefLabel` (troncature en fin avec « … ») + e2e : la colonne mesure 180 px avec la ref `feature/very-long-branch-name-for-sso`
- [ ] organiser-l-espace CA-15 → test Vitest de la priorité (courante, locale, distante seule, tag) et de « +n » + e2e : une seule étiquette par ligne, locale + `origin/…` à deux icônes
- [ ] organiser-l-espace CA-16 → e2e : survol puis focus clavier d'une étiquette tronquée ou « +n », toutes les étiquettes de la ligne entières et empilées, par-dessus le graphe
- [ ] organiser-l-espace CA-18 → test Vitest : infobulle « Valérie Olivier <v.olivier@pro-company.fr> » au survol et au focus
- [ ] explorer-l-historique CA-7 (évolution) → relancer les tests e2e de refs de S-5 (`e2e/refs.spec.ts`) adaptés à l'étiquette unique par ligne

## Hors périmètre
- Saisie en ligne d'un nom qui s'élargit (`organiser-l-espace` CA-17) : S-26 ; création, Rename de branche et Create tag eux-mêmes.
- Double-clic de checkout et `RefContextMenu` (S-25, S-36) : seulement ne pas les bloquer.
- Largeur du graphe (S-60), `BranchSidebar` (S-57 à S-59), colonnes auteur, date, SHA (S-4).

## Documentation à mettre à jour
- README : section « Graphe de `History` » (colonne des refs à 180 px, une étiquette par ligne, « +n », étiquettes flottantes, infobulle auteur).
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : (notée au démarrage de la boucle)

| # | Agent | Résultat | Verdict |
|---|---|---|---|

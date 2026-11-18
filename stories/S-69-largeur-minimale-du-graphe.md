# Story S-69 : Colonne du graphe d'au moins 64 px, infobulle de l'auteur au-dessus du nom

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-69-largeur-minimale-du-graphe.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-69 (tranche valeur 7 bis)
- Critères couverts : `organiser-l-espace` CA-11, CA-13, CA-18 (évolutions du 18/11/2026, validées par l'humain le 18/11/2026)
- Jobs servis : J-1
- Revue renforcée : non

## Objectif
La colonne du graphe mesure au moins 64 px (au défaut et au glisser), l'en-tête « Graph » reste entier et hors de « Commit message », et l'infobulle de l'auteur s'ouvre au-dessus du nom, alignée sur la colonne Auteur, sans recouvrir le message.

## Critères d'acceptation
- **organiser-l-espace CA-11** (modifié le 18/11/2026) : Étant donné un dépôt dont toutes les lanes tiennent dans 40 % de la zone du graphe, alors la largeur du graphe affiche toutes les lanes ; étant donné un dépôt dont les lanes dépassent 40 %, alors la largeur s'arrête à 40 % et un fondu au bord signale les lanes coupées ; étant donné un dépôt à une seule lane, alors la largeur du graphe vaut 64 px et l'en-tête « Graph » s'affiche entier, sans empiéter sur l'en-tête « Commit message ».
- **organiser-l-espace CA-13** (modifié le 18/11/2026) : Étant donné le séparateur entre graphe et message, quand je le glisse, alors la largeur du graphe suit sans descendre sous 64 px, l'en-tête « Graph » restant entier et hors de « Commit message », et est gardée à la fermeture d'Octogit pour ce dépôt seulement ; quand je double-clique dessus, alors elle revient au défaut, recalculé sur les lanes présentes (CA-11).
- **organiser-l-espace CA-18** (modifié le 18/11/2026) : Étant donné un commit de « Valérie Olivier » (`v.olivier@pro-company.fr`), quand je survole son nom d'auteur ou lui donne le focus clavier, alors une infobulle affiche « Valérie Olivier <v.olivier@pro-company.fr> », ouverte au-dessus du nom d'auteur, alignée sur la colonne Auteur, sans recouvrir le texte du message de cette ligne.

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, jeu de dépôts d'exemple, données dans un dossier temporaire)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (aucun changement attendu ici)
- Tokens de style : `src/lib/styles/tokens.css` (écrit à partir de `ux/tokens.md`, seule source des couleurs)
- Conventions : CSS natif, styles propres au composant Svelte, tokens seulement ; noms d'interface en anglais ; `camelCase` en TypeScript ; Conventional Commits en anglais ; un réglage par glisser est écrit à la fin du geste

## Contexte technique
- Évolution de S-60 (`stories/S-60-largeur-du-graphe.md`) et S-61 (`stories/S-61-colonne-des-refs.md`), livrées ; le code existe déjà.
- `src/lib/graphWidth.ts` : `MIN_GRAPH_WIDTH = 32` sert à la fois de marge de `lanesWidth` (`max * LANE_WIDTH + 32`), de plancher de `defaultGraphWidth` et de `clampGraphWidth`, et de borne haute minimale (`Math.max(lanes, MIN)`). Le plancher d'affichage passe à 64 px (au défaut comme au glisser) ; la borne haute « toutes les lanes » de S-60 est revue : elle ne peut pas descendre sous 64 px, un dépôt à une lane peut donc être élargi jusqu'à 64 px au moins. Séparer le plancher (64) de la marge de `lanesWidth` si nécessaire, sans changer le calcul du nombre de lanes ni le fondu (`cut = lanes > graphWidth` : pas de fondu pour un dépôt à une lane).
- `src/lib/graphWidth.test.ts` : tests existants à mettre à jour (plancher 32 devenu 64).
- `src/lib/components/CommitGraph.svelte` : `currentWidth` (`Math.max(MIN_GRAPH_WIDTH, adjusted)` : une largeur déjà mémorisée sous 64 px, dans `repositories.json` (`graph_widths`), est relevée à 64 à l'affichage, sans réécriture du fichier ni migration), `keyResize` (flèches), `aria-valuemin={MIN_GRAPH_WIDTH}`, séparateur positionné par `left: calc(REFS_WIDTH + graphWidth - 3px)`. En-tête `<span>Graph</span>` (≈ ligne 378) : doit tenir entier dans 64 px (padding et `overflow` de `.head` à vérifier) sans empiéter sur « Commit message ».
- Infobulle de l'auteur : `span.tooltip` (≈ lignes 541-545), dans `span.who` ; la règle `.tooltip` (≈ ligne 931) la place à gauche du nom (`right: 100%`, centrée verticalement), donc par-dessus le message. La même classe sert à l'infobulle de la date (`formatAbsolute`) : ne pas changer celle-ci. Nouvelle position pour l'auteur : au-dessus du nom (`bottom: 100%`), bord gauche aligné sur la colonne Auteur, sans couvrir le texte du message de la ligne ; vérifier que la première ligne visible (sous l'en-tête collant) ne la rogne pas. Focus clavier, `role="tooltip"` et `aria-describedby` inchangés ; texte ≥ 12 px, contraste AA.
- `e2e/graph-width.spec.ts` (CA-11, CA-13 de S-60) et `e2e/refs-column.spec.ts` (CA-18, ≈ lignes 135-153) : à adapter ; fixtures dans `fixtures/` (dont `wide.sh` pour beaucoup de lanes, `refcolumn.sh` pour « Valérie Olivier »). Une fixture à une seule lane existe sans doute : sinon en ajouter une (lancée par `sh <script>` comme dans `e2e/helpers.ts`).
- Écran : `ux/ecrans/history.md` (ligne `CommitGraph`), maquette `ux/maquettes/history.html` (sections 1 et « 7 · Sidebar and layout »), « Direction visuelle » de `ux.md`.
- Le graphe virtualisé reste à 60 images/s : `e2e/graph.spec.ts` (10 000 commits) doit rester vert.

## Interface à vérifier
- **Écrans et états** : `History` : dépôt à une seule lane (colonne 64 px, en-tête « Graph » entier, sans empiéter sur « Commit message »), dépôt à beaucoup de lanes (40 %, fondu), séparateur glissé au plus bas (64 px), double-clic (retour au défaut), infobulle de l'auteur au survol et au focus clavier (au-dessus du nom, message de la ligne visible), y compris sur la première ligne
- **Tailles d'écran** : 1500×900 (portable), 1920×1080 (second écran), 1280×720
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] organiser-l-espace CA-11 → Vitest de `defaultGraphWidth` / `lanesWidth` (une lane : 64 ; plancher 64 quand 40 % de la zone est plus petit) + e2e : dépôt à une lane, colonne de 64 px, en-tête « Graph » entier (boîte du texte contenue dans la colonne, hors de « Commit message »)
- [ ] organiser-l-espace CA-13 → Vitest de `clampGraphWidth` (jamais sous 64) + e2e : glisser le séparateur au plus bas, la colonne reste à 64 px, en-tête entier ; flèche gauche idem ; une largeur mémorisée sous 64 px est affichée à 64 ; double-clic revient au défaut recalculé
- [ ] organiser-l-espace CA-18 → e2e (adapter `e2e/refs-column.spec.ts`) : survol puis focus clavier du nom « Valérie Olivier » : texte de l'infobulle inchangé, boîte de l'infobulle au-dessus du nom, bord gauche aligné sur la colonne Auteur, sans intersection avec la boîte du message de la ligne

## Hors périmètre
- Défaut à 40 % de la zone, fondu et gel du défaut (CA-11, CA-12 hors évolution) : ne pas changer leur logique.
- Infobulle de la date, colonne des refs à 180 px, `RefLabel` (S-61), `BranchSidebar`.
- Ligne WIP, sélection du dernier commit, amend (S-67, S-68).
- Schéma de `repositories.json` : aucune migration.

## Documentation à mettre à jour
- README : section « Graphe de `History` » (largeur du graphe d'au moins 64 px au défaut et au glisser, infobulle de l'auteur au-dessus du nom) ; retirer toute mention de 32 px ou de la borne haute « toutes les lanes » si présente.
- `.env.example` : aucun changement (aucune variable ajoutée).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `171fce0`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : plancher 64 px (`LANES_MARGIN` séparée), infobulle auteur au-dessus du nom, tests et e2e verts | — |
| 1 | reviewer | CA-11, CA-13 couverts ; CA-18 partiel : infobulle auteur recouverte par l'en-tête collant (z-index), voir `S-69-revue-1.md` | à corriger |
| 2 | dev | terminé : `.who:hover/:focus-within` à `z-index: 5`, e2e ligne défilée (rouge constaté), tests verts | — |
| 2 | reviewer | tous critères couverts, bloquant 1 levé, voir `S-69-revue-2.md` | validé |

# Story S-30 : Rechercher dans l'historique par message, auteur ou SHA

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-30-recherche-dans-l-historique.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-30 (tranche valeur 7)
- Critères couverts : `explorer-l-historique` CA-17, CA-18, CA-19, CA-20, CA-21, CA-22
- Jobs servis : J-5
- Revue renforcée : non

## Objectif
`History` a une `SearchBox` (Cmd+F) qui surligne les commits dont le résumé, la description, l'auteur ou le SHA contient la saisie, navigue entre les résultats (Entrée, Maj+Entrée) avec compteur « position / total », sélectionne un SHA collé, et filtre le graphe par « Show matches only ».

## Critères d'acceptation
- **explorer-l-historique CA-17** : Étant donné `History`, quand je fais Cmd+F, alors `SearchBox` reçoit le focus.
- **explorer-l-historique CA-18** : Étant donné une saisie dans `SearchBox`, alors les commits dont le résumé, la description, l'auteur ou le SHA contient le texte, sans tenir compte de la casse, sont surlignés dans le graphe ; le compteur affiche « position / total » (ex. « 3 / 12 »).
- **explorer-l-historique CA-19** : Étant donné des résultats, quand je fais Entrée, alors la sélection passe au résultat suivant et le graphe défile pour l'afficher ; Maj+Entrée passe au précédent ; le compteur suit.
- **explorer-l-historique CA-20** : Étant donné un SHA complet ou abrégé d'un commit du dépôt collé dans `SearchBox`, alors ce commit est sélectionné et affiché dans le graphe sans autre geste.
- **explorer-l-historique CA-21** : Étant donné une saisie sans résultat, alors `SearchBox` affiche l'état « aucun » et la sélection ne change pas.
- **explorer-l-historique CA-22** : Étant donné des résultats, quand j'active « Show matches only », alors seules les lignes des résultats restent dans le graphe ; le désactiver rétablit toutes les lignes.

## Contexte technique
- Écran : `History` (`ux/ecrans/history.md`, composant `SearchBox` : états vide · n résultats · aucun · filtre seul ; maquette `ux/maquettes/history.html` : champ « Message, author, SHA ⌘F » dans l'en-tête ligne 112, état « Search active » ligne 302 : « notify », « 2 / 5 », ↑ ↓, case « Show matches only »). `ux.md` principe 5 (Cmd+F) ; « Ton et accessibilité » : tout au clavier, focus visible, jamais d'information portée par la couleur seule (le surlignage s'accompagne du compteur et de la sélection) ; « Direction visuelle » : tokens `selection`, `focus`, `border`, `muted`, texte ≥ 12 px, icônes Lucide non utilisées avant S-48. Couleurs seulement par `src/lib/styles/tokens.css`.
- À créer : `src/lib/components/SearchBox.svelte` (nom exact de `ux.md`) et sa logique de résultats dans un module TS testable (par exemple `src/lib/search.ts`, sur le modèle de `src/lib/sectionHeight.ts`).
- À toucher : `src/lib/screens/History.svelte` (l'en-tête `header` porte `RepoPicker`, `Toolbar`, `FetchStatus`… : y poser `SearchBox` ; Cmd+F via `svelte:window` ; la sélection passe déjà par `select` et `selected`) ; `src/lib/components/CommitGraph.svelte` (liste virtualisée à lignes de hauteur fixe `ROW`, `scrollTop`, props `selected`, `onselect` : ajouter un jeu d'ids surlignés, le défilement vers une ligne comme le fait déjà la saisie en ligne vers la ligne `inline` autour de la ligne 111, et « Show matches only » qui réduit la liste des lignes affichées ; les lanes restent calculées sur l'historique complet, seules les lignes affichées changent). Fichier long : `git grep -n` puis Read en offset et limit.
- Données : `CommitInfo` (`crates/git/src/lib.rs`) ne porte que `summary`, `author`, `author_email`, `id`, `timestamp`, `parents` : la description (corps du message) n'est pas côté interface. La recherche sur la description doit se faire dans le cœur (crate `git`, lecture `gix` via `commit.message()`, comme `read_commits` ligne 268) par une commande dédiée exposée par `src-tauri` (commandes seulement, sans logique), plutôt que d'alourdir `CommitInfo` de 10 000 corps de message. Même plage que le graphe (limite de lecture de `read_commits`). Contrat par `pnpm gen:bindings` (`src/lib/bindings.ts` généré, jamais édité) ; pont de test de `pnpm dev:web` qui exécute les vraies commandes (`e2e/`, `src/web-bridge.ts`).
- Règles de correspondance : sous-chaîne, sans casse, sur résumé, description, auteur (nom, et adresse si disponible) et SHA ; un SHA complet ou abrégé d'un commit du dépôt sélectionne ce commit (CA-20) ; résultats dans l'ordre du graphe (plus récent d'abord) ; Entrée après le dernier revient au premier (choix d'implémentation, à tester).
- Sélectionner un résultat = sélectionner le commit comme un clic (ouvre `CommitDetail`, S-5). La ligne WIP et les lignes de stash ne sont pas des résultats de recherche de message.
- Fixtures existantes à réutiliser : `fixtures/branches.sh`, `fixtures/refs.sh` (merge, commits signés) ; `fixtures/large.sh` (10 000 commits) pour vérifier que surlignage et filtre restent fluides ; ajouter un script de fixture seulement s'il faut des corps de message et auteurs distincts (voir `fixtures/lib.sh`).
- Conventions : composants Svelte 5 en `PascalCase`, `camelCase` en TypeScript, `snake_case` en Rust ; texte d'interface en anglais, messages courts (« No results » ou formulation d'`ux/ecrans/history.md` « aucun » : choisir une forme courte et factuelle).
- `stack.md` : tests ciblés `pnpm test:js <fichier> [-t <nom>]`, `pnpm test:rs -p <crate> [<filtre>]`, `pnpm e2e <fichier> [-g <nom>]`.

## Interface à vérifier
- **Écrans et états** : `History` : `SearchBox` vide ; saisie avec résultats (surlignage dans le graphe, « 2 / 5 », navigation Entrée et Maj+Entrée) ; SHA collé (commit sélectionné) ; saisie sans résultat (état « aucun ») ; « Show matches only » actif puis désactivé ; dépôt de 10 000 commits avec une saisie
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] explorer-l-historique CA-17 → e2e : Cmd+F dans `History` donne le focus à `SearchBox` ; test de composant du focus
- [ ] explorer-l-historique CA-18 → test unitaire (Vitest) de la correspondance (casse ignorée, résumé, description, auteur, SHA) et test Rust du crate `git` pour la description ; e2e : saisie, lignes surlignées, compteur « 1 / n »
- [ ] explorer-l-historique CA-19 → e2e : Entrée passe au résultat suivant, le graphe défile (résultat hors de la fenêtre virtualisée), Maj+Entrée revient, compteur suit
- [ ] explorer-l-historique CA-20 → e2e : SHA complet puis abrégé collés, le commit est sélectionné et visible, `CommitDetail` l'affiche
- [ ] explorer-l-historique CA-21 → test de composant et e2e : saisie sans résultat, état « aucun », sélection inchangée
- [ ] explorer-l-historique CA-22 → e2e : « Show matches only » ne laisse que les lignes des résultats, le désactiver rétablit toutes les lignes

## Hors périmètre
- Filtre « Whole repo / Local » (écarté dans `ux.md`) ; recherche dans le contenu des fichiers ou des diffs ; historique d'un fichier.
- `DiffView` (S-29), indexation (S-31), icônes Lucide (S-48), raccourcis autres que Cmd+F.
- Changer `CommitInfo` ou le contrat d'ouverture au-delà de ce que la recherche exige.
- Mémoriser la saisie ou l'état de « Show matches only » entre deux sessions (aucun critère).

## Documentation à mettre à jour
- README : section « Graphe de `History` » : décrire la recherche (Cmd+F, champs cherchés, compteur, Entrée / Maj+Entrée, SHA collé, « Show matches only »), la commande Rust de recherche et les fixtures éventuellement ajoutées.
- `.env.example` : aucun changement attendu. Rattrapage : README et `.env.example` vérifiés à l'écriture de la fiche, à jour (aucun retard constaté).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `c88b710`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (tests, lint, build, e2e 260, audit ✅) ; écart ux.md : `SearchBox` en seconde ligne sous le `header` (+40 px) au lieu de dans l'en-tête de la maquette | — |
| 1 | reviewer | validé avec 2 mineurs (`stories/S-30-revue-1.md`) | validé |
| 2 | dev | terminé (tests, lint, build ✅) ; 2 mineurs traités, rouge constaté | — |
| 2 | reviewer | validé, aucun problème (`stories/S-30-revue-2.md`) | validé |

## Décisions de l'humain
### Écart en attente (passage 1, avant revue 1)
- Question 1 : `dev` a posé `SearchBox` dans une seconde ligne sous le `header` de `History` (maquette `ux/maquettes/history.html` ligne 112 : dans l'en-tête). Raison : dans le `header`, `.path` s'effondre à 1280 px et `e2e/panel.spec.ts` échoue ; avec `flex-wrap` la hauteur bouge au chargement. Coût : environ 40 px de hauteur. Options : a) accepter la seconde ligne et amender `ux/ecrans/history.md` et la maquette via `/ksm:ux` (proposé) ; b) exiger la position dans l'en-tête (nouveau passage `dev`).
- Autres écarts de `dev` (commande `search_commit_messages`, fixture `fixtures/search.sh`, compteur `aria-live`, flèches en CSS, choix d'implémentation) : dans la fiche ou sans effet sur un contrat existant ; non transmis au reviewer.
- Réponse : a) accepter la seconde ligne ; `ux/ecrans/history.md` et la maquette à amender par `/ksm:ux`. L'humain constate aussi que l'en-tête de `History` ne respecte pas du tout la maquette : à reprendre en fin de parcours (18/11/2026).

### Après la revue 1
- Mineur 1 (README dit « dans l'en-tête » alors que `SearchBox` est en seconde ligne) : traiter (d'office), passage 2.
- Mineur 2 (Entrée avance depuis le rang de la recherche, pas depuis le commit sélectionné après un clic ailleurs) : traiter (d'office), passage 2 : Entrée part du commit sélectionné s'il est dans les résultats ; sinon comportement actuel ; test à ajouter.

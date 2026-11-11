# Revue S-4 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` (clippy `-D warnings` puis ESLint) | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo test workspace : 34 tests ; Vitest : 46 tests) | ✅ |
| `pnpm e2e` (22 tests, dont les 9 de `e2e/graph.spec.ts`) | ✅ |
| `pnpm audit:deps` (1 exception déjà acceptée) | ✅ |
| `pnpm tauri build` (avec `pnpm check` : 0 erreur) | ✅ |

L'arbre de travail est identique avant et après les vérifications. Aucun processus n'est resté lancé (vite et le bridge sont coupés).

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-9 | couvert | `crates/git/src/lib.rs` `lanes_of_the_branches_repository_split_and_rejoin_with_distinct_colors` (lanes 0/1, couleurs distinctes, coude de création par `In` sur « Fix parser bug », décision 3) ; `History.test.ts` CA-9 ; `e2e/graph.spec.ts:28` (trait = couleur du nœud, couleurs différentes entre branches voisines, bandes distinctes), aux deux tailles. Le test échouerait si les couleurs ou le trait manquaient. |
| explorer-l-historique CA-12 | couvert | `History.test.ts` CA-12 (« JG », `--lane-2`, aucun `img`) ; `e2e/graph.spec.ts:60` (bordure = trait, rayon 50 %, aucune requête `image`) |
| explorer-l-historique CA-13 | couvert | `e2e/graph.spec.ts:89` (clic droit, chaque colonne séparément, masquée puis réaffichée) et `:123` (Maj+F10, flèches, Entrée, Échap, focus rendu à l'en-tête, décision 1) ; `History.test.ts` CA-13 |
| explorer-l-historique CA-14 | couvert | `crates/store` : 5 tests, dont le fichier d'exemple `tests-data/preferences-v1.json` ; `src-tauri/src/preferences.rs` : 2 tests ; `e2e/graph.spec.ts:139` (rechargement avec le même `data_dir`, colonne toujours masquée, puis réaffichée et gardée) |
| explorer-l-historique CA-15 | couvert | `relativeTime.test.ts` (« 12 min ago », « yesterday », « 3 weeks ago », format « 2026-11-04 14:32 ») ; `e2e/graph.spec.ts:163` (survol, « 2024-01-14 09:00 » en UTC, disparition à la sortie) |
| explorer-l-historique CA-16 | couvert | `History.test.ts` CA-16 ; `e2e/graph.spec.ts:178` (une seule ligne, sans coupure, sous la dernière ligne, en pied de fenêtre) |
| explorer-l-historique CA-23 | couvert | `e2e/graph.spec.ts:203` : ouverture en moins de 3 s (1 335 ms mesurées dans mes captures), moins de 80 lignes dans le DOM, défilement image par image sans trou jusqu'à `max`, au moins 50 images/s (seuil accepté, décision 2) et aucune image au-delà de 50 ms |

Tests au rouge non constaté (`e2e/graph.spec.ts`, 8 tests) : je les ai examinés un par un. Chacun échouerait si son critère n'était pas tenu. Les assertions portent sur des valeurs calculées (couleurs, textes, nombre de lignes, temps, trous). Aucune n'est à vide ni ne dépend d'un état préalable : chaque test a son propre `Workspace` et son propre `data_dir`. Une seule comparaison est faible : `band` différent de la couleur de `body` dans CA-9. Le critère reste tenu par les autres assertions du même test, donc rien de bloquant.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · dépôt `branches` (lanes, merge, coudes) · 1500×900 | écart | 1 |
| History · dépôt `branches` · 1920×1080 | écart | 1 |
| History · thème clair (système) · 1500×900 et 1920×1080 | écart | 1 |
| History · menu des colonnes au clic droit · 1500×900 | écart | 2 |
| History · menu des colonnes au clavier (Maj+F10) · 1920×1080 | écart | 2 |
| History · colonne Date masquée puis page rechargée · 1500×900 et 1920×1080 | conforme | — |
| History · date absolue au survol · 1500×900 et 1920×1080 | conforme | — |
| History · 10 000 commits, ouverture, milieu et fin du défilement · 1500×900 et 1920×1080 | conforme | — |
| History · initiales d'un auteur composé (« Jean-Alexandre Gautreau » → JG) · 1500×900 et 1920×1080 | écart | 1 |
| History · barre d'aide en pied · 1500×900 et 1920×1080 | conforme | — |

Aucun débordement ni chevauchement de mise en page aux deux tailles (`scrollWidth` égal à `clientWidth`).

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/CommitNode.svelte:29` | Les initiales du nœud sont en `font-size: 10px` (pastille de 22 px). `ux.md` (« Ton et accessibilité ») exige un texte d'au moins 12 px. La maquette `ux/maquettes/history.html` trace les initiales en 12 px gras dans un cercle de rayon 12. | Initiales à 12 px au moins, et la pastille agrandie pour qu'elles tiennent (24 px comme la maquette), sans recouvrir la bande. Ajouter un test, par exemple étendre `typography.test.ts` à `CommitNode.svelte`. |
| 2 | bloquant | `src/lib/components/CommitGraph.svelte:217-227` | Le menu des colonnes ne propose que Author, Date et SHA. La maquette (section 1b « Right-click on graph header → columns ») montre aussi « Commit message » coché et désactivé, et une note qui dit quelles colonnes restent toujours affichées. | Ajouter une entrée « Commit message » cochée et désactivée (`aria-disabled`, sans effet au clic ni à Entrée), et une ligne de note sous les entrées, adaptée aux colonnes présentes (aujourd'hui « Graph » ; « Branch / tag » arrive en S-5). Couvrir par un test de composant ou e2e. |
| 3 | mineur | `crates/git/src/graph.rs:122` | Quand le second parent d'un merge est déjà attendu par une autre lane, l'arête `Out` prend la couleur du merge. La maquette colore ce coude de la couleur de la lane d'arrivée (`M26 425 H48 Q56 425 56 433 V459` en `lane-2`). C'est aussi ce que fait le code quand la lane est nouvelle. | `edge_color` = couleur de la lane `i` existante (`lanes[i]`). |
| 4 | mineur | `src/lib/components/CommitNode.svelte:27` | Le remplissage du nœud est mélangé avec `var(--on-brand)`. `ux/tokens.md` fixe « lane à 40 % sur blanc ». Le rendu est identique aujourd'hui en Neon, mais `on-brand` vaut `#062b27` en Kraken sombre. | Mélanger avec du blanc (ou un token dédié), pas `on-brand`. |
| 5 | mineur | `src/lib/components/CommitGraph.svelte:186-195` | La date absolue ne s'affiche qu'à `mouseenter`. Aucun chemin clavier n'existe : les lignes ne prennent pas encore le focus. | Afficher aussi l'infobulle au focus, quand les lignes deviendront focalisables (S-5). |
| 6 | mineur | `src/lib/components/CommitGraph.svelte:150` | L'en-tête a `role="toolbar"` sans aucun contrôle à l'intérieur. Les lecteurs d'écran annoncent une barre d'outils vide. | Un rôle d'en-tête de colonnes (`row` / `columnheader`) ou un groupe nommé, avec le même focus et le même menu. |

## Pour l'humain
- **pour information** : au-delà de 10 000 commits, le graphe s'arrête sans aucun signe. Les lanes encore ouvertes descendent jusqu'en bas sans rejoindre de commit, et rien ne dit que l'historique est tronqué.
- **pour information** : un échec d'écriture du fichier de préférences est ignoré sans message. La colonne paraît mémorisée mais réapparaîtra à la relance.

Captures (hors dépôt) : `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/b0c8b444-d3e1-49bc-ab88-130cd2f6fc2a/scratchpad/shots/`

# Revue S-4 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` (clippy puis ESLint) | ✅ |
| `pnpm format:check` (cargo fmt, Prettier) | ✅ |
| `pnpm test` (cargo test workspace : 35 tests ; Vitest : 49 tests) | ✅ |
| `pnpm e2e` (22 tests, dont les 9 de `e2e/graph.spec.ts`) | ✅ |
| `pnpm audit:deps` (1 exception déjà acceptée) | ✅ |
| `pnpm tauri build` (.app et .dmg produits) | ✅ |

L'arbre de travail est identique avant et après les vérifications. Aucun processus n'est resté lancé : vite et `pnpm dev:web` sont coupés, et le port 1420 est libre.

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-9 | couvert | `crates/git/src/lib.rs:153` (lanes et couleurs du dépôt `branches`, coude de création par `In`) ; `History.test.ts` CA-9 ; `e2e/graph.spec.ts:28`, aux deux tailles |
| explorer-l-historique CA-12 | couvert | `History.test.ts` CA-12 (« JG », `--lane-2`, aucun `img`) ; `e2e/graph.spec.ts:60` (bordure de la couleur du trait, cercle, aucune requête d'image) ; `typography.test.ts` (initiales en 12 px au moins, pastille de 24 px) |
| explorer-l-historique CA-13 | couvert | `e2e/graph.spec.ts:89` (clic droit, chaque colonne séparément) et `:123` (clavier : Maj+F10, « Commit message » cochée et désactivée, note, flèches, Entrée, Échap, focus rendu au groupe) ; `History.test.ts` CA-13 (trois tests, dont menu et rôle `group`) |
| explorer-l-historique CA-14 | couvert | tests du crate `store` et fichier d'exemple `tests-data/preferences-v1.json` ; `src-tauri/src/preferences.rs` ; `e2e/graph.spec.ts:146` |
| explorer-l-historique CA-15 | couvert | `relativeTime.test.ts` ; `History.test.ts` CA-15 ; `e2e/graph.spec.ts:170` (survol, « 2024-01-14 09:00 » en UTC) |
| explorer-l-historique CA-16 | couvert | `History.test.ts` CA-16 ; `e2e/graph.spec.ts:185` |
| explorer-l-historique CA-23 | couvert | `e2e/graph.spec.ts:210` : ouverture en moins de 3 s (1 332 ms dans mes captures), moins de 80 lignes dans le DOM, défilement sans trou jusqu'à `max`, 50 images/s au moins (seuil de la décision 2), aucune image au-delà de 50 ms |

Tests au rouge non constaté :
- **`e2e/graph.spec.ts`** : je les ai réexaminés un par un. Aucun n'a d'assertion à vide, et aucun ne dépend d'un état préalable, puisque chaque test a son `Workspace` et son `data_dir`.
- **Test CA-13 clavier étendu (`:123`)** : il échouerait si son critère n'était pas tenu. Les causes possibles :
  - `aria-disabled` ou `aria-checked` absent sur « Commit message » ;
  - note « Graph is always shown. » absente ;
  - en-tête sans rôle `group` nommé ;
  - premier focus pas sur « Author » (cela suppose que l'entrée désactivée soit sautée) ;
  - flèche qui ne mène pas à « Date », ou Entrée qui ne masque pas la colonne ;
  - focus pas rendu à l'en-tête après Échap.

  Le même comportement est aussi couvert par le test de composant `History.test.ts`. Ce test vérifie aussi qu'un clic sur « Commit message » n'appelle pas `onhidecolumns`.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · dépôt `branches` (lanes, merge, coudes) · 1500×900 | conforme | — |
| History · dépôt `branches` · 1920×1080 | conforme | — |
| History · thème clair (système) · 1500×900 et 1920×1080 | conforme | — |
| History · menu des colonnes au clic droit · 1500×900 et 1920×1080 | conforme | — |
| History · menu des colonnes au clavier (Maj+F10) · 1500×900 et 1920×1080 | conforme | — |
| History · colonne Date masquée puis page rechargée · 1500×900 et 1920×1080 | conforme | — |
| History · date absolue au survol · 1500×900 et 1920×1080 | conforme | — |
| History · 10 000 commits, ouverture, milieu et fin du défilement · 1500×900 et 1920×1080 | conforme | — |
| History · initiales d'un auteur composé (« Jean-Alexandre Gautreau » donne JG) · 1500×900 et 1920×1080 | conforme | — |
| History · barre d'aide en pied · 1500×900 et 1920×1080 | conforme | — |

Aucun débordement ni chevauchement aux deux tailles (`scrollWidth` égal à `clientWidth`). Le nœud mesure 24×24 px, avec des initiales en 12 px gras, et ne recouvre pas la bande. Le menu montre, comme la maquette 1b :
- « Commit message » cochée et grisée ;
- Author, Date et SHA ;
- une note séparée, adaptée aux colonnes présentes.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | `src/lib/components/CommitNode.svelte:23-29` : pastille de 24 px, initiales en 12 px, graisse 600. Test `typography.test.ts` « CommitNode: initials are at least 12px, in a 24px circle… » ; boîte mesurée de 24×24 dans les captures. |
| 2 | levé | `src/lib/components/CommitGraph.svelte:215-230` : entrée « Commit message » `aria-checked="true"` et `aria-disabled="true"`, sans gestionnaire, sautée par le focus (`ENABLED_ITEMS`), et note « Graph is always shown. ». Tests `History.test.ts` (menu, clic sans effet) et `e2e/graph.spec.ts:123`. |

Les mineurs 3, 4 et 6 du passage 1 sont traités :
- **Mineur 3** : `graph.rs:122`, test `merge_elbow_to_a_second_parent_awaited_elsewhere_takes_the_colour_of_that_lane`.
- **Mineur 4** : mélange avec `white`.
- **Mineur 6** : `role="group"` nommé, test dédié.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun. | — |

## Pour l'humain
- RAS

Captures (hors dépôt) : `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/b0c8b444-d3e1-49bc-ab88-130cd2f6fc2a/scratchpad/shots2/`

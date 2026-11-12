# Revue S-60 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace dont `store` 32 tests, + vitest 134 tests) | ✅ |
| `pnpm e2e` (72 tests, dont `e2e/graph-width.spec.ts` et `e2e/graph.spec.ts` CA-23 sur 10 000 commits) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (3 avertissements Rust déjà tolérés, 1 vulnérabilité ignorée déjà revue) |
| `pnpm tauri build` | non lancé par moi (pas de changement de dépendance ni de configuration dans le diff) |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| organiser-l-espace CA-11 | couvert | `src/lib/graphWidth.test.ts` (`defaultGraphWidth` : tout si ≤ 40 %, plafond sinon, plancher d'une lane). `e2e/graph-width.spec.ts:42` : fixture `branches`, largeur = max des lanes, ≤ 40 % de la zone, colonne mesurée = largeur, aucun `[data-fade]`. `e2e/graph-width.spec.ts:54` : fixture `wide`, max > 40 %, largeur = `floor(0.4 × zone)`, fondu visible avec `linear-gradient`. Les deux aux 3 tailles. |
| organiser-l-espace CA-12 | couvert | `e2e/graph-width.spec.ts:70` : le fetch périodique ajoute 40 branches, la largeur reste égale à `before`, le max passe au-dessus de 40 %, le fondu apparaît. Après réouverture, la largeur vaut `floor(0.4 × zone)`. Un recalcul au fetch ferait échouer l'égalité avec `before`. |
| organiser-l-espace CA-13 | couvert | `crates/store/src/lib.rs` : `graph_width_is_kept_for_its_repository_only_across_a_new_store`, tests de migration v3 vers v4 et de lecture v4, fichier d'exemple `crates/store/tests-data/repositories-v4.json`. `e2e/graph-width.spec.ts:94` : la largeur suit le pointeur sans écriture avant le relâchement, elle est écrite au relâchement, elle survit à un rechargement, et un autre dépôt garde son défaut. `e2e/graph-width.spec.ts:135` : flèches. `e2e/graph-width.spec.ts:150` : double-clic, retour au défaut recalculé sur les lanes présentes, entrée supprimée de `graph_widths`. |

Tests sans rouge constaté. Je les ai lus un par un : chacun a des assertions qui échoueraient si le critère n'était pas tenu. Ce sont des égalités exactes sur une largeur calculée, la mesure réelle de la colonne, le contenu du fichier `repositories.json` et la présence ou l'absence de `[data-fade]`. Aucune base préremplie ni assertion à vide. Je les juge probants, sans bloquant.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · toutes les lanes · 1500×900 | conforme (graphe entre colonne des refs et message, séparateur à droite des lanes) | — |
| History · toutes les lanes · 1920×1080 | conforme | — |
| History · toutes les lanes · 1280×720 | conforme | — |
| History · coupé avec fondu · 1500×900 | conforme (largeur ≈ 40 % de la zone, nœud de la lane coupée atténué au bord) | — |
| History · coupé avec fondu · 1920×1080 | conforme | — |
| History · coupé avec fondu · 1280×720 | conforme | — |
| History · glisser en cours · 1280×720 | conforme (séparateur surligné, largeur réduite de 120 px) | — |
| History · glisser en cours · 1500×900 | conforme | — |
| History · glisser en cours · 1920×1080 | conforme | — |
| History · largeur réglée · 3 tailles | conforme | — |
| History · séparateur au clavier · 1920×1080 (et autres) | conforme (contour de focus visible, rôle `separator`, flèches) | — |

Seules les captures 1500×900 (états 1 et 2), 1280×720 (état 3) et 1920×1080 (état 5) ont été ouvertes. Les autres cases s'appuient sur les e2e aux trois tailles. Le fondu est visible sur les captures mais discret (24 px, dégradé vers `--surface`). Le code n'utilise que des tokens, sans couleur brute. Les textes sont en anglais, comme le reste de l'interface. Le séparateur a le rôle `separator`, `aria-label`, `aria-valuemin`, `aria-valuemax` et `aria-valuenow`, avec `tabindex` 0.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun bloquant, aucun mineur. | — |

Périmètre : aucune dépendance ajoutée. Fichiers du diff : `bindings.ts` (nouvelles commandes), `repositories.json` en version 4 (`graph_widths`, prévu par la fiche) et le README. Rien dans `ux.md`, `ux/` ou `stack.md`. Le README est à jour : défaut, séparateur, fondu, `graph_widths`, version 4, `fixtures/wide.sh`.

## Pour l'humain
- **pour information** : `pnpm tauri build`, dernière case de « Terminé quand », n'a pas été relancé par le reviewer. À lancer avant le commit si la preuve est voulue.

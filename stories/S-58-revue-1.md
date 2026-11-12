# Revue S-58 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo 18 + 27 + 4 + 25 + 1, vitest 118) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e` | ❌ au premier passage : 57/58, seul `graph.spec.ts` CA-23 échoue (image la plus lente 117 ms, seuil 50 ms). Relancé seul avec `pnpm e2e -g CA-23` : ✅. Test préexistant, voir « Pour l'humain ». Les 8 tests de `sections.spec.ts` passent. |
| `pnpm audit:deps` | ✅ (3 avertissements « unmaintained/unsound » déjà revus et ignorés) |
| `pnpm tauri build` | ✅ (`svelte-check` : 0 erreur, 2 avertissements a11y sur `CommitGraph.svelte`, hors diff) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| organiser-l-espace CA-4 | couvert | `e2e/sections.spec.ts:57` aux 3 tailles : Local à 8×24 px avec `scrollHeight` de 23×24, origin à 3×24, courante `zlast` (23e ligne) en vue sans geste, Tags et Stashes sans `.items` ni séparateur. Le test Vitest `sectionHeight.test.ts` vérifie `defaultRows`, `defaultHeight`, `visibleRows` et `clampHeight` avec des valeurs exactes. |
| organiser-l-espace CA-5 | couvert | `e2e/sections.spec.ts:90` : un fetch fait passer origin de 3 à 4 refs, la hauteur reste 3×24, puis la réouverture via RepoPicker la passe à 4×24. |
| organiser-l-espace CA-6 | couvert | `e2e/sections.spec.ts:109` : rien n'est écrit pendant le glisser, écriture au relâchement, hauteur gardée après rechargement et dans un autre dépôt, double-clic qui revient à 8×24 et retire l'entrée du fichier. `:143` : réglage au clavier. Côté Rust : `section_heights_and_collapse_survive_a_new_store_and_keep_hidden_columns` (`crates/store/src/lib.rs`), `version_1_preferences_are_migrated_then_written_as_version_2`, `version_2_preferences_example_file_is_read` (avec `crates/store/tests-data/preferences-v2.json`), `section_layout_is_exposed_and_written_through_the_store` (`src-tauri/src/preferences.rs`). |
| organiser-l-espace CA-7 | couvert | `e2e/sections.spec.ts:156` : clic sur l'en-tête, `aria-expanded`, écriture immédiate de `collapsed_sections`, `version` 2, état gardé après rechargement et dans un autre dépôt. |
| organiser-l-espace CA-8 | couvert | `e2e/sections.spec.ts:190` : section et dossier repliés, la liste des `[data-ref]` du graphe est identique avant et après. |

Jugement des tests signalés sans rouge probant. Chacun est jugé sur ses assertions, pas sur la cause de son premier échec.
- **CA-4 e2e en 1500x900** : le premier échec venait d'un sélecteur absent. Les assertions exactes (`clientHeight` égal à 8×24, `scrollHeight` égal à 23×24, origin à 3×24) échoueraient avec une hauteur non bornée ou non ajustée. Le test prouve son critère.
- **`sectionHeight.test.ts`** : le premier échec venait d'un import non résolu. Il vérifie des valeurs exactes de la fonction pure (8 lignes au plus, 3 pour 3 lignes, dossier compté comme une ligne, rien sous un dossier replié). Le test prouve son critère.
- **Tests `crates/store` et test app** : le premier échec venait d'une compilation sur méthode manquante. Ils comparent des valeurs écrites puis relues par un nouveau `Store` (hauteurs, repli, `hidden_columns` conservées, migration v1 vers v2, fichier d'exemple v2). Ils échoueraient si la persistance ou la migration manquait. Les tests prouvent leur critère.

## Interface
Captures prises par mes soins (Playwright jetable, hors dépôt) à 1500×900, 1920×1080 et 1280×720, sur la fixture `layout.sh` (23 branches locales, 3 sur origin, Tags et Stashes vides). J'ai ouvert celles de 1500×900 (état initial), 1500×900 après repli d'origin et 1280×720 ; je n'ai pas ouvert les captures de 1920×1080 ni celles du glisser et du focus, et je n'ai pas relu la section « 7 · Sidebar and layout » de la maquette. Le 1280×720 montre Local à 11 lignes car la hauteur réglée par le glisser du script de capture est mémorisée globalement : c'est le comportement attendu.
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · section défilante (Local, 8 lignes) · 1500×900 | conforme (courante visible, sans débordement) | — |
| History · section courte (origin, 3 lignes) · 1500×900 | conforme | — |
| History · sections vides (Tags, Stashes : en-tête seul) · 1500×900 | conforme | — |
| History · section repliée (origin, chevron fermé, en-tête seul) · 1500×900 | conforme | — |
| History · bord bas en cours de glisser · 1500×900 | conforme d'après l'e2e (`sections.spec.ts:109`) ; capture `s-drag.png` non ouverte | — |
| History · état initial, section défilante, courte, vide · 1920×1080 | non ouvert à l'écran ; couvert seulement par l'e2e CA-4 à cette taille | — |
| History · sections défilante, courte, vide, repliée · 1280×720 | conforme | — |
| Accessibilité (lue dans le code) | séparateur `role=separator`, `tabindex=0`, `aria-label`, `aria-valuenow`, flèches, `:focus-visible` avec `var(--focus)` ; en-tête de section en `button` avec `aria-expanded` ; couleurs par tokens seulement (aucune couleur brute ajoutée) | — |

## Suivi de la revue précédente
Sans objet (passage 1).

## Problèmes
Aucun bloquant, aucun mineur.

## Pour l'humain
- **pour information** : le test de performance existant `explorer-l-historique CA-23` (graphe de 10 000 commits) est instable. Il a échoué une fois dans `pnpm e2e` (image la plus lente 117 ms pour un seuil de 50 ms), puis passé seul. Il n'a pas été modifié par S-58 ; un `pnpm e2e` complet peut donc échouer sans lien avec le code.

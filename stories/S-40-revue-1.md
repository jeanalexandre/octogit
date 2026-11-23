# Revue S-40 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:rs -p octogit-git --tests` (dont `operation`, `cherry_pick`, `integrate`, `working_tree`, `conflict`, `pull.rs` en `--lib`), lancé deux fois | ✅ (stable) |
| `pnpm test:rs -p octogit-app --test integrate_guard --lib` (dont `fetch::tests` synchroniser CA-8) | ✅ |
| `pnpm test:js src/lib/components/OperationBanner.test.ts src/lib/components/AbortMergeDialog.test.ts` | ✅ 25 tests |
| `pnpm e2e e2e/conflict-resolver.spec.ts e2e/integrate.spec.ts e2e/pull.spec.ts e2e/cherry-pick.spec.ts` | ✅ 69 tests |
| Captures Playwright jetables (`pnpm dev:web` démarré puis arrêté par le script, port 1420 libre ensuite), 1500×900 et 1280×720 | voir Interface |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| resoudre-les-conflits CA-9 | couvert | `crates/git/tests/operation.rs:125` ; `src-tauri/tests/integrate_guard.rs` `ca_9_a_conform_repository_continues_a_rebase…` ; e2e `conflict-resolver.spec.ts` |
| resoudre-les-conflits CA-10 | couvert | `crates/git/tests/operation.rs:175`, `:205` ; e2e |
| resoudre-les-conflits CA-15 | couvert | `crates/git/tests/operation.rs:235` ; `crates/git/tests/working_tree.rs` `ca_15_…` ; 3 e2e CA-15 |
| revenir-en-arriere CA-5 | couvert | `crates/git/tests/cherry_pick.rs` `ca_5_…` ; e2e `cherry-pick.spec.ts` |
| synchroniser CA-8 | couvert | `crates/git/src/pull.rs` `synchroniser_ca_8_…` ; `src-tauri/src/fetch.rs` ; e2e `pull.spec.ts` |
| Rappels CA-1, CA-11, CA-13, CA-19 | couvert | `operation.rs:300`, `:323` ; `integrate_guard.rs` ; `OperationBanner.test.ts`, `AbortMergeDialog.test.ts` ; e2e |

## Interface
Conforme à `ux.md` et aux maquettes, 1500×900 et 1280×720, sauf : History · OperationBanner avec Resolve, opération lancée au terminal (rebase à l'ouverture, merge et cherry-pick au retour) : écart 1.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/App.svelte:1693` (avec `merging`, `src/App.svelte:464-467`) | `merging` vaut maintenant vrai pour toute opération en cours, et il est passé tel quel à `WorkingChanges`. Pendant un rebase, un cherry-pick ou un revert, Commit et Amend sont désactivés avec la raison « Merge in progress ». C'est faux et contraire à `ux.md` J-9 (« Commit aussi pendant un merge »), à `ux/ecrans/history.md` et à resoudre-les-conflits CA-21. Aucun test ne couvre ce cas. | Passer à `WorkingChanges` un booléen vrai pour un merge seulement (ex. `merging && operation?.kind === "merge"`), en gardant `merging` pour le bandeau et `--banner-h`. Ajouter un test, par exemple un e2e sur rebase en conflit où Commit n'affiche pas « Merge in progress ». |
| 2 | mineur | `src/lib/components/AbortMergeDialog.svelte:72` | Le bouton « Abort rebase / cherry-pick / revert » de la confirmation garde l'icône `GitMerge`. Le bouton Abort du bandeau utilise `X`. | Une icône neutre, la même que celle du bandeau. |
| 3 | mineur | `README.md:65` | La section S-38 dit encore « `merge_branch` rend une issue `MergeView` ». Ce type est devenu `OperationOutcomeView`. | Remplacer le nom. |

## Pour l'humain
- **pour information** : dans l'état « identity mismatch », l'en-tête de `History` déborde horizontalement à 1500×900 comme à 1280×720 : « Not published » est coupé au bord droit. Écart antérieur à S-40.

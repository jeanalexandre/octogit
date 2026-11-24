**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 3 |
| `pnpm test:js src/lib/rebasePlan.test.ts src/lib/screens/InteractiveRebase.test.ts src/lib/components/OperationBanner.test.ts` | ✅ 57 tests |
| `pnpm e2e e2e/interactive-rebase.spec.ts` | ✅ 18 tests |
| Relecture du diff sur `App.svelte`, `InteractiveRebase.svelte`, la fixture et l'e2e « slow » | faite |

Tests Rust non relancés : le code Rust n'a pas bougé depuis la revue 1.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| nettoyer-une-branche CA-7 | couvert | `rebasePlan.test.ts` ; `InteractiveRebase.test.ts` ; e2e CA-7 aux deux tailles |
| nettoyer-une-branche CA-9 | couvert | tests Rust ; test de composant ; e2e |
| nettoyer-une-branche CA-12 | couvert | e2e « slow » : « Rebase in progress » avec « i / n » pendant l'exécution, puis « ✓ Rebase complete » ; e2e conflit à l'étape 2 vers `ConflictResolver` |
| nettoyer-une-branche CA-13 | couvert | test Rust ; test de composant (m relu) ; e2e |
| nettoyer-une-branche CA-14 | couvert | test Rust ; e2e |
| nettoyer-une-branche CA-15 | couvert | test Rust ; e2e |
| Décision 1 | couvert | e2e « slow » ; tests `OperationBanner` |
| Décision 2 | couvert | `interactive_rebase.rs` : `decision_2` |

## Interface
Tous les états (Start rebase désactivé, alerte, en cours sans Resolve, conflit, terminé avec liste et alerte masquées) conformes à 1280×720 et 1500×900.

## Suivi de la revue précédente
| # précédent | Statut |
|---|---|
| 1 (Resolve pendant l'exécution) | levé : `rebaseRunning` retire `onresolve` ; e2e « slow » |
| 2 (bandeau « en cours » non gardé) | levé : e2e « slow » (hook `post-commit` de 2 s) |
| 3 (liste figée après la fin) | corrigé : `{#if done === null}` |

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : la lecture « déjà poussé » ne regarde que `branch.<nom>.upstream` du `.git/config` local, sans réseau : si l'amont n'a pas été récupéré depuis un moment, `k` reflète la dernière récupération.
- **pour information** : le bandeau montre « No profile » pendant le rebase d'un dépôt sans profil. Le refus de Start rebase est à S-50, comme la fiche le dit.

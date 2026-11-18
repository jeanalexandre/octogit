**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace + vitest) | ✅ exit 0 ; vitest relancé seul : 34 fichiers, 401 tests |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build` | non relancés : seuls le README, `stepSearch` et un test unitaire ont changé depuis la revue 1, aucune dépendance touchée |

## Critères d'acceptation
CA-17 à CA-22 : couverts (inchangés depuis la revue 1 ; CA-19 complété par `History.test.ts:1010`).

## Interface
Aucun écran n'a changé depuis la revue 1.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (README « dans l'en-tête ») | traité | `README.md` dit « dans une seconde ligne sous l'en-tête de `History` ». |
| 2 (Entrée part du rang de la recherche) | traité | `History.svelte` `stepSearch` part de `results.indexOf(selected)` s'il est ≥ 0, sinon `active` ; test `History.test.ts:1010`. |

## Problèmes
Aucun.

## Pour l'humain
RAS

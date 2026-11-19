**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (Rust 47 + autres crates, Vitest 488/488) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/integrate-menu.spec.ts` (12 tests, 2 tailles) | ✅ |
| `pnpm e2e` complet, `pnpm audit:deps`, `pnpm tauri build` | non relancés (aucune dépendance ni commande ajoutée ; seuls les e2e touchés par le diff ont été rejoués) |

## Critères d'acceptation
| Critère | Statut |
|---|---|
| CA-1 | couvert |
| CA-2 | couvert |
| CA-3 | couvert |
| CA-4 | partiel (rejeu renvoyé à S-37) |
| CA-5 | partiel : seule la première moitié est prouvée ; aucun test Vitest |
| Décisions 1 et 2 | partiel |

## Interface
Conforme aux deux tailles (1500×900, 1280×720) pour tous les états listés.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `e2e/integrate-menu.spec.ts:149-154` ; `src/App.svelte` (`integrateFromMenu`) | La seconde moitié de CA-5 (« déjà courante : aucun checkout ») n'est pas prouvée : un checkout superflu passerait le test. L'ordre « checkout avant l'opération » et l'arrêt si le checkout est refusé ou échoue ne sont pas testés. | Test Vitest avec `checkout` espionné : non courante -> `checkout` puis `integrate` ; déjà courante -> jamais `checkout` ; refus ou échec -> jamais `integrate`. Sinon e2e détectant un checkout superflu (reflog de HEAD). |
| 2 | bloquant | `src/App.svelte` (`selectedRef`, `receiving`, `$effect` sur `openPath`) | Décision 1 sans test : branche sélectionnée disparue -> la courante reçoit ; changement de dépôt -> sélection vidée. | Un test par cas. |

## Pour l'humain
RAS

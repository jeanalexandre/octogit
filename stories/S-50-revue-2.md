# Revue S-50 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm test:js src/lib/components/CommitDetail.test.ts` : 26 tests | ✅ |
| `pnpm e2e e2e/operation-guard.spec.ts` : 6 tests, deux passes consécutives | ✅ |
| Preuve de rouge des deux tests signalés, par lecture du code | ✅ |

## Critères d'acceptation
Tous couverts. Nouveautés du passage 2 : le menu de choix de Checkout de `CommitDetail` est testé (menu ouvert, puis `operationBlocked` passe à vrai, menu fermé, aucun `oncheckout`) ; `CommitDetail.test.ts` couvre Checkout et « Create branch here » désactivés avec la raison, Cherry-pick et Revert sans raison, et la raison d'identité pour Cherry-pick et Revert. Les autres critères et la décision 1 sont inchangés depuis la revue 1.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `CommitDetail` · opération en cours · 1500×900 et 1920×1080 | conforme | — (style `:disabled` vérifié dans le code et par l'e2e, pas recapturé) |
| Autres écrans et états de la revue 1 | conforme | — (non modifiés ; mêmes réserves de captures qu'au passage 1) |

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (bloquant, style désactivé de `CommitDetail`) | levé | `CommitDetail.svelte:391-398` : `.action:hover:not(:disabled)` et `.action:disabled { color: var(--muted); cursor: not-allowed; }` (token défini dans les quatre thèmes). Raison en `title`. `e2e/operation-guard.spec.ts:131-138` contrôle `cursor: not-allowed` et le `title`. |
| 2 (mineur, test du menu Checkout) | levé | `CommitDetail.test.ts:201-214`. |

Les deux tests sans rouge constaté sont jugés probants (le test Vitest dépend du `$effect` ligne 87 ; l'assertion e2e dépend de la règle `.action:disabled`).

## Problèmes
Aucun.

## Pour l'humain
RAS

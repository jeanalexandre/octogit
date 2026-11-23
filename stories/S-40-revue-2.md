# Revue S-40 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm test:js src/lib/components/OperationBanner.test.ts src/lib/components/AbortMergeDialog.test.ts` | ✅ 25 tests |
| `pnpm e2e e2e/conflict-resolver.spec.ts e2e/graph-width.spec.ts` | 51 passés, 1 échec : `graph-width.spec.ts:123` (CA-13, attendu 508, reçu 372) |
| `pnpm e2e e2e/graph-width.spec.ts` (relance seul) | ✅ 15/15 |

Les 26 tests de `conflict-resolver.spec.ts` ont passé, nouveau test CA-21 rebase compris.

## Critères d'acceptation
Tous couverts (preuves du passage 1 inchangées). resoudre-les-conflits CA-21 : `e2e/conflict-resolver.spec.ts:463` ; le test de merge existant (`:308`) tient.

## Interface
Conforme. Écart du passage 1 levé.

## Suivi du passage 1
- Bloquant 1 : levé. `src/App.svelte:1693` passe `merging={merging && operation?.kind === "merge"}` à `WorkingChanges` ; test `e2e/conflict-resolver.spec.ts:463`.
- Mineur 2 : levé. `AbortMergeDialog.svelte:71` utilise l'icône `X`.
- Mineur 3 : levé. `README.md` dit `OperationOutcomeView`.

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : `e2e/graph-width.spec.ts:123` (CA-13, de S-69) échoue quand le fichier tourne après `conflict-resolver.spec.ts` dans la même exécution ; il passe seul, 15/15. La story ne modifie pas ce fichier. Même famille que les e2e instables de `graph-width` déjà notés.
- **pour information** : l'en-tête de `History` en « identity mismatch » est coupé (« Not published »). Écart antérieur à S-40, déjà noté au passage 1.

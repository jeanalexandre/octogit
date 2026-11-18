**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace puis vitest) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/propagation.spec.ts` (4 tests, 1500×900 et 1920×1080) | ✅ |
| `pnpm audit:deps`, `pnpm tauri build` | non relancés : aucune dépendance ni code front touché |

## Critères d'acceptation
Tous couverts (CA-18 conforme réécrit, valeur absente non réécrite, sans aucune clé ni réécrit ni listé ; CA-20 2 dépôts sur 3 laissés tels quels et listés, puis `IdentityMismatch`). Le test e2e sans rouge constaté prouve son critère : avec l'ancienne règle, `cli` ne serait plus listé et `bare` changerait d'octets.

## Interface
Conforme à `ux.md` et à la maquette, aux deux tailles ; aucun fichier front modifié.

## Problèmes
Aucun.

## Pour l'humain
- RAS

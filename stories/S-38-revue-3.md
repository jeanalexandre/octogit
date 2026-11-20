# Revue S-38 : passage 3

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 3 (sauf `pnpm e2e` : 1 échec connu `e2e/refs-column.spec.ts:189`, établi à la revue 2, pas de la story) |
| `pnpm test:js src/lib/conflictBlocks.test.ts src/lib/components/ConflictPane.test.ts src/lib/screens/ConflictResolver.test.ts` | ✅ 42 passés |
| Contre-épreuve hors dépôt, copie où `remainingRanks` recoupe `pending` par la fin | ✅ `keeps the count right after the markers of a block that is not the last are removed by hand` rouge sur la bonne assertion ; les 20 autres tests de `ConflictPane.test.ts` restent verts |

## Critères d'acceptation
resoudre-les-conflits CA-1 à CA-5 et integrer-une-branche CA-13 : couverts, inchangés depuis le passage 2. CA-3 : 3 boutons à la place des cases, décision Q1.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur, « Conflict 0 / n ») | levé | `lastRank` (`ConflictPane.svelte`), tests `ConflictPane.test.ts:71-89` |
| 2 (mineur, décompte à l'envers après édition à la main) | levé | `remainingRanks` (`conflictBlocks.ts:113`), test `ConflictPane.test.ts:91-104` avec contre-épreuve rouge |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/conflictBlocks.ts:113`, `src/lib/conflictBlocks.test.ts` | `remainingRanks` n'a pas de test unitaire. Un seul scénario la couvre, par le composant : un bloc non final retiré. Ni l'édition qui laisse un bloc modifié, ni le retrait du dernier bloc, ni le retrait de tous les blocs ne sont testés. | Ajouter quelques cas dans `conflictBlocks.test.ts` (non bloquant). |

## Pour l'humain
- **pour information** : pour la contre-épreuve, le reviewer a lancé `pnpm` dans une copie dont `node_modules` était un lien vers celui du dépôt ; des paquets ont été réinstallés à d'autres versions dans `node_modules` du dépôt (ignoré par Git), puis remis aux versions du lockfile par une seconde commande (suite JS à 42 verts). Aucun fichier suivi n'a changé. En cas de comportement étrange, `pnpm install` rétablit l'état.

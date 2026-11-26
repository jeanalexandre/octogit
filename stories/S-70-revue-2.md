**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm e2e e2e/switch-profile.spec.ts -g "CA-11"` | ✅ 2 tests |
| Même commande avec `--repeat-each=3` | ✅ 6 tests, stable |

## Critères d'acceptation
CA-1 à CA-7, CA-12, CA-13, CA-14, CA-16 : couverts (passage 1, inchangés). CA-11 : couvert, `e2e/switch-profile.spec.ts:160-200`.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | Le test agit sur le vrai `ProfileBadge` : filtre « All profiles », « Reset to rules » dans le menu du badge, badge toujours Pro, `RepoPicker` rouvert liste 3 dépôts avec « All profiles » sélectionné. Il échouerait si le badge écrivait le filtre (filtre initial = Pro, 1 seul dépôt). |

## Problèmes
Aucun.

## Pour l'humain
RAS

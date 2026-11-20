# Revue S-38 : passage 4

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 4 (sauf `pnpm e2e` : 1 échec connu `e2e/refs-column.spec.ts:189`, établi à la revue 2, pas de la story) |
| `pnpm test:js src/lib/conflictBlocks.test.ts` | ✅ 19 passés |
| Lecture des 5 tests contre `remainingRanks` (`conflictBlocks.ts:113-131`) | ✅ chacun a une sortie qui change si le code est cassé |
| `git status` | inchangé : seul `conflictBlocks.test.ts` a bougé |

Pas de mutation exécutée : les tests comparent des tableaux exacts, la lecture suffit.

## Critères d'acceptation
resoudre-les-conflits CA-1 à CA-5 et integrer-une-branche CA-13 : couverts, inchangés depuis le passage 3. CA-3 : 3 boutons à la place des cases, décision Q1.

## Suivi de la revue précédente
Mineur 1 (`remainingRanks` sans test unitaire) : levé, `conflictBlocks.test.ts:120-149`, 5 tests (bloc édité, retrait du dernier bloc, retrait d'un bloc du milieu, retrait de tous, restriction à `pending`).

## Problèmes
Aucun.

## Pour l'humain
RAS

# Revue S-67 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (vitest : 410 tests, 34 fichiers ; cargo) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e` sur `working-changes`, `commit`, `open-repository`, `panel` | ✅ 34 passés |
| `pnpm audit:deps`, `pnpm tauri build` | non lancés (aucune dépendance touchée) |

## Critères d'acceptation
Tous couverts : explorer-l-historique CA-31 à CA-35 (CA-31 et CA-35 discriminent désormais la branche courante de `commits[0]`, `History.test.ts:383-418`), preparer-un-commit CA-1, CA-2, CA-11.

## Interface
Captures aux deux tailles (1 500×900 et 1 280×720) pour les six états : conformes à `ux.md` et à la maquette. Le formulaire d'Amend est S-68, hors périmètre.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | Deux tests discriminants avec la fixture `currentOnB` ; remplacer `lastCommitId` par `commits[0]` les ferait échouer. |

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : au 1 280×720, le libellé de la ligne WIP est tronqué en « 3 change… » (colonne du message étroite). Non introduit par la story ; peut-être corrigé par la colonne du graphe (S-69), sinon à traiter à part.
- **pour information** : les deux e2e instables du passage 1 (`badge-menu` CA-11 et `refs-column` CA-18) n'ont pas été relancés. Surveiller le prochain `pnpm e2e` complet ; l'hypothèse (chargement asynchrone de `CommitDetail` à l'ouverture d'un dépôt propre) n'est pas prouvée.

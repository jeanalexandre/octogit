**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 3 |
| `pnpm e2e e2e/graph.spec.ts` | ✅ 9 tests |
| Port 1420 après la revue | libre |

## Critères d'acceptation
Inchangés depuis `S-49-revue-1.md` : CA-20, CA-21, CA-22, CA-23 et CA-25 restent couverts. Le seul changement depuis ce verdict est `e2e/graph.spec.ts`, et il ne touche aucun test de S-49.

## Changement de `e2e/graph.spec.ts`
- **Aucune assertion affaiblie.** Le diff remplace `page.getByRole("listitem")` par `graphRows(page)` (`.spacer` puis `getByRole("listitem")`) dans `openBranches` et dans CA-14. Les deux assertions restent `toHaveCount(6)`.
- **Le locator est exact.** `.spacer` est le `role="list"` des lignes du graphe (`src/lib/components/CommitGraph.svelte:416`).
- **L'explication tient.** Le panneau de détail du commit sélectionné contient des `listitem` ; le diff n'a modifié aucun composant du graphe ni du détail. Le reviewer n'a pas relancé sur `bb3b4cf`.
- **Preuve.** `graph.spec.ts` passe en entier (9 tests) ; l'e2e complet est à 477 verts chez `dev`.
- Correctif de test hors périmètre de la fiche, mais justifié, sans effet sur le comportement. Mineur, ne bloque pas.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/screens/Welcome.svelte` | Voir la revue 1 : « Install Command Line Tools » est sous « Check again », sans maquette pour trancher. | Rien d'obligatoire. |

## Pour l'humain
- **pour information** : sur `bb3b4cf`, les tests e2e CA-9, 12, 13, 14 et 15 du graphe échouaient, d'après `dev`. S-49 les répare au passage.
- **pour information** : la revérification toutes les 2 s appelle `recheck_git`, déjà notée dans la revue 1.

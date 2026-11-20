**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 (seul échec : `e2e/refs-column.spec.ts:189`, instable, reproduit sur la référence 0004c9d, hors S-39) |
| `pnpm test:rs -p octogit-git resoudre_les_conflits` | ✅ 9 tests |
| `pnpm test:rs -p octogit-app resoudre_les_conflits` | ✅ 4 tests |
| `pnpm test:js src/lib/components/OperationBanner.test.ts` | ✅ 10 tests |
| `pnpm e2e e2e/conflict-resolver.spec.ts` | ✅ 20 tests, deux tailles |

## Critères d'acceptation
CA-7, CA-8, CA-11, CA-13, CA-14, CA-19, CA-21 : couverts (CA-8 : message complet `%B` ; CA-13 : identité non conforme et « No profile », Rust et e2e).

## Suivi de la revue précédente
- 1 (message de merge avec `# Conflicts:`) : levé (`commit --no-edit --cleanup=strip`, assertions `%B`).
- 2 (« No profile » non testé) : levé (test Rust et e2e).
- Tests sans rouge probant (CA-13 « No profile », `%B` e2e) : non bloquants, ils échoueraient si la garde ou le correctif disparaissait.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/screens/ConflictResolver.svelte` (`.back`) | Back to graph est dans la barre « Conflicts », sous le bandeau ; la maquette le place dans le bandeau, à gauche d'Abort et Continue. | Optionnel : aligner sur la maquette. |

## Pour l'humain
- **pour information** : `notes-production.md` dit encore qu'un merge en conflit n'a aucune sortie dans l'application avant S-39 ; devient faux avec cette story.
- **pour information** : avertissement Svelte `derived_inert` pendant `conflict-resolver.spec.ts`, préexistance inconnue, ne fait échouer aucun test.
- **pour information** : `e2e/refs-column.spec.ts:189` (CA-18) instable, déjà présent sur 0004c9d, hors S-39.

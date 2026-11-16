# Revue S-16 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test:js` (vitest complet) | ✅ 216 tests |
| `pnpm test:js src/lib/components/WorkingChanges.test.ts` | ✅ 26 tests |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/identity-block.spec.ts` | ✅ 7/7 |
| Tests Rust, `pnpm audit:deps`, `pnpm tauri build`, e2e complet | non relancés : le passage 1 les avait validés, ce passage ne change que `WorkingChanges.svelte` et son test |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| proteger-l-identite CA-15 | couvert | Test composant (textes, Expected / Found, ordre des blocs), `commit_guard.rs`, `e2e/identity-block.spec.ts:45` et `:79` |
| proteger-l-identite CA-17 | couvert | `crates/git/tests/working_tree.rs`, `e2e/identity-block.spec.ts:94` |
| proteger-l-identite CA-18 | couvert | `commit_guard.rs`, `e2e/identity-block.spec.ts:116` |

Test sans rouge constaté « the blocked block comes before the Commit button » (`WorkingChanges.test.ts:263`) : jugé probant par lecture (position DOM du bouton Commit après le titre du bloc).

## Interface
Pas de nouvelles captures : seul l'ordre DOM change, le CSS est inchangé depuis le passage 1. Ordre lu : Summary, Description, Amend, bloc bloqué, Commit. Tous les états conformes à ux.md et à la maquette.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | `WorkingChanges.svelte:156-166`, test `WorkingChanges.test.ts:263`, 7 e2e verts |

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : le garde Rust laisse passer le commit quand les valeurs attendues ne se calculent pas (profil à signature cochée dont le `.pub` manque), alors que le badge affiche « identity mismatch ». Hors CA-15 ; à trancher, sans doute avec S-21.

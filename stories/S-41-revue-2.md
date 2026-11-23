## Revue S-41 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm test:rs -p octogit-git ca_17` (8 tests de `stash.rs`, dont `abort_keeps_an_indexed_file_unrelated_to_the_stash`, et le reste de la crate) | ✅ |
| Lecture du diff de `crates/git/src/stash.rs` : plus de source « tout l'index » dans `stash_conflict_abort` | ✅ |

Pas de relance des e2e ni des tests JS : le passage 2 ne touche que du Rust (`stash.rs`).

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| resoudre-les-conflits CA-6 | couvert | Inchangé depuis le passage 1. |
| resoudre-les-conflits CA-17 | couvert | `crates/git/tests/stash.rs:335` : un fichier indexé sans lien avec le stash survit à Abort (Pop et Apply). Reste inchangé depuis le passage 1. |
| resoudre-les-conflits CA-20 | couvert | Inchangé depuis le passage 1. |
| Décisions 1 et 2 | couvert | Inchangé depuis le passage 1. |

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | `stash_conflict_abort` construit `touched` à partir de `diff --name-only stash^1 stash`, `ls-tree stash^3` et `unmerged_files`. La ligne `diff --cached --name-only` a disparu. Le test `stash.rs:335` passe. |

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : Done lance `git reset -q` sur tout l'index. Des fichiers sans lien avec le stash, déjà indexés, sont aussi désindexés (contenu conservé). Point inchangé depuis le passage 1.

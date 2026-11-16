# Revue S-16 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace + vitest) | ✅ (une première sortie tronquée par rtk, puis `pnpm test:rs -p octogit-app`, `-p octogit-git` et `pnpm test:js` : 40 + 5 + 6 + 4 + 7 tests Rust verts, 27 + 6 + 12 pour `git`, 215 tests vitest verts) |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/identity-block.spec.ts` | ✅ 7/7 |
| `pnpm audit:deps`, `pnpm tauri build`, e2e complet | non relancés : aucune dépendance ajoutée, et le diff ne touche pas la configuration de build |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| proteger-l-identite CA-15 | partiel | Textes, Commit désactivé, refus côté Rust et `git log` inchangé sont prouvés. L'ordre des blocs de l'état bloqué ne suit pas la maquette (problème 1). |
| proteger-l-identite CA-17 | couvert | `crates/git/tests/working_tree.rs` (détection de `.git/config`) et `e2e/identity-block.spec.ts:94` (changement au terminal, état bloqué sans geste, `git log` inchangé). |
| proteger-l-identite CA-18 | couvert | `src-tauri/tests/commit_guard.rs:157` et `e2e/identity-block.spec.ts:116`. |

**Rouge probant des tests sans rouge constaté.** Jugé par lecture : pas de contre-épreuve sur une copie.
- `commit_guard.rs` CA-15 (`:87`) : sans le garde de `commit_checked`, `commit` réussirait sur un index non vide et `unwrap_err()` échouerait. Probant.
- `commit_guard.rs` lignes en écart (`:109`) : l'assertion porte sur les valeurs exactes de `current_mismatch`. Probant.
- `commit_guard.rs` CA-17 (`:139`) : un premier commit passe, puis `user.name` est modifié et le commit suivant doit échouer. Probant.
- `commit_guard.rs` CA-18 (`:157`) : `user.email` vaut `perso@example.org` avant le correctif et `p1@example.org` après, le reste du config est inchangé, puis un commit réussit. Probant.
- `e2e/identity-block.spec.ts` : chaque état est affirmé avant l'action, puis `git log` est comparé. L'e2e CA-17 modifie `.git/config` pendant que l'application est ouverte et attend l'état bloqué sans autre geste. Probant. Le blocage côté Rust n'est pas isolé en e2e, mais `commit_guard.rs` le prouve.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · `WorkingChanges` bloqué, une valeur · 1500×900 | écart (textes conformes, ordre des blocs différent) | 1 |
| History · `WorkingChanges` bloqué, deux valeurs · 1280×720 | écart (même ordre, rien ne déborde) | 1 |
| History · après « Fix repository identity » · 1500×900, 1280×720 | conforme | — |
| `ProfileBadge` non conforme · 1500×900, 1280×720 | conforme | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/WorkingChanges.svelte:157-170` | Le bloc bloqué (titre, Expected / Found, Fix) est rendu **après** le bouton Commit. La maquette `ux/maquettes/history.html` (section 2, « Identity mismatch → blocked », lignes 199-210) place l'avertissement entre le champ de résumé et le bouton Commit désactivé. Capturé aux deux tailles : bloc sous Commit. | Rendre le bloc bloqué avant le bouton Commit, pour les deux tailles. Le cas non bloqué (ligne d'identité, raison) garde sa place sous le bouton. |

## Pour l'humain
- **pour information** : le garde Rust laisse passer le commit quand les valeurs attendues ne se calculent pas (profil à signature cochée dont le `.pub` manque), alors que le badge affiche « identity mismatch ». Hors CA-15, qui parle d'une valeur locale en écart. Le blocage de ce cas reste à trancher, sans doute avec S-21.

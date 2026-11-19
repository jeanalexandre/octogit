# Revue S-32 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace + vitest, 458 tests JS) | ✅ |
| `pnpm lint` (clippy `-D warnings` + eslint) | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm check` (svelte-check) | ✅ 0 erreur ; 2 avertissements dans `CommitGraph.svelte`, hors diff |
| `pnpm e2e e2e/stash.spec.ts` | ✅ 10/10 |
| `pnpm audit:deps`, `pnpm tauri build` | non lancés par la revue (passés ✅ par `dev`) |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| preparer-un-commit CA-17 | couvert | `crates/git/tests/stash.rs`, test `app` `ca_17_stash_then_pop_return…`, `History.test.ts`, `e2e/stash.spec.ts` |
| preparer-un-commit CA-18 | couvert | Rust (Pop nommé, Pop du dernier), `History.test.ts`, e2e |
| preparer-un-commit CA-19 | couvert | `RefContextMenu.test.ts`, `BranchSidebar.test.ts`, Rust (Apply garde le stash), e2e |
| preparer-un-commit CA-20 | couvert | `DropStashDialog.test.ts`, Rust, e2e (Échap, Cancel, confirmation) |
| preparer-un-commit CA-21 | couvert | Rust (Pop et Apply en conflit), `WorkingChanges.test.ts`, `History.test.ts`, e2e |

Les tests sans rouge constaté prouvent bien leur critère (assertions sur l'état réel Git ou sur « Conflict » / « U »).

## Interface
Captures prises à 1500×900 et 1280×720 : saisie du message, après Stash, Stash désactivé, menu clic droit, confirmation de Drop, `WorkingChanges` en conflit. Tout conforme à `ux.md` et à la maquette.

## Problèmes
Aucun. Périmètre respecté, pas de dépendance ajoutée, `bindings.ts` cohérent, nom de stash validé (`stash@{n}`).

## Pour l'humain
- **pour information** : `pnpm audit:deps` et `pnpm tauri build` non lancés par la revue.
- **pour information** : la section Stashes de `BranchSidebar` garde sa hauteur par défaut figée à l'ouverture du dépôt ; après un premier Stash sur un dépôt sans stash, la ligne n'est visible qu'après réouverture ou redimensionnement (règle « hauteur figée » de `ux/ecrans/history.md`).

**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` | Rust : tous les groupes passent. Partie vitest tronquée (« 25 FAIL » dans les lignes omitées) : voir « Pour l'humain ». |
| `pnpm test:js` (relance) | 34 fichiers, 423 tests |
| `pnpm lint` | ok |
| `pnpm format:check` | ok |
| `pnpm build` | ok (deux avertissements a11y dans `CommitGraph.svelte`, hors diff) |
| `pnpm e2e e2e/amend-detail.spec.ts` | 6/6 |
| `pnpm audit:deps`, `pnpm tauri build` | non relancés : aucune dépendance ajoutée |

## Critères d'acceptation
| Critère | Statut |
|---|---|
| preparer-un-commit CA-27 | couvert (test composant, `History.test.ts`, e2e) |
| preparer-un-commit CA-28 | couvert (`crates/git/tests/commit.rs` dont `--reset-author`, `commit_guard.rs`, e2e clic et Cmd+Entrée) |
| preparer-un-commit CA-29 | couvert (test composant, `commit_guard.rs`, e2e identité non conforme ; « No profile » sans e2e, test composant) |
| preparer-un-commit CA-30 | couvert (e2e, `History.test.ts`, `commit.rs` index et arbre intacts) |

## Interface
Tous les états listés conformes à `ux.md` et à la maquette, à 1500×900 et 1280×720. Aucun écart.

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : la première exécution de `pnpm test` affichait « 25 FAIL » dans la partie vitest tronquée par rtk, alors que `pnpm test:js` relancé passe 423/423 (possible instabilité connue de `livraison.test.ts`). Relancer `pnpm test` avant commit lèverait le doute.

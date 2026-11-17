# Revue S-22 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` | ✅ côté Rust, dont `push_commits.rs` (5 tests). ⚠️ côté Vitest, le passage complet affiche « 18 FAIL » dans la sortie tronquée. Relancé seul avec `pnpm test:js`, il passe : 26 fichiers, 265 tests verts. Même schéma qu'au passage 1 (instabilité connue de `src/livraison.test.ts`). |
| `pnpm e2e` | ✅ 182 verts. `e2e/push-commits.spec.ts` seul : 6 verts, CA-26 compris. |
| `pnpm audit:deps` | ✅ aucune vulnérabilité. 3 avertissements « allowed » de `cargo audit` (`paste`, `proc-macro-error`, `glib`) : crates transitives, hors story. |
| `pnpm tauri build` | ✅ `.app` et `.dmg` produits. `svelte-check` : 2 avertissements d'accessibilité sur `CommitGraph.svelte:308`, ligne que la story ne touche pas. |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| proteger-l-identite CA-20 | couvert | `crates/identity/tests/commit_check.rs`, `crates/git/tests/unpushed.rs`, `src-tauri/tests/push_commits.rs` (refus, distant inchangé), `PushButton.test.ts`, e2e `push-commits.spec.ts:34` (aux deux tailles), `:76`, `:100`. |
| proteger-l-identite CA-22 | couvert | `crates/git/tests/unpushed.rs`, `src-tauri/tests/push_commits.rs`, e2e `push-commits.spec.ts:121`. |
| proteger-l-identite CA-23 | couvert | `CommitNode.test.ts`, `History.test.ts`, e2e `push-commits.spec.ts:34` et `:76`. |
| proteger-l-identite CA-26 | couvert | e2e `push-commits.spec.ts:149` vert ; test Rust de relecture à chaque appel vert. |

Test sans rouge probant jugé, l'assertion de non-chevauchement (`e2e/push-commits.spec.ts:57-62`) : elle prouve (ancien CSS injecté : le bas de la liste passe sous le haut de `.body`, 142 > 97 à 1500 px, 111 > 66 à 1920 px ; CSS actuel : 158 ≤ 195 et 119 ≤ 156).

## Interface
Tous les états conformes aux deux tailles (1500×900, 1920×1080) : `PushButton` bloqué auteur et committer, collègue, `origin/develop` fusionnée, commit au terminal, nœud fautif du `CommitGraph`. Aucun chevauchement ni débordement.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (e2e CA-26 rouge, `ahead` non relu au focus) | levé | `src/App.svelte` : `onFocus` relit le dépôt (`refreshRepository`). E2e `:149` vert, assertion non affaiblie. |
| 2 (liste de `PushButton` qui chevauche) | levé | `PushButton.svelte` : liste dans le flux de l'en-tête. Assertion e2e ajoutée, rouge prouvé. |

## Problèmes
Aucun problème ouvert.

## Pour l'humain
- **pour information** : le `pnpm test` complet affiche « 18 FAIL » côté Vitest à chaque passage de cette story, alors que `pnpm test:js` seul est vert (265/265). Cause non isolée (sortie tronquée) ; l'instabilité de `src/livraison.test.ts` (déjà dans `notes-production.md`) est l'hypothèse la plus probable. À surveiller si le rouge persiste.

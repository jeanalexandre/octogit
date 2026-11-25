**Verdict**

**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:rs -p octogit-git` (crate complet, dont `rebase_plan`, `interactive_rebase`, `cherry_pick`) | ✅ tous verts |
| `pnpm test:js` sur `RefContextMenuRebase`, `RefContextMenuInapplicable`, `RefContextMenu`, `CommitDetail`, `graphParents` | ✅ 73/73 |
| `pnpm e2e e2e/inapplicable.spec.ts` (5 tests × 2 tailles) | ✅ 10/10, stable |
| Captures Playwright jetables (1500×900 et 1920×1080) | ✅ ouvertes et comparées. Serveur arrêté, port 1420 libre ensuite. |
| `git status` avant/après | ✅ inchangé par la revue |

Je n'ai pas relancé `inapplicable_guard.rs` (crate `app`) : lu, et passé par `dev`.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| nettoyer-une-branche CA-2 | couvert | Raisons exactes par cause : `crates/git/tests/rebase_plan.rs` (`..._ca_2_each_refusal_has_its_exact_reason`). Refus du cœur : `crates/git/tests/interactive_rebase.rs` (HEAD détachée, commit racine) et `src-tauri/tests/inapplicable_guard.rs`. Entrée désactivée sans effet au clic et à Entrée : `RefContextMenuRebase.test.ts` (3 cas). e2e `inapplicable.spec.ts` (CA-2), `git` inchangé. |
| nettoyer-une-branche CA-3 | couvert | `rebase_plan.rs` (merge le plus proche du sommet, commit choisi lui-même merge, plage au-dessus du merge acceptée). Refus du cœur avec SHA : `interactive_rebase.rs` et `inapplicable_guard.rs`. e2e : message exact dans `alert`, `InteractiveRebase` fermé, `git log` et `git status` identiques. |
| revenir-en-arriere CA-6 | couvert | `crates/git/tests/cherry_pick.rs` (message, aucun `CHERRY_PICK_HEAD` ni `sequencer`, HEAD, refs, index, arbre identiques, SHA du commit résolu). `inapplicable_guard.rs` et e2e. |
| revenir-en-arriere CA-9 | couvert | `inapplicable_guard.rs` : `cherry_pick_checked`, `revert_checked`, `reset_branch` (soft, mixed) et `reset_hard` refusent « No current branch. », dépôt inchangé. `RefContextMenuInapplicable.test.ts` : menu commit et `origin/…`, sous-menu qui ne s'ouvre ni au clic ni à ArrowRight. `CommitDetail.test.ts` et e2e. |
| revenir-en-arriere CA-20 | couvert | `cherry_pick.rs` et `inapplicable_guard.rs` (commit et `origin/release`, Reset permis). `RefContextMenuInapplicable.test.ts`, ordre des raisons compris. `CommitDetail.test.ts` et e2e. `graphParents.test.ts` : lecture du nombre de parents. |

**Rouge probant des tests signalés** : jugés par lecture. Chaque test compare un message exact et l'état du dépôt avant/après ; sans le garde le résultat serait autre. `..._each_refusal_has_its_exact_reason` passait déjà : verrou, pas preuve du nouveau code. Aucun bloquant.

## Interface
Tous les états listés conformes à `ux.md` et à la maquette (HEAD détachée, commit racine, commit hors branche, merge, plage avec merge, cherry-pick sans changement), 1500×900 et 1920×1080. Aucun écart.

## Suivi de la revue précédente
Passage 1, sans objet.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/components/RefContextMenu.svelte`, rendu de `.reason` | La raison de Cherry-pick, Revert et Reset s'affiche sous le libellé, celle de « Interactive rebase from here » sur la même ligne. Les raisons de S-50 ont déjà cette présentation ; aucune maquette ni `ux.md` ne l'impose. | Détail de rendu : aligner si on le souhaite, sans bloquer. |

## Pour l'humain
- **pour information** : sur le commit racine, le menu propose « Rebase <branche> onto <sha racine> » activé, alors que « Interactive rebase from here » est désactivé. Comportement préexistant, hors story.

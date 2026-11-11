# Revue S-5 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (vitest 69 tests, cargo tests du workspace) | ✅ |
| `OCTOGIT_PORT=1521 pnpm e2e` (29 tests) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (1 advisory low déjà ignorée) |
| `pnpm tauri build` (.app et .dmg produits) | ✅ |

Je n'ai lancé aucun processus qui reste actif. Le vite du port 1420 (pid 11366/11367) et le `tauri dev` (pid 11231) préexistants sont intacts.

## Critères d'acceptation
Aucun changement depuis le passage 1 sur le code des critères. Tous les tests passent à nouveau.
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-7 | couvert | Tests Rust `explorer_l_historique_ca_7_*`, e2e `e2e/refs.spec.ts:31` (1500×900 et 1920×1080). |
| explorer-l-historique CA-8 | couvert | `RefLabel.test.ts`, e2e `e2e/refs.spec.ts:98`. |
| explorer-l-historique CA-10 | couvert | Test Rust (2, 3), e2e `e2e/refs.spec.ts:131`, test de composant `History.test.ts`. |
| explorer-l-historique CA-24 | couvert | e2e `e2e/refs.spec.ts:142`, tests Rust de `detail.rs`. |
| explorer-l-historique CA-25 | couvert | e2e `e2e/refs.spec.ts:172`, `CommitDetail.test.ts`. |

## Interface
Pas de nouvelle capture : le seul changement visuel depuis le passage 1 est le nom du stash. Il est prouvé par un e2e qui mesure le DOM, et le passage 1 avait déjà jugé conforme le reste des écrans, états et tailles.
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · refs, stash · 1500×900 et 1920×1080 | conforme : `e2e/refs.spec.ts:88` vérifie `scrollWidth <= clientWidth` sur `stash@{0}`, donc le nom est entier. Le test échouerait avec l'ellipse. | — |
| Autres écrans et états de la fiche | inchangés depuis le passage 1, conformes | — |

## Suivi de la revue précédente
Le passage 1 n'avait aucun bloquant. Les deux mineurs ont été traités sur décision de l'humain.
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur, nom du stash tronqué) | levé | `BranchSidebar.svelte:114-117` : `.name:not(:last-child)` en `flex: none`, seule la note est tronquée. e2e `refs.spec.ts:88`. |
| 2 (mineur, ref au-delà de 10 000 commits) | levé | Commentaire sur `COMMIT_LIMIT` (`src-tauri/src/launch.rs`) et sur `read_commits` (`crates/git/src/lib.rs:237`). Test du crate `git` (`crates/git/src/lib.rs:705`) : ref lue, sans nœud, `layout` sans erreur. Test `launch.rs` `repository_view_with_limit(…, 3)` : ref dans `refs`, absente de `commits`. Test `History.test.ts:290` : la ref reste dans `BranchSidebar` et n'a pas d'étiquette dans le graphe. |

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : la limite de 10 000 commits est gardée, et la fiche prévoit de la consigner dans `notes-production.md`. La ligne S-4 qui la décrit y est déjà. `/story` doit y ajouter la précision S-5 : une ref plus ancienne reste dans `BranchSidebar` sans étiquette dans le graphe.

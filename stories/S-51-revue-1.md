# Revue S-51 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:rs -p octogit-app` sur les filtres `gerer_les_branches_ca_6`, `integrer_une_branche_ca_12`, `revenir_en_arriere_ca_7`, `synchroniser_ca_9`, `nettoyer_une_branche_ca_11` (`src-tauri/tests/dirty_guard.rs`) | ✅ 7 tests passent |
| `pnpm test:js src/lib/integrate.test.ts` | ✅ 13/13 |
| `pnpm e2e e2e/dirty-refusal.spec.ts` | ✅ 8/8, aux deux tailles |
| `pnpm e2e e2e/checkout.spec.ts` | ✅ 15/15 |
| Captures Playwright jetables : cherry-pick refusé à 1500×900 et 1920×1080 | ✅ message d'une ligne, sans débordement |

Après les scripts du reviewer, aucun serveur sur le port 1420, ni vite ni pont.

Tests ciblés fournis sans rouge probant :
- Tests qui assertent un texte exact absent du code d'avant : rouge implicite (`dirty_guard.rs` dont Pull CA-9, e2e cherry-pick, revert, Pull, merge, Start rebase, `checkout.spec.ts`).
- Pull CA-9 : mise en place valide (les `git()` du test paniquent si elle échoue) ; sans garde, un pull ff-only aboutirait : rouge.
- Vitest `integrate.test.ts` : sans l'option `dirty`, le checkout part : rouge.
- Non-régression CA-6 « still allowed » et CA-12 « untracked alone » : passent légitimement avant le code. Non bloquants.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| gerer-les-branches CA-6 | couvert | `dirty_guard.rs` : checkout et « Create branch here » refusés, instantané inchangé, checkout compatible permis ; e2e `checkout.spec.ts` double-clic |
| integrer-une-branche CA-12 | couvert | `dirty_guard.rs` merge et rebase ; `dirty-refusal.spec.ts` merge ; Vitest `integrate.test.ts` |
| revenir-en-arriere CA-7 | couvert | `dirty_guard.rs` ; e2e cherry-pick et revert aux deux tailles |
| synchroniser CA-9 | couvert | `dirty_guard.rs` ff-only et rebase, `origin` inchangé ; e2e Pull |
| nettoyer-une-branche CA-11 | couvert | `dirty_guard.rs` : `start_rebase` refusé sans lancer Git ; e2e Start rebase |
| Décision 1 | couvert | `has_uncommitted_changes` avec `--untracked-files=no` ; test « untracked alone » |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `History` · cherry-pick refusé · 1500×900 et 1920×1080 | conforme (message exact, une ligne sous l'en-tête) | — |
| `History` · revert, Pull ff-only, merge, Start rebase, checkout double-clic | conforme : texte exact vérifié par les e2e, sans capture propre | — |
| `History` · Pull rebase, « Create branch here », sélecteur de `Toolbar` | non vérifié visuellement ; garde Rust testée | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src-tauri/src/fetch.rs:130` et `:188` | Tout `CheckoutError::Failed` ou `BranchError::Failed` avec des modifications présentes devient « …before switching branches. », même pour une autre cause (ref inconnue, verrou). La spec vise un checkout « qu'écraserait » les modifications. | Tester la sortie de Git (« would be overwritten ») avant de remplacer le message. |
| 2 | mineur | `src/App.svelte:1129` | La règle « fichiers suivis modifiés » existe en double (Rust `has_uncommitted_changes` et interface `dirty`), seul l'e2e merge la couvre. | À surveiller. Aucun changement exigé. |
| 3 | mineur | README (« Cherry-pick et Revert », `fetch.rs`) | L'absence de checkout avant un merge ou rebase avec arbre modifié n'est pas documentée. | Une phrase, si on le souhaite. |

## Pour l'humain
RAS.

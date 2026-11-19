**Verdict**

**validé**

Le verdict est validé : les 11 tests e2e de `e2e/cherry-pick.spec.ts` prouvent CA-1 à CA-4 et CA-17, et aucun problème bloquant n'est ouvert. Je n'ai pas relancé `pnpm audit:deps` ni `pnpm tauri build`. Aucun fichier de dépendances n'est modifié, et `pnpm check` est vert. Le dépôt n'a pas bougé : `git status` est identique, et le port 1420 est libre après mes captures.

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (Rust, puis Vitest) | ✅ après relance. Le premier lancement a échoué sur `detection_writes_nothing_in_a_repository`, un instable connu et préexistant. `pnpm test:rs --workspace` est ensuite vert. |
| `pnpm test:js` | ✅ 477 tests, 41 fichiers |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm check` (types, volet du build) | ✅ 0 erreur. Les 2 avertissements sur `CommitGraph.svelte` préexistent. |
| `pnpm e2e e2e/cherry-pick.spec.ts` | ✅ 11/11 |
| `pnpm e2e e2e/branch.spec.ts` (modifié par la story) | ✅ 10/10 |
| `pnpm audit:deps`, `pnpm tauri build` | non relancés (voir plus haut) |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| revenir-en-arriere CA-1 | couvert | Menu du commit et de `origin/…` : `RefContextMenu.test.ts` (« CA-1 »), e2e CA-1 aux deux tailles. Boutons : `CommitDetail.test.ts`. Le test e2e de `origin/…` passe par la section Origin de `BranchSidebar` : seule l'entrée `origin/…` porte Cherry-pick, la branche locale non. |
| revenir-en-arriere CA-2 | couvert | `crates/git/tests/cherry_pick.rs` (enfant de l'ancien sommet, message, diff). E2e : `HEAD~1 == tip`, sujet repris, diff identique à celui du commit repris, aucun dialogue ni alerte, et le graphe affiche 2 lignes « Remote one ». Il échouerait sans cherry-pick effectif. |
| revenir-en-arriere CA-3 | couvert | Test Rust : message complet avec SHA complet, arbre identique à celui d'avant. E2e : `Revert "Main work"`, `This reverts commit <SHA>.`, `main.txt` supprimé, `D\tmain.txt`. |
| revenir-en-arriere CA-4 | couvert | Test Rust avec auteur `Bob Author` ≠ profil `Pat Profile`, date de 2020, et signature ssh réelle (la signature disparaît quand `commit.gpgsign` passe à false). E2e : auteur et date comparés au commit repris, committer `Jag Work`. Le test de garde de `src-tauri/tests/cherry_pick_guard.rs` couvre l'auteur Zoe ≠ profil Work. |
| revenir-en-arriere CA-17 | couvert | Test Rust : les refs hors `main` et le dépôt `origin` bare sont inchangés. E2e : mêmes contrôles sur les refs et le bare. |

## Interface
Captures prises par script Playwright jetable, ouvertes et comparées à `ux/ecrans/history.md` et `ux/maquettes/history.html`.
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · menu d'un commit · 1500×900 et 1280×720 | conforme : Cherry-pick, Revert puis « Reset develop to here › », dans l'ordre tranché par la décision 3 | — |
| History · menu d'une `origin/…` · 1500×900 et 1280×720 | conforme : Checkout, Cherry-pick, Revert, Reset | — |
| History · `CommitDetail` · 1500×900 et 1280×720 | conforme : boutons avec icône Lucide, qui passent à la ligne sans déborder | — |
| History · après Cherry-pick · 1500×900 | conforme : nouveau commit en tête, même écran, sans dialogue | — |
| History · après Revert · 1500×900 | conforme : `Revert "Main work"`, auteur Jag Work | — |
| History · refus en une ligne · 1500×900 et 1280×720 | conforme : « 192ed8e conflicts or brings no changes. Nothing was changed. » | — |

Les écrans « après Cherry-pick » et « après Revert » à 1280×720 n'ont pas été examinés : mes captures de ces deux états existent mais je n'ai ouvert que celles de 1500×900. Les autres états à 1280×720 ne débordent ni ne se chevauchent.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `e2e/cherry-pick.spec.ts:109` | Le titre dit « Cherry-pick d'une origin/… depuis son menu et depuis CommitDetail », mais le test n'utilise que `CommitDetail`. Le chemin « clic droit sur une `origin/…`, puis Cherry-pick » (`pickFromMenu` dans `src/App.svelte`, qui retrouve la cible par `refs.find`) n'est exercé par aucun e2e ni test d'App. Je l'ai vérifié à la main : il résout bien `origin/develop` en `292906c`. | Ajouter l'appel depuis le menu de la section Origin, ou corriger le titre. |

## Pour l'humain
- **pour information** : après un Cherry-pick ou un Revert réussi, la sélection reste sur le commit d'origine, et non sur le commit créé. La spec ne dit rien sur ce point.
- **pour information** : sur un dépôt avec modifications non commitées, `git cherry-pick --abort` après un conflit pourrait toucher ces modifications. S-51 prévoit le refus en amont ; avant elle, ce cas n'est pas testé.

**à corriger**

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (Rust workspace + Vitest, 500 tests) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/integrate.spec.ts` (13 tests, deux tailles) | ✅ |
| `pnpm e2e` complet, `pnpm audit:deps`, `pnpm tauri build` | non lancés (e2e ciblé seulement) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| integrer-une-branche CA-4 (dernière phrase) | couvert | `crates/git/tests/integrate.rs` (`ca_4_rebase_onto_a_commit_without_branch…`) ; `e2e/integrate.spec.ts:136` (`feature/profiles~3` = cible, jamais vrai avant) |
| CA-6 | couvert | Rust `ca_6_merge_creates…` ; e2e `:67` (deux parents, message, `develop` inchangé, ligne du graphe absente avant l'action) |
| CA-7 | couvert | Rust `ca_7_…` ; e2e `:95` (ligne « Merge branch… » absente avant, parents vérifiés) |
| CA-8 | couvert | Rust (identité, signature ssh, absence de signature si `gpgsign` = false) ; e2e `:88-91` ; `src-tauri/tests/integrate_guard.rs` |
| CA-9 | couvert | Rust (branche locale et `origin/…`, auteurs et messages gardés, linéaire) ; e2e `:112` (`HEAD~2` = develop) |
| CA-10 | couvert | e2e `:123` « Force push » visible + `bare` inchangé. Capture : bouton « Force push » affiché après le rebase. L'état « avant » du bouton n'est pas asserté, mais les assertions git prouvent le rebase. |
| CA-11 | partiel | Rust : refus « Already up to date. » avec refs, index et arbre inchangés, merge et rebase (prouvé). e2e : voir problème 1. |
| CA-16 | couvert | Rust (`bare` identique, seule `feature/profiles` bouge) ; e2e `bare()` inchangé |
| Décision 1 (conflit annulé, une ligne) | couvert | Rust (merge et rebase : refs, état, `MERGE_HEAD` et `rebase-*` absents) ; e2e partiellement faible, voir problème 1 |
| Décision 2 (identité non conforme) | couvert | `integrate_guard.rs` (merge et rebase) ; e2e `:211` (merge seulement) |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · merge divergé · 1500×900 | conforme : commit de merge en tête, graphe à jour, même écran, aucun dialogue | — |
| History · merge d'une branche ancêtre · 1500×900 et 1280×720 | conforme : commit de merge créé (sortie du script de capture) | — |
| History · rebase onto develop · 1500×900 et 1280×720 | conforme : historique linéaire, « Force push » dans l'en-tête | — |
| History · rebase onto sha7 · 1500×900 et 1280×720 | conforme (e2e : historique linéaire au-dessus du commit) ; non capturé | — |
| History · « Already up to date. » · 1500×900 et 1280×720 | texte conforme, une ligne, rien ne bouge ; rendu en bandeau rouge alors que la maquette (`history.html:519`) utilise le style neutre « ok » | 2 |
| History · branche qui reçoit non courante · 1500×900 | conforme : `feature/profiles` courante après l'opération | — |
| History · merge divergé · 1280×720 | conforme, sans débordement | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `e2e/integrate.spec.ts:169-173` et `:200-207` | Seconde moitié de ces deux tests (rebase de CA-11, rebase de la décision 1) : l'alerte vérifiée porte le même texte que celle de la première moitié (merge). Entre les deux, rien n'est effacé ni attendu. `runStash` n'efface `checkoutNotice` qu'après le checkout asynchrone de S-36. L'alerte périmée peut donc satisfaire `toHaveText` avant l'exécution du rebase. Sans la garde « Already up to date. », le rebase de `develop` sur `feature/profiles` est un no-op de Git : branches et état restent identiques, le test passe. Pour la décision 1, un rebase non annulé ne serait attrapé que par la course sur `existsSync`. Je n'ai pas fait de contre-épreuve. | Séparer merge et rebase en deux tests, ou effacer l'alerte avant la seconde action (recharger la page ou fermer la ligne) et vérifier ensuite que l'alerte reparaît. |
| 2 | mineur | `src/App.svelte` (notice `checkoutNotice`) | « Already up to date. » s'affiche comme un refus rouge. La maquette `history.html:519` le montre en style neutre « ok ». Le texte est conforme et aucune couleur n'est imposée par `ux.md`. | Style neutre pour ce message si l'on veut coller à la maquette. |

## Pour l'humain
- **à décider** : « Already up to date. » est rendu comme une erreur (bandeau rouge). La maquette le montre en neutre. Aligner le rendu sur la maquette, ou garder la ligne d'erreur commune à tous les refus ?
- **pour information** : la fiche réclamait `src/web-bridge.ts` et `e2e/helpers.ts` « à compléter ». Aucun changement n'y était nécessaire, les e2e passent. Les tests e2e de CA-4 à CA-10, CA-16 et décision 2 (merge) prouvent leur critère : leurs assertions git échouent sans l'opération.

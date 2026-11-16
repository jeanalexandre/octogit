# Revue S-15 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` | ✅ La partie Rust est verte (dont `crates/git/tests/commit.rs`, 6 tests). Le premier passage de Vitest a affiché 12 FAIL, sans que je les relise. Le relancé seul, `pnpm test:js`, donne 210/210 verts. Ces échecs sont ceux, déjà connus, qui apparaissent sous charge. |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm check` (types Svelte et TypeScript) | ✅ 0 erreur. 2 avertissements d'accessibilité dans `CommitGraph.svelte`, que la story n'a pas touché. |
| `pnpm audit:deps` | ✅ Les avertissements viennent de dépendances existantes, l'avis déjà ignoré reste ignoré. |
| `pnpm e2e e2e/commit.spec.ts` | ✅ 7/7. Relancé avec `--repeat-each 3` : 21/21, donc pas d'instabilité. |
| `pnpm tauri build` | non lancé. `pnpm check` couvre le contrôle de types, et `bindings.ts` ne contient que les ajouts attendus pour `commit`, `getCommitEmail` et `CommittedView`. |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| preparer-un-commit CA-12 | couvert | Rust `crates/git/tests/commit.rs` (résumé puis corps, parent, Staged vide, non indexés gardés) ; Rust app `working_tree.rs` (`…ca_12_commit_returns_the_new_tree_and_the_graph_with_the_commit_on_top`) ; composant ; e2e `commit.spec.ts:43` aux deux tailles. |
| preparer-un-commit CA-13 | couvert | Composant (Cmd+Entrée depuis le résumé et depuis la description, Entrée seule sans effet) ; e2e `commit.spec.ts:78`. |
| preparer-un-commit CA-14 | couvert | Rust `commit.rs` : auteur et committer lus du `.git/config` local, avec un `~/.gitconfig` factice conservé octet pour octet et dossier HOME inchangé ; signature SSH locale, puis commit non signé quand elle est décochée. e2e : auteur « Work User ». |
| preparer-un-commit CA-15 | couvert | Composant (ligne placée après le bouton, absente sans identité conforme) ; e2e `commit.spec.ts:98`. |
| preparer-un-commit CA-16 | couvert | Rust `commit.rs` (nouveau SHA, même parent, fichiers indexés dans le commit, ancien SHA absent du graphe, 3 commits) ; e2e `commit.spec.ts:108`. |
| preparer-un-commit CA-22 | couvert | Composant (les deux raisons, aucun appel à Stage) ; Rust (refus, index et HEAD inchangés) ; e2e `commit.spec.ts:131`. |
| preparer-un-commit CA-23 | couvert | Composant ; e2e `commit.spec.ts:146` (brouillon restitué à l'identique, y compris les espaces et la ligne vide). |

Les tests sans rouge probant ont été jugés un par un :
- **Test Rust app `…ca_12_commit_returns…`** : il échouerait si le commit n'était pas fait. `staged` ne serait pas vide, et `commits[0].summary` ne vaudrait pas « feat: view ». Probant.
- **Tests e2e** : chacun échouerait sans le comportement visé.
  - Dans CA-16, le motif `Add keep$` n'est pas vide de sens : le nom accessible d'une ligne du graphe est exactement le résumé du commit.
  - Dans CA-15, la ligne n'apparaît que si le dépôt est conforme, et `open()` retire d'abord l'identité locale.
  - Aucune instabilité sur 3 répétitions.
- **Tests Rust de `commit.rs`** : le rouge par échec de compilation seul est acceptable, car chaque assertion porte sur l'état réel du dépôt temporaire (`git log`, `rev-parse`, `show`, `diff --cached`).

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · WorkingChanges avec saisie · 1500×900 | conforme | — |
| History · WorkingChanges avec saisie · 1280×720 | conforme | — |
| History · Commit désactivé (« Summary required », « No staged changes ») · 1500×900 et 1280×720 | conforme | — |
| History · amend coché (champs pré-remplis) et décoché (brouillon restauré) · 1500×900 et 1280×720 | conforme | — |
| History · ligne « Identity matches profile Work · adresse » · 1500×900 et 1280×720 | conforme | — |

Aucun débordement : `scrollHeight` égale `clientHeight` à 1280×720 (663) et à 1500×900 (843). Le bouton Commit reste dans la fenêtre. Focus visible, libellés présents (Summary, Description, Amend last commit) et textes de 12 px ou plus. Le ton est celui d'`ux.md`. La ligne d'identité est placée sous le bouton, comme le disent la spec (CA-15) et `ux.md`, alors que la maquette la met au-dessus (voir « Pour l'humain »).

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun problème relevé. | — |

## Pour l'humain
- **à décider** : la maquette `history.html` place la ligne « Identity matches profile … » au-dessus du bouton Commit, alors que la spec (CA-15) et `ux.md` disent « sous le bouton ». Le code suit la spec. À trancher : garder « sous le bouton » et corriger la maquette, ou l'inverse.
- **à décider** : « Amend last commit » est inutilisable sans fichier indexé, car Commit reste désactivé avec « No staged changes ». Reformuler le message d'un dernier commit sans rien indexer est donc impossible. C'est la lecture littérale de CA-22 et de CA-16 (« avec les fichiers indexés »), mais l'usage courant de l'amend est justement le message seul.

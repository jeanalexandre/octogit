# Revue 1 de S-29

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test:js` (32 fichiers, 364 tests) | ✅ |
| `pnpm test` (Rust, partie du workspace) | ✅ sauf `detection_writes_nothing_in_a_repository`, test instable connu et préexistant (voir « Pour l'humain ») |
| `pnpm test:rs -p octogit-git` | ✅ 62 tests sur 63 ; le 63e (`detection_writes_nothing_in_a_repository`) a échoué, puis passé à la relance isolée |
| `pnpm e2e` (249 tests) | ✅ 249 passés, dont les 6 de `e2e/diff-view.spec.ts` (relancés seuls : ✅) |
| `pnpm audit:deps` | ✅ « No known vulnerabilities found » ; 4 avertissements de crates non maintenues (`chrono`, `paste`, `proc-macro-error`, `glib`), sans lien avec le diff |
| `pnpm check` | ✅ 0 erreur ; 2 avertissements a11y dans `CommitGraph.svelte`, préexistants |
| `pnpm tauri build` | ✅ `Octogit.app` et `.dmg` produits |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-26 | couvert | Rust `explorer_l_historique_ca_26_a_modified_file_diffs_its_lines_before_and_after` ; Vitest `DiffView.test.ts` CA-26 ; `CommitDetail.test.ts` CA-26 (le clic renvoie le rang du fichier) ; e2e `diff-view.spec.ts:51` (côte à côte par défaut, bascule en unifié, deux tailles) |
| explorer-l-historique CA-27 | couvert | Vitest CA-27 ; e2e `diff-view.spec.ts:76` (File i / 4, suivant puis précédent, boutons désactivés aux deux extrémités) |
| explorer-l-historique CA-28 | couvert | Rust : trois tests (ajouté, supprimé, binaire avec tailles) ; Vitest ; e2e `diff-view.spec.ts:103` (un seul côté, « Binary file · 7 B → 11 B », aucune ligne) |
| explorer-l-historique CA-29 | couvert | e2e `diff-view.spec.ts:121` : `scrollTop` > 500 avant l'ouverture, identique après Échap ; `aria-current` sur le même commit ; 1500×900 et 1920×1080. `History` reste monté sous `DiffView` (`App.svelte`, `.stage` avec `inert`) |

Les tests signalés sans rouge probant prouvent bien leur critère (assertions concrètes : lignes exactes, `toHaveCount(0)` pour le côté absent, `scrollTop` comparé, `aria-current`, rang transmis).

## Interface
Captures prises sur le dépôt `fixtures/diff.sh`, aux deux tailles : côte à côte, unifié, ajouté, supprimé, binaire, premier et dernier fichier, retour par Échap à 1500×900 ; tous états à 1920×1080 : conformes à `ux.md` et à la maquette, aucun débordement ni chevauchement. Aucun serveur ne reste en écoute sur le port 1420. `git status` identique à celui du départ.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/screens/DiffView.svelte:219,235` | En-têtes de colonnes « before » / « after » sans le sha ; la maquette (section 2) affiche « c41d8e0 (before) » / « a3f9c21 (after) ». | Facultatif : afficher les SHA courts. La maquette est en basse fidélité, le sha du commit figure déjà dans l'en-tête. |

## Pour l'humain
- **pour information** : `detection_writes_nothing_in_a_repository` a échoué une fois pendant `pnpm test`, puis est passé à la relance isolée. C'est l'instabilité déjà connue (`CLAUDE.local.md`), sans lien avec la story.

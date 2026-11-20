**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:js` sur `OperationBanner.test.ts`, `AbortMergeDialog.test.ts`, `WorkingChanges.test.ts`, `ConflictResolver.test.ts` | ✅ 58 tests |
| `pnpm test:rs -p octogit-git resoudre_les_conflits` | ✅ 9 tests |
| `pnpm test:rs -p octogit-app resoudre_les_conflits` | ✅ 3 tests |
| `pnpm e2e e2e/conflict-resolver.spec.ts` | ✅ 18 tests |
| Preuve hors dépôt : fixture `conflict-merge`, résolution, `git commit --no-edit`, `git log -1 --format=%B` | ❌ le message contient `# Conflicts:` (problème 1) |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| CA-7 | couvert | `OperationBanner.test.ts` ; e2e « CA-7, CA-8 ». |
| CA-8 | partiel | Tests Rust et e2e ne contrôlent que `%s`, pas le message complet. Le commit réel porte « # Conflicts: / # notes.txt / # settings.txt » (problème 1). |
| CA-11 | couvert | `conflict.rs`, e2e « CA-11, CA-19 ». |
| CA-13 | partiel | « No profile » testé seulement par une prop du composant ; aucun test Rust ne refuse Continue sans profil ; dérivation de `continueReason` (`App.svelte:372-378`) non exercée (problème 2). |
| CA-14 | couvert | e2e. |
| CA-19 | couvert | `AbortMergeDialog.test.ts`, e2e. |
| CA-21 | couvert | `integrate_guard.rs` ca_21, `WorkingChanges.test.ts`, e2e. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `crates/git/src/integrate.rs` (`continue_merge`, `continue_merge_with_home`, args `["commit", "--no-edit"]`) ; `crates/git/tests/conflict.rs` ; `e2e/conflict-resolver.spec.ts:216-244` | `git commit --no-edit` garde les lignes de commentaire de `MERGE_MSG` : message « Merge branch 'develop' into feature/profiles\n\n# Conflicts:\n#\tnotes.txt\n#\tsettings.txt ». CA-8 exige le message par défaut de Git (`integrer-une-branche` CA-6). Les tests ne lisent que le sujet. | Message exactement « Merge branch '…' into … » (ex. `commit --no-edit --cleanup=strip`). Assertion sur le message complet (`%B`) dans `conflict.rs` et l'e2e, qui échoue avec la version actuelle. |
| 2 | bloquant | `src-tauri/tests/integrate_guard.rs` ; `src/App.svelte:372-378` | Seule l'identité non conforme est testée côté Rust ; « No profile » non testé pour `continue_merge_checked` ni côté interface (bandeau sur dépôt sans profil). | Test `src-tauri/tests/` : dépôt sans profil, `continue_merge_checked` refuse, `MERGE_HEAD` et `HEAD` inchangés. Test (composant ou e2e) : bandeau, Continue désactivé, raison « No profile ». |
| 3 | mineur | `src/lib/screens/ConflictResolver.svelte` (`.back`) | La maquette place Back to graph dans le bandeau, à gauche d'Abort et Continue ; l'implémentation le met dans la barre « Conflicts » sous le bandeau. | Optionnel : aligner sur la maquette. |

## Pour l'humain
- **pour information** : `notes-production.md` dit encore qu'un merge en conflit n'a aucune sortie dans l'application avant S-39 (S-38, décision 1). Caduque une fois S-39 validée ; à mettre à jour par `/story`.
- **pour information** : les autres points sont RAS ; la décision 1 (Continue dans S-39, refusé par `ensure_conform`) est respectée.

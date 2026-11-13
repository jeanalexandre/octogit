# Revue S-11 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ clippy sans avertissement (le `large_enum_variant` est levé), ESLint : « No issues found » |
| `pnpm format:check` | ✅ |
| `pnpm test` | cargo : tout vert, dont `src-tauri/tests/mismatch.rs` (7) et `crates/identity/tests/mismatch.rs` (4). La partie Vitest de `pnpm test` a encore affiché 9 FAIL sous charge, comme au passage 1. Relancé seul avec `pnpm exec vitest run` : 169/169 ✅ (lu dans `.vitest/json/output.json`, 0 échec). |
| `pnpm e2e` | ✅ 106/106, dont les 7 tests de `e2e/mismatch.spec.ts` |
| `pnpm audit:deps` | ✅ 3 avertissements Rust (`paste`, `proc-macro-error`, `glib`), aucune vulnérabilité nouvelle ; la vulnérabilité de faible gravité était déjà ignorée |
| `pnpm tauri build` | ✅ `Octogit.app` et le `.dmg` produits. Les 2 avertissements a11y de `CommitGraph.svelte` préexistent. |

Rouge probant, jugé dans le code (je n'ai pas inversé le code) :
- `e2e/mismatch.spec.ts:87` (CA-8) : le `core.sshCommand` local de départ est `ssh -i <clé>`. Le test attend ensuite exactement `ssh -F none -i <clé> -o IdentitiesOnly=yes -o IdentityAgent=none` après Save, le profil importé dans `manual_profiles`, et aucun dialogue à la réouverture. Sans l'écriture au Save, la valeur resterait `ssh -i <clé>` et l'assertion échouerait. Le test ne passe donc pas à vide.
- Le même test relit les octets de `.git/config` avant le Save, après l'ouverture de `ProfileSettings` : ils sont identiques.
- `src-tauri/tests/mismatch.rs:224` double ce test côté Rust : octets inchangés après `import_local_config`, forme d'Octogit après `attach_manually`, puis `mismatch` vide et profil « Imported » à la réouverture.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| proteger-l-identite CA-5 | couvert | `crates/identity/tests/mismatch.rs` (chacune des quatre valeurs seule en écart), `src-tauri/tests/mismatch.rs`, `e2e/mismatch.spec.ts:33` et `:140` |
| proteger-l-identite CA-6 | couvert | `src-tauri/tests/mismatch.rs:140`, `e2e/mismatch.spec.ts:64` |
| proteger-l-identite CA-8 | couvert | `e2e/mismatch.spec.ts:87`, `src-tauri/tests/mismatch.rs:155`, `:189` et `:224`, `crates/store/tests/manual_profiles.rs` |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `IdentityMismatch` · un seul écart · 1500×900 | conforme : ordre des lignes `user.email`, `user.name`, `core.sshCommand`, signature, comme la maquette (`setting_rows`, `crates/identity/src/local.rs`) | — |
| `IdentityMismatch` · un seul écart · 1920×1080 | conforme | — |
| `IdentityMismatch` · plusieurs écarts · 1500×900 et 1920×1080 | conforme : écarts marqués « ≠ differs » (signe et texte), vérifiés par e2e | — |
| `IdentityMismatch` · origine règle · 1500×900 et 1920×1080 | conforme : « matched by rule <motif> » vérifié par e2e | — |
| `ProfileSettings` pré-rempli par Import · 1500×900 et 1920×1080 | conforme : champs pré-remplis, nom vide, Save, vérifiés par e2e aux deux tailles | — |
| `History` conforme après Overwrite ou Save · 1500×900 et 1920×1080 | conforme : dialogue fermé, badge au nom du profil, vérifiés par e2e aux deux tailles | — |

Je n'ai pas repris de captures à ce passage. Seuls l'ordre des lignes et l'écriture au Save ont changé depuis le passage 1, qui avait capturé et jugé les écrans conformes. L'ordre des lignes est lu dans le code et correspond aux lignes 156 à 159 de la maquette. Les icônes des boutons sont reportées vers S-48 (décision 7).

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (clippy `large_enum_variant`) | levé | `LaunchState::History` porte `Box<RepositoryView>` (`src-tauri/src/launch.rs`), sans `#[allow]` ; `pnpm lint` passe |
| 2 (rien d'écrit au Save d'un Import) | levé | `attach_manually` appelle `overwrite_profile` puis `set_manual_profile` (`src-tauri/src/attach.rs:166-182`). Tests Rust (`src-tauri/tests/mismatch.rs:224`) et e2e (`e2e/mismatch.spec.ts:87`) avec `ssh -i <clé>` : verts et probants. Le README dit désormais que le Save écrit les valeurs et que le dialogue ne revient pas. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun | — |

## Pour l'humain
- **pour information** : sous `pnpm test`, 9 tests Vitest échouent encore sous charge et passent à la relance isolée. Cela correspond à l'instabilité de `src/livraison.test.ts`, déjà dans `notes-production.md`. Aucun test de la story n'est en cause.

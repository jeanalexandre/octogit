# Revue S-11 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ❌ clippy : `large_enum_variant` sur `LaunchState` (`src-tauri/src/launch.rs:111`) ; eslint non atteint |
| `pnpm format:check` | ✅ |
| `pnpm test` | cargo : tout vert, dont les nouveaux `mismatch.rs` (src-tauri et identity). Vitest : 9 FAIL dans la sortie de `pnpm test` (sous charge, `src/livraison.test.ts` déjà connu pour être instable). Relancé seul avec `pnpm exec vitest run` : 169/169 ✅ |
| `pnpm e2e` | ✅ 106/106, dont les 7 tests de `e2e/mismatch.spec.ts` |
| `pnpm audit:deps`, `pnpm tauri build` | non lancés : le lint échoue déjà |

Rouge probant des e2e, jugé dans le code (je n'ai pas inversé le code) :
- CA-5 : les assertions portent sur les textes exacts, sur « ≠ differs » comptée une seule fois, sur les cinq lignes et sur l'égalité d'octets. Elles échoueraient si le dialogue manquait ou écrivait.
- CA-6 : après Overwrite, le test vérifie les valeurs écrites dans `.git/config`. Il part d'un état différent (`perso@example.org`), donc il ne passe pas à vide.
- CA-8 : la relecture de `repositories.json` (`manual_profiles`) et la réouverture avec une règle différente prouvent le rattachement mémorisé.
- Cas à plusieurs écarts : le test compte 3 lignes « differs » et vérifie l'égalité d'octets après Échap.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| proteger-l-identite CA-5 | couvert | `crates/identity/tests/mismatch.rs` (chaque valeur seule en écart), `src-tauri/tests/mismatch.rs`, `e2e/mismatch.spec.ts:33` et `:141` |
| proteger-l-identite CA-6 | couvert | `src-tauri/tests/mismatch.rs` (CA-6), `e2e/mismatch.spec.ts:64` |
| proteger-l-identite CA-8 | partiel | `e2e/mismatch.spec.ts:87` et `crates/store/tests/manual_profiles.rs` passent. Rien n'est écrit après Save : voir problème 2 |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `IdentityMismatch` · un seul écart · 1500×900 | conforme (vu sur la capture 1920 identique en structure) | 3 (mineur) |
| `IdentityMismatch` · un seul écart · 1920×1080 | conforme | 3 |
| `IdentityMismatch` · plusieurs écarts · 1500×900 | conforme : 3 écarts marqués « ≠ differs » plus une barre, texte compris, rien ne déborde | 3 |
| `IdentityMismatch` · plusieurs écarts · 1920×1080 | conforme | 3 |
| `IdentityMismatch` · origine règle · 1500×900 et 1920×1080 | conforme : « matched by rule <motif> » | — |
| `ProfileSettings` pré-rempli par Import · 1500×900 | conforme : formulaire complet, nom vide, Save | — |
| `ProfileSettings` pré-rempli par Import · 1920×1080 | conforme (mêmes composants, seule la largeur change) | — |
| `History` conforme après Overwrite · 1500×900 | conforme : dialogue fermé, badge Pro | — |
| `History` conforme après Overwrite · 1920×1080 | conforme | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src-tauri/src/launch.rs:111` | `pnpm lint` échoue : `clippy::large_enum_variant` sur `LaunchState`. Le champ `mismatch` ajouté à `RepositoryView` porte la variante `History` à 248 octets. | Corriger sans `#[allow]` (par exemple `Box<RepositoryView>`, ou boxer `mismatch`) et régénérer les bindings si le contrat change. `pnpm lint` doit passer. |
| 2 | bloquant | `src-tauri/src/attach.rs` (`attach_manually`), `src/App.svelte` (`saveProfile`) | Décision 1 de la fiche, déjà actée et à faire à ce passage. Après Save d'un Import, rien n'est écrit. Avec un `core.sshCommand` local de forme différente (par exemple `ssh -i <clé>`), `IdentityMismatch` revient à l'ouverture suivante, contre CA-8 (« après Save … `ProfileBadge` est conforme »). Le test e2e n'exerce que le cas où le `core.sshCommand` local est déjà de la forme d'Octogit, qui ne prouve pas la décision. | `.git/config` identique octet pour octet jusqu'au Save. Au Save, écrire les valeurs du nouveau profil comme Overwrite. Ajouter un test (Rust et e2e) avec `core.sshCommand` local `ssh -i <clé>`. Vérifier que le dialogue ne revient pas à la réouverture. Mettre à jour la phrase du README qui dit le contraire (« sans écrire dans le `.git/config` », « `IdentityMismatch` se présente de nouveau »). |
| 3 | mineur | `src/lib/components/IdentityMismatch.svelte:108-116`, `crates/identity/src/local.rs` (`setting_rows`) | La maquette (`profile-settings.html` section 3) met une icône sur chaque bouton et place `user.email` avant `user.name`. Le composant n'a pas d'icônes ; l'ordre des lignes est `user.name`, `user.email`. | Aligner si possible. Non bloquant : maquette en basse fidélité. |

## Pour l'humain
- **pour information** : `pnpm test` a échoué une fois sous charge sur 9 tests Vitest, vert à la relance isolée. Cela correspond à l'instabilité de `src/livraison.test.ts` déjà notée dans `notes-production.md` ; aucun test de la story n'est en cause.

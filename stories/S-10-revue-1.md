# Revue S-10 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (`cargo test --workspace` puis `vitest run`) | ✅ Cargo : tous les tests passent. Vitest : 21 fichiers, 169 tests passent. |
| `pnpm lint` | ✅ clippy `-D warnings` et ESLint sans problème |
| `pnpm format:check` | ✅ |
| `pnpm e2e` | ✅ 99/99, dont `e2e/rules.spec.ts` (5 cas) |
| `pnpm build` et `pnpm check` | ✅ 0 erreur. 2 avertissements a11y sur `CommitGraph.svelte`, fichier non touché par la story. |
| `pnpm audit:deps`, `pnpm tauri build` | Non relancés : audit réseau, et build du bundle trop lourd. Aucune dépendance ajoutée (aucun `Cargo.toml`, `Cargo.lock`, `package.json` ni `pnpm-lock.yaml` modifié). |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| configurer-les-profils CA-11 | couvert | `crates/store/src/lib.rs` : `rules_are_persisted_with_their_type_and_a_removed_rule_stays_removed` ; `src-tauri/src/profiles.rs` : `rules_are_saved_with_their_type_listed_back_and_removed_by_a_later_save` ; e2e `rules.spec.ts` « CA-11 » (ajout, Save, rechargement, retrait, 2 tailles) |
| proteger-l-identite CA-1 | couvert | `src-tauri/tests/attach.rs` : `…ca_1_the_first_profile_wins…` et `…ca_1_a_repository_matching_no_rule…` ; `crates/identity/tests/rules.rs` : `the_first_profile_with_a_matching_rule_wins…` ; e2e `rules.spec.ts` « CA-1 » (lancement, `RepoPicker`, 2 tailles) |
| proteger-l-identite CA-2 | couvert | `crates/identity/tests/rules.rs` : `a_remote_owner_rule_matches_ssh_and_https_origins…` et `…ignores_other_owners_other_hosts_and_a_missing_origin`. `upstream` est couvert par la lecture de `origin` seul (`read_origin_url`), et l'absence d'`origin` par `None`. |
| proteger-l-identite CA-3 | couvert | `crates/identity/tests/local.rs` : `a_repository_without_local_identity_gets_the_values_of_the_profile` ; `src-tauri/tests/attach.rs` : `…ca_3_opening_writes_the_work_values…` (une seule clé `-i`, remotes et branches inchangés) |
| proteger-l-identite CA-4 | couvert | `attach.rs` : `…ca_4_a_conform_config_is_identical_byte_for_byte_after_opening` ; `local.rs` : `a_config_already_conform_is_left_byte_for_byte_identical` |
| proteger-l-identite CA-28 | couvert | `src-tauri/tests/gitconfig.rs` : faux `HOME`, vraies commandes d'ouverture (`open_repository`, `launch_state`), `.gitconfig` comparé octet pour octet. Il couvre l'écriture, le cas conforme et le cas qui diffère. Ni clone, ni `IdentityMismatch`, ni menu du badge : ils n'existent pas encore. |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| ProfileSettings · MatchingRuleList (règle Path et règle Remote owner, retrait) · 1500×900 | conforme : titre « Matching rules », lignes type / motif / retrait, boutons « Path rule » et « Remote owner rule », comme la maquette | — |
| ProfileSettings · MatchingRuleList · 1920×1080 | conforme, sans débordement | — |
| History · dépôt rattaché affichant le profil · 1500×900 | conforme : pastille de couleur et nom, à droite de l'en-tête comme la maquette (« Client X » rattaché par `remote_owner`). Le suffixe « · @compte » n'est pas là : il relève de S-12. | — |
| History · dépôt rattaché · 1920×1080 | non capturé : même composant, pas d'état propre à cette taille. Le e2e CA-1 passe aux deux tailles. | — |

Accessibilité lue dans le code : libellés « Rule pattern » et « Remove <type> rule <motif> », focus visible, tutoiement absent, textes en anglais comme le reste de l'interface.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun problème relevé. Contrats (`RuleView`, `ProfileBadgeView`, `profiles.json` v2) conformes aux décisions 2 à 7. `bindings.ts` est régénéré (le test `bindings.test.ts` passe). Doc README à jour. | — |

## Pour l'humain
- **pour information** : au premier `pnpm test`, 6 tests de `livraison.test.ts` (qui lance `check-bundle.sh`, 100 s) sont sortis en échec, pendant que cargo et la compilation tournaient. Deux relances ont fait passer les 18 tests. Le test préexiste et la story ne le touche. Il semble sensible à la charge machine. Je n'ai pas pu lire la cause de l'échec.
- **à décider** : l'amendement de `stack.md` pour `-F none` (décision 1 de la fiche) reste à faire par `/ksm:stack`. Le README décrit déjà la commande avec `-F none`, `stack.md` non.

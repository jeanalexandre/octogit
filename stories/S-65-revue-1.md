# Revue S-65 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo 100 % ok ; vitest 29 fichiers, 327 tests) | ✅ |
| `pnpm e2e e2e/rules.spec.ts e2e/mismatch.spec.ts e2e/badge.spec.ts e2e/badge-menu.spec.ts e2e/profiles.spec.ts` (55 tests) | ✅ |
| `pnpm audit:deps` (4 avertissements RustSec « allowed », exception déjà acceptée) | ✅ |
| `pnpm tauri build` (`pnpm check` : 0 erreur, 2 avertissements a11y de `CommitGraph.svelte`, fichier non touché) | ✅ |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| proteger-l-identite CA-1 | couvert | `crates/identity/tests/rules.rs` ; `src-tauri/tests/attach.rs` (`…ca_1_rules_of_two_profiles_leave_no_profile_in_both_orders_and_write_nothing`, `…ca_1_a_single_matching_profile_is_attached`) ; e2e `rules.spec.ts` |
| proteger-l-identite CA-3 | couvert | `crates/identity/tests/local.rs::a_repository_without_local_identity_gets_the_values_of_the_profile` |
| proteger-l-identite CA-13 | couvert | `src-tauri/tests/attach.rs::proteger_l_identite_ca_13_no_profile_leaves_an_existing_local_identity_untouched` ; capture « No profile » badge, Push, Commit |
| proteger-l-identite CA-29 | couvert | `crates/identity/tests/local.rs`, `crates/identity/tests/mismatch.rs`, `src-tauri/tests/attach.rs`, `IdentityMismatch.test.ts`, e2e `mismatch.spec.ts` |
| configurer-les-profils CA-17 | couvert | `src-tauri/tests/attach.rs::configurer_les_profils_ca_17_reordering_changes_no_attachment_…` ; e2e Alt+↑ préexistant |

Tests sans rouge probant : ils prouvent tous leur critère (l'ancien code échouerait ; seul le cas « un seul profil correspond » des tests CA-1 de `src-tauri/tests/attach.rs` est une non-régression voulue).

## Interface
Captures à 1 500×900 et 1 280×720 : History « No profile » (règles de deux profils), Push et Commit bloqués, conforme ; `IdentityMismatch` à l'ouverture avec `user.email` seul (« not set » et « ≠ differs » sur les 3 lignes absentes), conforme. Choix de profil, Reset to rules et `ProfileSettings` réordonné : vérifiés par e2e, non capturés. Après Cancel, `.git/config` reste avec `user.email` seul.

## Suivi de la revue précédente
Sans objet : premier passage.

## Problèmes
Aucun.

## Pour l'humain
- **à décider** : le libellé de `MatchingRuleList` (« a repository uses the first profile with a matching rule »), la maquette `profile-settings.html` (section 3) et la ligne J-12 de `ux.md` disent encore « premier profil », ce qui est faux depuis S-65. `dev` ne peut pas modifier ces fichiers (`ux.md` et `ux/` sont hors périmètre). Il faut les mettre à jour, puis le libellé du composant.

Aucun processus laissé sur le port 1420.

# Revue S-7 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo test --workspace + vitest : 100 tests, 13 fichiers) | ✅ |
| `pnpm e2e` (43 tests, dont profiles.spec.ts 9 tests) | ✅ |
| `pnpm lint` (clippy `-D warnings` + eslint) | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (3 avertissements cargo non bloquants, 1 avis ignoré déjà accepté) |
| `pnpm tauri build` | ✅ (svelte-check 0 erreur, 2 avertissements a11y préexistants dans CommitGraph) |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| configurer-les-profils CA-2 | couvert | `ProfileSettings.test.ts` (formulaire vide) ; `e2e/profiles.spec.ts:23` (1500 et 1920) |
| configurer-les-profils CA-3 | couvert | test `profiles_are_empty_by_default_and_survive_a_new_store_exactly_and_in_order` (store) ; `e2e/profiles.spec.ts:47` (rechargement, valeurs, Save désactivé). Échouerait si rien n'était persisté. |
| configurer-les-profils CA-13 | couvert | `crates/store/tests/gitconfig.rs` : faux `HOME`, comparaison octet pour octet |
| configurer-les-profils CA-14 | couvert | `ProfileSettings.test.ts:272-287` (états rempli et vide) |
| configurer-les-profils CA-17 | couvert | `profiles::tests::moving_is_remembered_across_stores` ; `e2e/profiles.spec.ts:83` (Alt+↑, rechargement) |
| configurer-les-profils CA-19 | couvert | `e2e/profiles.spec.ts:115-147` : Cancel, Discard, Save, Échap sans modification, retour à History |

Tests lents sans rouge constaté (CA-3, CA-17, CA-19) : chacun relit l'état après rechargement ou `profiles.json`. Aucun ne passerait si le critère n'était pas tenu. Les 9 e2e passent.

## Interface
Je n'ai pas repris de captures à ce passage. Les écrans ont été capturés et jugés conformes au passage 1. Le passage 2 ne change que la pastille et la couleur dans l'en-tête, le piège de focus du dialogue et `startNew`. Je les ai jugés dans le code et par les tests.
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| ProfileSettings · vide · 1500×900 et 1920×1080 | conforme (inchangé depuis le passage 1) | — |
| ProfileSettings · profil complet enregistré · 1500×900 et 1920×1080 | conforme : pastille, nom et choix de couleur dans l'en-tête (`ProfileSettings.svelte:212-228`), comme la maquette | — |
| ProfileSettings · liste de 3 profils réordonnée · 1500×900 et 1920×1080 | conforme (inchangé) | — |
| ProfileSettings · « Discard changes to profile Work? » · 1500×900 et 1920×1080 | conforme (Cancel, Discard, Save ; focus piégé) | — |

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (bloquant : New profile perd le brouillon) | levé | `ProfileSettings.svelte:99-104` (`startNew` passe par le dialogue quand `dirty`) et `:84-91`, `:124-132` (Discard et Save mènent au formulaire vide). `ProfileSettings.test.ts:181-234` : sans modification, dialogue, Cancel garde le brouillon, Discard ouvre le formulaire vide, Save enregistre puis l'ouvre. Les 100 tests passent. |
| 2 (mineur : pastille et couleur) | traité | `ProfileSettings.test.ts:254` ; code `:212-228` |
| 3 (mineur : focus piégé) | traité | `trapTab` (`:138-148`) ; test `ProfileSettings.test.ts:236` (Tab, Maj+Tab, focus échappé ramené dans le dialogue) |

## Problèmes
Aucun.

## Pour l'humain
RAS

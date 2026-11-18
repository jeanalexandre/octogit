**Verdict**

**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace, dont `commands::clone_state_tests` et les tests de `clone.rs` ; vitest : 31 fichiers, 357 tests) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e`, `pnpm tauri build`, `pnpm audit:deps` | non relancés : le correctif ne touche que `crates/git/src/clone.rs` et `src-tauri/src/commands.rs` (logique Rust, pas de manifeste). Le passage 1 avait déjà vu l'e2e du clone passer. |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| demarrer-un-depot CA-5 | couvert | Inchangé depuis le passage 1 (`Welcome.test.ts`, e2e `clone.spec.ts`). |
| demarrer-un-depot CA-11 | couvert | Inchangé (`src-tauri/tests/clone_ssh.rs`). |
| demarrer-un-depot CA-12 | couvert | `crates/git/src/clone.rs` : `…cancel_stops_the_clone_and_leaves_the_destination_absent`, `…cancel_keeps_an_existing_empty_destination_empty`, `…cancel_never_deletes_the_content_of_a_non_empty_destination`. La progression est prouvée par `parse_progress`, `clone_with` et le composant. |
| demarrer-un-depot CA-17 | couvert | Inchangé. |
| demarrer-un-depot CA-18 | couvert | Inchangé. |

## Interface
Aucun fichier d'interface (Svelte, CSS) n'a changé depuis le passage 1 pour ces correctifs : les lignes du passage 1 restent valables.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (bloquant, `Destination::restore` supprimait le contenu d'une destination non vide) | levé | `Destination` retient `non_empty` avant le clone, et `restore` rend la main sans rien toucher dans ce cas (`clone.rs:138-158`). Le test `…never_deletes_the_content_of_a_non_empty_destination` annule avec `&& true`. La fonction `cancelled` est lue avant `try_wait` à chaque tour de boucle, et `git` ne peut donc pas avoir refusé le dossier avant. L'ancien `restore` vidait ce dossier, donc le test échouerait : rouge par raisonnement, sans contre-épreuve exécutée. Les fichiers `mine.txt` et `sub/deep.txt` doivent rester intacts. Le cas « existait vide » reste couvert. |
| 2 (mineur, Cancel avant enregistrement du drapeau) | levé | `CloneState` mémorise `early_cancel`, que `begin()` applique au clone qui démarre. Le test `…a_cancel_before_the_flag_exists_applies_to_the_clone_that_starts` échouerait sans ce champ (drapeau initialisé à `false`). C'est un test unitaire direct de la fonction, sans dépendance à l'environnement : il vérifie son critère. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src-tauri/src/commands.rs:149-153` (`CloneState::cancel`) | Le correctif du mineur 2 a un effet de bord. Un Cancel reçu quand aucun clone ne tourne, par exemple un clic à la milliseconde où un clone se termine, laisse `early_cancel = true`. Le clone suivant démarre alors annulé, sans que l'utilisateur l'ait demandé. Aucune donnée perdue : le dossier revient à son état d'avant. La fenêtre est très courte. | Borner la validité du Cancel anticipé, par exemple en le remettant à zéro à la fin du `clone_repository` (`end()` le fait déjà, mais pas pour un Cancel arrivé après) ou en l'horodatant. Non bloquant. |

## Pour l'humain
- **à décider** : `ux/ecrans/welcome.md` dit « pas de clone sans profil » pour l'état vide, alors que la fiche et CA-17 gardent `Clone…` atteignable. Déjà noté dans les décisions de la fiche (en attente de `/ksm:ux`).
- **pour information** : le compteur « objets reçus / total » n'est toujours pas vu de bout en bout avec l'événement Tauri réel. Déjà accepté (test manuel sous `pnpm tauri dev`).

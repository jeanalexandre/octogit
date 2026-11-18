**Verdict**

**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace, dont les 2 tests de `commands::clone_state_tests`, puis vitest) | ✅ (code de sortie 0) |
| `pnpm lint` (clippy `-D warnings` et eslint) | ✅ |
| `pnpm format:check`, `pnpm e2e`, `pnpm tauri build`, `pnpm audit:deps` | non relancés : le passage 3 ne touche que `src-tauri/src/commands.rs` (logique Rust, pas de manifeste). |
| `git status` | Inchangé par ma revue. |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| demarrer-un-depot CA-5, CA-11, CA-17, CA-18 | couvert | Inchangés depuis le passage 2. |
| demarrer-un-depot CA-12 | couvert | Tests du passage 2 inchangés. Le Cancel anticipé est borné par le test `…a_stale_cancel_received_outside_any_clone_does_not_cancel_the_next_clone`, jugé ci-dessous. |

## Interface
Aucun fichier d'interface n'a changé depuis le passage 1. Les lignes du passage 1 restent valables.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur, un Cancel reçu hors de tout clone annulait le clone suivant) | levé | `CloneSlot.early_cancel` est maintenant un `Option<Instant>`. `begin_at` le consomme avec `.take()` et ne l'applique que si l'écart est `<= EARLY_CANCEL_WINDOW` (2 s). `end()` le remet aussi à `None`. |

## Jugement du test sans rouge constaté
`demarrer_un_depot_ca_12_a_stale_cancel_received_outside_any_clone_does_not_cancel_the_next_clone` vérifie son critère. Il appelle directement `cancel_at(t0)`, puis `begin_at(t0 + fenêtre + 1 ms)`, et exige que le drapeau soit `false`. Il ne dépend ni de l'horloge réelle ni de l'environnement. Avant le passage 3, `early_cancel` était un booléen sans borne de temps. Un Cancel hors clone aurait donc levé le drapeau du clone suivant, et l'assertion aurait échoué. Si on retire la comparaison à la fenêtre, ou si on la rend toujours vraie, il échoue aussi. Le rouge est établi par raisonnement, sans contre-épreuve exécutée. Il n'est pas bloquant. Le cas complémentaire (Cancel anticipé appliqué au clone qui démarre) reste couvert par `…a_cancel_before_the_flag_exists_applies_to_the_clone_that_starts`.

## Problèmes
Aucun.

## Pour l'humain
- **à décider** : `ux/ecrans/welcome.md` dit « pas de clone sans profil » pour l'état vide, alors que la fiche et CA-17 gardent `Clone…` atteignable. Déjà noté dans les décisions de la fiche (en attente de `/ksm:ux`).
- **pour information** : le compteur « objets reçus / total » n'est toujours pas vu de bout en bout avec l'événement Tauri réel. Déjà accepté (test manuel sous `pnpm tauri dev`).

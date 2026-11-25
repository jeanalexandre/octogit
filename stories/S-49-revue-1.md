**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm test:js src/App.test.ts src/lib/screens/Welcome.test.ts` | ✅ 22 tests |
| `pnpm test:rs -p octogit-platform` | ✅ 8 tests |
| `pnpm e2e e2e/git-absent.spec.ts e2e/launch.spec.ts` | ✅ 13 tests |
| Captures Playwright (script jetable, serveur arrêté, port 1420 libre) | ✅ |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| demarrer-un-depot CA-20 | couvert | Rust : `crates/platform/src/lib.rs`, tests `ca_20_*` (aucun `git` dans le `PATH` ; le shim d'Apple n'est jamais lancé, seul `xcode-select -p` est appelé). `src-tauri/src/launch.rs`, test `ca_20_*` (`GitMissing` sans lire de dépôt, y compris sans dépôt ou avec un dépôt introuvable). Composant : `Welcome.test.ts`. `App.test.ts` : ⌘O, ⌘⇧C et ⌘, sans effet. E2E : `git-absent.spec.ts` (CA-20 à 1500×900 et 1280×720, puis CA-5, CA-6 et CA-1), avec `xcodeSelectCalls()` vide. |
| demarrer-un-depot CA-21 | couvert | Rust : `ca_21_*` (`xcode-select --install` à chaque appel). `App.test.ts`, `Welcome.test.ts` et l'e2e CA-21 : un seul appel, état d'attente, les deux boutons affichés. |
| demarrer-un-depot CA-22 | couvert | E2E : second clic, `["--install","--install"]`, attente conservée. `App.test.ts` : 2 appels. |
| demarrer-un-depot CA-23 | couvert | `Welcome.test.ts` : minuterie à 2 s, arrêtée au démontage. Rust : `ca_23_*`. `App.test.ts` : « Check again ». E2E : un `git` apparaît pendant l'attente et `History` s'ouvre en moins de 5 s ; « Check again » avec Git absent puis présent ; reprise vers `Welcome` sans dernier dépôt. |
| demarrer-un-depot CA-25 | couvert | Rust : `ca_25_*` (versions 1.7.1, `Apple Git-154`, 9.99.0, aucun `--install`). `App.test.ts`, `Welcome.test.ts` et l'e2e CA-25 : aucun état Git. `launch.spec.ts` vert. |

Les tests sans rouge constaté prouvent leur critère : un appel au shim ou à `--install` ferait échouer les assertions sur `calls.log` et sur `xcodeSelectCalls()`. Sans la garde sur `gitMissing`, `chooseFolder` serait appelé.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| Welcome · Git not found · 1500×900 | conforme : textes exacts, un seul bouton avec icône, rien d'autre affiché | — |
| Welcome · Git not found · 1280×720 | conforme | — |
| Welcome · attente · 1500×900 | conforme : `role="status"`, « Check again » et « Install Command Line Tools » affichés | — |
| Welcome · attente · 1280×720 | conforme, rien ne déborde | — |
| Reprise vers History, Welcome normal, Git installé | conforme (e2e) | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/screens/Welcome.svelte` (états Git absent et attente) | Le bouton « Install Command Line Tools » est affiché en dessous de « Check again ». C'est un choix de disposition sans maquette. | Rien d'obligatoire. |

## Changement de `e2e/launch.spec.ts`
Le locator `.spacer` (`CommitGraph.svelte:416`, `role="list"`) restreint le comptage aux seules lignes du graphe. Le panneau de détail du commit sélectionné contient aussi des `listitem`, d'où les 4 au lieu de 3. L'assertion reste `toHaveCount(3)` avec le même contenu. Le test n'est pas affaibli, la correction est légitime.

## Pour l'humain
- **pour information** : la revérification toutes les 2 s appelle `recheck_git` (une commande synchrone). Tant que Git est absent elle ne lit aucun dépôt, donc le coût est négligeable. Elle s'exécute comme `get_launch_state`, déjà synchrone.

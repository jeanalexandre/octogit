# Revue S-55 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm --dir /Users/jaja/Dev/Perso/octogit test:rs -p octogit-git ca_1` (CA-14 de `push.rs` compris) | ✅ |
| `pnpm --dir /Users/jaja/Dev/Perso/octogit test:rs -p octogit-git a_failure_is_offline` (CA-5, classement) | ✅ |
| `pnpm --dir /Users/jaja/Dev/Perso/octogit test:rs -p octogit-app --test network_robustness` (7 tests) | ✅ |
| `pnpm --dir /Users/jaja/Dev/Perso/octogit test:js` sur App.busy, App, FetchStatus, PushButton, Welcome, DiffView, DiffViewWorking (82 tests), lancé 2 fois | ✅ stable |
| `pnpm --dir /Users/jaja/Dev/Perso/octogit e2e` sur offline, push-remote, busy-buttons, big-diff, git-absent (25 tests) | ✅ |
| Captures Playwright jetables, hors dépôt (3 scripts du scratchpad, serveur lancé puis arrêté par le script) | ✅ aucun processus restant, `git status` inchangé |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-5 | couvert | `crates/git/src/fetch.rs` (test `..._ca_5_a_failure_is_offline_...`) : 6 sorties réseau, le délai, et le refus de clé, qui n'est pas classé hors ligne. `src-tauri/tests/network_robustness.rs:126` vérifie `Offline` et que branches, `HEAD`, statut, refs distantes et `.git/config` sont identiques ; `:150` vérifie qu'un refus donne `Failed`. Les 3 tests de `FetchStatus.test.ts` vérifient le texte et le symbole, l'âge gardé et le retour à l'état normal. `e2e/offline.spec.ts` vérifie « ○ offline », le graphe cliquable, rien de changé, le retour à « fetched » et l'absence de « offline » sur un refus. |
| synchroniser CA-14 | couvert | `crates/git/src/push.rs` (3 tests CA-14) ; `network_robustness.rs:163`, `:183`, `:204` (garde calculé pour `backup`), `:230` ; `App.busy.test.ts:114` et `:136` ; `PushButton.test.ts` (liste, Échap, Cancel) ; `e2e/push-remote.spec.ts` |
| synchroniser CA-19 | couvert | `App.busy.test.ts:156`, `:176`, `:195` ; `e2e/busy-buttons.spec.ts` : un seul appel au faux `ssh` et aucun appel `push_repository` pendant le Fetch All. |
| preparer-un-commit CA-10 | couvert | `DiffView.test.ts`, `DiffViewWorking.test.ts` (5 000 affichées, 5 001 repliées), tests binaires de S-29 et S-31, `e2e/big-diff.spec.ts` |
| demarrer-un-depot CA-24 | couvert | `Welcome.test.ts`, `App.test.ts`, `network_robustness.rs:222`, `e2e/git-absent.spec.ts` (aux 2 tailles, reprise en moins de 5 s sans clic). Le test Welcome « revérification continue » passerait seul sur l'ancien code, mais l'e2e prouve la chaîne entière. |

## Interface
Tous les écrans et états listés par la fiche, aux deux tailles (1500×900 et 1280×720) : conformes à `ux.md` et aux maquettes. Écarts : liste des remotes (voir problème 2), diff replié (voir problème 3).

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | src/App.svelte:447-452 | Après un « offline », un échec qui n'est pas une coupure (refus de clé quand le réseau revient) ne remet pas `fetchOffline` à faux. `FetchStatus` continue donc d'afficher « offline — retrying every minute » alors que le réseau répond. | Sur un échec `failed`, remettre `fetchOffline = false`, ce qui revient à l'affichage d'avant S-55 (dernier âge gardé). |
| 2 | mineur | src/lib/components/PushButton.svelte:185 | Le bouton Cancel de la liste des remotes n'a pas d'icône. La fiche demande une icône Lucide devant chaque libellé de bouton. | Ajouter une icône (par exemple `X`, 16 px, trait 1,8). |
| 3 | mineur | src/lib/screens/DiffView.svelte:365-367 | Le bouton « Show diff » n'a pas d'icône (même règle). La maquette n'en montre pas non plus. | Ajouter une icône (par exemple `Eye`), ou garder tel quel si la maquette fait foi. |
| 4 | mineur | src-tauri/src/fetch.rs:462 | `push_repository_to` ne vérifie que l'existence du remote. Appelé sur une branche déjà suivie, ou dans un dépôt qui a `origin`, il remplacerait le suivi par `--set-upstream`. L'interface ne l'appelle jamais dans ces cas. | Refuser dans le cœur une branche déjà suivie, ou un dépôt avec `origin`, comme le fait `push_remote_choices`. |

## Pour l'humain
- **pour information** : avec plusieurs remotes, un Fetch All dont un seul remote est injoignable passe `FetchStatus` à « offline » même si les autres remotes ont été récupérés. Le classement « hors ligne » porte sur l'échec entier, pas sur chaque remote.

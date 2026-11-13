# Revue S-9 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` | ✅ hors bac à sable. Dans le bac à sable, les 11 tests de `src/livraison.test.ts`, que la story ne touche pas, échouent : `clang: error: unable to make temporary file: Operation not permitted` et `hdiutil` refusé. Tous passent hors bac à sable. Le test `only_the_profile_key_is_presented_whatever_the_agent_holds` passe dans les deux cas. |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e` | ✅ 94/94, dont les 4 tests de `e2e/connection.spec.ts` |
| `pnpm audit:deps` | ✅ 3 avertissements déjà autorisés, 1 exception déjà acceptée |
| `pnpm tauri build` | ✅ lancé hors bac à sable, car `hdiutil` y est refusé. `.app` et `.dmg` sont produits. |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| configurer-les-profils CA-8 | couvert | Rust `ok_answer_gives_the_account_even_though_ssh_exits_with_1` (ssh.rs:645). e2e `connection.spec.ts:28` aux 2 tailles, avec un texte exact. Vitest « Test connection teste la clé du profil… » : rouge prouvé hors dépôt. Sans le libellé « Test again » dans `ProfileForm.svelte:278`, ce test échoue. |
| configurer-les-profils CA-9 | partiel | `only_the_profile_key_is_presented_whatever_the_agent_holds` (ssh.rs:670). Il prouve bien `-i <clé Pro>`, `IdentitiesOnly=yes` et `IdentityAgent=none` par le journal : retirer une de ces options fait échouer une assertion explicite. En revanche, `-F none` manque toujours (décision 3), voir problème 1. |
| configurer-les-profils CA-10 | couvert | Rust `a_refusal_gives_test_failed_and_the_raw_output` (ssh.rs:703), `silence_gives_the_timeout_message_within_the_delay_and_stops_ssh` (ssh.rs:721, avec `TEST_TIMEOUT == 10 s`, utilisé par `commands.rs`). e2e `connection.spec.ts:50` et `:68` : Copy public key et Test again sont présents dans les deux cas. |

## Interface
Captures prises avec un script Playwright jetable. `pnpm dev:web` a été démarré par le script puis arrêté. Profil Pro avec sa clé, faux `ssh` réglé par l'adresse.

| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| ProfileSettings · test en cours · 1500×900 | conforme | — |
| ProfileSettings · test en cours · 1920×1080 | conforme | — |
| ProfileSettings · test OK · 1500×900 | conforme | — |
| ProfileSettings · test OK · 1920×1080 | conforme | — |
| ProfileSettings · test refusé · 1500×900 | conforme | 4, 5 |
| ProfileSettings · test refusé · 1920×1080 | conforme | 4, 5 |
| ProfileSettings · délai dépassé · 1500×900 | conforme | 5 |
| ProfileSettings · délai dépassé · 1920×1080 | conforme | 5 |

Aucun débordement horizontal aux deux tailles. Le ton est correct : anglais, impersonnel, sans « you ». Le focus visible vient du code (`ProfileForm.svelte:407`).

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | crates/identity/src/ssh.rs:342-347 | `-F none` n'est pas passé à `ssh`. Un `IdentityFile` déclaré pour github.com dans `~/.ssh/config` serait encore présenté, ce qui contredit CA-9. La décision 3 demande cet ajout à ce passage, avec un test qui le prouve. | Ajouter `-F none` aux arguments du test de connexion. Dans `only_the_profile_key_is_presented_whatever_the_agent_holds`, et dans l'e2e CA-8 qui relit le journal, vérifier que la ligne du faux `ssh` contient `-F none`. |
| 2 | bloquant | src/lib/screens/ProfileSettings.test.ts, test « changer de clé efface le résultat du test et ignore celui d'un test encore en cours » (dernière assertion) | Le test passe aussi sans le garde `if (!key \|\| key.path !== path) return;` (`ProfileForm.svelte:145`). Preuve hors dépôt, sur une copie avec ce garde retiré : 34/34 verts. `waitFor(...toBeEnabled())` est déjà vrai avant que la promesse résolue ne mette le DOM à jour, donc `queryByTestId(...)` est lu trop tôt. Avec une attente de 100 ms avant cette assertion, la même mutation échoue : le résultat de l'ancienne clé s'affiche bien. Par ailleurs, aucun résultat n'est affiché avant le changement de clé : la partie « efface le résultat » n'est pas exercée. | Attendre que la continuation de `testConnection` ait tourné avant d'affirmer l'absence de résultat, par exemple `await tick()` après `finish(...)` ou une attente explicite. Couvrir aussi le cas où un résultat est déjà affiché puis la clé change. Le test doit échouer si le garde ou la remise à zéro de l'`$effect` sont retirés. |
| 3 | bloquant | crates/identity/src/ssh.rs:286-294 | Il y a une course dans `Drop for PipedAskPass`. Si le fil écrivain n'a pas encore atteint son `open(O_WRONLY)`, `is_finished()` est faux. L'`open` en lecture-écriture du `Drop` est alors ouvert puis fermé aussitôt. Le fil ouvre le tube ensuite, s'y bloque pour toujours, et `writer.join()` ne rend jamais la main. Le test de connexion reste alors en « Testing… » sans limite, au-delà des 10 s. Reproduction fidèle hors dépôt : blocage à la 11e itération sur 200. Ce chemin est possible quand `ssh` échoue tout de suite avec une passphrase (spawn en échec, `try_wait` en erreur). Il n'a pas été reproduit sur 20 appels réels, mais c'est un défaut de concurrence. | Garder le descripteur ouvert en lecture-écriture pendant le `join`, par exemple `let _reader = open(rw); writer.join();`, pour que l'`open` du fil réussisse quel que soit son moment. Sinon, ouvrir côté écrivain en non bloquant avec une boucle bornée. Ajouter un test du chemin « `ssh` ne lit jamais la passphrase », par exemple un programme qui sort aussitôt, avec une limite de temps. |
| 4 | mineur | src/lib/components/ProfileForm.svelte:286 | La maquette, état « Error: connection refused », affiche le message brut en `mono` et la ligne d'aide « Public key not added on GitHub yet? ». Les deux sont absents. | Afficher le message brut en police mono et ajouter cette ligne d'aide à l'état refusé. |
| 5 | mineur | src/lib/components/ProfileForm.svelte:277-279 | Les boutons Test connection et Test again n'ont pas d'icône. `ux.md` (Icônes) demande une icône devant chaque libellé de bouton, et la maquette en montre une. | Ajouter l'icône de la maquette (prise) devant ces deux libellés. |
| 6 | mineur | src/lib/components/ProfileForm.svelte:277 | Le bouton passe à `disabled` pendant le test. Au clavier, le focus retombe sur `body` et n'est pas rendu après le résultat. | Garder le focus sur le bouton, par exemple avec `aria-disabled` et un garde dans le gestionnaire, ou le lui rendre à la fin du test. |
| 7 | mineur | crates/identity/src/ssh.rs:373 | Le délai de 10 s compte à partir du lancement de `ssh`, pas du clic : le message arrive légèrement après 10 s, ce qui dépasse le « au plus tard 10 s après le clic » de CA-10. | Compter le délai depuis l'entrée dans la commande, ou retrancher une petite marge. |
| 8 | mineur | crates/identity/src/ssh.rs:598-631 | Si l'agent de test ne démarre pas, `TestAgent` continue sans rien dire, et le test passe sans agent chargé d'une autre clé. | Signaler explicitement que l'agent est absent, par un message, ou documenter dans le test que la preuve repose seulement sur le journal. |
| 9 | mineur | crates/identity/src/ssh.rs:2-4 | Le commentaire du module dit encore que la passphrase passe par l'environnement du sous-processus. C'est faux pour le test de connexion, qui utilise un tube. | Mettre à jour le commentaire. |

## Pour l'humain
- **à décider** : en production, le test de connexion lance le `ssh` trouvé dans le `PATH`, pour que le faux `ssh` des tests puisse s'y placer. `stack.md` nomme `/usr/bin/ssh`. Lancé depuis un terminal (`pnpm tauri dev`), Octogit peut donc utiliser un autre OpenSSH, par exemple celui de Homebrew. Lancé depuis le Finder, c'est bien celui du système. Faut-il amender `stack.md` en même temps que les décisions 2 et 3 ?
- **pour information** : aucun bouton de `ProfileSettings` hérité de S-8 n'a l'icône que demande `ux.md` (Choose…, Generate ed25519…, Copy public key, Save, New profile). L'écart vient d'avant cette story. La disposition de l'écran (cartes, Matching rules) diffère aussi encore de la maquette, et cela vient aussi d'avant.

Preuves hors dépôt :
- copie de mutation : `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/mut1`
- scripts : `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/mutate.mjs`, `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/mutate-test.mjs`
- reproduction de la course : `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/fifo/src/main.rs`
- captures : `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/shots/`

`git status` n'a pas bougé.

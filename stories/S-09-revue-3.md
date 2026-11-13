# Revue S-9 : passage 3

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` | ✅ Lancé hors bac à sable. Rust tout vert, dont 28/28 dans `octogit-app` avec `the_delay_includes_a_slow_keychain_read` et 17/17 dans `octogit-identity`. Vitest : 169/169. |
| `pnpm e2e` | ✅ 94/94, dont les 4 tests de `e2e/connection.spec.ts` |
| `pnpm audit:deps` | ✅ 3 avertissements déjà autorisés, 1 exception déjà acceptée |
| `pnpm tauri build` | ✅ Lancé hors bac à sable, car `hdiutil` y est refusé |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| configurer-les-profils CA-8 | couvert | Le passage 2 a établi la preuve, et rien n'a changé dans `crates/identity/src/ssh.rs` depuis ; le fichier est identique à la copie de la revue 2, hors mutation. Test Rust `ok_answer_gives_the_account_even_though_ssh_exits_with_1`. Test e2e `connection.spec.ts:28` aux 2 tailles, vert. |
| configurer-les-profils CA-9 | couvert | Test Rust `only_the_profile_key_is_presented_whatever_the_agent_holds`. Son rouge a été prouvé au passage 2 sur une copie sans `-F none`. Le code n'a pas changé depuis. |
| configurer-les-profils CA-10 | couvert | Mêmes tests Rust, Vitest et e2e qu'au passage 2, tous verts. Nouveau test `the_delay_includes_a_slow_keychain_read` (src-tauri/src/ssh_keys.rs:223-243) : trousseau factice lent de 300 ms, délai de 600 ms, résultat attendu en moins de 850 ms. Son rouge est prouvé sur une copie hors dépôt : si l'échéance est calculée après la lecture du trousseau, il échoue avec « the delay restarted after the keychain read: 902.294125ms ». Sans mutation, il passe sur la copie, puis de nouveau dans le dépôt (0,62 s). |

## Interface
Le script Playwright jetable a démarré `pnpm dev:web` puis l'a arrêté ; aucun processus `vite` ne reste. Le test est déclenché au clavier : focus sur le bouton, puis Entrée. L'interface n'a pas changé depuis le passage 2, et les captures donnent le même rendu.

| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| ProfileSettings · test en cours · 1500×900 | conforme | — |
| ProfileSettings · test en cours · 1920×1080 | conforme | — |
| ProfileSettings · test OK · 1500×900 | conforme | — |
| ProfileSettings · test OK · 1920×1080 | conforme | — |
| ProfileSettings · test refusé · 1500×900 | conforme | — |
| ProfileSettings · test refusé · 1920×1080 | conforme | — |
| ProfileSettings · délai dépassé · 1500×900 | conforme | — |
| ProfileSettings · délai dépassé · 1920×1080 | conforme | — |

- **Test en cours :** « Testing the connection to github.com… » s'affiche.
- **Test OK :** « ✓ github.com: authenticated as @compte-pro » s'affiche.
- **Test refusé :** « Test failed: » est suivi du message brut en mono, puis de « Public key not added on GitHub yet? ». Copy public key et Test again sont présents.
- **Délai dépassé :** « No response from github.com after 10 s. » s'affiche, avec les mêmes boutons.
- **Focus :** il reste sur le bouton du test aux 4 états.
- **Débordement :** aucun débordement horizontal aux 2 tailles.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur) | levé | Le nouveau test `ssh_keys::tests::the_delay_includes_a_slow_keychain_read` (src-tauri/src/ssh_keys.rs:223) appelle `ssh_keys::test_connection` avec un trousseau lent et un faux `ssh` silencieux. Il échoue si l'échéance est calculée après la lecture du trousseau (902 ms mesurées, pour une limite de 850 ms). Il passe sur le code livré. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun | — |

## Pour l'humain
RAS

Preuves hors dépôt :
- **Mutation Rust :** la copie du workspace est dans `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/r3`. Le script est `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/r3mutate.mjs`, avec deux variantes : `late` (rouge) et `none` (vert).
- **Captures :** elles sont dans `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/shots3/`. Le script est `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/captures3.mjs`.

`git status` n'a pas bougé.

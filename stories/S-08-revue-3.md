# Revue S-8 : passage 3

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo : 27 + 27 + 10 + 1 + 32 + 1 ; vitest : 163 dans 21 fichiers) | ✅ |
| `pnpm e2e` (90 tests) | ✅ |
| `pnpm audit:deps` | ✅ (rien de nouveau : les 3 avertissements « unmaintained » ou « unsound » et l'avis ignoré étaient déjà admis) |
| `pnpm tauri build` (avec `pnpm check` : 0 erreur ; les 2 avertissements de `CommitGraph.svelte` existaient avant) | ✅ |
| Captures Playwright (script jetable du scratchpad, `pnpm dev:web` lancé puis arrêté par le script, `pgrep` sans vite ni pont ensuite) | ✅ |
| `git status` avant et après la revue | inchangé |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| configurer-les-profils CA-5 | couvert | `ssh_keys::tests::inspecting_a_key_gives_the_fingerprint_of_ssh_keygen` et `ssh::tests::the_fingerprint_is_the_one_ssh_keygen_gives` comparent le résultat à `/usr/bin/ssh-keygen -lf`. Les e2e `CA-5 : Choose…` le vérifient aux 2 tailles d'écran. |
| configurer-les-profils CA-6 | couvert | `generating_for_work_proposes_creates_and_the_profile_references_the_files` et `generating_over_an_existing_file_writes_nothing_and_names_it`. Les e2e CA-6 aussi, dont `e2e/profiles.spec.ts:223` et `:254`. Nouveau test vitest `une clé générée pendant un changement de profil n'est pas rattachée à l'autre profil` (`src/lib/screens/ProfileSettings.test.ts:392`). |
| configurer-les-profils CA-7 | couvert | `the_public_key_line_has_the_displayed_fingerprint`. L'e2e CA-7 compare l'empreinte de la ligne copiée, calculée par `ssh-keygen -lf`, à celle affichée. |
| configurer-les-profils CA-15 | couvert | `a_generated_passphrase_is_read_from_the_keychain_after_a_new_store_and_never_in_data_files` et l'e2e CA-15 (relance, aucune passphrase dans les données). |
| configurer-les-profils CA-16 | couvert | `a_protected_key_without_pub_asks_once_then_works_without_asking` et l'e2e CA-16. |

Les deux tests vitest ajoutés à ce passage n'ont pas de rouge constaté. J'ai lu l'ancien code : chacun aurait échoué dessus.
- `:392` : l'ancien `generate` écrivait `profile.sshKeyPath = view.path` dans le brouillon de Perso après l'`await`. Le champ aurait affiché `id_ed25519_pro`, ce que refusent les assertions des lignes 411 et 412.
- `:383` : l'ancien `tildify` affichait `/Users/Shared/keys/id_other` sous la forme `~/keys/id_other`. L'assertion `toHaveTextContent("/Users/Shared/keys/id_other")` aurait donc échoué.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| ProfileSettings · vide (Choose…, Generate ed25519…) · 1500×900 | conforme | — |
| ProfileSettings · vide · 1920×1080 | conforme | — |
| ProfileSettings · clé choisie (chemin, empreinte, Copy public key) · 1500×900 | conforme | — |
| ProfileSettings · clé choisie · 1920×1080 | conforme | — |
| ProfileSettings · Generate ed25519… (fichier proposé qui suit le Name) · 1500×900 | conforme | — |
| ProfileSettings · Generate ed25519… · 1920×1080 | conforme | — |
| ProfileSettings · fichier existant refusé · 1500×900 | conforme | — |
| ProfileSettings · fichier existant refusé · 1920×1080 | conforme | — |
| ProfileSettings · passphrase d'une clé sans `.pub` (et mauvaise passphrase) · 1500×900 | conforme | — |
| ProfileSettings · passphrase d'une clé sans `.pub` · 1920×1080 | conforme | — |
| ProfileSettings · Copy public key (« Copied ») · 1500×900 | conforme | — |
| ProfileSettings · Copy public key · 1920×1080 | conforme | — |

Ce que montrent les captures :
- **Generate ed25519…** : le Name est passé de « Pro » à « Work Two » pendant que le panneau était ouvert. Le fichier proposé a suivi (`…/id_ed25519_work_two`), et c'est bien ce fichier qui a été créé. Aucun `id_ed25519_pro` n'a été écrit.
- **Mise en page** : aucun débordement horizontal aux deux tailles.
- **Chemins des captures** : ils sont sous `/private/tmp/…`, et le segment `-Users-jaja-` au milieu n'est pas abrégé, car la regex est ancrée au début du chemin.

## Suivi de la revue précédente
La revue 2 n'avait aucun bloquant. Les 3 mineurs ont été traités :

| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur) | levé | `src/lib/components/ProfileForm.svelte:102-106` lit `profile.id` avant l'`await` et ignore le résultat si l'id a changé. Le test `ProfileSettings.test.ts:392` le prouve. Le cas résiduel (clé sur disque rattachée à aucun profil) est accepté par la décision 17. |
| 2 (mineur) | levé | `src/lib/sshKeys.ts:28` exclut `/Users/Shared` (et `/Users/Shared/…`), mais pas `/Users/Sharedxyz`. Le test `ProfileSettings.test.ts:383` le prouve. Les autres utilisateurs restent abrégés, ce qu'accepte la décision 16. |
| 3 (mineur) | levé | `.env.example:10-14` est aligné sur le README (ligne 64), sur `src-tauri/src/lib.rs:34-42` (défaut `~/.ssh`) et sur `src-tauri/examples/octogit-bridge.rs:91-98` (défaut `<données>/ssh`). Il dit aussi que la variable vaut pour `pnpm dev:web` et que `?ssh_dir` la remplace. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun | — |

## Pour l'humain
- RAS

# Revue S-8 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo : 26 + 27 + 10 + 1 + 32 + 1 ; vitest : 158) | ✅ |
| `pnpm e2e` (88 tests) | ✅ |
| `pnpm audit:deps` | ✅ (seulement des avertissements « unmaintained » ou « unsound » déjà admis, aucune vulnérabilité nouvelle) |
| `pnpm tauri build` (avec `pnpm check` : 0 erreur, 2 avertissements dans `CommitGraph.svelte`, qui existaient avant) | ✅ |
| Captures Playwright (script jetable, `pnpm dev:web` lancé puis arrêté par le script) | ✅ (Chromium tourne hors sandbox : dans le sandbox, la connexion au port Mach est refusée) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| configurer-les-profils CA-5 | couvert | `ssh_keys::tests::inspecting_a_key_gives_the_fingerprint_of_ssh_keygen` et `ssh::tests::the_fingerprint_is_the_one_ssh_keygen_gives` comparent le résultat à la sortie de `/usr/bin/ssh-keygen -lf`, lancé par le test lui-même ; e2e `CA-5 : Choose…` aux 2 tailles d'écran (chemin, et empreinte égale à `ws.fingerprintOf`). Ces tests échoueraient si l'empreinte était fausse. |
| configurer-les-profils CA-6 | partiel | `generating_for_work_proposes_creates_and_the_profile_references_the_files` (nom proposé, droits 600, `.pub`, `profiles.json`), `generating_over_an_existing_file_writes_nothing_and_names_it`, et les 2 e2e CA-6 : ils prouvent ce qu'ils vérifient. Mais le fichier affiché comme « proposé » peut différer du fichier réellement créé (problème 1). |
| configurer-les-profils CA-7 | couvert | `the_public_key_line_has_the_displayed_fingerprint` ; l'e2e CA-7 calcule l'empreinte de la ligne copiée avec `ssh-keygen -lf` et la compare à celle affichée (presse-papiers simulé, comme prévu par la fiche) |
| configurer-les-profils CA-15 | couvert | `a_generated_passphrase_is_read_from_the_keychain_after_a_new_store_and_never_in_data_files` : il échouerait sans passphrase dans le trousseau, car `needs_passphrase` vaudrait vrai. L'e2e CA-15 fait une relance, reconstruit le `.pub` par le faux trousseau et vérifie l'absence de la passphrase dans les données. Le test de connexion est hors périmètre (S-9). |
| configurer-les-profils CA-16 | couvert | `a_protected_key_without_pub_asks_once_then_works_without_asking` (mauvaise passphrase : rien n'est écrit ; bonne : `.pub` écrit, puis aucune nouvelle demande) ; e2e CA-16 (une seule demande, Copy, relance sans demande) |
| Décision 4 (trousseau livré) | couvert | `tests::the_application_always_uses_the_macos_keychain` échouerait si `passphrase_store()` rendait une autre implémentation. `the_fake_file_keychain_exists_only_in_the_test_bridge` est une recherche de texte dans le code source : c'est une garde faible, mais la garantie vient de la construction de `passphrase_store()`, `src-tauri/src/lib.rs:48`. |

Tests sans rouge constaté : ils échoueraient tous si leur critère n'était pas tenu, sauf les tests vitest CA-5 et CA-7. Ceux-là s'appuient sur des simulations et vérifient seulement le câblage de l'interface ; les e2e réels couvrent leur critère.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| ProfileSettings · vide (Choose…, Generate ed25519…) · 1500×900 | conforme | 4 |
| ProfileSettings · vide · 1920×1080 | conforme | 4 |
| ProfileSettings · clé choisie (chemin, empreinte, Copy public key) · 1500×900 | conforme | 5 |
| ProfileSettings · clé choisie · 1920×1080 | conforme | 5 |
| ProfileSettings · Generate ed25519… (fichier proposé) · 1500×900 | écart | 1 |
| ProfileSettings · Generate ed25519… · 1920×1080 | écart | 1 |
| ProfileSettings · fichier existant refusé · 1500×900 | conforme | — |
| ProfileSettings · fichier existant refusé · 1920×1080 | conforme | — |
| ProfileSettings · passphrase d'une clé sans `.pub` (et mauvaise passphrase) · 1500×900 | conforme | — |
| ProfileSettings · passphrase d'une clé sans `.pub` · 1920×1080 | conforme | — |
| ProfileSettings · Copy public key (« Copied ») · 1500×900 | conforme | — |
| ProfileSettings · Copy public key · 1920×1080 | conforme | — |

Aucun débordement horizontal ni chevauchement aux deux tailles. Le focus clavier est visible sur Choose… Les libellés sont reliés aux champs (`label for` sur `output` et sur les champs de mot de passe).

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/ProfileForm.svelte:68-86` | `openGenerate` fige `proposed` au clic, mais `generate()` renvoie `profile.name` tel qu'il est au moment de confirmer. Preuve : panneau ouvert avec Name vide (affiché `…/id_ed25519_profile`), puis Name = « Work » et Generate : le fichier créé est `id_ed25519_work`, alors que le panneau affichait toujours `id_ed25519_profile`. Même écart si on change de profil dans la liste pendant que le panneau est ouvert : `generating` et `proposed` ne sont pas remis à zéro. Le fichier confirmé n'est donc pas celui qui est écrit (CA-6 : « le fichier proposé est … quand je confirme, alors la clé … est créée »). | Le fichier affiché est toujours celui qui sera écrit : soit la proposition est recalculée à chaque changement de Name (ou le panneau se ferme), soit `generate` reçoit le nom figé à l'ouverture. Le panneau se ferme au changement de profil. Un test (vitest ou e2e) couvre « Name modifié panneau ouvert » et vérifie que le fichier créé est celui affiché. |
| 2 | bloquant | `src-tauri/examples/octogit-bridge.rs:92-99` et `.gitignore:4` | Le faux trousseau écrit les passphrases en clair dans `<data_dir>.keychain-fake.json`. Avec `pnpm dev:web` sans `?data_dir` (checkout principal, sans `.env.local`), `data_dir()` vaut `<repo>/.dev-data`. Le fichier est alors `<repo>/.dev-data.keychain-fake.json`, que Git n'ignore pas (`git check-ignore` ne renvoie que la règle `.dev-data/`, pour le chemin des créneaux). Une passphrase saisie dans l'interface de dev peut donc être commitée. Dans le même mode, sans `?ssh_dir`, le pont retombe sur le vrai `~/.ssh` (`ssh_dir()`, `src-tauri/src/lib.rs:35`), ce que la fiche exclut en test. | Les passphrases du faux trousseau ne peuvent jamais atterrir dans un chemin suivi par Git : fichier placé dans un dossier ignoré, ou motif `*.keychain-fake.json` ajouté à `.gitignore`. Le pont n'écrit jamais dans le vrai `~/.ssh` : sans `OCTOGIT_SSH_DIR`, il refuse les commandes qui écrivent, ou utilise un dossier temporaire. |
| 3 | mineur | `src-tauri/src/lib.rs:103-104` | `std::env::set_var` et `remove_var` sont appelés dans un test qui tourne en parallèle d'autres tests. Ces autres tests lisent l'environnement (`data_dir`, `ssh_dir`) et lancent des sous-processus (`ssh-keygen`). Sur macOS, `setenv` en concurrence avec `getenv` ou `fork` peut faire planter le test de façon aléatoire. Aucun échec observé sur 1 passage. | Vérifier la propriété sans modifier l'environnement du processus, par exemple en ne testant que `kind()`. Ou isoler ce test (sérialisation). |
| 4 | mineur | `src/lib/components/ProfileForm.svelte:154` | Dans l'état vide, la maquette (section 2) affiche « Choose in ~/.ssh… » ; l'implémentation affiche « Choose… », comme la spec CA-5 et la section 1. | Choisir un libellé et l'aligner, ou le signaler dans `ux.md`. |
| 5 | mineur | `src/lib/components/ProfileForm.svelte:151-153, 168` | Les chemins s'affichent en absolu (`/Users/…/.ssh/id_ed25519_work`) alors que la maquette et CA-6 écrivent `~/.ssh/id_ed25519_work`. Les longs chemins passent sur 4 lignes à côté des boutons. | Remplacer le dossier personnel par `~` à l'affichage (le chemin enregistré ne change pas). |

## Pour l'humain
- **pour information** : la persistance du vrai trousseau macOS après relance (CA-15 dans l'application livrée) n'est prouvée que par le test manuel décrit dans le README. Aucun test automatique ne l'exerce, comme `stack.md` le prévoit. Elle reste à faire avant de clore la valeur 2.
- **pour information** : la passphrase est transmise à `ssh-keygen` par une variable d'environnement du sous-processus, lue par un petit script temporaire (`SSH_ASKPASS`). Elle n'apparaît pas sur la ligne de commande. En revanche, un autre processus du même utilisateur peut la lire dans l'environnement pendant la courte durée de l'appel. S-9 réutilisera ce mécanisme pour la connexion SSH.
